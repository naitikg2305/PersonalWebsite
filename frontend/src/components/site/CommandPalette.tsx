'use client';

// ⌘K / Ctrl+K (or "/") palette: search every page on the site, or hand the query to the AI.
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { IndexItem } from '@/lib/siteIndex';
import { HiOutlineSearch } from 'react-icons/hi';
import { useChat } from './ChatProvider';

const KBD = 'rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-400';

const PaletteContext = createContext<{ openPalette: () => void }>({ openPalette: () => {} });
export const usePalette = () => useContext(PaletteContext);

function score(item: IndexItem, q: string): number {
  const title = item.title.toLowerCase();
  const hay = `${title} ${item.summary} ${item.category ?? ''} ${item.section}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  let s = 1;
  for (const w of words) {
    if (title.startsWith(w)) s += 6;
    else if (title.includes(w)) s += 3;
  }
  return s;
}

export default function CommandPalette({ index, children }: { index: IndexItem[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { ask } = useChat();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    const list = q
      ? index.map((i) => ({ i, s: score(i, q) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.i)
      : index.filter((i) => i.section !== 'Knowledge').concat(index.filter((i) => i.section === 'Knowledge').slice(0, 6));
    return list.slice(0, 12);
  }, [index, query]);

  // first row is always "Ask AI" when there's a query
  const rows: ({ kind: 'ask' } | { kind: 'page'; item: IndexItem })[] = [
    ...(query.trim() ? [{ kind: 'ask' as const }] : []),
    ...results.map((item) => ({ kind: 'page' as const, item })),
  ];

  const choose = (row: (typeof rows)[number]) => {
    setOpen(false);
    if (row.kind === 'ask') ask(query);
    else router.push(row.item.url);
  };

  return (
    <PaletteContext.Provider value={{ openPalette: () => setOpen(true) }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-[#00ff88]/30 bg-black/95 shadow-[0_0_30px_rgba(0,255,136,0.12)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Search the site"
          >
            <div className="flex items-center gap-3 border-b border-neutral-800 px-4">
              <HiOutlineSearch className="text-[#00ff88]" size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, rows.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === 'Enter' && rows[active]) {
                    e.preventDefault();
                    choose(rows[active]);
                  }
                }}
                placeholder="Search projects, jobs, notes… or ask a question"
                className="flex-1 bg-transparent py-4 font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
              />
              <kbd className={KBD}>esc</kbd>
            </div>
            <ul className="max-h-[55vh] overflow-y-auto p-2">
              {rows.map((row, idx) => (
                <li key={row.kind === 'ask' ? 'ask' : row.item.url}>
                  <button
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(row)}
                    className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left ${idx === active ? 'bg-[#00ff88]/10' : ''}`}
                  >
                    {row.kind === 'ask' ? (
                      <>
                        <span className="mt-0.5 font-mono text-[#00ff88]">✦</span>
                        <span>
                          <span className="font-mono text-neutral-100">ask ai: </span>
                          <span className="text-[#00ff88]">“{query}”</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="mt-0.5 w-20 shrink-0 font-mono text-[11px] uppercase tracking-wider text-neutral-500">{row.item.section}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[13.5px] text-neutral-100">{row.item.title}</span>
                          {row.item.summary && <span className="block truncate text-[12.5px] text-neutral-500">{row.item.summary}</span>}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
              {rows.length === 0 && <li className="px-3 py-6 text-center font-mono text-sm text-neutral-500">Type to search…</li>}
            </ul>
            <div className="flex gap-4 border-t border-neutral-800 px-4 py-2 font-mono text-[11px] text-neutral-500">
              <span><kbd className={KBD}>↑↓</kbd> move</span>
              <span><kbd className={KBD}>↵</kbd> open</span>
              <span><kbd className={KBD}>⌘K</kbd> toggle</span>
            </div>
          </div>
        </div>
      )}
    </PaletteContext.Provider>
  );
}

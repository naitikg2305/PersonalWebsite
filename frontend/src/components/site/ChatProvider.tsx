'use client';

// Global "ask ai" (ported from v2): the navbar button, the ⌘K palette and the floating button all
// open the same black panel, which drops down from under the navbar (and can be maximized to the
// full screen). The conversation is kept for the browser session (sessionStorage) and the last few
// turns are sent along as memory. Answers type out progressively, sources link to site pages, and
// each request's real backend trace is printed into the live background terminal.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HiChevronUp } from 'react-icons/hi';
import { HiArrowsPointingIn, HiArrowsPointingOut } from 'react-icons/hi2';
import type { IndexItem } from '@/lib/siteIndex';
import { liveLog } from '@/lib/liveLog';

const ACCENT = '#00ff88';
const STORE = 'askai:session';
const HISTORY = 6; // prior messages sent as memory

interface Source {
  title: string;
  source: string;
}
interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}
interface Trace {
  cold_start?: boolean;
  model?: string;
  retrieve_ms?: number;
  chunks?: number;
  keywords?: string[];
  bedrock_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_ms?: number;
  daily_count?: number | null;
  daily_cap?: number | null;
  capped?: boolean;
}
interface ChatContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  ask: (question: string) => void;
  toggle: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}

const SUGGESTIONS = [
  'What is Naitik working on right now?',
  'Show me his robotics projects',
  'How did he fix the audio on his laptop?',
  'What did he do at Zillion?',
];

// Print the real backend trace (returned by the Lambda) into the live background terminal.
function logTrace(status: number, roundTripMs: number, data: { trace?: Trace; sources?: Source[] }) {
  const t = data.trace;
  liveLog(status < 400 ? 'ok' : 'out', `HTTP ${status} · round trip ${roundTripMs} ms`);
  if (!t) return;
  liveLog('out', `lambda site-chatbot · ${t.cold_start ? 'cold start' : 'warm'} · total ${t.total_ms ?? '?'} ms`);
  if (t.capped) return liveLog('out', `daily cap reached (${t.daily_cap}) · bedrock not called`);
  if (t.daily_count != null) liveLog('out', `dynamodb site-chatbot-usage · today ${t.daily_count}/${t.daily_cap}`);
  liveLog('out', `chroma.query · ${t.chunks} chunks · ${t.retrieve_ms} ms${t.keywords?.length ? ` · keyword pass ${JSON.stringify(t.keywords)}` : ''}`);
  liveLog('out', `bedrock ${t.model?.replace(/^us\.anthropic\./, '')} · ${t.bedrock_ms} ms · ${t.input_tokens} tokens in / ${t.output_tokens} out`);
  if (data.sources?.length) liveLog('ok', `✓ grounded in ${data.sources.map((s) => s.source.split('/').slice(-1)[0]).join(', ')}`);
}

const chip = 'rounded-md border border-neutral-700 bg-black px-2.5 py-1 font-mono text-[12px] text-neutral-300 transition';

export default function ChatProvider({ index, children }: { index: IndexItem[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(0); // chars of the latest answer shown
  const [draft, setDraft] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [top, setTop] = useState(0); // bottom edge of the navbar the panel drops from
  const [navAsk, setNavAsk] = useState(false); // the navbar has its own ask bar → no floating button
  const isHome = usePathname() === '/'; // the homepage uses the navbar ask bar only (the button covered the boot's skip hint)
  const history = useRef<Message[]>([]);
  history.current = messages;

  // session memory: restore on load, save on every change
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? '[]');
      if (Array.isArray(saved) && saved.length) {
        setMessages(saved);
        setRevealed(Infinity); // don't re-type restored answers
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    const check = () => setNavAsk(!!document.querySelector('[data-site-nav]'));
    const later = () => setTimeout(check, 120); // the navbar mounts on the render after the scroll event
    check();
    window.addEventListener('scroll', later, { passive: true });
    return () => window.removeEventListener('scroll', later);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setTop(document.querySelector('[data-site-nav]')?.getBoundingClientRect().bottom ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // content path → page, so sources become links
  const pageForPath = useMemo(() => {
    const map = new Map<string, IndexItem>();
    index.forEach((item) => item.paths.forEach((p) => map.set(p, item)));
    return map;
  }, [index]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      setOpen(true);
      setDraft('');
      const prior = history.current.slice(-HISTORY).map(({ role, text }) => ({ role, text }));
      setMessages((m) => [...m, { role: 'user', text: q }]);
      setLoading(true);
      const started = performance.now();
      liveLog('cmd', `curl -X POST /api/chat -d '{"query": "${q.slice(0, 60)}"}'`);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, history: prior }),
        });
        const data = await res.json();
        logTrace(res.status, Math.round(performance.now() - started), data);
        setRevealed(0);
        setMessages((m) => [...m, { role: 'assistant', text: data.response ?? 'No response.', sources: data.sources ?? [] }]);
      } catch {
        setRevealed(0);
        setMessages((m) => [...m, { role: 'assistant', text: 'Something went wrong talking to the AI. Please try again.' }]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  // progressive reveal of the newest answer
  const latest = messages[messages.length - 1];
  useEffect(() => {
    if (latest?.role !== 'assistant' || revealed >= latest.text.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setRevealed((r) => (reduce ? latest.text.length : r + 6)), 12);
    return () => clearTimeout(t);
  }, [latest, revealed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, revealed, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <ChatContext.Provider value={{ open, setOpen, ask, toggle: () => setOpen((o) => !o) }}>
      {children}

      {/* floating button */}
      {!open && !navAsk && !isHome && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-md border bg-black/90 px-4 py-2.5 font-mono text-sm shadow-[0_0_16px_rgba(0,255,136,0.18)] backdrop-blur transition hover:bg-[#00ff8814]"
          style={{ color: ACCENT, borderColor: `${ACCENT}66` }}
          aria-label="Ask the AI about Naitik"
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: ACCENT }} /> ask ai
        </button>
      )}

      {/* drop-down panel: slides out from under the navbar (navbar z-index 1001 stays on top) */}
      <div className={`fixed inset-x-0 bottom-0 z-[1000] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} style={{ top }} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-x-0 top-0 flex flex-col border-b bg-black transition-all duration-300 ease-out ${open ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}
          style={{ height: maximized ? '100%' : 'min(62vh, 620px)', borderColor: `${ACCENT}44`, boxShadow: '0 18px 40px rgba(0,0,0,0.85)' }}
          role="dialog"
          aria-label="Ask the AI"
        >
          <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3">
            <div className="font-mono text-sm">
              <span style={{ color: ACCENT }}>naitik@ai</span>
              <span className="text-neutral-500">:~$ ask</span>
              {messages.length > 0 && <span className="ml-3 text-[11px] text-neutral-600"># {messages.filter((m) => m.role === 'user').length} in this session</span>}
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setRevealed(0); }} className="rounded border border-neutral-700 px-1.5 text-neutral-500 hover:text-white">
                  clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded border border-neutral-700 px-1.5 text-neutral-500 hover:text-white">
                esc
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-5 px-5 py-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="font-mono text-[13px] leading-relaxed text-neutral-400">
                  <span className="text-neutral-600"># </span>Ask anything about Naitik&apos;s work, projects, or the engineering notes on this site.
                  Answers come only from the site&apos;s own content, with sources.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className={`${chip} hover:border-[#00ff88] hover:text-[#00ff88]`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isLatest = i === messages.length - 1 && m.role === 'assistant';
              const text = isLatest ? m.text.slice(0, revealed) : m.text;
              const done = !isLatest || revealed >= m.text.length;
              return m.role === 'user' ? (
                <div key={i} className="font-mono text-sm text-neutral-100">
                  <span style={{ color: ACCENT }}>❯ </span>
                  {m.text}
                </div>
              ) : (
                <div key={i} className="rounded-lg border border-neutral-800 bg-[#0b0e0f] p-4">
                  <div className="text-[14.5px] leading-relaxed text-neutral-200 [&>*+*]:mt-3 [&_a]:text-[#00ff88] [&_code]:font-mono [&_code]:text-[#00ff88] [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:text-white [&_ul]:list-disc">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                    {!done && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse align-middle" style={{ background: ACCENT }} />}
                  </div>
                  {done && m.sources && m.sources.length > 0 && (
                    <div className="mt-4 border-t border-neutral-800 pt-3">
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">sources</div>
                      <div className="flex flex-wrap gap-2">
                        {m.sources.map((s) => {
                          const page = pageForPath.get(s.source);
                          return page ? (
                            <Link key={s.source} href={page.url} onClick={() => setOpen(false)} className={`${chip} hover:border-[#00ff88] hover:text-[#00ff88]`}>
                              {page.section} · {page.title}
                            </Link>
                          ) : (
                            <span key={s.source} className={chip}>{s.title}</span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 font-mono text-sm text-neutral-500">
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: ACCENT }} /> searching the site and thinking…
              </div>
            )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="mx-auto w-full max-w-3xl px-5 pb-6 pt-3"
          >
            <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-[#0b0e0f] px-3 focus-within:border-[#00ff88]">
              <span className="font-mono" style={{ color: ACCENT }}>❯</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={messages.length ? 'Ask a follow-up…' : 'Ask a question…'}
                maxLength={1000}
                className="flex-1 bg-transparent py-3 font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
              />
              <button type="submit" disabled={loading || !draft.trim()} className="font-mono text-xs disabled:opacity-40" style={{ color: ACCENT }}>
                enter ↵
              </button>
            </div>
          </form>

          {/* tab on the bottom edge: ↑ folds the panel back up into the navbar; the other button toggles full screen */}
          <div
            className={`absolute left-1/2 flex h-[24px] -translate-x-1/2 items-stretch overflow-hidden border bg-black ${maximized ? 'bottom-0 rounded-t-md border-b-0' : '-bottom-[24px] rounded-b-md border-t-0'}`}
            style={{ borderColor: `${ACCENT}44`, color: ACCENT }}
          >
            <button
              onClick={() => {
                setOpen(false);
                setMaximized(false);
              }}
              className="flex w-12 items-center justify-center transition hover:bg-[#00ff8814] hover:text-white"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <HiChevronUp size={17} />
            </button>
            <button
              onClick={() => setMaximized((m) => !m)}
              className="flex w-10 items-center justify-center border-l transition hover:bg-[#00ff8814] hover:text-white"
              style={{ borderColor: `${ACCENT}33` }}
              aria-label={maximized ? 'Exit full screen' : 'Full screen'}
              title={maximized ? 'Exit full screen' : 'Full screen'}
            >
              {maximized ? <HiArrowsPointingIn size={14} /> : <HiArrowsPointingOut size={14} />}
            </button>
          </div>
        </aside>
      </div>
    </ChatContext.Provider>
  );
}

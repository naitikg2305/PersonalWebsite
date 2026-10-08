'use client';

// The live background terminal, shared by the landing page (after the boot intro) and every
// other page (viewers, detail pages). Prints only real activity from this visitor's session:
// clicks, network requests (browser performance timing), sections entering view, and anything
// logged via liveLog() (e.g. the chatbot's backend trace).
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LogKind = 'cmd' | 'out' | 'ok' | 'bar' | 'dim';
export interface LogLine {
  kind: LogKind;
  text: string;
}

export const LOG_PREFIX: Record<LogKind, string> = { cmd: '$ ', out: '  ', ok: '  ', bar: '  ', dim: '# ' };
export const LOG_COLOR: Record<LogKind, string> = {
  cmd: 'text-[#3dff8c]',
  out: 'text-neutral-400',
  ok: 'text-emerald-300',
  bar: 'text-neutral-300',
  dim: 'text-neutral-600',
};

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} kB` : `${n} B`);
const shorten = (p: string) => (p.length > 64 ? `${p.slice(0, 30)}…${p.slice(-30)}` : p);

const NO_SECTIONS: string[] = []; // stable default: a fresh [] each render would re-run the effect (and re-print buffered requests) forever

/** Wire real browser activity into `push` while `active`. */
export function useLiveLog(
  active: boolean,
  push: (kind: LogKind, text: string) => void,
  { buffered = false, sections = NO_SECTIONS }: { buffered?: boolean; sections?: string[] } = {},
) {
  useEffect(() => {
    if (!active) return;

    // 1) anything on the page can log (chat traces etc.)
    const onLog = (e: Event) => {
      const { kind, text } = (e as CustomEvent<LogLine>).detail;
      push(kind, text);
    };
    window.addEventListener('livelog', onLog);

    // 2) real clicks
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest('a, button, input, textarea, [role="button"], h1, h2, h3, img, canvas') as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      const label = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || (el as HTMLInputElement).placeholder || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 48);
      const href = el.getAttribute('href');
      push('cmd', `click → <${tag}${href ? ` href="${href}"` : ''}>${label ? ` "${label}"` : ''}`);
    };
    document.addEventListener('click', onClick, true);

    // 3) real network requests (STL files, markdown, images, API calls…)
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          const url = new URL(entry.name, location.href);
          // skip framework internals (JS/CSS bundles, HMR); keep content, media, models and API calls
          if (/webpack-hmr|turbopack|hot-update|__nextjs|^\/_next\/static\//.test(url.pathname)) continue;
          const method = entry.initiatorType === 'fetch' && url.pathname.startsWith('/api/') ? 'POST' : 'GET';
          const status = (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus;
          const cached = entry.transferSize === 0 && entry.decodedBodySize > 0;
          const host = url.host === location.host ? '' : url.host;
          push(
            'out',
            `${method} ${host}${shorten(decodeURIComponent(url.pathname))}${status ? ` ${status}` : ''} · ${entry.initiatorType} · ${Math.max(0, Math.round(entry.duration))} ms · ${cached ? 'cache' : fmtBytes(entry.transferSize)}`,
          );
        }
      });
      observer.observe({ type: 'resource', buffered });
    } catch {}

    // 4) sections scrolling into view
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          const id = (en.target as HTMLElement).id;
          if (en.isIntersecting && id && !seen.has(id)) {
            seen.add(id);
            push('cmd', `cat ${id}.md`);
          }
        }),
      { threshold: 0.35 },
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    return () => {
      window.removeEventListener('livelog', onLog);
      document.removeEventListener('click', onClick, true);
      observer?.disconnect();
      io.disconnect();
    };
  }, [active, push, buffered, sections]);
}

/** Faint live terminal behind every page except the landing page (which has its own boot intro). */
export default function LiveBackdrop() {
  const pathname = usePathname();
  const [lines, setLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const push = useCallback((kind: LogKind, text: string) => setLines((l) => [...l.slice(-80), { kind, text }]), []);
  const isHome = pathname === '/';

  // a header line per page; client-side navigations keep the history, like a real shell
  useEffect(() => {
    if (isHome) return;
    const q = typeof window !== 'undefined' ? window.location.search : '';
    push('cmd', `open ${decodeURIComponent(pathname + q)}`);
  }, [pathname, isHome, push]);

  useLiveLog(!isHome, push, { buffered: true });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  if (isHome) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ opacity: 0.12 }}>
      <div ref={scrollRef} className="h-full overflow-hidden px-5 py-6 text-left font-mono text-[13px] leading-6 sm:px-8 sm:text-sm">
        <div className="flex min-h-full flex-col justify-end md:max-w-[60%]">
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${LOG_COLOR[l.kind]}`}>
              {LOG_PREFIX[l.kind]}
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

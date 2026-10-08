'use client';

// Landing intro: a fake-but-faithful deploy of this very site streams on a black screen,
// then the terminal dissolves into a faint, still-scrolling backdrop behind the page.
// Plays once per tab session; any key/click skips; reduced-motion users skip entirely.
import { useCallback, useEffect, useRef, useState } from 'react';

type Kind = 'cmd' | 'out' | 'ok' | 'bar' | 'dim';
interface Line {
  kind: Kind;
  text: string;
  pause?: number; // ms to wait after this line finishes
}

const SCRIPT: Line[] = [
  { kind: 'dim', text: 'naitikg.us deploy · us-east-1 · main@f00cd24', pause: 150 },
  { kind: 'cmd', text: 'git push origin main' },
  { kind: 'out', text: 'Enumerating objects: 94, done.  Writing objects: 100% (94/94)' },
  { kind: 'out', text: 'To github-personal:naitikg2305/PersonalWebsite.git   ca2adcf..f00cd24  main -> main', pause: 120 },
  { kind: 'cmd', text: 'cd frontend && next build' },
  { kind: 'out', text: '▲ Next.js 15.3.5   Creating an optimized production build ...' },
  { kind: 'ok', text: '✓ Compiled successfully   ✓ Generating static pages (15/15)', pause: 120 },
  { kind: 'cmd', text: 'python backend-chatbot/embed.py' },
  { kind: 'out', text: 'onnx all-MiniLM-L6-v2 · chunking 66 markdown files' },
  { kind: 'ok', text: '✓ Embedded 576 chunks → chroma_db', pause: 100 },
  { kind: 'cmd', text: 'docker build --platform linux/amd64 -t site-chatbot backend-chatbot' },
  { kind: 'bar', text: 'building image' },
  { kind: 'out', text: '=> COPY chatbot.py lambda_function.py ./   => COPY chroma_db ./chroma_db', pause: 80 },
  { kind: 'cmd', text: 'aws ecr push site-chatbot:f00cd24' },
  { kind: 'bar', text: 'pushing layers' },
  { kind: 'cmd', text: 'aws lambda update-function-code --function-name site-chatbot' },
  { kind: 'ok', text: '✓ LastUpdateStatus: Successful   role: site-chatbot-lambda (bedrock:InvokeModel)', pause: 80 },
  { kind: 'cmd', text: 'aws bedrock-runtime converse --model-id us.anthropic.claude-haiku' },
  { kind: 'ok', text: '✓ claude-haiku ready   daily cap: 300 · tokens metered', pause: 80 },
  { kind: 'cmd', text: 'amplify deploy --branch main' },
  { kind: 'ok', text: '✓ BUILD ✓ DEPLOY ✓ VERIFY   www.naitikg.us → cloudfront · tls ✓', pause: 220 },
  { kind: 'ok', text: '✔ deployed', pause: 300 },
  { kind: 'cmd', text: './naitik --init', pause: 450 },
];

const prefix: Record<Kind, string> = { cmd: '$ ', out: '  ', ok: '  ', bar: '  ', dim: '# ' };
const color: Record<Kind, string> = {
  cmd: 'text-[#3dff8c]',
  out: 'text-neutral-400',
  ok: 'text-emerald-300',
  bar: 'text-neutral-300',
  dim: 'text-neutral-600',
};

type Phase = 'boot' | 'dissolve' | 'backdrop';

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [lines, setLines] = useState<{ kind: Kind; text: string }[]>([]);
  const [typing, setTyping] = useState(''); // current command being typed
  const [bar, setBar] = useState(-1); // progress 0..100 of the current bar line
  const doneRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(
    (instant = false) => {
      if (doneRef.current) return;
      doneRef.current = true;
      try {
        sessionStorage.setItem('booted', '1');
      } catch {}
      if (instant) {
        setLines(SCRIPT.map(({ kind, text }) => ({ kind, text: kind === 'bar' ? `${text} [████████████████████] 100%` : text })));
        setTyping('');
        setBar(-1);
      }
      setPhase('dissolve');
      setTimeout(() => {
        setPhase('backdrop');
        onDone();
      }, instant ? 500 : 1400);
    },
    [onDone],
  );

  // run the script
  useEffect(() => {
    let skipped = false;
    try {
      skipped = sessionStorage.getItem('booted') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (skipped) {
      finish(true);
      return;
    }

    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (const line of SCRIPT) {
        if (cancelled || doneRef.current) return;
        if (line.kind === 'cmd') {
          for (let i = 1; i <= line.text.length; i++) {
            if (cancelled || doneRef.current) return;
            setTyping(line.text.slice(0, i));
            await sleep(9);
          }
          setTyping('');
        } else if (line.kind === 'bar') {
          for (let p = 0; p <= 100; p += 5) {
            if (cancelled || doneRef.current) return;
            setBar(p);
            await sleep(16);
          }
          setBar(-1);
        } else {
          await sleep(55);
        }
        if (cancelled || doneRef.current) return; // StrictMode re-runs effects in dev: never append from a stale run
        const text = line.kind === 'bar' ? `${line.text} [████████████████████] 100%` : line.text;
        setLines((l) => [...l, { kind: line.kind, text }]);
        if (line.pause) await sleep(line.pause);
      }
      if (!cancelled) finish();
    })();

    const skip = () => finish(true);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [finish]);

  // live mode: only real activity from this visitor's session prints from here on
  useEffect(() => {
    if (phase !== 'backdrop') return;
    const push = (kind: Kind, text: string) => setLines((l) => [...l.slice(-80), { kind, text }]);
    push('dim', 'live · this session\'s clicks, network requests and AI calls print here');

    // 1) anything on the page can log (chat traces etc.)
    const onLog = (e: Event) => {
      const { kind, text } = (e as CustomEvent<{ kind: Kind; text: string }>).detail;
      push(kind, text);
    };
    window.addEventListener('livelog', onLog);

    // 2) real clicks
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest('a, button, input, textarea, [role="button"], h1, h2, h3, img') as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      const label = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || (el as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 48);
      const href = el.getAttribute('href');
      push('cmd', `click → <${tag}${href ? ` href="${href}"` : ''}>${label ? ` "${label}"` : ''}`);
    };
    document.addEventListener('click', onClick, true);

    // 3) real network requests, from the browser's own performance timing
    const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} kB` : `${n} B`);
    const shorten = (p: string) => (p.length > 64 ? `${p.slice(0, 30)}…${p.slice(-30)}` : p);
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          const url = new URL(entry.name, location.href);
          if (/webpack-hmr|turbopack|hot-update|__nextjs|_next\/static\/development/.test(url.pathname)) continue;
          const method = entry.initiatorType === 'fetch' && url.pathname.startsWith('/api/') ? 'POST' : 'GET';
          const status = (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus;
          const cached = entry.transferSize === 0 && entry.decodedBodySize > 0;
          const host = url.host === location.host ? '' : url.host;
          push(
            'out',
            `${method} ${host}${shorten(url.pathname)}${status ? ` ${status}` : ''} · ${entry.initiatorType} · ${Math.round(entry.duration)} ms · ${cached ? 'cache' : fmtBytes(entry.transferSize)}`,
          );
        }
      });
      observer.observe({ type: 'resource', buffered: false });
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
    document.querySelectorAll('[id]').forEach((el) => {
      if (['about', 'featured', 'experience', 'education', 'chat'].includes(el.id)) io.observe(el);
    });

    return () => {
      window.removeEventListener('livelog', onLog);
      document.removeEventListener('click', onClick, true);
      observer?.disconnect();
      io.disconnect();
    };
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, typing, bar]);

  // inline styles: the dissolve values must always apply (no reliance on generated utility classes)
  const layer: React.CSSProperties =
    phase === 'boot'
      ? { zIndex: 3000, backgroundColor: '#000', opacity: 1, filter: 'none' }
      : {
          zIndex: phase === 'dissolve' ? 3000 : -1,
          backgroundColor: 'transparent',
          opacity: 0.5, // constant 50%: content sits on solid black panels above it
          filter: 'none',
        };

  return (
    <div
      aria-hidden={phase !== 'boot'}
      className="pointer-events-none fixed inset-0"
      style={{
        ...layer,
        transition:
          phase === 'backdrop'
            ? 'opacity 0.15s linear, filter 0.15s linear' // follow the scroll closely
            : 'opacity 1.4s ease-out, filter 1.4s ease-out, background-color 1.4s ease-out',
      }}
    >
      <div ref={scrollRef} className="h-full overflow-hidden px-5 py-6 text-left font-mono text-[13px] leading-6 sm:px-8 sm:text-sm">
        <div className="flex min-h-full flex-col justify-end md:max-w-[56%]">
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${color[l.kind]}`}>
              {prefix[l.kind]}
              {l.text}
            </div>
          ))}
          {typing && (
            <div className="whitespace-pre-wrap break-all text-[#3dff8c]">
              $ {typing}
              <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#3dff8c]" />
            </div>
          )}
          {bar >= 0 && (
            <div className="text-neutral-300">
              {'  '}[{'█'.repeat(Math.round(bar / 5)).padEnd(20, '░')}] {bar}%
            </div>
          )}
        </div>
      </div>
      {phase === 'boot' && (
        <div className="pointer-events-none absolute bottom-5 right-6 font-mono text-xs text-neutral-600">press any key to skip</div>
      )}
    </div>
  );
}

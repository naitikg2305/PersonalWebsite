'use client';

// Landing intro: a fake-but-faithful deploy of this very site streams on a black screen,
// then the terminal dissolves into a faint, still-scrolling backdrop behind the page.
// Plays once per tab session; any key/click skips; reduced-motion users skip entirely.
// The log keeps going after the deploy: `./naitik --init` draws "NAITIK GUPTA" in big Unicode block
// letters (built column by column, in the same log), types the tagline, then `cat about.md` types the
// About text below it, then points you to scroll. It all stays in the log, like one terminal session.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveLog } from './LiveLog';

const HOME_SECTIONS = ['timeline', 'about', 'featured', 'experience', 'education', 'chat'];

type Kind = 'cmd' | 'out' | 'ok' | 'bar' | 'dim' | 'about' | 'banner' | 'tagline';
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

const prefix: Record<Kind, string> = { cmd: '$ ', out: '  ', ok: '  ', bar: '  ', dim: '# ', about: '', banner: '', tagline: '' };

// "ANSI Shadow" figlet glyphs: the banner is rendered from these, not stored as a picture
const GLYPHS: Record<string, string[]> = {
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  K: ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
  G: [' ██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  P: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
};
const figlet = (word: string) => GLYPHS.N.map((_, row) => [...word].map((ch) => GLYPHS[ch][row]).join(' '));
// two words stacked, so the letters can be big and still fit the left pane
const BANNER = [...figlet('NAITIK'), '', ...figlet('GUPTA')];
const BANNER_W = Math.max(...BANNER.map((l) => l.length));
const TAGLINE = 'Decode the world to build it better.';

// about.md → plain terminal text (no heading, no markdown emphasis)
const plain = (md: string) =>
  md
    .replace(/^#.*\n+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
const color: Record<Kind, string> = {
  cmd: 'text-[#3dff8c]',
  out: 'text-neutral-400',
  ok: 'text-emerald-300',
  bar: 'text-neutral-300',
  dim: 'text-neutral-600',
  about: 'text-neutral-400',
  banner: 'text-[#3dff8c]',
  tagline: 'text-[#3dff8c]',
};

type Phase = 'boot' | 'dissolve' | 'backdrop';

/** Big block letters; size scales with the viewport so the stacked words fill the left pane (BANNER_W columns). */
function Banner({ lines }: { lines: string[] }) {
  return (
    <pre
      aria-label="Naitik Gupta"
      className="my-2 font-mono font-bold text-[#3dff8c] text-[min(3.2vw,22px)] md:text-[min(1.8vw,22px)]"
      style={{ lineHeight: 1, textShadow: '0 0 12px rgba(61,255,140,0.55)' }}
    >
      {lines.join('\n')}
    </pre>
  );
}

export default function BootSequence({ onDone, onIntro }: { onDone: () => void; onIntro?: () => void }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [lines, setLines] = useState<{ kind: Kind; text: string }[]>([]);
  const [typing, setTyping] = useState(''); // current command being typed
  const [bar, setBar] = useState(-1); // progress 0..100 of the current bar line
  const doneRef = useRef(false);
  const [scroll, setScroll] = useState(0);
  const [focus, setFocus] = useState(0); // 0..1: how much of the timeline section is on screen

  // dim the log while the timeline / git graph is in view, so they read cleanly
  useEffect(() => {
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(e.target.id, e.intersectionRatio));
        setFocus(Math.min(1, Math.max(0, ...ratios.values()) / 0.5)); // full dim once ~half is visible
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    ['timeline', 'gitgraph'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  // live mode: only real activity from this visitor's session prints from here on (shared with LiveBackdrop)
  // keep the last 80 lines, but the About block always stays
  const pushLive = useCallback(
    (kind: Kind, text: string) => setLines((l) => [...l.filter((x, i) => x.kind === 'about' || i >= l.length - 80), { kind, text }]),
    [],
  );

  // the intro, continuing the same log: banner → tagline → cat about.md → scroll hint
  const [about, setAbout] = useState<string | null>(null); // About pane text (typed progressively)
  const [bannerCols, setBannerCols] = useState(-1); // columns of the banner drawn so far (-1 = not yet)
  const introStarted = useRef(false);
  // latched once the boot script ends; the dissolve → backdrop change must not restart the intro
  const introGo = phase !== 'boot';
  useEffect(() => {
    if (!introGo || introStarted.current) return; // runs on straight from the boot script
    introStarted.current = true;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let instant = false;
    try {
      instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    const type = async (text: string, ms: number) => {
      for (let i = 1; i <= text.length && !cancelled; i++) {
        setTyping(text.slice(0, i));
        if (!instant) await sleep(ms);
      }
      setTyping('');
    };
    const add = (kind: Kind, text: string) => setLines((l) => [...l, { kind, text }]);
    (async () => {
      const aboutText = fetch('/content/about/about.md').then((r) => r.text()).then(plain);
      // `./naitik --init` (the boot script's last line) prints the banner, built left to right
      for (let c = 0; c <= BANNER_W && !cancelled; c += instant ? BANNER_W : 1) {
        setBannerCols(c);
        if (!instant) await sleep(24);
      }
      if (cancelled) return;
      setBannerCols(-1);
      add('banner', BANNER.join('\n'));
      if (!instant) await sleep(200);
      for (let i = 1; i <= TAGLINE.length && !cancelled; i++) {
        setTagline(TAGLINE.slice(0, i));
        if (!instant) await sleep(38);
      }
      if (cancelled) return;
      setTagline(null);
      add('tagline', TAGLINE);
      if (!instant) await sleep(400);
      await type('cat about.md', 40);
      if (cancelled) return;
      add('cmd', 'cat about.md');
      const text = await aboutText;
      for (let i = instant ? text.length : 0; i <= text.length && !cancelled; i += 3) {
        setAbout(text.slice(0, i));
        if (!instant) await sleep(10);
      }
      if (cancelled) return;
      setAbout(null);
      add('about', text);
      if (!instant) await sleep(300);
      add('dim', 'scroll ⌄ to see the git log');
      setIntroDone(true);
      onIntro?.();
    })().catch(() => {});
    return () => {
      cancelled = true;
      introStarted.current = false;
    };
  }, [introGo, onIntro]);
  const [tagline, setTagline] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false); // live activity starts printing after the intro
  useEffect(() => {
    if (phase === 'backdrop' && introDone) pushLive('dim', "live · this session's clicks, network requests and AI calls print here");
  }, [phase, introDone, pushLive]);
  useLiveLog(phase === 'backdrop' && introDone, pushLive, { sections: HOME_SECTIONS });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, typing, bar, about, bannerCols, tagline]);

  // inline styles: the dissolve values must always apply (no reliance on generated utility classes)
  const fade = Math.min(1, scroll / (typeof window === 'undefined' ? 800 : window.innerHeight * 0.9)); // 0 at top → 1 after ~a screen
  const layer: React.CSSProperties =
    phase === 'boot'
      ? { zIndex: 3000, backgroundColor: '#000', opacity: 1, filter: 'none' }
      : {
          zIndex: phase === 'dissolve' ? 3000 : -1,
          backgroundColor: 'transparent',
          // full while the name shows; fades 75% (→ 0.25) as you scroll; dips to 0.05 over the timeline
          opacity: (1 - 0.75 * fade) * (1 - focus) + 0.05 * focus,
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
          {lines.map((l, i) =>
            l.kind === 'banner' ? (
              <Banner key={i} lines={BANNER} />
            ) : l.kind === 'tagline' ? (
              <div key={i} className="mb-3 mt-1 text-base font-semibold text-[#3dff8c] sm:text-lg" style={{ textShadow: '0 0 10px rgba(61,255,140,0.6)' }}>
                {l.text}
              </div>
            ) : l.kind === 'about' ? (
              <div key={i} className={`my-1 whitespace-pre-wrap break-words ${color.about}`}>
                {l.text}
              </div>
            ) : (
              <div key={i} className={`whitespace-pre-wrap break-all ${color[l.kind]}`}>
                {prefix[l.kind]}
                {l.text}
              </div>
            ),
          )}
          {bannerCols >= 0 && <Banner lines={BANNER.map((l) => l.slice(0, bannerCols))} />}
          {tagline !== null && (
            <div className="mb-3 mt-1 text-base font-semibold text-[#3dff8c] sm:text-lg" style={{ textShadow: '0 0 10px rgba(61,255,140,0.6)' }}>
              {tagline}
              <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#3dff8c]" />
            </div>
          )}
          {about !== null && (
            <div className={`my-1 whitespace-pre-wrap break-words ${color.about}`}>
              {about}
              <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#3dff8c]" />
            </div>
          )}
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

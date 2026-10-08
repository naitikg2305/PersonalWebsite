'use client';

// Career + projects as a git graph: `main` is the career (jobs, education, milestones); each
// project branches off where it started and merges back when it finished (ongoing ones run to
// "today"). Time is proportional. ≥1280px: horizontal SVG. Smaller: a `git log --graph` list.
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type Kind = 'software' | 'hardware' | 'ai';
interface MainCommit {
  date: string; // YYYY-MM
  label: string;
  href?: string;
}
interface Branch {
  name: string;
  start: string; // YYYY-MM
  end?: string; // YYYY-MM; omitted = ongoing
  kinds: Kind[];
  href?: string;
}

const MAIN: MainCommit[] = [
  { date: '2021-08', label: 'UMD · B.S. CompE', href: '/education/UMD' },
  { date: '2022-08', label: 'Engineering IT · SDE', href: '/experience/engineering-it' },
  { date: '2024-05', label: 'EIT Lead', href: '/experience/engineering-it' },
  { date: '2024-06', label: 'Zillion intern', href: '/experience/zillion' },
  { date: '2025-05', label: 'Graduated', href: '/education/UMD' },
  { date: '2025-06', label: 'Zillion AI intern', href: '/experience/zillion' },
  { date: '2025-10', label: 'Zillion AI Engineer', href: '/experience/zillion' },
  { date: '2026-01', label: 'Minfy AI Engineer', href: '/experience/minfy-technologies' },
  { date: '2026-09', label: 'Hackathon 2nd · Solutions Architect', href: '/experience/minfy-technologies' },
];

const BRANCHES: Branch[] = [
  { name: 'autonomous-rover', start: '2021-08', end: '2021-12', kinds: ['hardware'], href: '/projects/autonomous-rover' },
  { name: 'gsm-iot-research', start: '2023-05', end: '2024-05', kinds: ['hardware'] },
  { name: 'quintacle', start: '2024-01', kinds: ['ai', 'software'], href: '/projects/quintacle' },
  { name: 'navigatr', start: '2025-01', end: '2025-05', kinds: ['hardware', 'ai'], href: '/projects/NaviGatr' },
  { name: 'self-balancing-robot', start: '2025-04', end: '2025-05', kinds: ['hardware'], href: '/projects/self-balance' },
  { name: 'naitikg.us', start: '2025-07', kinds: ['software', 'ai'], href: '/projects/website' },
  { name: 'peoplelens', start: '2026-07', end: '2026-09', kinds: ['ai', 'software'], href: '/projects/peoplelens' },
  { name: 'local-chat', start: '2026-08', end: '2026-09', kinds: ['ai', 'software'], href: '/projects/local-chat' },
  { name: 'llm-eval-toolkit', start: '2026-10', kinds: ['ai', 'software'], href: '/projects/llm-eval-toolkit' },
];

const COLOR: Record<Kind, string> = { software: '#8ab4f8', hardware: '#f6c26b', ai: '#c58af9' };
const MAIN_COLOR = '#00ff88';
const START = '2021-06';

const months = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const [sy, sm] = START.split('-').map(Number);
  return (y - sy) * 12 + (m - sm);
};
const nowYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fmt = (ym?: string) => {
  if (!ym) return 'now';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

// SVG geometry (viewBox units; the SVG scales to the container width)
const W = 1200;
const PAD_L = 20;
const PAD_R = 120;
const Y_MAIN = 118;
const LANE_GAP = 40;
const FIRST_LANE = Y_MAIN + 56;

export default function GitGraph() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const now = nowYM();
  const total = months(now) + 1;
  const x = (ym: string) => PAD_L + (months(ym) / total) * (W - PAD_L - PAD_R);
  const xNow = x(now) + 18;

  // greedy lane assignment so branches never overlap in time
  const placed = useMemo(() => {
    const laneEnds: number[] = [];
    return BRANCHES.map((b) => {
      const s = months(b.start);
      const e = months(b.end ?? now) + 3; // a little breathing room after a merge
      let lane = laneEnds.findIndex((end) => end < s);
      if (lane === -1) lane = laneEnds.push(e) - 1;
      else laneEnds[lane] = e;
      return { ...b, lane };
    });
  }, [now]);
  const lanes = Math.max(...placed.map((p) => p.lane)) + 1;
  const H = FIRST_LANE + lanes * LANE_GAP + 10;
  const years = Array.from({ length: Number(now.slice(0, 4)) - 2021 }, (_, i) => 2022 + i);

  const visible = (b: Branch) => filter === 'all' || b.kinds.includes(filter);
  const go = (href?: string) => href && router.push(href);

  // list for small screens: everything in time order
  const list = [
    ...MAIN.map((c) => ({ date: c.date, text: c.label, href: c.href, main: true as const, kinds: [] as Kind[] })),
    ...BRANCHES.map((b) => ({ date: b.start, text: `${b.name}  (${fmt(b.start)} → ${fmt(b.end)})`, href: b.href, main: false as const, kinds: b.kinds })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section id="gitgraph" style={{ margin: '0 2rem 3rem' }}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="inline-block rounded-md border border-[#00ff00]/40 bg-black px-3 py-1.5 font-mono text-[#00ff00] shadow-[0_0_12px_rgba(0,255,0,0.15)]">
          $ git log --graph --all <span className="text-neutral-500"># career on main, projects on branches</span>
        </p>
        <div className="flex gap-2 rounded-md bg-black p-1">
          {(['all', 'software', 'hardware', 'ai'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded px-2.5 py-1 font-mono text-[11px] transition"
              style={{
                color: f === 'all' ? MAIN_COLOR : COLOR[f],
                background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${filter === f ? (f === 'all' ? MAIN_COLOR : COLOR[f]) + '88' : 'transparent'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── ≥1280px: horizontal graph ──────────────────────────────────── */}
      <div className="mt-6 hidden xl:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Career and projects as a git graph">
          {/* year grid */}
          {years.map((y) => (
            <g key={y}>
              <line x1={x(`${y}-01`)} x2={x(`${y}-01`)} y1={8} y2={H} stroke="rgba(255,255,255,0.07)" />
              <text x={x(`${y}-01`) + 4} y={H - 4} fill="#5c6b64" fontSize="10" fontFamily="monospace">{y}</text>
            </g>
          ))}

          {/* branches */}
          {placed.map((b) => {
            const y = FIRST_LANE + b.lane * LANE_GAP;
            const x0 = x(b.start);
            const x1 = b.end ? x(b.end) : xNow;
            const c = COLOR[b.kinds[0]];
            const on = visible(b);
            const curve = 14;
            const d = b.end
              ? `M${x0},${Y_MAIN} C${x0},${y} ${x0},${y} ${x0 + curve},${y} L${Math.max(x0 + curve, x1 - curve)},${y} C${x1},${y} ${x1},${y} ${x1},${Y_MAIN}`
              : `M${x0},${Y_MAIN} C${x0},${y} ${x0},${y} ${x0 + curve},${y} L${x1},${y}`;
            return (
              <g
                key={b.name}
                opacity={on ? 1 : 0.15}
                style={{ cursor: b.href ? 'pointer' : 'default', transition: 'opacity .3s' }}
                onClick={() => go(b.href)}
              >
                <title>{`${b.name} · ${fmt(b.start)} → ${fmt(b.end)}`}</title>
                <path d={d} fill="none" stroke={c} strokeWidth="2.2" style={{ filter: `drop-shadow(0 0 3px ${c}66)` }} />
                {!b.end && <path d={`M${x1},${y - 5} L${x1 + 8},${y} L${x1},${y + 5} Z`} fill={c} />}
                <circle cx={x0 + curve + 2} cy={y} r="4" fill="#000" stroke={c} strokeWidth="2" />
                {b.end && <circle cx={Math.max(x0 + curve + 2, x1 - curve - 2)} cy={y} r="4" fill="#000" stroke={c} strokeWidth="2" />}
                {(() => {
                  const lw = b.name.length * 6.6 + 10;
                  const lx = x0 + curve + 10 + lw > W - 8 ? x0 - lw - 6 : x0 + curve + 10;
                  return (
                    <>
                      <rect x={lx} y={y - 21} width={lw} height="15" rx="3" fill="#000" opacity="0.85" />
                      <text x={lx + 5} y={y - 10} fill={c} fontSize="11" fontFamily="monospace">{b.name}</text>
                    </>
                  );
                })()}
              </g>
            );
          })}

          {/* main */}
          <line x1={PAD_L - 10} x2={xNow} y1={Y_MAIN} y2={Y_MAIN} stroke={MAIN_COLOR} strokeWidth="3" style={{ filter: `drop-shadow(0 0 4px ${MAIN_COLOR}88)` }} />
          <path d={`M${xNow},${Y_MAIN - 6} L${xNow + 10},${Y_MAIN} L${xNow},${Y_MAIN + 6} Z`} fill={MAIN_COLOR} />
          <text x={xNow + 14} y={Y_MAIN + 4} fill={MAIN_COLOR} fontSize="11" fontFamily="monospace">today</text>
          <text x={PAD_L - 10} y={Y_MAIN + 20} fill={MAIN_COLOR} fontSize="10" fontFamily="monospace" opacity="0.7">main</text>
          {MAIN.map((c, i) => {
            const cx = x(c.date);
            const level = i % 3; // stagger labels so close commits don't collide
            const ly = Y_MAIN - 18 - level * 26;
            const w = c.label.length * 6.4 + 10;
            const right = cx + w / 2 > W - 8; // would clip on the right → hang the label to the left
            const rx = right ? cx - w + 12 : cx - w / 2;
            return (
              <g key={c.label} style={{ cursor: c.href ? 'pointer' : 'default' }} onClick={() => go(c.href)}>
                <title>{`${c.label} · ${fmt(c.date)}`}</title>
                <line x1={cx} x2={cx} y1={Y_MAIN - 6} y2={ly + 4} stroke="rgba(255,255,255,0.25)" />
                <rect x={rx} y={ly - 11} width={w} height="16" rx="3" fill="#000" stroke={`${MAIN_COLOR}55`} />
                <text x={rx + w / 2} y={ly + 1} fill="#e6ece8" fontSize="11" fontFamily="monospace" textAnchor="middle">{c.label}</text>
                <circle cx={cx} cy={Y_MAIN} r="6" fill="#000" stroke={MAIN_COLOR} strokeWidth="2.5" />
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex gap-4 font-mono text-[11px] text-neutral-500">
          <span><span style={{ color: MAIN_COLOR }}>━</span> main: jobs & education</span>
          <span><span style={{ color: COLOR.software }}>━</span> software</span>
          <span><span style={{ color: COLOR.hardware }}>━</span> hardware</span>
          <span><span style={{ color: COLOR.ai }}>━</span> AI</span>
          <span>▶ = still in progress · click anything to open it</span>
        </div>
      </div>

      {/* ── smaller screens: git log --graph style list ────────────────── */}
      <ul className="mt-4 space-y-1 rounded-md bg-black p-4 font-mono text-[12px] xl:hidden">
        {list
          .filter((it) => it.main || filter === 'all' || it.kinds.includes(filter))
          .map((it) => {
            const color = it.main ? MAIN_COLOR : COLOR[it.kinds[0]];
            return (
              <li key={`${it.date}-${it.text}`} className="flex gap-2">
                <span className="shrink-0" style={{ color }}>{it.main ? '●' : '├─●'}</span>
                <span className="shrink-0 whitespace-nowrap text-neutral-500">{it.date}</span>
                {it.href ? (
                  <button onClick={() => go(it.href)} className="text-left hover:underline" style={{ color: it.main ? '#e6ece8' : color }}>
                    {it.text}
                  </button>
                ) : (
                  <span style={{ color: it.main ? '#e6ece8' : color }}>{it.text}</span>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}

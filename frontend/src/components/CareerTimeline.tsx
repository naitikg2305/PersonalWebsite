'use client';

// Career timeline, Aug 2021 → today. Desktop: horizontal swimlanes (one lane per org, so
// overlapping roles interlace cleanly). Phones: the same data as a vertical, chronological list.
import Link from 'next/link';

interface Bar {
  label: string;
  start: string; // YYYY-MM
  end?: string; // YYYY-MM, omitted = present
  href?: string;
}
interface Lane {
  name: string;
  color: string;
  bars: Bar[];
}
interface Milestone {
  label: string;
  date: string; // YYYY-MM
  icon: string;
  href?: string;
}

const LANES: Lane[] = [
  {
    name: 'Education',
    color: '#8ab4f8',
    bars: [{ label: 'University of Maryland · B.S. Computer Engineering', start: '2021-08', end: '2025-05', href: '/education/UMD' }],
  },
  {
    name: 'Campus',
    color: '#c58af9',
    bars: [
      { label: 'Clark School Ambassador', start: '2022-08', end: '2023-05', href: '/experience/clark-ambassador' },
      { label: 'Research · Prof. Gomez (GSM IoT)', start: '2023-05', end: '2024-05' },
    ],
  },
  {
    name: 'Engineering IT',
    color: '#f6c26b',
    bars: [
      { label: 'Software Development Engineer', start: '2022-08', end: '2024-05', href: '/experience/engineering-it' },
      { label: 'Lead Software Developer', start: '2024-05', end: '2025-05', href: '/experience/engineering-it' },
    ],
  },
  {
    name: 'Zillion',
    color: '#5ee0d4',
    bars: [
      { label: 'SWE Intern · SharePoint RAG', start: '2024-06', end: '2024-08', href: '/experience/zillion' },
      { label: 'AI Intern · Zecured', start: '2025-06', end: '2025-10', href: '/experience/zillion' },
      { label: 'AI Engineer · Sysco voice agent', start: '2025-10', end: '2026-01', href: '/experience/zillion' },
    ],
  },
  {
    name: 'Minfy',
    color: '#3dff8c',
    bars: [
      { label: 'AI Engineer · Grubhub, Samsara, …', start: '2026-01', href: '/experience/minfy-technologies' },
      { label: 'Solutions Architect (Pre-Sales)', start: '2026-09', href: '/experience/minfy-technologies' },
    ],
  },
];

const MILESTONES: Milestone[] = [
  { label: 'Graduated', date: '2025-05', icon: '🎓', href: '/education/UMD' },
  { label: 'Hackathon 2nd', date: '2026-09', icon: '🏆', href: '/experience/minfy-technologies' },
];

const START = '2021-08';

// month index since START; "present" = end of the current month (stable within a month → no hydration drift)
function monthsFrom(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const [sy, sm] = START.split('-').map(Number);
  return (y - sy) * 12 + (m - sm);
}
function nowYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmt(ym?: string) {
  if (!ym) return 'Present';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export default function CareerTimeline() {
  const now = nowYM();
  const total = monthsFrom(now) + 1;
  const pct = (ym: string) => (monthsFrom(ym) / total) * 100;
  const years = Array.from({ length: Number(now.slice(0, 4)) - 2021 + 1 }, (_, i) => 2021 + i);

  // flat chronological list for phones
  const items = LANES.flatMap((lane) => lane.bars.map((b) => ({ ...b, lane: lane.name, color: lane.color })))
    .concat(MILESTONES.map((m) => ({ label: `${m.icon} ${m.label}`, start: m.date, end: m.date, href: m.href, lane: 'Milestone', color: '#e6ece8' })))
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <section id="timeline" style={{ background: '#000', border: '1px solid #00ff0055', borderRadius: 8, boxShadow: '0 0 12px #00ff0026', margin: '0 2rem 3rem', padding: '1.5rem 2rem' }}>
      <p style={{ fontFamily: 'monospace', color: '#00ff00', marginBottom: '1.25rem' }}>
        $ git log --graph --since=2021 <span style={{ color: '#7f8c86' }}># click any bar</span>
      </p>

      {/* ── desktop: horizontal swimlanes ─────────────────────────────── */}
      <div className="hidden md:block">
        <div className="relative" style={{ paddingLeft: 120 }}>
          {/* year grid */}
          <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: 120 }}>
            <span className="absolute -top-1 left-0 font-mono text-[11px] text-neutral-500">Aug 2021</span>
            {years.map((y) => {
              const left = pct(`${y}-01`);
              return left >= 0 && left <= 100 ? (
                <div key={y} className="absolute inset-y-0 border-l border-white/10" style={{ left: `${left}%` }}>
                  <span className="absolute -top-1 left-1 font-mono text-[11px] text-neutral-500">{y}</span>
                </div>
              ) : null;
            })}
          </div>

          <div className="space-y-3 pt-6">
            {LANES.map((lane) => (
              <div key={lane.name} className={`relative flex items-center ${lane.bars.some((b, i) => lane.bars.slice(0, i).some((p) => (p.end ?? now) > b.start)) ? "h-11" : "h-9"}`}>
                <span className="absolute font-mono text-xs text-neutral-400" style={{ left: -120, width: 112 }}>
                  {lane.name}
                </span>
                {lane.bars.map((b, i) => {
                  const left = pct(b.start);
                  const width = Math.max(pct(b.end ?? now) - left + (b.end ? 0 : 100 / total), 1.2);
                  // overlapping bars in one lane (Minfy) stack as a thinner second row
                  const overlap = lane.bars.slice(0, i).some((p) => (p.end ?? now) > b.start);
                  const bar = (
                    <div
                      className="group absolute flex items-center overflow-visible rounded-md px-2 font-mono text-[11px] text-black transition hover:brightness-125"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        height: overlap ? 14 : 22,
                        top: overlap ? 22 : 2,
                        background: lane.color,
                        boxShadow: `0 0 10px ${lane.color}55`,
                      }}
                    >
                      <span className="truncate">{overlap ? '' : b.label}</span>
                      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-max max-w-xs rounded-md border border-white/15 bg-black px-3 py-2 text-[12px] text-neutral-200 shadow-lg group-hover:block">
                        <span style={{ color: lane.color }}>{lane.name}</span> · {b.label}
                        <br />
                        <span className="text-neutral-500">{fmt(b.start)} – {fmt(b.end)}</span>
                      </span>
                    </div>
                  );
                  return b.href ? (
                    <Link key={b.label} href={b.href} aria-label={`${b.label}, ${fmt(b.start)} to ${fmt(b.end)}`}>
                      {bar}
                    </Link>
                  ) : (
                    <div key={b.label}>{bar}</div>
                  );
                })}
              </div>
            ))}

            {/* milestones */}
            <div className="relative h-8">
              <span className="absolute font-mono text-xs text-neutral-400" style={{ left: -120 }}>Milestones</span>
              {MILESTONES.map((m) => (
                <Link
                  key={m.label}
                  href={m.href ?? '#'}
                  className={`absolute whitespace-nowrap rounded-full border border-white/15 bg-black px-2 py-0.5 font-mono text-[11px] text-neutral-200 hover:border-[#3dff8c] ${pct(m.date) > 88 ? '-translate-x-full' : '-translate-x-1/2'}`}
                  style={{ left: `${pct(m.date)}%` }}
                >
                  {m.icon} {m.label}
                </Link>
              ))}
            </div>
          </div>

          {/* today marker */}
          <div className="pointer-events-none absolute inset-y-0 right-0 border-r-2 border-dashed border-[#3dff8c]/60">
            <span className="absolute -top-1 right-1 font-mono text-[11px] text-[#3dff8c]">today</span>
          </div>
        </div>
      </div>

      {/* ── phone: vertical ───────────────────────────────────────────── */}
      <ol className="relative space-y-4 border-l border-white/15 pl-5 md:hidden">
        {items.map((it) => {
          const body = (
            <div>
              <span className="absolute -left-[26px] mt-1.5 h-2.5 w-2.5 rounded-full" style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />
              <div className="font-mono text-[11px] text-neutral-500">
                {it.lane === 'Milestone' ? fmt(it.start) : `${fmt(it.start)} – ${fmt(it.end)}`} · <span style={{ color: it.color }}>{it.lane}</span>
              </div>
              <div className="text-sm text-neutral-100">{it.label}</div>
            </div>
          );
          return (
            <li key={`${it.lane}-${it.label}`} className="relative">
              {it.href ? <Link href={it.href} className="block hover:opacity-80">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

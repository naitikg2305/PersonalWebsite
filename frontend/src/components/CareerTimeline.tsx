'use client';

// Career timeline: one clean horizontal line, dots on it, and vertical connectors that alternate
// short/long so the blocks form two interleaved rows. Everything fits the width (no sideways scroll).
// ≥1280px: horizontal. Smaller screens: a vertical line with blocks to the right.
import Link from 'next/link';

interface Exhibit {
  date: string; // display date
  title: string;
  org: string;
  bullets: string[];
  href?: string;
}

// chronological, oldest → newest
const EXHIBITS: Exhibit[] = [
  {
    date: 'AUG 2021',
    title: 'Enrolled · B.S. Computer Engineering',
    org: 'University of Maryland',
    bullets: ['ML, AI, OS, computer architecture', 'ENES100 autonomous rover (tank-tread drive)'],
    href: '/education/UMD',
  },
  {
    date: 'AUG 2022',
    title: 'Software Development Engineer',
    org: 'Engineering IT, UMD',
    bullets: ['Built Pinpoint: lab access for 100+ users', 'Swipe login + Canvas Badges training gates'],
    href: '/experience/engineering-it',
  },
  {
    date: 'MAY 2023',
    title: 'Undergraduate Researcher',
    org: 'Prof. Romel Gomez, UMD ECE',
    bullets: ['Appliance control over GSM (SMS)', 'SIM7600 + Arduino, 3D-printed enclosure'],
  },
  {
    date: 'MAY 2024',
    title: 'Lead Software Developer',
    org: 'Engineering IT, UMD',
    bullets: ['Led a 10-person Scrum team', '4 production features shipped', 'Hiring + onboarding curriculum'],
    href: '/experience/engineering-it',
  },
  {
    date: 'JUN 2024',
    title: 'Software Engineering Intern',
    org: 'Zillion Technologies',
    bullets: ['SharePoint search + RAG chatbot', 'Delta re-indexing of changed files'],
    href: '/experience/zillion',
  },
  {
    date: 'MAY 2025',
    title: 'Graduated',
    org: 'University of Maryland',
    bullets: ['B.S. Computer Engineering', 'Capstone: NaviGatr edge-AI headset'],
    href: '/education/UMD',
  },
  {
    date: 'JUN 2025',
    title: 'Software AI Engineer Intern',
    org: 'Zillion Technologies',
    bullets: ['Zecured IAM admin panel', 'Role clustering + approval flow'],
    href: '/experience/zillion',
  },
  {
    date: 'OCT 2025',
    title: 'AI Engineer',
    org: 'Zillion Technologies',
    bullets: ['Sysco voice agent (LangGraph, Google ADK)', 'Local Phi-3, 4-bit, replacing GPT'],
    href: '/experience/zillion',
  },
  {
    date: 'JAN 2026',
    title: 'AI Engineer',
    org: 'Minfy Technologies',
    bullets: ['Grubhub ranker: 1.1M-request load test', 'Samsara dashcam VLM pipeline', 'LLM evaluation test bench'],
    href: '/experience/minfy-technologies',
  },
  {
    date: 'SEP 2026',
    title: '2nd Place · AWS × Anthropic Hackathon',
    org: 'Houston, TX',
    bullets: ['Pipeline leak-detection agent', 'Deployed on Bedrock AgentCore'],
    href: '/experience/minfy-technologies',
  },
  {
    date: 'SEP 2026',
    title: 'Solutions Architect (Pre-Sales)',
    org: 'Minfy Technologies',
    bullets: ['Discovery → AWS architecture', 'SOWs + cost estimates'],
    href: '/experience/minfy-technologies',
  },
];

const ACCENT = '#00ff88';
const SHORT = 22; // px connector for the upper row
const ROW = 210; // px offset of the lower row (card height + gap)

function Block({ ex, className = '', style }: { ex: Exhibit; className?: string; style?: React.CSSProperties }) {
  const inner = (
    <div
      className={`group rounded-lg border border-white/10 bg-[#0d1112] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#00ff88]/60 ${className}`}
      style={style}
    >
      <div className="font-mono text-[10px] tracking-[0.15em]" style={{ color: ACCENT }}>{ex.date}</div>
      <h4 className="mt-1 font-mono text-[12.5px] font-bold leading-snug text-neutral-100">{ex.title}</h4>
      <p className="font-mono text-[11px] text-neutral-400">{ex.org}</p>
      <ul className="mt-2 space-y-0.5 font-mono text-[10.5px] leading-snug text-neutral-400">
        {ex.bullets.map((b) => (
          <li key={b} className="flex gap-1.5">
            <span style={{ color: ACCENT }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return ex.href ? (
    <Link href={ex.href} aria-label={`${ex.title}, ${ex.org}, ${ex.date}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function CareerTimeline() {
  const n = EXHIBITS.length;
  // each block spans two event-steps; place centers so the first/last blocks stay inside the panel
  const width = 200 / (n + 1); // % width of a block
  const step = (100 - width) / (n - 1); // % between neighbouring events (= width / 2)
  return (
    <section
      id="timeline"
      style={{ background: '#000', border: '1px solid #00ff0055', borderRadius: 8, boxShadow: '0 0 12px #00ff0026', margin: '0 2rem 3rem', padding: '1.5rem 2rem' }}
    >
      <p className="font-mono text-[#00ff00]">
        $ git log --oneline --since=2021 <span className="text-neutral-500"># {n} commits to the career branch</span>
      </p>

      {/* ── large screens: one line, alternating short/long connectors ───── */}
      <div className="relative mt-8 hidden xl:block" style={{ height: ROW + SHORT + 215 }}>
        <div className="absolute left-0 right-0 top-[5px] h-px bg-white/25" />
        {EXHIBITS.map((ex, i) => {
          const center = width / 2 + step * i;
          const lower = i % 2 === 1;
          const connector = lower ? SHORT + ROW : SHORT;
          return (
            <div key={`${ex.date}-${ex.title}`}>
              <span
                className="absolute top-0 h-[11px] w-[11px] -translate-x-1/2 rounded-full border-2 bg-black"
                style={{ left: `${center}%`, borderColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }}
              />
              <span className="absolute w-px -translate-x-1/2 bg-white/25" style={{ left: `${center}%`, top: 11, height: connector }} />
              <div
                className="absolute -translate-x-1/2"
                style={{ left: `${center}%`, top: 11 + connector, width: `calc(${width}% - 10px)` }}
              >
                <Block ex={ex} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── smaller screens: vertical line, blocks to the right ──────────── */}
      <ol className="relative mt-6 space-y-4 border-l border-white/25 pl-6 xl:hidden">
        {EXHIBITS.map((ex) => (
          <li key={`${ex.date}-${ex.title}`} className="relative">
            <span
              className="absolute -left-[30px] top-3 h-[11px] w-[11px] rounded-full border-2 bg-black"
              style={{ borderColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }}
            />
            <Block ex={ex} />
          </li>
        ))}
      </ol>
    </section>
  );
}

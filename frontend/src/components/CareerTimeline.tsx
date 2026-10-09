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
const CARD_H = 175; // px, room reserved for a block
// connector lengths (px), alternating sides: organic-looking but neighbours never collide
const LENGTHS = [40, 70, 30, 95, 55, 35, 85, 45, 65, 30, 75];

function Block({ ex, showDate = false }: { ex: Exhibit; showDate?: boolean }) {
  const inner = (
    <div className="rounded-lg border border-white/15 bg-[#0b0e0f] p-3 text-left shadow-[0_6px_20px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:border-[#00ff88]/60">
      {showDate && <div className="font-mono text-[10px] tracking-[0.15em]" style={{ color: ACCENT }}>{ex.date}</div>}
      <h4 className="font-mono text-[12.5px] font-bold leading-snug text-neutral-100">{ex.title}</h4>
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
  // each block spans two event-steps; place centers so the first/last blocks stay inside
  const width = 200 / (n + 1); // % width of a block
  const step = (100 - width) / (n - 1); // % between neighbouring events (= width / 2)
  const maxLen = Math.max(...LENGTHS);
  const half = maxLen + CARD_H; // px above and below the line
  return (
    <section id="timeline" style={{ margin: '0 2rem 3rem' }}>
      <p className="inline-block rounded-md border border-[#00ff00]/40 bg-black px-3 py-1.5 font-mono text-[#00ff00] shadow-[0_0_12px_rgba(0,255,0,0.15)]">
        $ git log --oneline --since=2021 <span className="text-neutral-500"># {n} commits to the career branch</span>
      </p>

      {/* ── ≥1280px: one line, blocks scattered above/below with varied connectors ── */}
      <div className="relative mt-6 hidden xl:block" style={{ height: half * 2 }}>
        <div className="absolute left-0 right-0 h-px bg-white/30" style={{ top: half }} />
        {EXHIBITS.map((ex, i) => {
          const center = width / 2 + step * i;
          const up = i % 2 === 0;
          const len = LENGTHS[i % LENGTHS.length];
          return (
            <div key={`${ex.date}-${ex.title}`}>
              {/* dot */}
              <span
                className="absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-black"
                style={{ left: `${center}%`, top: half, borderColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }}
              />
              {/* date on the line, opposite side from the block */}
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 font-mono text-[10px] tracking-wider"
                style={{ left: `${center}%`, top: up ? half + 9 : half - 23, color: ACCENT }}
              >
                {ex.date}
              </span>
              {/* connector */}
              <span
                className="absolute w-px -translate-x-1/2 bg-white/30"
                style={{ left: `${center}%`, top: up ? half - 6 - len : half + 6, height: len }}
              />
              {/* block */}
              <div
                className="absolute -translate-x-1/2"
                style={{
                  left: `${center}%`,
                  width: `calc(${width}% - 10px)`,
                  ...(up ? { bottom: half * 2 - (half - 6 - len) } : { top: half + 6 + len }),
                }}
              >
                <Block ex={ex} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── smaller screens: vertical line, blocks to the right ── */}
      <ol className="relative mt-6 space-y-4 border-l border-white/30 pl-6 xl:hidden">
        {EXHIBITS.map((ex) => (
          <li key={`${ex.date}-${ex.title}`} className="relative">
            <span
              className="absolute -left-[30px] top-3 h-[11px] w-[11px] rounded-full border-2 bg-black"
              style={{ borderColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }}
            />
            <Block ex={ex} showDate />
          </li>
        ))}
      </ol>
    </section>
  );
}

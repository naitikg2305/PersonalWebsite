'use client';

// Career timeline as a detective's evidence board: a red string runs across, pins mark each
// event, and a thread drops from every pin to an "exhibit" card with the details.
// Desktop: horizontal (scrolls sideways). Phones: the string runs down the left instead.
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
    title: 'Student Ambassador',
    org: 'Clark School of Engineering',
    bullets: ['Campus tours for admitted students', 'Open houses & recruiting events'],
    href: '/experience/clark-ambassador',
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

const STRING = '#e5484d'; // red investigation string
const tilt = (i: number) => [-2, 1.5, -1, 2, -1.5, 1][i % 6];

function Card({ ex, i }: { ex: Exhibit; i: number }) {
  const body = (
    <div
      className="relative w-[230px] rounded-sm border border-white/10 bg-[#111315] p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition duration-300 hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:border-[#e5484d]/60"
      style={{ transform: `rotate(${tilt(i)}deg)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">EXHIBIT {String(i + 1).padStart(2, '0')}</span>
        <span
          className="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider"
          style={{ color: STRING, borderColor: `${STRING}aa`, transform: 'rotate(-4deg)' }}
        >
          {ex.date}
        </span>
      </div>
      <h4 className="mt-2 font-mono text-[13px] font-bold leading-snug text-neutral-100">{ex.title}</h4>
      <p className="font-mono text-[11px] text-[#00ff88]">{ex.org}</p>
      <ul className="mt-2 space-y-1 font-mono text-[11px] leading-snug text-neutral-400">
        {ex.bullets.map((b) => (
          <li key={b} className="flex gap-1.5">
            <span style={{ color: STRING }}>▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {ex.href && <span className="mt-2 block font-mono text-[10px] text-neutral-600">open file →</span>}
    </div>
  );
  return ex.href ? (
    <Link href={ex.href} aria-label={`${ex.title}, ${ex.org}, ${ex.date}`}>
      {body}
    </Link>
  ) : (
    body
  );
}

function Pin() {
  return (
    <span
      className="relative z-10 block h-4 w-4 rounded-full"
      style={{ background: `radial-gradient(circle at 35% 35%, #ff8a8a, ${STRING} 55%, #7a1c1f)`, boxShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
    />
  );
}

export default function CareerTimeline() {
  return (
    <section
      id="timeline"
      style={{ background: '#000', border: '1px solid #00ff0055', borderRadius: 8, boxShadow: '0 0 12px #00ff0026', margin: '0 2rem 3rem', padding: '1.5rem 0' }}
    >
      <div className="px-8">
        <p className="font-mono text-[#00ff00]">
          $ cat case-file.md <span className="text-neutral-500"># the investigation so far: 2021 → today</span>
        </p>
        <p className="mt-1 hidden font-mono text-[11px] text-neutral-600 md:block">scroll sideways → {EXHIBITS.length} exhibits · click any card to open the file</p>
      </div>

      {/* ── desktop: horizontal string, threads dropping to exhibits ───────── */}
      <div className="hidden overflow-x-auto pb-6 md:block [scrollbar-color:#333_transparent]">
        <div className="relative mt-8 flex w-max gap-6 px-10">
          {/* the main string, with a slight sag */}
          <svg className="pointer-events-none absolute left-0 top-[7px] h-6 w-full" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden>
            <path d="M0,2 Q25,6 50,3 T100,4" fill="none" stroke={STRING} strokeWidth="0.6" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${STRING}88)` }} />
          </svg>
          {EXHIBITS.map((ex, i) => (
            <div key={`${ex.date}-${ex.title}`} className="relative flex flex-col items-center">
              <Pin />
              {/* thread down to the card */}
              <span className="block w-px" style={{ height: 28 + (i % 3) * 18, background: `${STRING}cc` }} />
              <Card ex={ex} i={i} />
            </div>
          ))}
        </div>
      </div>

      {/* ── phones: vertical string down the left ─────────────────────────── */}
      <ol className="relative mt-6 space-y-6 px-6 md:hidden">
        <span className="absolute bottom-0 left-[31px] top-0 w-[2px]" style={{ background: STRING, boxShadow: `0 0 6px ${STRING}88` }} aria-hidden />
        {EXHIBITS.map((ex, i) => (
          <li key={`${ex.date}-${ex.title}`} className="relative flex items-start gap-3 pl-1">
            <span className="mt-6 shrink-0"><Pin /></span>
            <span className="mt-[31px] block h-px w-4 shrink-0" style={{ background: `${STRING}cc` }} />
            <Card ex={ex} i={i} />
          </li>
        ))}
      </ol>
    </section>
  );
}

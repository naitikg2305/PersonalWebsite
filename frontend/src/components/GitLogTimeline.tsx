'use client';

// v3.5: everything on one vertical `git log --graph`, newest on top. The graph lives in a narrow
// gutter on the far left (main = career on the left edge, project branches to its right). From
// each commit dot a horizontal wire runs right to its card. Cards form an organized collage across
// the full width: each card's top sits at its commit (so time still reads top to bottom), cards in
// different columns may overlap vertically, and a wire simply runs under any card in its way.
// A filter fades everything but the chosen track.
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

const STLViewer = dynamic(() => import('./STLViewer'), { ssr: false });
type PointerState = { x: number; y: number } | null;

type Kind = 'software' | 'hardware' | 'ai';

interface MainCommit {
  type: 'main';
  date: string; // YYYY-MM
  title: string;
  org: string;
  period: string;
  bullets: string[];
  href: string; // where the block leads (experience page anchor / education page)
  milestone?: boolean;
}
interface ProjectCommit {
  type: 'project';
  id: string;
  date: string; // start YYYY-MM
  end?: string; // YYYY-MM; omitted = ongoing
  title: string;
  summary: string;
  tags: string[];
  kind: Kind;
  href?: string;
  github?: string;
  stl?: string; // card thumbnail model (same as the featured project cards)
  image?: string;
}
type Row = MainCommit | ProjectCommit;

const MAIN: MainCommit[] = [
  { type: 'main', date: '2021-08', title: 'B.S. Computer Engineering', org: 'University of Maryland', period: 'Aug 2021 – May 2025', bullets: ['ML, AI, OS, computer architecture', 'Capstone: NaviGatr'], href: '/education/UMD' },
  { type: 'main', date: '2022-08', title: 'Software Development Engineer', org: 'Engineering IT, UMD', period: 'Aug 2022 – May 2024', bullets: ['Built Pinpoint: lab access for 100+ users', 'Swipe login + Canvas Badges training gates'], href: '/experience#engineering-it' },
  { type: 'main', date: '2024-05', title: 'Lead Software Developer', org: 'Engineering IT, UMD', period: 'May 2024 – May 2025', bullets: ['Led a 10-person Scrum team', '4 production features, hiring + onboarding'], href: '/experience#engineering-it' },
  { type: 'main', date: '2024-06', title: 'Software Engineering Intern', org: 'Zillion Technologies', period: 'Jun – Aug 2024', bullets: ['SharePoint search + RAG chatbot', 'Delta re-indexing of changed files'], href: '/experience#zillion' },
  { type: 'main', date: '2025-05', title: '🎓 Graduated', org: 'University of Maryland', period: 'May 2025', bullets: ['B.S. Computer Engineering'], href: '/education/UMD', milestone: true },
  { type: 'main', date: '2025-06', title: 'Software AI Engineer Intern', org: 'Zillion Technologies', period: 'Jun – Oct 2025', bullets: ['Zecured IAM admin panel', 'Role clustering + approval flow'], href: '/experience#zillion' },
  { type: 'main', date: '2025-10', title: 'AI Engineer', org: 'Zillion Technologies', period: 'Oct 2025 – Jan 2026', bullets: ['Sysco voice agent (LangGraph, Google ADK)', 'Local Phi-3, 4-bit, replacing GPT'], href: '/experience#zillion' },
  { type: 'main', date: '2026-01', title: 'AI Engineer', org: 'Minfy Technologies', period: 'Jan 2026 – present', bullets: ['Grubhub ranker: 1.1M-request load test', 'Samsara dashcam VLM pipeline · LLM eval bench'], href: '/experience#minfy-technologies' },
  { type: 'main', date: '2026-09', title: 'Solutions Architect (Pre-Sales)', org: 'Minfy Technologies', period: 'Sep 2026 – present', bullets: ['Discovery → AWS architecture', 'SOWs + cost estimates'], href: '/experience#minfy-technologies' },
  { type: 'main', date: '2026-09', title: '🏆 2nd Place · AWS × Anthropic Hackathon', org: 'Houston, TX', period: 'Sep 2026', bullets: ['Pipeline leak-detection agent on Bedrock AgentCore'], href: '/projects/pipeline-leak-agent', milestone: true },
];

const PROJECTS: ProjectCommit[] = [
  { type: 'project', id: 'rover', image: '/content/projects/Featured/autonomous-rover/image.jpg', date: '2021-09', end: '2021-12', title: 'Autonomous Crash-Site Rover', summary: 'ENES100 over-terrain vehicle: conceived the 4-motor tank-tread drive and led electronics.', tags: ['Arduino', 'sensors', 'hardware'], kind: 'hardware', href: '/projects/autonomous-rover' },
  { type: 'project', id: 'research', date: '2023-05', end: '2024-05', title: 'GSM IoT Research', summary: 'Appliance control over SMS with a SIM7600 + Arduino, with Prof. Romel Gomez.', tags: ['GSM', 'C', 'embedded'], kind: 'hardware' },
  { type: 'project', id: 'quintacle', date: '2024-01', title: 'The Quintacle', summary: 'Local-first personal AI OS: deterministic core, LLM at the edges, markdown as the source of truth.', tags: ['Python', 'FastAPI', 'Next.js', 'Claude'], kind: 'ai', href: '/projects/quintacle', github: 'https://github.com/naitikg2305/quintacle' },
  { type: 'project', id: 'navigatr', stl: 'content/projects/Featured/NaviGatr/card.stl', date: '2025-01', end: '2025-05', title: 'NaviGatr', summary: 'Edge-AI headset for the visually impaired: object detection, depth and emotion → spoken guidance.', tags: ['Raspberry Pi 5', 'Coral TPU', 'YOLO'], kind: 'hardware', href: '/projects/NaviGatr', github: 'https://github.com/naitikg2305/NaviGatr' },
  { type: 'project', id: 'balance', image: '/content/projects/Featured/self-balance/image.jpg', date: '2025-04', end: '2025-05', title: 'Self-Balancing Robot', summary: 'Two-wheel inverted pendulum on an ESP32 + MPU6050, PD loop tuned from telemetry.', tags: ['ESP32', 'PID', 'C++'], kind: 'hardware', href: '/projects/self-balance', github: 'https://github.com/naitikg2305/Self-Balancing-Robot' },
  { type: 'project', id: 'website', image: '/content/projects/Featured/website/image.jpg', date: '2025-07', title: 'naitikg.us', summary: 'This site: Next.js on AWS Amplify, a RAG chatbot on Lambda + Bedrock, and a live terminal background.', tags: ['Next.js', 'AWS', 'RAG'], kind: 'software', href: '/projects/website', github: 'https://github.com/naitikg2305/PersonalWebsite' },
  { type: 'project', id: 'peoplelens', date: '2026-07', end: '2026-09', title: 'PeopleLens', summary: 'Consent-based face re-identification: detection, FaceNet embeddings, local-only storage.', tags: ['PyTorch', 'FaceNet', 'FastAPI'], kind: 'ai', href: '/projects/peoplelens', github: 'https://github.com/naitikg2305/FaceDetect' },
  { type: 'project', id: 'localchat', date: '2026-08', end: '2026-09', title: 'Offline LLM Agent (Local-chat)', summary: 'Fully local chat agent with memory and a bounded web-research tool loop on a laptop GPU.', tags: ['Ollama', 'Qwen3', 'FastAPI'], kind: 'ai', href: '/projects/local-chat', github: 'https://github.com/naitikg2305/Local-chat' },
  { type: 'project', id: 'leakagent', date: '2026-09', end: '2026-09', title: 'Pipeline Leak-Detection Agent', summary: 'Hackathon 2nd place: SCADA leak detection on Bedrock AgentCore; 20/20 labelled events, ~5 mi localization.', tags: ['Bedrock AgentCore', 'Strands', 'Claude'], kind: 'ai', href: '/projects/pipeline-leak-agent', github: 'https://github.com/naitikg2305/AWS_Hackathon_Minfy' },
  { type: 'project', id: 'eval', date: '2026-10', title: 'LLM Evaluation Toolkit', summary: 'Five offline-reproducible eval tools: taxonomy, judge reliability, regression gates, agreement, RAG quality.', tags: ['Python', 'SciPy', 'pytest'], kind: 'ai', href: '/projects/llm-eval-toolkit' },
];

const COLOR: Record<Kind, string> = { software: '#8ab4f8', hardware: '#f6c26b', ai: '#c58af9' };
const MAIN_COLOR = '#00ff88';
const LANE_W = 16; // px between lanes in the gutter
const DOT_Y = 22; // px from the top of a row to its commit dot
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ym?: string) => (ym ? `${MONTH[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : 'now');

// rows newest-first (git log order); main before project when they share a month
const ROWS: Row[] = [...MAIN, ...PROJECTS].sort((a, b) => b.date.localeCompare(a.date) || (a.type === 'main' ? -1 : 1));

interface Span {
  id: string;
  lane: number; // 1+ (0 is main)
  color: string;
  startRow: number; // row of the branch's first commit (bottom of its span)
  endRow: number; // row where it merges into main (top of its span), or 0 if ongoing
  ongoing: boolean;
}

// branch spans + greedy lane assignment (lanes never overlap in rows)
function layout(): Span[] {
  const spans = PROJECTS.map((p) => {
    const startRow = ROWS.findIndex((r) => r.type === 'project' && r.id === p.id);
    let endRow = 0;
    if (p.end) {
      // merge into the main commit closest to (at or after) the end date, above the start row
      endRow = startRow;
      for (let i = startRow - 1; i >= 0; i--) {
        if (ROWS[i].type === 'main' && ROWS[i].date >= p.end) {
          endRow = i;
          break;
        }
      }
      if (endRow === startRow) endRow = Math.max(0, startRow - 1);
    }
    return { id: p.id, color: COLOR[p.kind], startRow, endRow, ongoing: !p.end, lane: 0 };
  });
  const laneTop: number[] = []; // per lane: the smallest row index already used (lanes fill bottom-up)
  spans
    .slice()
    .sort((a, b) => b.startRow - a.startRow)
    .forEach((s) => {
      let lane = laneTop.findIndex((top) => top > s.startRow);
      if (lane === -1) lane = laneTop.push(s.endRow) - 1;
      else laneTop[lane] = s.endRow;
      s.lane = lane + 1;
    });
  return spans;
}

const SPANS = layout();
const LANES = Math.max(...SPANS.map((s) => s.lane)) + 1;
const GUTTER = 14 + (LANES - 1) * LANE_W + 14;
const WIRE_GAP = 18; // clear space between the card area and the gutter, so wires read
const COL_GAP = 18;
const ROW_GAP = 16; // vertical space between cards in the same column
const MIN_STEP = 34; // next commit is at least this far below the previous one (room for fork curves)

/** The whole graph as one SVG: main on the left edge, branches to its right. */
function Graph({ ys, width, height }: { ys: number[]; width: number; height: number }) {
  const laneX = (lane: number) => 10 + lane * LANE_W;
  const mx = laneX(0);
  const dotY = (row: number) => ys[row] + DOT_Y;
  const last = ROWS.length - 1;
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={height} aria-hidden>
      <defs>
        {Object.entries({ main: MAIN_COLOR, ...COLOR }).map(([k, c]) => (
          <filter key={k} id={`glow-${k}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={c} floodOpacity="0.6" />
          </filter>
        ))}
      </defs>
      {/* main line */}
      <line x1={mx} x2={mx} y1={dotY(0) - 18} y2={dotY(last)} stroke={MAIN_COLOR} strokeWidth="3" />
      <text x={mx} y={dotY(0) - 20} fill={MAIN_COLOR} fontSize="10" textAnchor="middle">▲</text>

      {/* branches: fork curve off main at the first commit, line up to the merge (or off the top if ongoing) */}
      {SPANS.map((s) => {
        const x = laneX(s.lane);
        const y0 = dotY(s.startRow);
        const y1 = s.ongoing ? dotY(0) - 18 : dotY(s.endRow) + 22;
        return (
          <g key={s.id} stroke={s.color} strokeWidth="2" fill="none">
            <path d={`M${x},${y0} C${x},${y0 + 18} ${mx},${y0 + 10} ${mx},${y0 + 26}`} />
            <line x1={x} x2={x} y1={y1} y2={y0} />
            {s.ongoing ? (
              <text x={x} y={y1 - 2} fill={s.color} stroke="none" fontSize="10" textAnchor="middle">▲</text>
            ) : (
              <path d={`M${mx},${dotY(s.endRow)} C${mx},${dotY(s.endRow) + 14} ${x},${dotY(s.endRow) + 8} ${x},${y1}`} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface Placed {
  col: number;
  top: number;
  bottom: number;
}

/** Time-ordered collage: each card goes in a column that is free at its top (never overlapping
 *  another card); its top is at least MIN_STEP below the previous card's, so order reads top-down. */
function place(heights: number[], cols: number): Placed[] {
  const placed: Placed[] = [];
  let prevTop = -MIN_STEP;
  ROWS.forEach((r, i) => {
    const key = `${r.date}-${r.title}`;
    let y = prevTop + MIN_STEP;
    for (;;) {
      const colBottom = Array.from({ length: cols }, (_, c) => Math.max(-Infinity, ...placed.filter((p) => p.col === c).map((p) => p.bottom)));
      const allowed = colBottom
        .map((_, c) => c)
        .filter((c) => colBottom[c] + ROW_GAP <= y);
      if (allowed.length) {
        // mostly the leftmost allowed column (fills the width in a cascade), sometimes another one
        const pick = rand(key, 4) < 0.55 ? allowed[0] : allowed[Math.floor(rand(key, 5) * allowed.length)];
        placed.push({ col: pick, top: y, bottom: y + heights[i] });
        prevTop = y;
        return;
      }
      // advance to the next moment a column frees up
      y = Math.min(...colBottom.map((b) => b + ROW_GAP).filter((b) => b > y));
    }
  });
  return placed;
}

// deterministic "random" in [0,1) per card, so the board is stable across renders/SSR
function rand(seed: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

type Filter = 'all' | 'career' | 'projects';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'everything' },
  { key: 'career', label: 'education & experience' },
  { key: 'projects', label: 'projects' },
];

function MainCard({ c }: { c: MainCommit }) {
  return (
    <Link
      href={c.href}
      className="block rounded-lg border bg-[#0b0e0f] px-4 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.7)] transition hover:-translate-y-1"
      style={{ borderColor: c.milestone ? '#ffffff33' : `${MAIN_COLOR}44` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-mono text-[14px] font-bold text-neutral-100">{c.title}</h4>
        <span className="font-mono text-[11px] text-neutral-500">{c.period}</span>
      </div>
      <p className="font-mono text-[12px]" style={{ color: MAIN_COLOR }}>{c.org}</p>
      <ul className="mt-1.5 space-y-0.5 font-mono text-[12px] text-neutral-400">
        {c.bullets.map((b) => (
          <li key={b}><span style={{ color: MAIN_COLOR }}>· </span>{b}</li>
        ))}
      </ul>
    </Link>
  );
}

function ProjectCard({ p }: { p: ProjectCommit }) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const pointer = useRef<PointerState>(null); // drives the STL model without re-rendering
  const c = COLOR[p.kind];
  // a clickable div (not <a>) so the GitHub link inside isn't a nested anchor
  return (
    <div
      role={p.href ? 'link' : undefined}
      tabIndex={p.href ? 0 : undefined}
      onClick={() => p.href && router.push(p.href)}
      onKeyDown={(e) => e.key === 'Enter' && p.href && router.push(p.href)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        pointer.current = null;
      }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      }}
      className="overflow-hidden rounded-lg border bg-[#0b0e0f] shadow-[0_6px_20px_rgba(0,0,0,0.7)] transition hover:-translate-y-1"
      style={{ borderColor: `${c}55`, cursor: p.href ? 'pointer' : 'default', boxShadow: hover ? `0 10px 24px rgba(0,0,0,.6), 0 0 18px ${c}33` : undefined }}
    >
      {/* media like the featured project cards: STL model (rotates on hover) or cover image */}
      {p.stl ? (
        <div className="bg-[#111]" style={{ height: 170 }}>
          <STLViewer url={p.stl} height={170} spin pointer={pointer} controls={false} zoom={false} />
        </div>
      ) : p.image ? (
        <img src={p.image} alt={p.title} className="h-[150px] w-full object-cover" />
      ) : null}
      <div className="px-4 py-3" style={{ borderTop: p.stl || p.image ? `1px solid ${c}33` : undefined }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-mono text-[14px] font-bold text-neutral-100">
            <span style={{ color: c }}>⎇ </span>
            {p.title}
          </h4>
          <span className="font-mono text-[11px] text-neutral-500">{fmt(p.date)} → {fmt(p.end)}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{p.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.tags.map((t) => (
            <span key={t} className="rounded border px-1.5 py-0.5 font-mono text-[10.5px]" style={{ color: c, borderColor: `${c}55` }}>{t}</span>
          ))}
          {p.github && (
            <a href={p.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-neutral-400 hover:text-white" aria-label="GitHub">
              <FaGithub size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GitLogTimeline() {
  const [filter, setFilter] = useState<Filter>('all');
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;
  const area = width - GUTTER - WIRE_GAP; // card area, right of the gutter
  const colW = Math.max(0, (area - COL_GAP * (cols - 1)) / cols);

  // track the container width
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // cards render at the column width; measure their real heights, then lay out
  useLayoutEffect(() => {
    if (!width) return;
    const measure = () => setPlaced(place(cardRefs.current.map((el) => el?.offsetHeight ?? 160), cols));
    measure();
    const ro = new ResizeObserver(measure); // fonts/images settling change heights
    cardRefs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [width, cols]);

  const items = ROWS.map((r, i) => {
    const isMain = r.type === 'main';
    const p = placed?.[i];
    const lane = r.type === 'main' ? 0 : SPANS.find((s) => s.id === r.id)!.lane;
    return {
      key: `${r.date}-${r.title}`,
      r,
      i,
      isMain,
      color: r.type === 'main' ? MAIN_COLOR : COLOR[r.kind],
      dim: (filter === 'career' && !isMain) || (filter === 'projects' && isMain),
      p,
      left: GUTTER + WIRE_GAP + (p ? p.col * (colW + COL_GAP) : 0),
      dotX: 10 + lane * LANE_W,
    };
  });

  const height = placed ? Math.max(...placed.map((p) => p.bottom)) + 24 : 0;
  const ys = placed?.map((p) => p.top) ?? [];

  return (
    <section id="timeline" style={{ margin: '0 auto 3rem', maxWidth: 1440, padding: '0 1.5rem' }}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="inline-block rounded-md border border-[#00ff00]/40 bg-black px-3 py-1.5 font-mono text-[#00ff00] shadow-[0_0_12px_rgba(0,255,0,0.15)]">
          $ git log --graph --all <span className="text-neutral-500"># career on main, projects on branches</span>
        </p>
        <div className="flex flex-wrap gap-3 rounded-md bg-black px-3 py-1.5 font-mono text-[11px] text-neutral-400">
          <span><span style={{ color: MAIN_COLOR }}>●</span> work & education</span>
          <span><span style={{ color: COLOR.ai }}>●</span> AI</span>
          <span><span style={{ color: COLOR.software }}>●</span> software</span>
          <span><span style={{ color: COLOR.hardware }}>●</span> hardware</span>
        </div>
        <div role="group" aria-label="Filter" className="flex overflow-hidden rounded-md border border-neutral-700 bg-black font-mono text-[11px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className="px-2.5 py-1.5 transition"
              style={filter === f.key ? { background: '#00ff8822', color: MAIN_COLOR } : { color: '#a3a3a3' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={boxRef} className="relative mt-8" style={{ height, visibility: placed ? 'visible' : 'hidden' }}>
        {placed && width > 0 && <Graph ys={ys} width={width} height={height} />}
        {/* Fixed layers, never interleaved per row (a faded row would otherwise form its own layer and
            let its wire paint over other cards): wires (1) < cards (2) < gutter dots (3) < hovered card (4)
            < the hovered card's own wire and dot (5, 6), so you can trace which line is whose. */}
        {items.map(({ key, i, color, dim, p, left, dotX }) => {
          if (!p) return null;
          // hovering a card traces its wire: lifted above every card, brighter and thicker; others dim
          const lit = hovered === i;
          return (
            <div
              key={`w-${key}`}
              className="absolute transition-all duration-200"
              style={{
                left: dotX,
                top: p.top + DOT_Y - (lit ? 1.5 : 1),
                height: lit ? 3 : 2,
                width: left - dotX,
                zIndex: lit ? 5 : 1,
                opacity: dim ? 0.12 : hovered !== null && !lit ? 0.35 : 1,
                background: lit ? color : `linear-gradient(90deg, ${color}, ${color}88)`,
                boxShadow: lit ? `0 0 10px ${color}, 0 0 3px ${color}` : `0 0 4px ${color}66`,
              }}
            />
          );
        })}
        {items.map(({ key, i, isMain, color, dim, p, dotX }) => {
          if (!p) return null;
          const lit = hovered === i;
          const size = (isMain ? 13 : 11) + (lit ? 5 : 0);
          return (
            <span
              key={`d-${key}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-200"
              style={{ left: dotX, top: p.top + DOT_Y, width: size, height: size, zIndex: lit ? 6 : 3, opacity: dim ? 0.3 : 1, borderColor: color, background: lit ? color : '#000', boxShadow: lit ? `0 0 14px ${color}` : `0 0 8px ${color}aa` }}
            />
          );
        })}
        {items.map(({ key, r, i, isMain, color, dim, p, left }) => (
          <div
            key={key}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            className="absolute transition-[top,left,opacity] duration-500"
            style={{ left, top: p?.top ?? 0, width: colW, zIndex: hovered === i ? 4 : 2, opacity: dim ? 0.12 : 1 }}
          >
            {/* where the wire meets the card */}
            <span className="absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: 0, top: DOT_Y, background: color, boxShadow: `0 0 6px ${color}` }} />
            <div className="mb-1 pl-3 font-mono text-[10.5px] text-neutral-500">
              {fmt(r.date)}
              {!isMain && <span className="ml-2" style={{ color }}>branch: {r.type === 'project' ? r.id : ''}</span>}
            </div>
            <div className={dim ? 'pointer-events-none' : ''}>{r.type === 'main' ? <MainCard c={r} /> : <ProjectCard p={r} />}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

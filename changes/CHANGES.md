# Session changes – re-apply after discard

This doc lists every change made in the session so you can re-apply them (or cherry-pick) after discarding. New/updated work experience markdowns are in `changes/employment/`; copy them into `frontend/public/content/employment/` when you want them back.

---

## 1. Work experience: LinkedIn-style multiple positions + sub-bullets

### 1.1 Types – `frontend/src/types/experience.ts`

Add these types and extend `Experience`:

```ts
export type ExperienceBullet = {
  main: string;
  sub?: string[];
};

export type ExperiencePosition = {
  role: string;
  dates: string;
  bullets: ExperienceBullet[];
};

export type Experience = {
  title: string;
  company: string;
  dates: string;
  location: string;
  slug: string;
  summaryPoints: string[];
  positions?: ExperiencePosition[]; // optional: multiple roles with sub-bullets
  order?: number;
};
```

### 1.2 Homepage cards – `frontend/src/components/WorkExperienceSection.tsx`

- When `exp.positions` exists and has length > 0, render company as `h3`, then each position as `h4` (role — dates) with bullets: each bullet has `main` (bold) and optional `sub` (nested `<ul>`).
- When no positions, keep current behavior: `h3` = title — company, single `summaryPoints` list.
- Use a wrapper like `.positionsList` and `.positionBlock` for each role.

Example structure:

```tsx
<h3>{exp.positions?.length ? exp.company : `${exp.title} — ${exp.company}`}</h3>
{exp.positions?.length ? (
  <div className={styles.positionsList}>
    {exp.positions.map((pos, posIdx) => (
      <div key={posIdx} className={styles.positionBlock}>
        <h4>{pos.role} — {pos.dates}</h4>
        <ul>
          {pos.bullets.map((b, i) => (
            <li key={i}>
              <strong>{b.main}</strong>
              {b.sub?.length ? <ul>{b.sub.map((s, j) => <li key={j}>{s}</li>)}</ul> : null}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
) : (
  <ul>{exp.summaryPoints.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
)}
```

### 1.3 Styles – `frontend/src/styles/landing.module.css`

- **Company title bigger:** `.experienceCard h3 { font-size: 1.4rem; font-weight: 600; }` (in addition to existing color/margin).
- **Positions on cards:**
  - `.positionsList`, `.positionBlock` (margin/spacing).
  - `.experienceCard .positionBlock h4 { color: #00ff00; font-size: 0.95rem; font-weight: 600; margin-bottom: 0.35rem; }`
  - `.experienceCard .positionBlock ul { margin-left: 1rem; }`
  - `.experienceCard .positionBlock ul ul { list-style-type: circle; margin-left: 1.25rem; margin-top: 0.2rem; }`
- **Detail page (markdown):** `.markdownContent ul`, `.markdownContent ul ul` (margin, list-style-type circle/square), `.markdownContent li > strong { color: #9cdcfe; }`, `.markdownContent h3 { color: #dcdcaa; font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }`

---

## 2. Employment markdown files

**Backups are in:** `PersonalWebsite/changes/employment/`

- **zillion.md** – Full version with 3 positions (Summer 2024, Summer 2025 Software AI Engineer Intern / Zecured, AI Engineer with agentic AI + local LLM), human-readable homepage bullets, and long-form “What I learned” sections. Copy to `frontend/public/content/employment/zillion.md` to restore.
- **engineering-it.md** – Version with `positions` array (SDE 2022–2024, Lead 2024–2025) and team-lead focused bullets. Copy to `frontend/public/content/employment/engineering-it.md` to restore.
- **minfy-technologies.md** – New job: Associate Software Engineer, Minfy Technologies, Jan 2026 – Present. Copy to `frontend/public/content/employment/minfy-technologies.md` to add it.
- **clark-ambassador.md** – Only change was `order: 4` in frontmatter (so order is Minfy 1, Zillion 2, Engineering IT 3, Clark 4). Edit the existing file’s frontmatter if you restore the other three.

---

## 3. Project cards: 3D hover

**File:** `frontend/src/styles/landing.module.css`

On `.projectCard`:

- Add transition: `transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease`.
- Default shadow: `0 4px 6px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)`.

On `.projectCard:hover`:

- `transform: translateY(-8px) scale(1.02);`
- `box-shadow: 0 12px 24px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,0,0.15);`
- `border-color: rgba(0,255,0,0.3);`

---

## 4. Featured projects on homepage (optional)

If you want the “featured projects” block on the homepage again (separate from any existing Featured section):

- **New component:** `frontend/src/components/FeaturedProjectsSection.tsx` – takes `projects: Project[]`, renders terminal-style section “featured-projects.md”, grid of `ProjectCard`, link “View all projects →” to `/projects`.
- **Data:** Use existing `getProjects()` from `frontend/src/lib/getProjects.ts` (reads `public/content/projects/Featured`).
- **Home:** In `Home.tsx`, add `projects` to props, render `<FeaturedProjectsSection projects={projects} />` (e.g. between Education and Chat). In `app/page.tsx`, call `getProjects()` and pass `projects` into `Home`. Optionally add nav link `#projects` to scroll to this section.

(Your current setup uses `FeaturedSection` + `getFeaturedProjects`; the above is the variant we added in-session.)

---

## 5. Quick checklist after discard

- [ ] Restore `experience.ts` (positions types).
- [ ] Restore `WorkExperienceSection.tsx` (positions rendering).
- [ ] Restore `landing.module.css` (h3 size, positions, markdown nested lists, projectCard 3D hover).
- [ ] Copy `changes/employment/zillion.md` → `frontend/public/content/employment/zillion.md`.
- [ ] Copy `changes/employment/engineering-it.md` → `frontend/public/content/employment/engineering-it.md`.
- [ ] Copy `changes/employment/minfy-technologies.md` → `frontend/public/content/employment/minfy-technologies.md`.
- [ ] Set Clark Ambassador `order: 4` in its frontmatter if using the new order.
- [ ] (Optional) Add FeaturedProjectsSection + getProjects wiring if you want that homepage block.

---

*Generated so you can re-apply these changes after discarding.*

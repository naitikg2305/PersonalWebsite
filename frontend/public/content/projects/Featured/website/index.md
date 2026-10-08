---
title: "Website- Personal Portfolio"
date: "2025-07-25"
tags: ["AI", "Full-Stack"]
featured: true                               # optional
summary: "Personal Website showcase everything I learn and build"    # required
github: https://github.com/naitikg2305/PersonalWebsite
category: "software"                         # also listed under Software Projects on /projects
softwareOrder: 5                             # position in the Software Projects section (leaves homepage order untouched)

---
# Building an AI Chatbot with Frontend and Backend Integration

This guide documents how to build an AI-powered chatbot with full integration across backend, frontend, and Markdown content-driven design. It is written to help new developers understand the entire pipeline, from file-based content loading to chatbot API responses.

---

## 🧱 Project Structure Overview

```
/public/content/
    /about/
    /employment/
    /education/
/src/
    /components/
        Home.tsx
        WorkExperienceSection.tsx
        EducationSection.tsx
        ChatbotButton.tsx
        ChatSection.tsx
    /lib/
        getWorkExperiences.ts
        getEducations.ts
        readExperience.ts
        readEducation.ts
    /types/
        experience.ts
        education.ts
    /app/
        /experience/[slug].tsx
        /education/[slug].tsx
```

---

## 📄 Step 1: Store Content in Markdown

Each work experience or education entry is stored in a `.md` file with frontmatter:

```md
---
title: "University of Maryland"
order: 1
company: "University of Maryland"
dates: "Aug 2021 – May 2025 (Expected)"
location: "College Park, MD"
slug: "university-of-maryland"
summaryPoints:
  - Pursuing a B.S. in Computer Engineering
  - Coursework: AI, OS, ML, Embedded Systems
  - Led student teams on AI/full-stack projects
---
```

---

## 📚 Step 2: Create Content Loaders

We use `gray-matter` to parse markdown files in `getWorkExperiences.ts` and `getEducations.ts`.

```ts
// getEducations.ts
export function getEducations(): Education[] {
  const dir = path.join(process.cwd(), 'public/content/education');
  const files = fs.readdirSync(dir);

  const educations = files.map((filename) => {
    const file = fs.readFileSync(path.join(dir, filename), 'utf8');
    const { data } = matter(file);
    return data as Education;
  });

  educations.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return educations;
}
```

```ts
// readEducation.ts
export function readEducation(slug: string) {
  const filePath = path.join(process.cwd(), 'public/content/education', `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { content, data } = matter(fileContent);
  return { content, data };
}
```

---

## 💻 Step 3: Frontend Display

Each section is a React component that renders data from the backend.

### EducationSection.tsx

```tsx
export default function EducationSection({ educations }: { educations: Education[] }) {
  return (
    <div>
      {educations.map((edu) => (
        <div key={edu.slug}>
          <h3>{edu.title}</h3>
          <p>{edu.dates} — {edu.location}</p>
        </div>
      ))}
    </div>
  );
}
```

### Home.tsx Integration

```tsx
<EducationSection educations={educations} />
<WorkExperienceSection experiences={workExperiences} />
```

### Page.tsx (Server-side)

```tsx
const educations = getEducations();
const workExperiences = getWorkExperiences();
return <Home workExperiences={workExperiences} educations={educations} />;
```

---

## 🤖 Step 4: Implementing Chatbot Backend

In `/pages/api/chat.ts`:

```ts
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const { prompt } = req.body;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  res.status(200).json({ text: response.choices[0].message.content });
}
```

---

## 🧠 Step 5: Chatbot Frontend Logic

### ChatSection.tsx

```tsx
const [input, setInput] = useState('');
const [response, setResponse] = useState('');

async function sendPrompt() {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: input })
  });
  const data = await res.json();
  setResponse(data.text);
}
```

### ChatbotButton.tsx

```tsx
<button onClick={toggleChat}>Ask</button>
```

---

## 🌐 Styling

Use `landing.module.css` for dark terminal-style UI with:
- `.terminal`
- `.experienceCard`
- `.navTitle`

---

## ✅ Final Notes

- Ensure every markdown file has a valid `slug`.
- Always pass arrays to components that `.map()`.
- Use `remark-gfm` to render bullet points and Markdown properly.
- Make sure dynamic routes like `[slug].tsx` use the correct file loader.

> Now you have a working site with a chatbot, content-driven pages, and real frontend-backend integration.

---


# 🧠 Portfolio Codebase: Structure, Routing, and Content Rendering

This file documents the architecture and logic behind Naitik Gupta’s personal website — including how work experiences, education entries, and markdown content are structured, routed, and rendered.

---

## 🗂️ File & Directory Layout

```
/app
  /experience
    /[slug]/page.tsx         → Dynamic route for each work experience
  /education
    /[slug]/page.tsx         → Dynamic route for each education entry

/components
  Home.tsx                   → Main page that renders About, Experience, Education
  WorkExperienceSection.tsx  → Displays all work experiences
  EducationSection.tsx       → Displays all education entries

/lib
  getWorkExperiences.ts      → Reads all experience .md files
  readExperience.ts          → Reads one experience .md file
  getEducations.ts           → Reads all education .md files
  readEducation.ts           → Reads one education .md file

/public
  /content
    /experience/*.md         → Markdown for each job
    /education/*.md          → Markdown for each school
    /about/about.md          → Markdown for bio
```

---

## 🧠 Component Behavior

### Home.tsx

This is the main frontend page, composed of:
- A floating name + quote animation using `useEffect` and index slicing
- A fixed top navbar that fades in on scroll
- Sections rendered in order:
  - **About** → markdown terminal (`about.md`)
  - **Experience** → list of jobs (`WorkExperienceSection`)
  - **Education** → list of schools (`EducationSection`)
  - **Chat** → AI chatbot block

Props passed to `Home.tsx`:
```ts
interface HomeProps {
  workExperiences: Experience[];
  educations: Experience[];
}
```

### WorkExperienceSection.tsx & EducationSection.tsx

Each uses the same terminal-style design:
```tsx
<div className={styles.contentContainer} id="education">
  <div className={styles.terminal}>
    <div className={styles.terminalHeader}>education.md</div>
    <div className={styles.terminalBody}>
      {educations.map(...)}
    </div>
  </div>
</div>
```

Each item includes:
- `title — company`
- `dates • location`
- `summaryPoints[]`
- Link to `Read more →` via slug

---

## 🧭 Routing Strategy

### Dynamic Pages (`app/experience/[slug]/page.tsx` and `app/education/[slug]/page.tsx`)

Each `[slug]` page reads from the corresponding Markdown file using:
```ts
const { content, data } = readExperience(params.slug);
// OR
const { content, data } = readEducation(params.slug);
```

They use the same UI logic:
```tsx
<h1>{data.title}</h1>
<h2>{data.company}</h2>
<p><em>{data.dates} • {data.location}</em></p>
<hr />
<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
  {content}
</ReactMarkdown>
```

Each Markdown file sits at:
```
/public/content/experience/<slug>.md
/public/content/education/<slug>.md
```

The slug must match the filename.

---

## 📄 Example Markdown Frontmatter

Each `.md` file has YAML frontmatter:
```yaml
---
title: "University of Maryland"
company: "University of Maryland"
dates: "Aug 2021 – May 2025 (Expected)"
location: "College Park, MD"
slug: "university-of-maryland"
summaryPoints:
  - Pursuing a B.S. in Computer Engineering
  - Coursework: AI, OS, ML, etc.
  - Led student teams on AI and full-stack projects
---
```

---

## 🧾 Markdown Render Pipeline

- Files are read with `gray-matter` to extract `data` and `content`.
- Markdown content is rendered using:
  ```tsx
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
  ```
- This allows:
  - GitHub-flavored markdown
  - Syntax-highlighted code blocks
  - Inline images and formatting
  - Full layout control via `.markdownContent` CSS class

---

## 🎨 Styling Notes

All sections use a terminal-style theme, defined in `landing.module.css`.

Key styles:
```css
.contentContainer {
  padding-top: 100vh;
  padding-bottom: 4rem;
}

.terminal {
  background-color: #000000e6;
  border: 1px solid #00ff00;
  padding: 2rem;
  box-shadow: 0 0 10px #00ff00;
}

.terminalHeader {
  font-weight: bold;
  color: #00ff00;
}

.terminalBody {
  color: #00ff00;
  font-family: monospace;
}
```

To tighten spacing between Experience and Education:
```css
.educationSpacingFix {
  padding-top: 2rem !important;
}
```

---

## ✅ Summary of Key Techniques

- File-based CMS using Markdown in `/public/content`
- Dynamic route loading via `[slug]/page.tsx` under `app/`
- ReactMarkdown + GFM + syntax highlighting
- Consistent terminal-style UI reused across sections
- Experience and Education handled identically, separated only by folder and route

This system is minimal, scalable, and Markdown-friendly — ready to expand into more content types like projects, builds, or blogs.


---


# 🧭 Personal Website Setup Guide (Next.js 13+)

This guide documents the complete setup for a personalized portfolio website using **Next.js 13 App Router**, with rich markdown rendering, a typing animation on the homepage, dynamic sections (Projects, About, Experience), and custom styling.

---

## 🧰 Technologies Used

- **Next.js 13+** with App Router
- **React + TypeScript**
- **Tailwind CSS + CSS Modules**
- **react-markdown**, **remark-gfm**, **rehype-raw**
- **Markdown content structure**
- **Static image background**
- **Typing animations and scroll-based layout transitions**

---

## 📁 Folder Structure Overview

```
my-portfolio/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── components/
│       ├── Home.tsx
│       └── WorkExperienceSection.tsx
├── lib/
│   └── readExperience.ts
├── public/
│   ├── content/
│   │   ├── about/
│   │   │   └── about.md
│   │   ├── employment/
│   │   │   └── zillion.md
│   ├── image1.png
│   └── favicon.ico
├── styles/
│   └── landing.module.css
├── types/
│   └── experience.ts
└── globals.css
```

---

## 🛠 Setup Instructions

### 1. Initialize Project

```bash
npx create-next-app@latest
# Enable: TypeScript, Tailwind, App Router
```

### 2. Install Dependencies

```bash
npm install react-markdown remark-gfm rehype-raw
```

---

## 🧩 Feature Implementation

### ✍️ Typing Animation + Scroll Logic

`app/components/Home.tsx` handles:
- Typing out “Naitik Gupta”
- Showing quote under it
- Shrinking to top-right on scroll
- Rendering `about.md` in terminal style

### 🧠 Markdown Format (example)

```md
---
title: "Software Engineering Intern"
company: "Zillion Technologies"
dates: "Summer 2024"
location: "Hybrid"
slug: "zillion"
summaryPoints:
  - Built a vector DB from SharePoint
  - Added OCR & delta indexing
---

# 🏢 Zillion Technologies

Built a full-stack semantic search tool using ChromaDB and Hugging Face.
```

### 🖼 Static Image Background

Put your image at:

```
/public/image1.png
```

Use in CSS:

```css
.container {
  background-image: url('/image1.png');
  background-size: cover;
  background-attachment: fixed;
}
```

---

## 🧾 Work Experience Section

`WorkExperienceSection.tsx` dynamically loads all markdown files in `public/content/employment` and renders:

- Title, company, dates
- Summary points as list
- Link to full page via slug

---

## 🧪 Terminal-Styled Markdown

Markdown is styled with:

```css
.terminal {
  background: black;
  color: #00ff00;
  font-family: monospace;
  padding: 2rem;
}
```

Use `react-markdown` with:

```tsx
<ReactMarkdown
  children={aboutContent}
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeRaw]}
/>
```

---

## ✅ Final Features Recap

- [x] Typing animation: “Naitik Gupta”
- [x] Static background with scroll
- [x] Sticky navbar after scroll
- [x] Markdown rendering for content
- [x] Projects and Experience from MD files

You're now set up with a fully extendable and stylish personal website!

---

Made by Naitik Gupta 🚀


---

# 🧠 Full Developer Resume Guide for the Personal Website

This file documents everything a new developer needs to know to understand and build upon this Next.js React-based personal website. It captures our decisions, architecture, folder layout, problems encountered, and styling systems.

---

## 🧱 React + Next.js Stack Overview

- **React Version**: 18+
- **Next.js Version**: 13+ with the `/app` directory structure
- **Styling**: CSS Modules (`landing.module.css`), global styles (`globals.css`)
- **Markdown Rendering**: Using `react-markdown` + `remark-gfm`

---

## 🔄 Fetch vs. getStaticProps: What We Learned

### ❌ `getStaticProps` Issue
We initially used `getStaticProps` to load content like `about.md`, but it is server-side only. This meant **animations and scroll-based UI logic** (like navbar hiding or typing effects) had to run client-side, which conflicted with `getStaticProps`. The page either wouldn’t hydrate properly or animations broke.

### ✅ `fetch()` Solution
We switched to using `fetch()` **client-side** to load markdown from the `/public` folder. This allows scroll-based rendering, animation timing, and dynamic behavior **while still loading content from markdown**.

---

## 🏠 Main Page (`Home.tsx` inside `/components`)

This page handles:

- Typing animation for name (`Naitik Gupta`)
- Showing a quote after name types out
- Navbar that appears after scrolling
- `about.md` loading using `fetch()`
- Injecting markdown into a custom terminal-style component
- Rendering work experiences using a `WorkExperienceSection`

---

## 💼 Work Experience Design

### 🔨 Folder Setup

Markdown files like `zillion.md`, `engineering-it.md`, and `clarkambassador.md` are stored in:

```
/public/content/experience/
```

Each file contains **frontmatter** like this:

```md
---
title: Zillion Technologies
company: Zillion
dates: Summer 2024
location: Hybrid
slug: zillion
summaryPoints:
  - Worked on vector database
  - Handled SharePoint pipeline
  - Used ChromaDB + OpenAI
---

Full description goes here.
```

### 🧠 What Is a Slug?
The `slug` becomes the URL for the experience page. For example:

```
slug: zillion ➜ /experience/zillion
```

### 🔄 Data Flow

1. **Build Time**: `getWorkExperiences.ts` reads all `.md` files and parses their frontmatter
2. **Homepage**: `WorkExperienceSection.tsx` shows blurbs with `Read more` links
3. **Route**: Clicking the link routes to `/experience/[slug]` using Next.js dynamic routing
4. **Page**: `readExperience.ts` loads the full markdown file for that slug

---

## 📂 Full Folder Structure

```
src/
├── app/
│   ├── page.tsx                 # Loads Home with experiences as props
│   ├── experience/
│   │   └── [slug]/
│   │       └── page.tsx         # Dynamic route page for each experience
│   └── layout.tsx               # Site layout wrapper
│
├── components/
│   ├── Home.tsx                 # The main home page logic (animations, sections)
│   └── WorkExperienceSection.tsx
│
├── lib/
│   ├── getWorkExperiences.ts    # Reads all markdown summaries at build time
│   └── readExperience.ts        # Reads specific markdown by slug
│
├── styles/
│   └── landing.module.css       # Terminal theme, navbar, fonts, cursor, etc.
│
├── types/
│   └── experience.ts            # TypeScript interface for experience structure

public/
└── content/
    ├── about/
    │   └── about.md
    └── experience/
        ├── zillion.md
        ├── engineering-it.md
        └── clarkambassador.md
```

---

## 🎨 Styling and Animation

- Terminal interface is built with `div.terminal`, `terminalHeader`, and `terminalBody`
- Typing and blinking cursor animations are custom CSS
- Navbar is hidden until scroll offset `> 10px`
- Markdown content is wrapped in a styled `<div>` for scoped formatting

### Markdown Styling via `.markdownContent` wrapper:

```tsx
<div className={styles.markdownContent}>
  <ReactMarkdown>{markdown}</ReactMarkdown>
</div>
```

```css
.markdownContent h1, .markdownContent h2 {
  color: #00ff00;
}

.markdownContent p {
  color: #ffffff;
  line-height: 1.6;
}
```

---

## ✅ How to Add More Work Experiences

1. Create a markdown file in `public/content/experience/`
2. Add frontmatter like `title`, `company`, `dates`, `slug`, and `summaryPoints`
3. It will automatically appear on the homepage
4. `Read more →` will lead to `/experience/[slug]`

---

## 🧠 Next Dev Tasks

- Add more content sections (`Projects`, `Knowledge`, `Builds`) like `WorkExperienceSection`
- Consider adding GitHub repos, badges, or video demos to each project
- Add Google Analytics or Chatbot integration

---

This guide ensures **any new dev** can understand the full scope and resume development confidently.

---

# Personal Website Setup & Resume Guide


This document captures the current working state of your React/Next.js personal website. It covers folder structure, dynamic content loading, routing setup, and styling practices.

## 🏠 Home Component (`Home.tsx`)


This is the main client-side rendered page that handles:
- Typing animation for your name
- Scroll-based navbar visibility
- Markdown loading from the public folder
- Work experience rendering via a reusable component


## 📁 Routing Overview


You're using the new `/src/app` structure in React 18 / Next.js 13+.

- `layout.tsx` is your root layout.
- `page.tsx` files define routes.
- The `Home.tsx` component is passed props via `page.tsx` in `/app`.


## 💼 Work Experience Setup


Each experience has:
- A Markdown file with frontmatter for title, company, dates, and bullet points
- `getWorkExperiences.ts` reads and parses these files at build time
- `WorkExperienceSection.tsx` renders short blurbs and links to each page


## 🔁 Dynamic Content Loading


- **About Section**: Uses `fetch()` in the browser to load `/public/content/about/about.md`
- **Experience**: Loaded using server-side file system access at build time


## 🎨 Markdown Styling Caveats


`ReactMarkdown` does not support `className` directly unless you use custom components or plugins.
To style markdown:
- Wrap it in a styled div
- Use global styles or override element tags with CSS


## 📂 Folder Structure
```
- src/
  - app/
    - page.tsx       # Loads Home component and passes props
  - components/
    - Home.tsx
    - WorkExperienceSection.tsx
  - lib/
    - getWorkExperiences.ts
    - readExperience.ts
  - styles/
    - landing.module.css
  - types/
    - experience.ts
- public/
  - content/
    - about/about.md
    - experience/zillion.md
    - experience/engineering-it.md
    - experience/clarkambassador.md
```

---

# Project Website Development: Full Implementation Learnings

This document outlines all the key learnings, steps, and architecture decisions made during the development of a personal project website using **Next.js**, **React**, and **Markdown-based content routing**.

---

## 🗂 Project Structure

```
├── app
│   ├── projects
│   │   ├── [slug]
│   │   │   └── page.tsx       # Dynamic project detail renderer
│   │   └── page.tsx           # Project listing
│   ├── layout.tsx             # Global layout
│   ├── page.tsx               # Homepage
├── components
│   └── WorkExperienceSection.tsx
├── lib
│   ├── getProjects.ts         # Loads featured project metadata
│   └── readProject.ts         # Reads individual project files
├── public
│   └── content
│       └── projects
│           └── Featured
│               └── [slug]
│                   ├── index.md      # Markdown + YAML metadata
│                   ├── image.jpg     # Optional image
│                   ├── *.stl, *.pdf  # Linked assets
├── styles
│   └── landing.module.css     # Terminal-style aesthetic
```

---

## 🧠 Core Concepts

### 📦 Content-Based Routing

- Projects are organized into folders under `public/content/projects/Featured/[slug]`.
- Each project has an `index.md` file with YAML frontmatter:
  ```yaml
  ---
  title: "NaviGatr"
  summary: "AI vision device for the blind."
  tags: ["AI", "Hardware"]
  youtube: "https://youtu.be/abc123"
  pdfs: ["Final_Report.pdf"]
  stls: ["headset.stl"]
  docs: ["wiring.md"]
  ---
  ```

### 📚 Dynamic Reading

- `getProjects.ts` reads each folder's `index.md` and returns project metadata.
- `readProject.ts` reads and parses a single markdown file with `gray-matter`.

### 🔁 Slug Routing

- The `[slug]/page.tsx` file dynamically renders a detail view for a project using the folder name as the slug.
- Clicking a project card takes you to `/projects/my-project-slug`.

### 🧾 Markdown + Asset Integration

- Uses `ReactMarkdown` and `remark-gfm` to render content.
- Image `![](xyz.jpg)` tags are auto-rewritten to resolve from the correct folder:
  ```ts
  const resolvedSrc = src.startsWith("http") || src.startsWith("data:image")
    ? src
    : `/content/projects/Featured/${params.slug}/${src}`;
  ```

### 🧊 STL + Doc Viewers

- STL files link to a `/stl-viewer` page with query params to render models.
- Markdown docs open in a `/doc-viewer` page for readability.

### 🎯 Project Cards

- The main `/projects/page.tsx` shows all featured projects with title, summary, and image.
- Clicking a card routes to its `[slug]` detail.

---

## 💡 Developer Notes

- Markdown files must contain valid frontmatter.
- Image references in Markdown should be filenames only (e.g., `photo.jpg`).
- Avoid spaces in folder names; use kebab-case or underscores for slugs.
- Assets must be inside `public/` to be directly linkable.

---

## 🛠 Styling Goals (WIP)

- Terminal-like appearance (black background, green/white text).
- Mobile and desktop layout responsiveness.
- Scroll-fixed parallax background image.

---

## ✅ Example Markdown Usage

```markdown
![Circuit Diagram](circuit.jpg)
:link: [Open Source Code](https://github.com/user/repo)
```

---

## 🧪 Base64 Images

- Previously used Base64 images were moved to regular `.jpg` files.
- Use Python script to decode any remaining `.md` base64 files if needed.

---

## 👨‍💻 Final Notes

- Hot reload is instant after first compile.
- Initial dev compile may take 5–6 minutes due to Markdown processing.
- All changes to content files are live after first boot.

---

Built with ❤️ using Next.js, React, and your own Markdown knowledge base.

---

# STL Viewer and Markdown Viewer Setup Guide

This document explains the implementation of the **STL Viewer** and **Markdown Viewer** for the personal website project. It is intended for new developers contributing to the project.

---

## 📦 STL Viewer

### Purpose
To display `.stl` files directly in the browser using a 3D model viewer.

### Path
```
/app/stl-viewer/page.tsx
```

### Key Features
- Uses `useSearchParams` to fetch the `file` URL from query string.
- Uses `@react-three/fiber` and `@react-three/drei` to render STL in 3D.
- Includes OrbitControls for interactive rotation and zoom.
- Includes lighting and auto-centering.

### Sample Usage
```tsx
const fileUrl = searchParams.get('file'); // Ex: /content/builds/section/slug/model.stl
```

### Dependencies Required
Install the following if not already present:
```bash
npm install @react-three/fiber @react-three/drei three
```

### Embedding STL
```tsx
<primitive object={scene} dispose={null} />
```

---

## 📘 Markdown Viewer

### Purpose
To render `.md` documents with embedded images and GitHub-style formatting.

### Path
```
/app/doc-viewer/page.tsx
```

### Key Features
- Reads Markdown files dynamically via `fetch(fileUrl)`.
- Uses `ReactMarkdown` and `remark-gfm` for rendering.
- Automatically resolves relative image paths based on file's location.
- Monospace style and dark background for consistency.

### Sample Image Resolver
```tsx
img: ({ src, alt }) => {
  const resolvedSrc = fileUrl?.split('/').slice(0, -1).join('/') + '/' + safeSrc;
  return <img src={resolvedSrc} alt={alt || ''} ... />
}
```

### Dependencies Required
```bash
npm install react-markdown remark-gfm
```

### Example Use Case
URL: `/doc-viewer?file=/content/projects/Featured/my-project/doc.md`

---

## 🧪 Tips for New Developers

- Always validate your `file` URLs and ensure they are inside `public/content`.
- STL files must have the `.stl` extension; 3MF is not supported by default.
- Markdown viewer works with any `.md` file placed in the correct folder.
- Use `encodeURIComponent` when linking to avoid URL issues with spaces.

---

## 📁 Folder Convention
Make sure your STL and Markdown files are placed in:

```
/public/content/projects/Featured/<slug>/...
/public/content/builds/<section>/<slug>/...
```

---

For further customization, see styles in `landing.module.css` or add your own.

---

# Personal Website Setup Guide

This markdown file captures all the key steps and learnings from the July 2025 build of the portfolio website. It is written for onboarding new developers to understand and recreate the site locally or in production.

---

## 📁 Folder Structure

```
/public
  /content
    /about
    /employment
    /projects
      /Featured
        /<slug>
          - index.md
          - image.jpg
          - other files (PDF, STL, etc.)
    /builds
    /knowledge
    /interests

/src
  /app
    /projects
      /[slug]/page.tsx
      /page.tsx
    /builds
      /[slug]/page.tsx
    /docviewer/page.tsx
  /components
    - ProjectCard.tsx
    - WorkExperienceSection.tsx
  /lib
    - getProjects.ts
    - readProject.ts
    - getWorkExperiences.ts
    - readBuild.ts
  /styles
    - landing.module.css
  - layout.tsx
  - Home.tsx
```

---

## ✅ Features Implemented

### 1. 🔧 Project Routing

- Uses dynamic route `[slug]/page.tsx` for `/projects` and `/builds`.
- Markdown files stored in `/public/content/...`.
- Slugs are read using `fs.readdirSync()` and `gray-matter`.

### 2. 📁 File Parsing with Frontmatter

Used `gray-matter` to extract metadata:
```ts
const {{ data, content }} = matter(file);
```

### 3. 🧠 Markdown Rendering

- Used `react-markdown` with `remark-gfm`.
- Custom rendering logic for images:
```tsx
img: ({{ src }}) => {{
  const resolvedSrc = `/content/.../${{safeSrc}}`;
  return <img src={{resolvedSrc}} style={{ ... }} />
}}
```

### 4. 🧊 STL Viewer Support

- STL files linked using `/stl-viewer?file=...`.
- 3MF files are **not supported** by STL viewer.

### 5. 📽️ YouTube Support

- **Shorts** don't embed properly by default.
- Convert all URLs to `https://www.youtube.com/embed/<video_id>`.

### 6. 🧠 Interests and Knowledge Sections

- Render all loose `.md` files inside `/content/interests/` and `/content/knowledge/`.
- Use same markdown + image handling as projects.

### 7. 🛠 Build Ordering

- Work experience sorted with `order` field in frontmatter.
- Sorting logic:
```ts
.sort((a, b) => (b.order || 0) - (a.order || 0));
```

### 8. 🎨 Styling and Display

- Centralized in `landing.module.css`.
- Circle-floating image added in Home page with conditional render and positioning.
- Headings styled using standard `h1`, `h2` and `.projectDetail`, `.markdownContent`.

### 9. 🧷 Footer + Navbar Socials

- Added `react-icons`:
  - GitHub: `FaGithub`
  - LinkedIn: `FaLinkedin`
  - Email: `HiOutlineMail`
- Socials shown in `Home.tsx` header or footer.

### 10. 🌐 GitHub Links on Projects

- Added to metadata:
```yaml
github: "https://github.com/user/project"
```
- Rendered with GitHub button using inline styles.

---

## 🧪 Common Errors & Fixes

- ❌ **params.slug used synchronously**
  ✅ Convert page to `async function` and `await readProject(params.slug)`

- ❌ YouTube Shorts not embedding
  ✅ Convert Shorts URL to `https://www.youtube.com/embed/<id>`

- ❌ Image not found
  ✅ Ensure path resolution is relative to `/public/content/...`

---

## 🌍 Hosting & Deployment

1. **Local Hosting:**
   Run using `npm run dev`.

2. **Production Hosting (Vercel recommended):**
   - Push to GitHub
   - Connect repo to Vercel
   - Set output directory and `public/` folder visibility

3. **Favicon:**
   - Replace `/public/favicon.ico` with custom icon
   - Takes effect automatically

---

_Last updated: 2025-07-23_


---


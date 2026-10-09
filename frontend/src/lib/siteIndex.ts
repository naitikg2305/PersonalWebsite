// One index of every page on the site: powers the ⌘K palette and turns chatbot
// source paths (content-relative .md paths) into links.
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export type IndexSection = 'About' | 'Experience' | 'Education' | 'Projects' | 'Builds' | 'Knowledge' | 'Interests';

export interface IndexItem {
  title: string;
  url: string;
  section: IndexSection;
  summary: string;
  category?: string;
  /** content-relative markdown paths that belong to this page (matches chatbot sources) */
  paths: string[];
}

// retired from the site but still on disk
const HIDDEN = new Set(['clark-ambassador.md']);

const CONTENT = path.join(process.cwd(), 'public', 'content');

async function readMd(rel: string) {
  return matter(await fs.readFile(path.join(CONTENT, rel), 'utf-8'));
}

async function list(rel: string): Promise<string[]> {
  try {
    return await fs.readdir(path.join(CONTENT, rel));
  } catch {
    return [];
  }
}

export async function getSiteIndex(): Promise<IndexItem[]> {
  const items: IndexItem[] = []; // (the About page is off the site for now)

  for (const file of (await list('employment')).filter((f) => f.endsWith('.md') && !HIDDEN.has(f))) {
    const { data } = await readMd(`employment/${file}`);
    items.push({
      title: `${data.company}: ${data.title}`,
      url: `/experience/${file.replace(/\.md$/, '')}`,
      section: 'Experience',
      summary: data.summaryPoints?.[0] ?? data.dates ?? '',
      paths: [`employment/${file}`],
    });
  }

  for (const file of (await list('education')).filter((f) => f.endsWith('.md'))) {
    const { data } = await readMd(`education/${file}`);
    items.push({
      title: data.title ?? file,
      url: `/education/${file.replace(/\.md$/, '')}`,
      section: 'Education',
      summary: data.summaryPoints?.[0] ?? '',
      paths: [`education/${file}`],
    });
  }

  for (const group of ['Software', 'Featured']) {
    for (const dir of await list(`projects/${group}`)) {
      const files = (await list(`projects/${group}/${dir}`)).filter((f) => f.endsWith('.md'));
      if (!files.includes('index.md')) continue;
      const { data } = await readMd(`projects/${group}/${dir}/index.md`);
      items.push({
        title: data.title ?? dir,
        url: `/projects/${dir}`,
        section: 'Projects',
        summary: data.summary ?? '',
        paths: files.map((f) => `projects/${group}/${dir}/${f}`),
      });
    }
  }

  for (const section of await list('builds')) {
    for (const dir of await list(`builds/${section}`)) {
      try {
        const { data } = await readMd(`builds/${section}/${dir}/index.md`);
        items.push({
          title: data.title ?? dir,
          url: `/builds/${data.slug ?? dir}?section=${section}`,
          section: 'Builds',
          summary: data.summary ?? '',
          paths: [`builds/${section}/${dir}/index.md`],
        });
      } catch {
        /* folder without index.md */
      }
    }
  }

  for (const file of (await list('knowledge')).filter((f) => f.endsWith('.md'))) {
    const { data } = await readMd(`knowledge/${file}`);
    items.push({
      title: data.title ?? file,
      url: `/knowledge/${file.replace(/\.md$/, '')}`,
      section: 'Knowledge',
      summary: data.summary ?? '',
      category: data.category,
      paths: [`knowledge/${file}`],
    });
  }

  for (const file of (await list('interests')).filter((f) => f.endsWith('.md'))) {
    const { data } = await readMd(`interests/${file}`);
    items.push({
      title: data.title ?? file,
      url: `/interests/${file.replace(/\.md$/, '')}`,
      section: 'Interests',
      summary: data.summary ?? '',
      paths: [`interests/${file}`],
    });
  }

  return items;
}

// lib/readProject.ts

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const projectsRoot = path.join(process.cwd(), 'public', 'content', 'projects');

// Software/ is checked first, then Featured/ (the original location).
const SEARCH_DIRS = ['Software', 'Featured'] as const;
export type ProjectDir = (typeof SEARCH_DIRS)[number];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readProject(slug: string): Promise<{
  data: Project;
  content: string;
  /** Content folder the project was found in; used to build asset URLs. */
  dir: ProjectDir;
}> {
  const decoded = decodeURIComponent(slug);

  let dir: ProjectDir = 'Featured';
  for (const candidate of SEARCH_DIRS) {
    if (await exists(path.join(projectsRoot, candidate, decoded, 'index.md'))) {
      dir = candidate;
      break;
    }
  }

  const basePath = path.join(projectsRoot, dir);
  const indexPath = path.join(basePath, decoded, 'index.md');
  const file = await fs.readFile(indexPath, 'utf-8');
  const { data, content } = matter(file);

  let stlCard = '';
  if (await exists(path.join(basePath, slug, 'card.stl'))) {
    stlCard = `/content/projects/${dir}/${slug}/card.stl`;
  }

  // Featured projects keep their original behaviour (image.jpg always referenced).
  // Software projects only show a banner if an image actually exists.
  let image = `/content/projects/${dir}/${slug}/image.jpg`;
  if (dir === 'Software' && !(await exists(path.join(basePath, decoded, 'image.jpg')))) {
    image = '';
  }

  const category = dir === 'Software' ? 'software' : data.category || '';

  return {
    data: {
      title: data.title || slug,
      slug,
      summary: data.summary || '',
      date: data.date || '',
      image,
      pdfs: data.pdfs || [],
      stls: data.stls || [],
      stlCard,
      docs: data.docs || [],
      youtube: data.youtube || '',
      github: data.github || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      category,
    },
    content,
    dir,
  };
}

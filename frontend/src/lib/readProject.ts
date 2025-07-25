// lib/readProject.ts

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const basePath = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');

export async function readProject(slug: string): Promise<{
  data: Project;
  content: string;
}> {
  const indexPath = path.join(basePath, decodeURIComponent(slug), 'index.md');
  const file = await fs.readFile(indexPath, 'utf-8');
  const { data, content } = matter(file);

  return {
    data: {
      title: data.title || slug,
      slug,
      summary: data.summary || '',
      date: data.date || '',
      image: `/content/projects/Featured/${slug}/image.jpg`,
      pdfs: data.pdfs || [],
      stls: data.stls || [],
      docs: data.docs || [],
      youtube: data.youtube || '',
      github: data.github || '', // ✅ include if used
    },
    content,
  };
}

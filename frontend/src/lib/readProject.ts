// lib/readProject.ts

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const basePath = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');

export function readProject(slug: string): {
  data: Project;
  content: string;
} {
  const indexPath = path.join(basePath, decodeURIComponent(slug), 'index.md');
  const file = fs.readFileSync(indexPath, 'utf-8');
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
    },
    content,
  };
}

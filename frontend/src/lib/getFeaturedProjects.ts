// lib/getFeaturedProjects.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

export function getFeaturedProjects(): Project[] {
  const dir = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');
  const folders = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  const projects: Project[] = folders.map((folder) => {
    const folderPath = path.join(dir, folder.name);
    const indexPath = path.join(folderPath, 'index.md');

    const file = fs.readFileSync(indexPath, 'utf8');
    const { data } = matter(file);

    return {
      title: data.title || folder.name,
      slug: folder.name, // ✅ so links work
      summary: data.summary || '',
      date: data.date || '',
      image: `/content/projects/Featured/${folder.name}/image.jpg`, // ✅ so images work
      pdfs: data.pdfs || [],
      stls: data.stls || [],
      stlCard: data.stlCard || '',
      docs: data.docs || [],
      youtube: data.youtube || '',
      github: data.github || '',
      order: data.order ?? 999, // keep sorting behavior
    };
  });

  // Sort by 'order' (lowest first)
  projects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return projects;
}

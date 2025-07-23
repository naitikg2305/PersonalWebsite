// lib/getProjects.ts

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const projectsDir = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');

export function getProjects(): Project[] {
  const projectFolders = fs.readdirSync(projectsDir);

  return projectFolders.map((folder) => {
    const folderPath = path.join(projectsDir, folder);
    const indexPath = path.join(folderPath, 'index.md');

    if (!fs.existsSync(indexPath)) return null;

    const file = fs.readFileSync(indexPath, 'utf-8');
    const { data } = matter(file);

    return {
      title: data.title || folder,
      slug: folder,
      summary: data.summary || '',
      date: data.date || '',
      image: `/content/projects/Featured/${folder}/image.jpg`, // optional fallback to a placeholder
      pdfs: data.pdfs || [],
      stls: data.stls || [],
      docs: data.docs || [],
      youtube: data.youtube || '',
    };
  }).filter(Boolean) as Project[];
}

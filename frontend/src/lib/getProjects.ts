import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const projectsDir = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');

export function getProjects(): Project[] {
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory()) // ✅ Only folders
    .map((folder) => {
      const folderPath = path.join(projectsDir, folder.name);
      const indexPath = path.join(folderPath, 'index.md');

      if (!fs.existsSync(indexPath)) return null;

      const file = fs.readFileSync(indexPath, 'utf-8');
      const { data } = matter(file);

      return {
        title: data.title || folder.name,
        slug: folder.name,
        summary: data.summary || '',
        date: data.date || '',
        image: `/content/projects/Featured/${folder.name}/image.jpg`, // or fallback
        pdfs: data.pdfs || [],
        stls: data.stls || [],
        docs: data.docs || [],
        youtube: data.youtube || '',
        github: data.github || '',
      };
    })
    .filter(Boolean) as Project[];
}

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const projectsDir = path.join(process.cwd(), 'public', 'content', 'projects', 'Featured');

export async function getProjects(): Promise<Project[]> {
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });

    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (folder) => {
          const folderPath = path.join(projectsDir, folder.name);
          const indexPath = path.join(folderPath, 'index.md');
          const cardStlPath = path.join(folderPath, 'card.stl');

          try {
            const file = await fs.readFile(indexPath, 'utf-8');
            const { data } = matter(file);
            let stlCard = '';
            try {
              await fs.access(cardStlPath);
              stlCard = `/content/projects/Featured/${folder.name}/card.stl`;
            } catch {
              // No STL file → leave as empty string
              stlCard = '';
            }

            return {
              title: data.title || folder.name,
              slug: folder.name,
              summary: data.summary || '',
              date: data.date || '',
              image: `/content/projects/Featured/${folder.name}/image.jpg`,
              pdfs: data.pdfs || [],
              stls: data.stls || [],
              stlCard,
              docs: data.docs || [],
              youtube: data.youtube || '',
              github: data.github || '',
            };
          } catch {
            console.warn(`[SKIP] Missing or unreadable index.md in: ${folder.name}`);
            return null;
          }
        })
    );

    return projects.filter(Boolean) as Project[];
  } catch (err) {
    console.error(`[getProjects] Failed to read project dir: ${err}`);
    return [];
  }
}

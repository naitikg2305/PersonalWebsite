// lib/getSoftwareProjects.ts
//
// Loads the "Software Projects" section of /projects.
// Sources:
//   1. public/content/projects/Software/<slug>/index.md  (software-only projects)
//   2. public/content/projects/Featured/<slug>/index.md with `category: "software"`
//      (e.g. the website project, which stays in Featured/ so the homepage
//      featured section and existing URLs are unchanged)
// Sorted by `order` (lowest first). Software cards never use STL previews.

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Project } from '../types/project';

const projectsRoot = path.join(process.cwd(), 'public', 'content', 'projects');

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadFrom(subdir: 'Software' | 'Featured'): Promise<Project[]> {
  const dir = path.join(projectsRoot, subdir);
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (folder): Promise<Project | null> => {
        const folderPath = path.join(dir, folder.name);
        try {
          const file = await fs.readFile(path.join(folderPath, 'index.md'), 'utf-8');
          const { data } = matter(file);
          const category = subdir === 'Software' ? 'software' : data.category;
          if (category !== 'software') return null;

          const hasImage = await fileExists(path.join(folderPath, 'image.jpg'));
          return {
            title: data.title || folder.name,
            slug: folder.name,
            summary: data.summary || '',
            date: data.date || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            // `softwareOrder` lets Featured/ projects set their Software-section position
            // without changing the homepage featured order (which uses `order`).
            order: data.softwareOrder ?? data.order ?? 999,
            image: hasImage ? `/content/projects/${subdir}/${folder.name}/image.jpg` : '',
            github: data.github || '',
            category: 'software',
          };
        } catch {
          console.warn(`[SKIP] Missing or unreadable index.md in: ${subdir}/${folder.name}`);
          return null;
        }
      })
  );

  return projects.filter(Boolean) as Project[];
}

export async function getSoftwareProjects(): Promise<Project[]> {
  const [software, featuredSoftware] = await Promise.all([
    loadFrom('Software'),
    loadFrom('Featured'),
  ]);
  const seen = new Set<string>();
  const all = [...software, ...featuredSoftware].filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
  all.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return all;
}

// lib/getBuilds.ts
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Build } from '../types/build';

export async function getBuilds(): Promise<Build[]> {
  const sections: ('3d-printing' | 'car-projects')[] = ['3d-printing', 'car-projects'];
  const builds: Build[] = [];

  for (const section of sections) {
    const sectionPath = path.join(process.cwd(), 'public', 'content', 'builds', section);

    try {
      const folders = await fs.readdir(sectionPath);

      for (const folder of folders) {
        const filePath = path.join(sectionPath, folder, 'index.md');

        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const { data, content } = matter(fileContent);

          if (!data.slug || !data.title || !data.summary) {
            console.warn(`[SKIP] Missing required frontmatter in: ${folder}`);
            continue;
          }

          console.log(`[BUILD] Loaded: ${data.slug} from ${section}/${folder}`);

          builds.push({
  title: data.title || folder,
  slug: data.slug || folder,
  summary: data.summary || '',
  image: data.image || '',
  tags: data.tags || [],
  stls: data.stls || [],
  pdfs: data.pdfs || [],
  docs: data.docs || [],
  date: data.date || '',
  section,
  content,
});
        } catch {
          console.warn(`[SKIP] index.md not found or unreadable in ${folder}`);
        }
      }
    } catch {
      console.warn(`[WARN] Section directory not found or unreadable: ${sectionPath}`);
    }
  }

  return builds;
}

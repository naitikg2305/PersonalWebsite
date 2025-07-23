// lib/getBuilds.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Build } from '../types/build';

export function getBuilds(): Build[] {
  const sections: ('3d-printing' | 'car-projects')[] = ['3d-printing', 'car-projects'];
  const builds: Build[] = [];

  for (const section of sections) {
    const sectionPath = path.join(process.cwd(), 'public','content', 'builds', section);
    if (!fs.existsSync(sectionPath)) {
      console.warn(`[WARN] Section directory not found: ${sectionPath}`);
      continue;
    }

    const folders = fs.readdirSync(sectionPath);
    for (const folder of folders) {
      const filePath = path.join(sectionPath, folder, 'index.md');
      if (!fs.existsSync(filePath)) {
        console.warn(`[SKIP] Missing index.md in: ${folder}`);
        continue;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      if (!data.slug || !data.title || !data.summary) {
        console.warn(`[SKIP] Missing required frontmatter in: ${folder}`);
        continue;
      }

      console.log(`[BUILD] Loaded: ${data.slug} from ${section}/${folder}`);

      builds.push({
        ...data,
        section,
        content,
      });
    }
  }

  return builds;
}

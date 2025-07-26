// lib/getInterests.ts
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const basePath = path.join(process.cwd(), 'public', 'content', 'interests');

export async function getInterests(): Promise<{ slug: string; title: string }[]> {
  const files = await fs.readdir(basePath);

  const interests = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const slug = file.replace(/\.md$/, '');
        const fullPath = path.join(basePath, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data } = matter(content);

        return {
          slug,
          title: data.title || slug,
        };
      })
  );

  return interests;
}

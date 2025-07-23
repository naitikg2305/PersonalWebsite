import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function readBuild(section: string, slug: string) {
  const filePath = path.join(process.cwd(), 'public','content', 'builds', section, slug, 'index.md');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  return { data, content };
}

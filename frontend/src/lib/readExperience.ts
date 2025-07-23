import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function readExperience(slug: string) {
  const filePath = path.join(process.cwd(), 'public/content/employment', `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { content, data } = matter(fileContent);

  return { content, data };
}


import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Interest {
  slug: string;
  title: string;
  content: string;
}

export function getInterests(): Interest[] {
  const dir = path.join(process.cwd(), 'public', 'content', 'interests');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const filePath = path.join(dir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      return {
        slug: file.replace('.md', ''),
        title: data.title || file.replace('.md', ''),
        content,
      };
    });
}

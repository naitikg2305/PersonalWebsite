import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export interface KnowledgeNote {
  slug: string;
  title: string;
  content: string;
}

export async function getKnowledge(): Promise<KnowledgeNote[]> {
  const dir = path.join(process.cwd(), 'public', 'content', 'knowledge');

  try {
    const files = await fs.readdir(dir);

    const notes = await Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => {
          const filePath = path.join(dir, file);
          const raw = await fs.readFile(filePath, 'utf-8');
          const { data, content } = matter(raw);

          return {
            slug: file.replace('.md', ''),
            title: data.title || file.replace('.md', ''),
            content,
          };
        })
    );

    return notes;
  } catch (err) {
    console.warn(`[getKnowledge] Failed to read directory: ${err}`);
    return [];
  }
}

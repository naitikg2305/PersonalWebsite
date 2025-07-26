import fs from 'fs/promises'; // ✅ async
import path from 'path';
import matter from 'gray-matter';

const educationBasePath = path.join(process.cwd(), 'public', 'content', 'education');

export async function readEducation(slug: string) {
  const filePath = path.join(educationBasePath, `${slug}.md`);
  const file = await fs.readFile(filePath, 'utf-8'); // ✅ async read
  const { data, content } = matter(file);

  return {
    data: {
      title: data.title,
      company: data.company,
      dates: data.dates,
      location: data.location,
      slug,
      summaryPoints: data.summaryPoints || [],
    },
    content,
  };
}

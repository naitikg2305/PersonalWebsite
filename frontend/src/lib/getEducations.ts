import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Experience } from '../types/experience';

const educationPath = path.join(process.cwd(), 'public', 'content', 'education');

export function getEducations(): Experience[] {
  const files = fs.readdirSync(educationPath).filter(f => f.endsWith('.md'));

  return files.map((filename) => {
    const file = fs.readFileSync(path.join(educationPath, filename), 'utf-8');
    const { data } = matter(file);
    const slug = filename.replace(/\.md$/, '');

    return {
      title: data.title,
      company: data.company,
      dates: data.dates,
      location: data.location,
      slug,
      summaryPoints: data.summaryPoints || [],
    };
  });
}

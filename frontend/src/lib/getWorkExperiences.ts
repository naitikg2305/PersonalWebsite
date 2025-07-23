import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Experience } from '../types/experience';

export function getWorkExperiences(): Experience[] {
  const dir = path.join(process.cwd(), 'public/content/employment');
  const files = fs.readdirSync(dir);

  return files.map((filename) => {
    const file = fs.readFileSync(path.join(dir, filename), 'utf8');
    const { data } = matter(file);
    return data as Experience;
  });
}

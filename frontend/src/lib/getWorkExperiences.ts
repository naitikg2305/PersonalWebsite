import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Experience } from '../types/experience';

export function getWorkExperiences(): Experience[] {
  const dir = path.join(process.cwd(), 'public/content/employment');
  const files = fs.readdirSync(dir);

  const experiences = files.map((filename) => {
    const file = fs.readFileSync(path.join(dir, filename), 'utf8');
    const { data } = matter(file);
    return data as Experience;
  });

  // Sort by 'order' field (lowest = first). Default to 999 if missing.
  //experiences.sort((a, b) =>  new Date(b.date).getTime() - new Date(a.date).getTime()  );

  experiences.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return experiences;
}

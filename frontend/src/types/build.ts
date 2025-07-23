// /types/build.ts

export interface Build {
  title: string;
  slug: string;
  summary: string;
  image?: string;
  tags?: string[];
  stls?: string[];
  pdfs?: string[];
  docs?: string[];
  date?: string;
  section: '3d-printing' | 'car-projects';
  content?: string;
}

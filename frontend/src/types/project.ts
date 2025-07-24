export interface Project {
  title: string;
  slug: string;
  summary: string;
  tags?: string[];
  date?: string;
  image?: string;
  youtube?: string;
  pdfs?: string[];
  stls?: string[];
  docs?: string[];
  github?: string;
  files?: {
    name: string;
    path: string;
  }[];
}

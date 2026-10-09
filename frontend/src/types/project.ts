export interface Project {
  title: string;
  slug: string;
  summary: string;
  tags?: string[];
  order?: number;
  date?: string;
  image?: string;
  youtube?: string;
  pdfs?: string[];
  stls?: string[];
  docs?: string[];
  stlCard?: string;
  github?: string;
  /** 'software' for projects shown in the Software Projects section */
  category?: string;
  files?: {
    name: string;
    path: string;
  }[];
}

export type ExperienceBullet = {
  main: string;
  sub?: string[];
};

export type ExperiencePosition = {
  role: string;
  dates: string;
  bullets: ExperienceBullet[];
};

export type Experience = {
  title: string;
  company: string;
  dates: string;
  location: string;
  slug: string;
  summaryPoints: string[];
  positions?: ExperiencePosition[];
  order?: number;
};

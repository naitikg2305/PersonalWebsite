'use client';

import Link from 'next/link';
import styles from '../styles/landing.module.css';

interface BuildCardProps {
  title: string;
  slug: string;
  summary: string;
  image?: string;
  section: string;
}

export default function BuildCard({ title, slug, summary, image, section }: BuildCardProps) {
  return (
    <div className={styles.experienceCard}>
      <h3>{title}</h3>
      <p>{summary}</p>
      {image && <img src={`/content/builds/${section}/${slug}/${image}`} alt={title} style={{ width: '100%', maxWidth: '400px', margin: '1rem 0' }} />}
      <Link href={`/builds/${slug}?section=${section}`}>Read more →</Link>
    </div>
  );
}

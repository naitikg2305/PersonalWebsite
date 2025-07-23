'use client';

import styles from '../styles/landing.module.css';
import Link from 'next/link';
import { Experience } from '../types/experience';

interface Props {
  experiences: Experience[];
}

export default function WorkExperienceSection({ experiences }: Props) {
  return (
    <div className={styles.experienceSection} id="experience">
      <h2 style={{ marginBottom: '1rem', color: '#00ff00' }}>Work Experience</h2>

      {experiences.map((exp) => (
        <div key={exp.slug} className={styles.experienceCard}>
          <h3>{exp.title} — {exp.company}</h3>
          <p><em>{exp.dates} • {exp.location}</em></p>
          <ul>
            {exp.summaryPoints.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
          <Link href={`/experience/${exp.slug}`}>
            Read more →
          </Link>
        </div>
      ))}
    </div>
  );
}

'use client';

import styles from '../styles/landing.module.css';
import Link from 'next/link';
import { Experience } from '../types/experience';

interface Props {
  educations: Experience[];
}

export default function EducationSection({ educations }: Props) {
  return (
    <div className={`${styles.contentContainer} ${styles.educationSpacingFix}`} id="education">
      <div className={styles.terminal}>
        <div className={styles.terminalHeader}>education.md</div>
        <div className={styles.terminalBody}>
          {educations.map((edu) => (
            <div key={edu.slug} className={styles.experienceCard}>
              <h3>{edu.title} — {edu.company}</h3>
              <p><em>{edu.dates} • {edu.location}</em></p>
              <ul>
                {edu.summaryPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
              <Link href={`/education/${edu.slug}`}>
                Read more →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

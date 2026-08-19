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
          <h3>{exp.positions?.length ? exp.company : `${exp.title} — ${exp.company}`}</h3>
          <p><em>{exp.dates} • {exp.location}</em></p>
          {exp.positions && exp.positions.length > 0 ? (
            <div className={styles.positionsList}>
              {exp.positions.map((pos, posIdx) => (
                <div key={posIdx} className={styles.positionBlock}>
                  <h4>{pos.role} — {pos.dates}</h4>
                  <ul>
                    {pos.bullets.map((b, i) => (
                      <li key={i}>
                        <strong>{b.main}</strong>
                        {b.sub && b.sub.length > 0 && (
                          <ul>
                            {b.sub.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul>
              {exp.summaryPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          )}
          <Link href={`/experience/${exp.slug}`}>
            Read more →
          </Link>
        </div>
      ))}
    </div>
  );
}

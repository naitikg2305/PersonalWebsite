// components/ProjectCard.tsx
'use client';
import Link from 'next/link';
import styles from '../styles/landing.module.css';
import { Project } from '../types/project';

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  return (
    <Link href={`/projects/${project.slug}`} className={styles.projectCard}>
      <div className={styles.projectImageWrapper}>
        <img
          src={project.image}
          alt={project.title}
          className={styles.projectImage}
          onError={(e) =>
            (e.currentTarget.src = '/placeholder.png') // fallback
          }
        />
      </div>
      <div className={styles.projectContent}>
        <h3>{project.title}</h3>
        <p>{project.summary}</p>
      </div>
    </Link>
  );
}

'use client';
import Link from 'next/link';
import styles from '../styles/landing.module.css';
import { Project } from '../types/project';
import { FaGithub } from 'react-icons/fa';

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  return (
    <div className={styles.projectCard}>
      <Link href={`/projects/${project.slug}`} className={styles.projectCardLink}>
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

      {/* ✅ GitHub Icon */}
      {project.github && (
        <a
          href={project.github}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubIcon}
          title="View on GitHub"
        >
          <FaGithub size={22} />
        </a>
      )}
    </div>
  );
}

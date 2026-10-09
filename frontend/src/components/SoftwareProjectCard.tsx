import Link from 'next/link';
import { FaGithub } from 'react-icons/fa';
import styles from '../styles/softwareProjects.module.css';
import { Project } from '../types/project';

/**
 * Card for the Software Projects section. No STL preview; shows a
 * terminal-style title bar (or a real screenshot if image.jpg exists),
 * title, summary, tags, and a GitHub link when the repo is public.
 */
export default function SoftwareProjectCard({ project }: { project: Project }) {
  return (
    <div className={styles.card}>
      <Link href={`/projects/${project.slug}`} className={styles.cardLink}>
        <div className={styles.cardHeader} aria-hidden="true">
          <span className={`${styles.dot} ${styles.dotActive}`} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.path}>~/projects/{project.slug}</span>
        </div>

        {project.image && (
          <img src={project.image} alt={project.title} className={styles.image} />
        )}

        <div className={styles.body}>
          <h3 className={styles.title}>{project.title}</h3>
          <p className={styles.summary}>{project.summary}</p>
          {project.tags && project.tags.length > 0 && (
            <ul className={styles.tagList} aria-label="Tags">
              {project.tags.map((tag) => (
                <li key={tag} className={styles.tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>
      </Link>

      {project.github && (
        <a
          href={project.github}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.github}
          title="View on GitHub"
          aria-label={`${project.title} on GitHub`}
        >
          <FaGithub size={20} />
        </a>
      )}
    </div>
  );
}

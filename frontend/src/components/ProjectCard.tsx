'use client';

import Link from 'next/link';
import styles from '../styles/landing.module.css';
import { Project } from '../types/project';
import { FaGithub } from 'react-icons/fa';
import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load the 3D viewer on the client (avoids SSR issues)
const STLViewer = dynamic(() => import('../components/STLViewer'), { ssr: false });

interface Props {
  project: Project & {
    /** Optional: path like `/models/thing.stl` or full URL */
    stlUrl?: string;
    /** Optional: override viewer height ("240" | "260px" | "18rem" | "40vh") */
    viewerHeight?: number | string;
  };
}

export default function ProjectCard({ project }: Props) {
  const [hover, setHover] = useState(false);

  // Height for the 3D preview area — defaults to your old card image zone feel
  const previewHeight = project.viewerHeight ?? 260;

  // If there’s no STL, we keep the exact old image behavior
  const hasStl = !!project.stlCard;

  return (
    <div
      className={styles.projectCard}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <Link href={`/projects/${project.slug}`} className={styles.projectCardLink}>
        <div className={styles.projectImageWrapper}>
          {hasStl ? (
            // 3D thumbnail (no controls/zoom; rotates on hover)
            <div style={{ width: '100%', height: previewHeight }}>
              <STLViewer
                url={project.stlCard as string}
                height={previewHeight}
                hover={hover}
                controls={false}
                zoom={false}
              />
            </div>
          ) : (
            // Fallback to your original image flow
            <img
              src={project.image}
              alt={project.title}
              className={styles.projectImage}
              onError={(e) => (e.currentTarget.src = '/placeholder.png')}
            />
          )}
        </div>

        <div className={styles.projectContent}>
          <h3>{project.title}</h3>
          <p>{project.summary}</p>
        </div>
      </Link>

      {/* GitHub Icon (unchanged) */}
      {project.github && (
        <a
          href={project.github}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubIcon}
          title="View on GitHub"
          onClick={(e) => e.stopPropagation()}
        >
          <FaGithub size={22} />
        </a>
      )}
    </div>
  );
}

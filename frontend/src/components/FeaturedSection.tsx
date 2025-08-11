// components/FeaturedSection.tsx
'use client';


import { Project } from '@/types/project';
import ProjectCard from './ProjectCard'; // ✅ reuse existing card
import styles from '../styles/landing.module.css';

interface FeaturedProps {
  featuredProjects: Project[];
}

export default function FeaturedSection({ featuredProjects }: FeaturedProps) {
  return (
    <div className={styles.featuredSection}>
      <h2 className={styles.sectionTitle}>Featured Projects</h2>
      <div className={styles.projectGrid}>
        {featuredProjects.slice(0, 3).map((proj) => (
          <ProjectCard key={proj.slug} project={proj} /> 
        ))}
      </div>
    </div>
  );
}

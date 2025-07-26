// app/projects/page.tsx

import { getProjects } from '../../lib/getProjects';
import { Project } from '../../types/project';
import ProjectCard from '../../components/ProjectCard';
import styles from '../../styles/landing.module.css';

export default async function ProjectsPage() {
  const projects: Project[] = await getProjects();

  return (
    <div className={styles.projectGridPage}>
      <h1 className={styles.sectionTitle}>Featured Projects</h1>
      <div className={styles.projectGrid}>
        {projects.map((proj) => (
          <ProjectCard key={proj.slug} project={proj} />
        ))}
      </div>
    </div>
  );
}

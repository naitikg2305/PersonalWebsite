// app/projects/page.tsx

import { getProjects } from '../../lib/getProjects';
import { getSoftwareProjects } from '../../lib/getSoftwareProjects';
import { Project } from '../../types/project';
import ProjectCard from '../../components/ProjectCard';
import SoftwareProjectCard from '../../components/SoftwareProjectCard';
import styles from '../../styles/landing.module.css';
import softwareStyles from '../../styles/softwareProjects.module.css';

export default async function ProjectsPage() {
  const [softwareProjects, projects]: [Project[], Project[]] = await Promise.all([
    getSoftwareProjects(),
    getProjects(),
  ]);

  return (
    <div className={styles.projectGridPage}>
      {softwareProjects.length > 0 && (
        <section className={softwareStyles.section}>
          <h1 className={styles.sectionTitle}>Software Projects</h1>
          <p className={softwareStyles.sectionSubtitle}>
            AI systems, local inference, and tooling
          </p>
          <div className={styles.projectGrid}>
            {softwareProjects.map((proj) => (
              <SoftwareProjectCard key={proj.slug} project={proj} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Hardware &amp; Robotics</h2>
        <div className={styles.projectGrid}>
          {projects.map((proj) => (
            <ProjectCard key={proj.slug} project={proj} />
          ))}
        </div>
      </section>
    </div>
  );
}

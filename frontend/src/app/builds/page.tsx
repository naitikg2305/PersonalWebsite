import { getBuilds } from '../../lib/getBuilds';
import BuildCard from '../../components/BuildCard';
import styles from '../../styles/landing.module.css';

export default function BuildsPage() {
  const builds = getBuilds();
  const carBuilds = builds.filter(b => b.section === 'car-projects');
  const printBuilds = builds.filter(b => b.section === '3d-printing');

  return (
    <div className={styles.experienceSection} id="builds">
      <h2 style={{ color: '#00ff00', marginBottom: '2rem' }}>🧱 Builds</h2>

      <h3 style={{ color: '#00ff00' }}>🛻 Car Projects</h3>
      {carBuilds.map(build => (
        <BuildCard key={build.slug} {...build} />
      ))}

      <h3 style={{ color: '#00ff00', marginTop: '3rem' }}>🧊 3D Printing Projects</h3>
      {printBuilds.map(build => (
        <BuildCard key={build.slug} {...build} />
      ))}
    </div>
  );
}

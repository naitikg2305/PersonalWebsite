import { getBuilds } from '../../lib/getBuilds';
import BuildCard from '../../components/BuildCard';
import styles from '../../styles/landing.module.css';

export default function BuildsPage() {
  const builds = getBuilds();
  const carBuilds = builds.filter(b => b.section === 'car-projects');
  const printBuilds = builds.filter(b => b.section === '3d-printing');

  return (
    <div className={styles.experienceSection} id="builds">
      <h2 style={{
  color: '#00ff00',
  fontSize: '2rem',
  borderBottom: '2px solid #00ff00',
  paddingBottom: '0.5rem',
  marginTop: '2rem'
}}>
  🧱 Builds
</h2>
<h6 style={{
  color: '#00ff00',
  fontSize: '2rem',
  
  paddingBottom: '0.5rem',
  marginTop: '2rem'
}}>
  🛻 Car Projects
</h6>


      
      {carBuilds.map(build => (
        <BuildCard key={build.slug} {...build} />
      ))}
        <h6 style={{
  color: '#00ff00',
  fontSize: '2rem',
  
  paddingBottom: '0.5rem',
  marginTop: '2rem'
}}>
  🧊 3D Printing Projects
</h6>
      
      {printBuilds.map(build => (
        <BuildCard key={build.slug} {...build} />
      ))}
    </div>
  );
}

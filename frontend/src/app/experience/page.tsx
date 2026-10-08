import Link from 'next/link';
import WorkExperienceSection from '@/components/WorkExperienceSection';
import { getWorkExperiences } from '@/lib/getWorkExperiences';

export const metadata = { title: 'Experience · Naitik Gupta' };

// Full work history (moved off the homepage). Timeline blocks link here as /experience#<slug>;
// each card's "Read more" opens /experience/<slug>.
export default function ExperiencePage() {
  const experiences = getWorkExperiences();
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem 4rem', fontFamily: 'monospace' }}>
      <Link href="/" style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: 14 }}>← home</Link>
      <p style={{ marginTop: '1.5rem', color: '#00ff00' }}>
        $ cat experience.md <span style={{ color: '#7f8c86' }}># every role, with the details · open any card for the full write-up</span>
      </p>
      <WorkExperienceSection experiences={experiences} />
    </div>
  );
}

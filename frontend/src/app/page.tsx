import { getWorkExperiences } from '../lib/getWorkExperiences';
import { getEducations } from '../lib/getEducations';
import Home from '../components/Home';
import { Experience } from '../types/experience';
import { getFeaturedProjects } from '@/lib/getFeaturedProjects';

export default function Page() {
  const workExperiences: Experience[] = getWorkExperiences();
  const educations: Experience[] = getEducations();
  const featuredProjects = getFeaturedProjects();

  return <Home workExperiences={workExperiences} educations={educations} featuredProjects={featuredProjects}/>;
}

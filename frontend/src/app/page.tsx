import { getWorkExperiences } from '../lib/getWorkExperiences';
import { getEducations } from '../lib/getEducations';
import Home from '../components/Home';
import { Experience } from '../types/experience';

export default function Page() {
  const workExperiences: Experience[] = getWorkExperiences();
  const educations: Experience[] = getEducations();

  return <Home workExperiences={workExperiences} educations={educations} />;
}

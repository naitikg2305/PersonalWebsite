import { getWorkExperiences } from '../lib/getWorkExperiences';
import Home from '../components/Home';
import { Experience } from '../types/experience';

export default function Page() {
  const workExperiences: Experience[] = getWorkExperiences();
  return <Home workExperiences={workExperiences} />;
}

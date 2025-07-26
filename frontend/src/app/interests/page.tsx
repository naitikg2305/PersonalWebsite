import { getInterests } from '../../lib/getInterests';
import Link from 'next/link';

export default async function InterestsPage() {
  const interests = await getInterests(); // ✅ await

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: '#00ff00' }}>🎯 Interests</h1>
      <ul>
        {interests.map(({ slug, title }) => (
          <li key={slug}>
            <Link href={`/interests/${slug}`}>{title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

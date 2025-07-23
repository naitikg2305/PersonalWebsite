import { getKnowledge } from '../../lib/getKnowledge';
import Link from 'next/link';

export default function KnowledgePage() {
  const notes = getKnowledge();

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: '#00ff00' }}>📚 Knowledge Notes</h1>
      <ul>
        {notes.map(({ slug, title }) => (
          <li key={slug}>
            <Link href={`/knowledge/${slug}`}>{title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

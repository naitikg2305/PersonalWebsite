import { getKnowledge } from '../../lib/getKnowledge';
import Link from 'next/link';

export default async function KnowledgePage() {
  const notes = await getKnowledge();

  // Group notes by category, alphabetically, with titles sorted inside each group
  const groups = new Map<string, typeof notes>();
  for (const note of notes) {
    groups.set(note.category, [...(groups.get(note.category) ?? []), note]);
  }
  const categories = [...groups.keys()].sort();

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#00ff00' }}>📚 Knowledge Notes</h1>
      <p style={{ color: '#aaa' }}>
        Things I&apos;ve learned building software, written up so I (and anyone asking my site&apos;s chatbot) can find them again.
      </p>
      {categories.map((category) => (
        <section key={category} style={{ marginTop: '2rem' }}>
          <h2 style={{ color: '#00ff00', borderBottom: '1px solid #333', paddingBottom: '0.3rem' }}>{category}</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {groups.get(category)!
              .sort((a, b) => a.title.localeCompare(b.title))
              .map(({ slug, title, summary }) => (
                <li key={slug} style={{ margin: '0.9rem 0' }}>
                  <Link href={`/knowledge/${slug}`}>{title}</Link>
                  {summary && <div style={{ color: '#aaa', fontSize: '0.9rem' }}>{summary}</div>}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

import { readEducation } from '../../../lib/readEducation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import styles from '../../../styles/landing.module.css';

export default async function EducationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { content, data } = await readEducation(slug);

  return (
    <div style={{ padding: '2rem', color: '#ffffffff', fontFamily: 'monospace' }}>
      <h1>{data.title}</h1>
      <h2>{data.company}</h2>
      <p>
        <em>
          {data.dates} • {data.location}
        </em>
      </p>
      <hr />
      <div className={styles.markdownContent}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

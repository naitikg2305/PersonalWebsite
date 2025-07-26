import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/landing.module.css';

export default async function InterestDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const filePath = path.join(process.cwd(), 'public', 'content', 'interests', `${slug}.md`);
  const content = await fs.readFile(filePath, 'utf-8'); // ✅ async read

  return (
    <div className={styles.projectDetail}>
      <h1>{slug}</h1>
      <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              const safeSrc = typeof src === 'string' ? src : '';
              const resolvedSrc =
                safeSrc.startsWith('http') || safeSrc.startsWith('data:image')
                  ? safeSrc
                  : `/content/interests/${safeSrc}`;

              return (
                <img
                  src={resolvedSrc}
                  alt={alt || ''}
                  style={{
                    maxWidth: '100%',
                    display: 'block',
                    margin: '1.5rem auto',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    backgroundColor: '#111',
                  }}
                />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

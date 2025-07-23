import { readBuild } from '../../../lib/readBuild';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/landing.module.css';

export default function BuildDetail({ params, searchParams }: { params: { slug: string }, searchParams: { section: string } }) {
  const { slug } = params;
  const section = searchParams.section;
  const { content, data } = readBuild(section, slug);

  return (
    <div className={styles.projectDetail}>
      <h1>{data.title}</h1>
      {data.image && (
        <img
          src={`/content/builds/${section}/${slug}/${data.image}`}
          alt={data.title}
          className={styles.projectBanner}
        />
      )}
      <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              const safeSrc = typeof src === 'string' ? src : '';
              const resolvedSrc =
                safeSrc.startsWith('http') || safeSrc.startsWith('data:image')
                  ? safeSrc
                  : `/content/builds/${section}/${slug}/${safeSrc}`;

              return (
                <img
                  src={resolvedSrc}
                  alt={alt || ''}
                  style={{
                    maxWidth: '100%',
                    display: 'inline',
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

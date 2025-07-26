// src/app/doc-viewer/DocViewerClient.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';
import styles from '../../styles/landing.module.css';

export default function DocViewerClient() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get('file');
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;
    fetch(fileUrl)
      .then((res) => res.text())
      .then(setContent);
  }, [fileUrl]);

  if (!fileUrl) return <p style={{ color: '#ccc', padding: '2rem' }}>No file specified.</p>;
  if (!content) return <p style={{ color: '#ccc', padding: '2rem' }}>Loading...</p>;

  return (
    <div className={styles.projectDetail}>
      <h1 className={styles.sectionTitle}>📚 Document Viewer</h1>
      <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              const safeSrc = typeof src === 'string' ? src : '';
              const resolvedSrc =
                safeSrc.startsWith('http') || safeSrc.startsWith('data:image')
                  ? safeSrc
                  : fileUrl
                      ?.split('/')
                      .slice(0, -1)
                      .join('/') + '/' + safeSrc;

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

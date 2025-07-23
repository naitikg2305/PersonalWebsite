

import { readProject } from '../../../lib/readProject';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/landing.module.css';

export default function ProjectDetailPage({ params }: { params: { slug: string } }) {
  const { data, content } = readProject(params.slug);

  return (
    <div className={styles.projectDetail}>
      {/* Title */}
      <h1>{data.title}</h1>

      {/* Banner Image */}
      {data.image && (
        <img
          src={data.image}
          alt={data.title}
          className={styles.projectBanner}
        />
      )}

      {/* YouTube Embed */}
      {data.youtube && (
        <div className={styles.videoWrapper}>
          <iframe
            src={data.youtube}
            title="YouTube Video"
            allowFullScreen
          />
        </div>
      )}

      {/* Summary */}
      <p className={styles.projectSummary}>{data.summary}</p>

      {/* Linked Files Section */}
      <div className={styles.projectFiles}>
        {data.pdfs?.length > 0 && (
          <FileList title="📄 PDFs" files={data.pdfs} slug={data.slug} prefix="Featured" isViewer={false} />
        )}
        {data.stls?.length > 0 && (
          <FileList title="🧊 STL Files" files={data.stls} slug={data.slug} prefix="Featured" isViewer={true} />
        )}
        {data.docs?.length > 0 && (
          <FileList title="📚 Docs" files={data.docs} slug={data.slug} prefix="Featured" isViewer={false} />
        )}
      </div>

      {/* Markdown Body */}
      <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              const safeSrc = typeof src === 'string' ? src : '';
              return safeSrc ? (
                <img
                  src={safeSrc}
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
              ) : null;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * Shared file list rendering component
 */
function FileList({
  title,
  files,
  slug,
  prefix,
  isViewer,
}: {
  title: string;
  files: string[];
  slug: string;
  prefix: string;
  isViewer: boolean;
}) {
  return (
    <>
      <h3>{title}</h3>
      <ul>
        {files.map((file, idx) => {
          const fileName = file.split('/').pop();
          const href = isViewer
            ? `/stl-viewer?file=/content/projects/${prefix}/${slug}/${file}`
            : `/content/projects/${prefix}/${slug}/${file}`;
          return (
            <li key={idx}>
              <a href={href} target="_blank" rel="noopener noreferrer">
                {fileName}
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

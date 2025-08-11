import { readProject } from '../../../lib/readProject';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/landing.module.css';
import STLViewer from '../../../components/STLViewer';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data, content } = await readProject(slug);

  return (
    <div className={styles.projectDetail}>
      <h1>{data.title}</h1>

      {data.image && (
        <img
          src={data.image}
          alt={data.title}
          className={styles.projectBanner}
        />
      )}

      {data.youtube && (
        <div className={styles.videoWrapper}>
          <iframe
            src={data.youtube}
            title="YouTube Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {data.stlCard && (
  <div style={{ width: '100%', height: '400px', margin: '2rem 0' }}>
    <STLViewer url={data.stlCard} height={400} controls={true} zoom={true} />
  </div>
)}

      <p className={styles.projectSummary}>{data.summary}</p>

      {data.github && (
        <a
          href={data.github}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginBottom: '1.5rem',
            backgroundColor: '#0d1117',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '5px',
            border: '1px solid #30363d',
            fontFamily: 'monospace',
            textDecoration: 'none',
          }}
        >
          🌐 View on GitHub
        </a>
      )}

      <div className={styles.projectFiles}>
        {Array.isArray(data.pdfs) && data.pdfs.length > 0 && (
          <FileList title="📄 PDFs" files={data.pdfs} slug={data.slug} prefix="Featured" isViewer={false} />
        )}
        {Array.isArray(data.stls) && data.stls.length > 0 && (
          <FileList title="🧊 STL Files (viewable)" files={data.stls} slug={data.slug} prefix="Featured" isViewer={true} viewerType="stl-viewer" />
        )}
        {Array.isArray(data.docs) && data.docs.length > 0 && (
          <FileList title="📚 Docs" files={data.docs} slug={data.slug} prefix="Featured" isViewer={true} viewerType="doc-viewer" />
        )}
      </div>

      <div className={styles.markdownContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              const safeSrc = typeof src === 'string' ? src : '';
              const resolvedSrc =
                safeSrc.startsWith('http') || safeSrc.startsWith('data:image')
                  ? safeSrc
                  : `/content/projects/Featured/${slug}/${safeSrc}`;

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

function FileList({
  title,
  files,
  slug,
  prefix,
  isViewer,
  viewerType,
}: {
  title: string;
  files: string[];
  slug: string;
  prefix: string;
  isViewer: boolean;
  viewerType?: 'stl-viewer' | 'doc-viewer';
}) {
  return (
    <>
      <h3>{title}</h3>
      <ul>
        {files.map((file, idx) => {
          const fileName = file.split('/').pop();
          const href = isViewer && viewerType
            ? `/${viewerType}?file=/content/projects/${prefix}/${slug}/${file}`
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

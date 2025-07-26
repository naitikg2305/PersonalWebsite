export const dynamic = 'force-dynamic';
import { readBuild } from '../../../lib/readBuild';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/landing.module.css';



export default function BuildDetail({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { section: string };
}) {
  const { slug } = params;
  const section = searchParams.section;
  const { content, data } = readBuild(section, slug);


  return (
    <div className={styles.projectDetail}>
      <h1>{data.title}</h1>

      {/* Banner Image */}
      {data.image && (
        <img
          src={`/content/builds/${section}/${slug}/${data.image}`}
          alt={data.title}
          className={styles.projectBanner}
        />
      )}

      {/* Linked Files */}
      <div className={styles.projectFiles}>
        {data.pdfs?.length > 0 && (
          <FileList
            title="📄 PDFs"
            files={data.pdfs}
            slug={slug}
            prefix={section}
            isViewer={false}
          />
        )}
        {data.stls?.length > 0 && (
          <FileList
            title="🧊 STL Files (viewable)"
            files={data.stls}
            slug={slug}
            prefix={section}
            isViewer={true}
            viewerType="stl-viewer"
          />
        )}
        {data.docs?.length > 0 && (
          <FileList
            title="📚 Docs"
            files={data.docs}
            slug={slug}
            prefix={section}
            isViewer={true}
            viewerType="doc-viewer"
          />
        )}
      </div>

      {/* Markdown */}
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
            ? `/${viewerType}?file=/content/builds/${prefix}/${slug}/${file}`
            : `/content/builds/${prefix}/${slug}/${file}`;
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

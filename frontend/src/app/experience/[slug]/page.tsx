import { readExperience } from '../../../lib/readExperience';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from "../../../styles/landing.module.css";

export default function WorkExperiencePage({
  params,
}: {
  params: { slug: string };
}) {
  //console.log(params.slug);
  const { content, data } = readExperience(params.slug);

  return (
    <div style={{ padding: '2rem', color: '#ffffffff', fontFamily: 'monospace' }}>
      <h1>{data.title}</h1>
      <h2>{data.company}</h2>
      <p><em>{data.dates} • {data.location}</em></p>
      <hr />
      <div className={styles.markdownContent}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}  >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

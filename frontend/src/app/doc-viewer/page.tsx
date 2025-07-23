'use client';

import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';

export default function DocViewer() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get('file');
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;
    fetch(fileUrl)
      .then((res) => res.text())
      .then(setContent);
  }, [fileUrl]);

  if (!fileUrl) return <p>No file specified.</p>;
  if (!content) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem', color: '#eee', fontFamily: 'monospace' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

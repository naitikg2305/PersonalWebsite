// src/app/doc-viewer/page.tsx
import { Suspense } from 'react';
import DocViewerClient from './DocViewerClient';

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: '2rem', color: '#ccc' }}>Loading viewer...</p>}>
      <DocViewerClient />
    </Suspense>
  );
}

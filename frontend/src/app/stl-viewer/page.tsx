import { Suspense } from 'react';
import STLViewerClient from './STLViewerClient';

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: '2rem', color: '#ccc' }}>Loading STL Viewer...</p>}>
      <STLViewerClient />
    </Suspense>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import STLViewer from '../../components/STLViewer';

export default function STLViewerClient() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get('file');

  if (!fileUrl) {
    return <p style={{ padding: '2rem', color: '#ccc' }}>No STL file specified in the URL.</p>;
  }

  return (
    <div>
      <h1 style={{ color: '#00ff00', textAlign: 'center', margin: '1rem 0' }}>
        3D STL Viewer
      </h1>
      <STLViewer url={fileUrl} />
    </div>
  );
}

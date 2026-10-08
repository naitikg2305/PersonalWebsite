'use client';

import { useRouter } from 'next/navigation';

/** "← back" for the viewers: previous page if there is one, else the projects list. */
export default function BackButton({ fallback = '/projects' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      style={{ fontFamily: 'monospace', color: '#00ff00', background: '#000', border: '1px solid #00ff0055', borderRadius: 6, padding: '0.3rem 0.75rem', margin: '1rem', cursor: 'pointer' }}
    >
      ← back
    </button>
  );
}

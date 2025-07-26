'use client';
import { useState } from 'react';

export default function ChatSection() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data.response || 'No response received.');
    } catch (err) {
      setResponse('⚠️ Error talking to AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <textarea
        rows={4}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask anything about Naitik's work, projects, interests..."
        style={{ width: '100%', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '1rem' }}
      />
      <button
        onClick={askAI}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1.2rem',
          fontSize: '1rem',
          fontFamily: 'monospace',
          backgroundColor: '#00ff88',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Thinking...' : 'Ask'}
      </button>

      {response && (
        <div style={{ marginTop: '2rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.5' }}>
          <strong>AI:</strong> {response}
        </div>
      )}
    </div>
  );
}

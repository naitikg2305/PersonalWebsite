'use client';
import { useState } from 'react';
import { liveLog } from '../lib/liveLog';

interface Trace {
  cold_start?: boolean;
  model?: string;
  retrieve_ms?: number;
  chunks?: number;
  keywords?: string[];
  bedrock_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_ms?: number;
  daily_count?: number | null;
  daily_cap?: number | null;
  capped?: boolean;
}

// Print the real backend trace (returned by the Lambda) into the live background terminal.
function logTrace(status: number, roundTripMs: number, data: { trace?: Trace; sources?: { source: string }[] }) {
  const t = data.trace;
  liveLog(status < 400 ? 'ok' : 'out', `HTTP ${status} · round trip ${roundTripMs} ms`);
  if (!t) return;
  liveLog('out', `lambda site-chatbot · ${t.cold_start ? 'cold start' : 'warm'} · total ${t.total_ms ?? '?'} ms`);
  if (t.capped) return liveLog('out', `daily cap reached (${t.daily_cap}) · bedrock not called`);
  if (t.daily_count != null) liveLog('out', `dynamodb site-chatbot-usage · today ${t.daily_count}/${t.daily_cap}`);
  liveLog('out', `chroma.query · ${t.chunks} chunks · ${t.retrieve_ms} ms${t.keywords?.length ? ` · keyword pass ${JSON.stringify(t.keywords)}` : ''}`);
  liveLog('out', `bedrock ${t.model?.replace(/^us\.anthropic\./, '')} · ${t.bedrock_ms} ms · ${t.input_tokens} tokens in / ${t.output_tokens} out`);
  if (data.sources?.length) liveLog('ok', `✓ grounded in ${data.sources.map((s) => s.source.split('/').slice(-1)[0]).join(', ')}`);
}

export default function ChatSection() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse('');

    const started = performance.now();
    liveLog('cmd', `curl -X POST /api/chat -d '{"query": "${query.trim().slice(0, 60)}"}'`);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data.response || 'No response received.');
      logTrace(res.status, Math.round(performance.now() - started), data);
    } catch {
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

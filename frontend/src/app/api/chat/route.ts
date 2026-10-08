// Server-side proxy for the chatbot. The browser only ever talks to naitikg.us/api/chat;
// this route invokes the Lambda with AWS credentials that never reach the client.
//   - On Amplify: the app's compute (SSR) IAM role, allowed to invoke only this function.
//   - Locally: the profile in CHATBOT_AWS_PROFILE (never the shell's AWS_PROFILE).
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { fromIni } from '@aws-sdk/credential-providers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const FUNCTION_NAME = process.env.CHATBOT_FUNCTION_NAME ?? 'site-chatbot';
const MAX_QUERY_CHARS = 1000;
const MAX_HISTORY = 6; // prior messages forwarded as conversation memory (the backend re-validates)
const MAX_HISTORY_CHARS = 1500;

type Turn = { role: 'user' | 'assistant'; text: string };
function cleanHistory(history: unknown): Turn[] {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY)
    .filter((m): m is Turn => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.text === 'string')
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_HISTORY_CHARS) }));
}

const lambda = new LambdaClient({
  region: process.env.CHATBOT_REGION ?? 'us-east-1',
  ...(process.env.CHATBOT_AWS_PROFILE && {
    credentials: fromIni({ profile: process.env.CHATBOT_AWS_PROFILE }),
  }),
});

export async function POST(request: Request) {
  let query: unknown;
  let history: unknown;
  try {
    ({ query, history } = await request.json());
  } catch {
    return NextResponse.json({ response: 'Invalid request.' }, { status: 400 });
  }
  if (typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ response: 'Please ask a question.' }, { status: 400 });
  }

  const body = JSON.stringify({ query: query.slice(0, MAX_QUERY_CHARS), history: cleanHistory(history) });

  // Local dev: point at backend-chatbot/local_server.py instead of the deployed Lambda.
  if (process.env.CHATBOT_LOCAL_URL) {
    try {
      const res = await fetch(`${process.env.CHATBOT_LOCAL_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch (err) {
      console.error('local chatbot error', err);
      return NextResponse.json({ response: 'Local chatbot server is not running.' }, { status: 502 });
    }
  }

  try {
    const result = await lambda.send(
      new InvokeCommand({
        FunctionName: FUNCTION_NAME,
        // Same event shape as a Function URL request, so the handler stays unchanged.
        Payload: Buffer.from(JSON.stringify({ body })),
      }),
    );
    if (result.FunctionError || !result.Payload) {
      throw new Error(result.FunctionError ?? 'empty payload');
    }
    const lambdaResponse = JSON.parse(Buffer.from(result.Payload).toString('utf-8'));
    return NextResponse.json(JSON.parse(lambdaResponse.body), { status: lambdaResponse.statusCode ?? 200 });
  } catch (err) {
    console.error('chat proxy error', err);
    return NextResponse.json({ response: 'Sorry, something went wrong. Please try again.' }, { status: 502 });
  }
}

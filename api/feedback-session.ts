import { verifySession } from './_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const token = String(req.body?.token || '').trim();
  const session = verifySession(token);
  if (!session || session.role !== 'supervisor' || !session.superviseeEmail || !session.feedback) {
    return send(res, 401, { error: 'This feedback link is invalid or expired.' });
  }

  return send(res, 200, {
    superviseeEmail: session.superviseeEmail,
    supervisor: { name: session.name, email: session.email },
    reviewEntry: session.reviewEntry || null,
    feedback: session.feedback,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}

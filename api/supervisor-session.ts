import { verifySession } from './_auth';

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
  if (!session || session.role !== 'supervisor' || !session.superviseeEmail) {
    return send(res, 401, { error: 'This supervisor invite is invalid or expired.' });
  }

  return send(res, 200, {
    supervisor: {
      name: session.name,
      email: session.email,
    },
    superviseeEmail: session.superviseeEmail,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}

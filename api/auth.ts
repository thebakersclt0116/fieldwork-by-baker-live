import { signSession, verifyBetaCredentials } from './_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  if (!email || !password) return send(res, 400, { error: 'Email and password are required.' });

  const user = verifyBetaCredentials(email, password);
  if (!user) return send(res, 401, { error: 'Invalid email or password.' });

  const token = signSession(user);
  if (!token) {
    return send(res, 503, {
      error: 'Secure session signing is not available on this deployment yet.',
    });
  }

  return send(res, 200, { user, token });
}

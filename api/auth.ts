import { issueBetaSessionFromCredentials } from './_auth.js';

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

  const authenticated = issueBetaSessionFromCredentials(email, password);
  if (!authenticated) return send(res, 401, { error: 'Invalid email or password.' });

  return send(res, 200, authenticated);
}

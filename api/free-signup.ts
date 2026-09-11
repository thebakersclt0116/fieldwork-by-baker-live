import { signSession } from './_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const name = String(req.body?.name || '').trim().slice(0, 120);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (name.length < 2) return send(res, 400, { error: 'Enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid email.' });
  if (password.length < 8) return send(res, 400, { error: 'Use a password with at least 8 characters.' });

  const user = {
    email,
    name,
    role: 'free' as const,
  };

  // Browser-local beta accounts keep their signed entitlement for one year.
  // User fieldwork records remain under the user's control in their own browser.
  const token = signSession(user, 60 * 60 * 24 * 365);
  if (!token) return send(res, 503, { error: 'Secure signup is not available on this deployment.' });

  return send(res, 200, { user, token });
}

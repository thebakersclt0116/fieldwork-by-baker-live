import { BAKER_EMILY_EMAIL, BAKER_OWNER_EMAIL, signSession, verifyBetaCredentials } from './_auth.js';

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

  const normalizedEmail = user.email.trim().toLowerCase();
  const betaAccount = normalizedEmail === BAKER_EMILY_EMAIL || normalizedEmail === BAKER_OWNER_EMAIL;
  const ttlSeconds = betaAccount ? 60 * 60 * 24 * 365 : 60 * 60 * 12;
  const token = signSession(user, ttlSeconds);
  if (!token) {
    return send(res, 503, {
      error: 'Secure session signing is not available on this deployment yet.',
    });
  }

  return send(res, 200, { user, token });
}

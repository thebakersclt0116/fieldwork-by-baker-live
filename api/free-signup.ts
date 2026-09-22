import { BAKER_EMILY_EMAIL, BAKER_OWNER_EMAIL, signSession } from './_auth.js';

const THREE_DAYS_SECONDS = 60 * 60 * 24 * 3;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
  if (email === BAKER_EMILY_EMAIL || email === BAKER_OWNER_EMAIL) {
    return send(res, 409, { error: 'This beta account already exists. Use Sign In instead.' });
  }

  const trialEndsAt = Math.floor(Date.now() / 1000) + THREE_DAYS_SECONDS;
  const user = {
    email,
    name,
    role: 'free' as const,
    trialEndsAt,
  };

  // The signed browser session remains valid so the user can upgrade after the trial,
  // while premium APIs enforce trialEndsAt server-side.
  const token = signSession(user, ONE_YEAR_SECONDS);
  if (!token) return send(res, 503, { error: 'Secure signup is not available on this deployment.' });

  return send(res, 200, { user, token, trialEndsAt });
}

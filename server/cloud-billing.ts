import { cloudApiOrigin } from './cloud-session.js';

type BillingAction = 'checkout' | 'complete';
type BillingRequest = { headers?: Record<string, string | string[] | undefined>; body?: unknown };

function allowedBrowserOrigin(req: BillingRequest): string | null {
  const canonical = 'https://www.fieldworkbybaker.com';
  const origin = req.headers?.origin;
  const allowed = new Set([canonical]);
  if (process.env.VERCEL_ENV === 'preview' && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(process.env.VERCEL_URL || '')) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }
  // Server-side beta callers can omit Origin, but cookie callers cannot. This
  // prevents the server-to-server secret from weakening browser CSRF checks.
  if (!origin) return typeof req.headers?.authorization === 'string' && /^Bearer b2\./.test(req.headers.authorization) ? canonical : null;
  return typeof origin === 'string' && allowed.has(origin) ? origin : null;
}

/** Only these fixed operations are forwarded; caller input never selects a URL. */
export async function forwardCloudBilling(req: BillingRequest, res: any, action: BillingAction): Promise<void> {
  const origin = cloudApiOrigin();
  const serverSecret = process.env.FIELDWORK_ORIGIN_SECRET;
  const browserOrigin = allowedBrowserOrigin(req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (!origin || !serverSecret) {
    res.status(503).send(JSON.stringify({ code: 'BILLING_BACKEND_REQUIRED', error: 'Durable billing is not connected yet. No payment was created.' })); return;
  }
  if (!browserOrigin) {
    res.status(403).send(JSON.stringify({ code: 'BILLING_ORIGIN_REJECTED', error: 'Open billing from your Fieldwork account.' })); return;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', accept: 'application/json',
    'x-fieldwork-origin-secret': serverSecret, origin: browserOrigin,
  };
  const cookie = req.headers?.cookie;
  if (typeof cookie === 'string') headers.cookie = cookie;
  const authorization = req.headers?.authorization;
  if (typeof authorization === 'string' && /^Bearer b2\./.test(authorization)) headers.authorization = authorization;
  else if (authorization && authorization !== 'Bearer cloud-session') {
    res.status(401).send(JSON.stringify({ code: 'DURABLE_ACCOUNT_REQUIRED', error: 'Sign in with your verified Fieldwork account before opening billing.' })); return;
  }
  try {
    const response = await fetch(`${origin}/api/cloud/billing/${action}`, {
      method: 'POST', headers, body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(25_000), redirect: 'error', cache: 'no-store',
    });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error('Invalid billing response.');
    const text = await response.text();
    if (text.length > 64_000) throw new Error('Invalid billing response.');
    res.status(response.status).send(text);
  } catch {
    res.status(503).send(JSON.stringify({ code: 'BILLING_TEMPORARILY_UNAVAILABLE', error: 'Billing could not be confirmed. Check your account before trying another payment.' }));
  }
}

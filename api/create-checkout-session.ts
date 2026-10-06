import { requireSession } from './_auth.js';

type PlanId = 'individual_monthly' | 'professional_monthly' | 'professional_annual';

type Plan = {
  id: PlanId;
  name: string;
  amount: number;
  mode: 'subscription';
  interval?: 'month' | 'year';
};

const PLANS: Record<PlanId, Plan> = {
  individual_monthly: { id: 'individual_monthly', name: 'Fieldwork by Baker Individual', amount: 1699, mode: 'subscription', interval: 'month' },
  professional_monthly: { id: 'professional_monthly', name: 'Fieldwork by Baker Professional', amount: 3499, mode: 'subscription', interval: 'month' },
  professional_annual: { id: 'professional_annual', name: 'Fieldwork by Baker Professional Annual', amount: 34900, mode: 'subscription', interval: 'year' },
};

function send(res: any, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function originFor(_req: any): string {
  const canonical = 'https://www.fieldworkbybaker.com';
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(process.env.VERCEL_URL)) return 'https://' + process.env.VERCEL_URL;
  const configured = process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL;
  if (!configured) return canonical;
  try { const url = new URL(configured); return url.origin === canonical ? canonical : canonical; } catch { return canonical; }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req, ['free', 'paid', 'professional', 'owner']);
  if (!session) return send(res, 401, { error: 'Sign in before upgrading.' });

  const planId = String(req.body?.plan || '') as PlanId;
  const plan = PLANS[planId];
  if (!plan) return send(res, 400, { error: 'Choose a valid Baker plan.' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return send(res, 503, {
      error: 'Stripe Checkout is not connected to this deployment yet.',
      code: 'STRIPE_NOT_CONFIGURED',
    });
  }

  const previewTest = process.env.VERCEL_ENV === 'preview' && process.env.BAKER_ALLOW_TEST_CHECKOUT === 'true';
  if (!secret.startsWith('sk_live_') && !previewTest) return send(res, 503, { error: 'Live billing is not connected yet. No payment was created.', code: 'LIVE_BILLING_NOT_CONFIGURED' });
  if (!previewTest) return send(res, 503, { error: 'Subscription billing is paused until durable accounts and renewal/cancellation processing are connected. No payment was created.', code: 'BILLING_BACKEND_REQUIRED' });

  const origin = originFor(req);
  const params = new URLSearchParams();
  params.set('mode', plan.mode);
  params.set('success_url', `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/upgrade?canceled=1`);
  params.set('client_reference_id', session.email);
  params.set('customer_email', session.email);
  params.set('allow_promotion_codes', 'true');
  params.set('metadata[baker_plan]', plan.id);
  params.set('metadata[baker_email]', session.email);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(plan.amount));
  params.set('line_items[0][price_data][product_data][name]', plan.name);
  params.set('line_items[0][price_data][product_data][description]', 'Fieldwork by Baker subscription with the connected BCBA workspace.');
  if (plan.interval) params.set('line_items[0][price_data][recurring][interval]', plan.interval);

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const payload = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url || !payload.id) {
      console.error('Stripe Checkout creation failed', response.status, payload.error?.message || 'Unknown error');
      return send(res, 502, { error: payload.error?.message || 'Stripe Checkout could not be created.' });
    }

    return send(res, 200, { id: payload.id, url: payload.url, plan: plan.id });
  } catch (error) {
    console.error('Stripe Checkout request failed', error);
    return send(res, 502, { error: 'Stripe Checkout could not be reached.' });
  }
}

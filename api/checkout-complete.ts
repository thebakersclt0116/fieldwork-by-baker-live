import { requireSession, signSession } from './_auth';

type StripeSession = {
  id?: string;
  status?: string;
  payment_status?: string;
  mode?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  customer_details?: { email?: string | null } | null;
};

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const current = requireSession(req, ['free', 'paid', 'professional', 'owner']);
  if (!current) return send(res, 401, { error: 'Sign in to apply this purchase.' });

  const checkoutSessionId = String(req.body?.sessionId || '').trim();
  if (!/^cs_/.test(checkoutSessionId)) return send(res, 400, { error: 'Invalid Stripe Checkout session.' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return send(res, 503, { error: 'Stripe is not configured on this deployment.' });

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const stripeSession = await response.json() as StripeSession & { error?: { message?: string } };
    if (!response.ok) return send(res, 502, { error: stripeSession.error?.message || 'Could not verify Stripe Checkout.' });

    const paid = stripeSession.status === 'complete' && stripeSession.payment_status === 'paid';
    if (!paid) return send(res, 402, { error: 'Stripe has not marked this Checkout Session as paid.' });

    const purchasedEmail = String(stripeSession.metadata?.baker_email || stripeSession.client_reference_id || '').toLowerCase();
    if (!purchasedEmail || purchasedEmail !== current.email.toLowerCase()) {
      return send(res, 403, { error: 'This purchase belongs to a different Baker account.' });
    }

    const plan = String(stripeSession.metadata?.baker_plan || '');
    let upgraded: Omit<Parameters<typeof signSession>[0], 'exp'> | null = null;

    if (plan === 'export_pass') {
      upgraded = {
        email: current.email,
        name: current.name,
        role: current.role === 'owner' ? 'owner' : current.role === 'professional' ? 'professional' : current.role === 'paid' ? 'paid' : 'free',
        subscription: current.subscription,
        exportPass: true,
      };
    } else if (plan === 'individual_monthly') {
      upgraded = {
        email: current.email,
        name: current.name,
        role: current.role === 'owner' ? 'owner' : 'paid',
        subscription: 'individual',
        exportPass: true,
      };
    } else if (plan === 'professional_monthly' || plan === 'professional_annual') {
      upgraded = {
        email: current.email,
        name: current.name,
        role: current.role === 'owner' ? 'owner' : 'paid',
        subscription: 'professional',
        exportPass: true,
      };
    }

    if (!upgraded) return send(res, 400, { error: 'This Stripe purchase is not mapped to a Baker entitlement.' });
    const token = signSession(upgraded, 60 * 60 * 24 * 365);
    if (!token) return send(res, 503, { error: 'Could not issue the upgraded Baker session.' });

    return send(res, 200, {
      token,
      user: upgraded,
      plan,
      checkoutSessionId: stripeSession.id,
    });
  } catch (error) {
    console.error('Stripe Checkout verification failed', error);
    return send(res, 502, { error: 'Could not verify your Stripe payment.' });
  }
}

import { requireSession } from './_auth.js';
import { forwardCloudBilling } from '../server/cloud-billing.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, ['free', 'paid', 'professional', 'owner']);
  if (!session) return res.status(401).json({ error: 'Sign in before upgrading.' });
  // The cloud account, catalog, durable customer mapping, and live launch gates
  // are checked together before the cloud billing service can open Checkout.
  return forwardCloudBilling(req, res, 'checkout');
}

import { requireSession } from './_auth.js';
import { forwardCloudBilling } from '../server/cloud-billing.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, ['free', 'paid', 'professional', 'owner']);
  if (!session) return res.status(401).json({ error: 'Sign in to view this purchase.' });
  // The success page only reads the result of signed webhook fulfillment.
  // CHECKOUT_MODE_MISMATCH and ownership checks live in cloud/billing.ts.
  // No paid bearer token is minted here; renewed cookie sessions read the DB.
  return forwardCloudBilling(req, res, 'complete');
}

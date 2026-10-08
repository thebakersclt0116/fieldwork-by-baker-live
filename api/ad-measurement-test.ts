import { randomUUID } from 'node:crypto';
import { billingIdentity } from '../server/billing.js';
import { CloudError, cloudRequest } from '../server/cloud-client.js';
import { attributionMetadata, firstPaymentEvent, sendAdEvent } from '../server/ad-measurement.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  if (process.env.VERCEL_ENV !== 'preview' || process.env.BAKER_META_TESTING !== 'true' || !/^TEST\d{3,20}$/.test(process.env.META_TEST_EVENT_CODE || '')) return res.status(404).json({ code: 'NOT_FOUND' });
  try {
    const { token, user } = await billingIdentity(req);
    const rows: any = await cloudRequest('/rest/v1/profiles?id=eq.' + user.id + '&select=role', token);
    if (!Array.isArray(rows) || rows[0]?.role !== 'owner') throw new CloudError('OWNER_REQUIRED', 403);
    const now = Date.now();
    const metadata = attributionMetadata({ consent: 'ads-v1', consentAt: now, visitorId: randomUUID() }, 'fictional-launch-test@example.com', 'Fieldwork fictional launch test', now);
    const invoice = { id: 'in_Fictional' + randomUUID().replaceAll('-', ''), livemode: true, status: 'paid', paid: true, amount_paid: 1699, currency: 'usd', billing_reason: 'subscription_create', status_transitions: { paid_at: Math.floor(now / 1000) } };
    const event = firstPaymentEvent(invoice, metadata, [], now);
    if (!event) throw new CloudError('AD_TEST_FAILED', 500);
    const zeroExcluded = firstPaymentEvent({ ...invoice, amount_paid: 0 }, metadata, [], now) === null;
    const renewalExcluded = firstPaymentEvent({ ...invoice, billing_reason: 'subscription_cycle' }, metadata, [], now) === null;
    const returningMemberExcluded = firstPaymentEvent(invoice, metadata, [{ ...invoice, id: 'in_PriorFictional' }], now) === null;
    if (!zeroExcluded || !renewalExcluded || !returningMemberExcluded) throw new CloudError('AD_TEST_FAILED', 500);
    const received = await sendAdEvent(event, process.env.META_TEST_EVENT_CODE);
    if (!received) throw new CloudError('AD_TEST_NOT_CONFIGURED');
    return res.status(200).json({ received: true, fictional: true, metaTestEventsOnly: true, zeroExcluded, renewalExcluded, returningMemberExcluded, eventId: event.event_id });
  } catch (error) { const failure = error instanceof CloudError ? error : new CloudError('AD_TEST_FAILED', 500); return res.status(failure.status).json({ code: failure.code }); }
}

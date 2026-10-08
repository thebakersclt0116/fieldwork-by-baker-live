import { createHash } from 'node:crypto';
import { stripeRequest } from './billing.js';
import { CloudError, cloudConfiguration } from './cloud-client.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const MAX_CONSENT_AGE = 30 * 24 * 60 * 60 * 1000;
export function adMeasurementConfigured() {
  return process.env.BAKER_META_ADS_ENABLED === 'true' && /^\d{5,30}$/.test(process.env.META_DATASET_ID || '') && (process.env.META_CAPI_ACCESS_TOKEN || '').length >= 20;
}
export function attributionMetadata(input: any, email: string, userAgent: unknown, now = Date.now()): Record<string, string> {
  if (!input || input.consent !== 'ads-v1' || !Number.isSafeInteger(input.consentAt) || input.consentAt > now || now - input.consentAt > MAX_CONSENT_AGE || typeof input.visitorId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.visitorId)) return {};
  const metadata: Record<string, string> = { baker_ads_consent: 'ads-v1', baker_ads_consent_at: String(input.consentAt), baker_ads_external: hash(input.visitorId), baker_ads_email: hash(email.trim().toLowerCase()), baker_ads_captured_at: String(now) };
  if (typeof input.fbc === 'string' && /^fb\.1\.\d{13}\.[A-Za-z0-9_-]{8,200}$/.test(input.fbc)) {
    const created = Number(input.fbc.split('.')[2]);
    if (created <= now && now - created <= MAX_CONSENT_AGE) metadata.baker_ads_fbc = input.fbc;
  }
  if (typeof userAgent === 'string') metadata.baker_ads_ua = userAgent.replace(/[\r\n]/g, '').slice(0, 480);
  return metadata;
}
export function adUserData(metadata: any, now = Date.now()) {
  const consentAt = Number(metadata?.baker_ads_consent_at);
  const capturedAt = Number(metadata?.baker_ads_captured_at);
  if (metadata?.baker_ads_consent !== 'ads-v1' || !Number.isSafeInteger(consentAt) || consentAt > now || now - consentAt > MAX_CONSENT_AGE || !Number.isSafeInteger(capturedAt) || capturedAt > now || now - capturedAt > 7 * 24 * 60 * 60 * 1000 || !/^[a-f0-9]{64}$/.test(metadata?.baker_ads_email || '') || !/^[a-f0-9]{64}$/.test(metadata?.baker_ads_external || '')) return null;
  return { em: [metadata.baker_ads_email], external_id: [metadata.baker_ads_external], ...(typeof metadata.baker_ads_ua === 'string' && metadata.baker_ads_ua ? { client_user_agent: metadata.baker_ads_ua.slice(0, 480) } : {}), ...(typeof metadata.baker_ads_fbc === 'string' && /^fb\.1\.\d{13}\.[A-Za-z0-9_-]{8,200}$/.test(metadata.baker_ads_fbc) ? { fbc: metadata.baker_ads_fbc } : {}) };
}
export function firstPaymentEvent(invoice: any, metadata: any, previous: any[], now = Date.now()) {
  const userData = adUserData(metadata, now);
  if (!userData || invoice?.livemode !== true || invoice.status !== 'paid' || invoice.paid !== true || invoice.billing_reason !== 'subscription_create' || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0 || invoice.currency !== 'usd' || !/^in_[A-Za-z0-9]+$/.test(invoice.id || '')) return null;
  // A returning member is not a new paying user. Unpaid invoices and $0 tests do not qualify.
  if (previous.some(value => value.id !== invoice.id && value.livemode === true && value.status === 'paid' && value.amount_paid > 0)) return null;
  const paidAt = invoice.status_transitions?.paid_at;
  if (!Number.isSafeInteger(paidAt) || paidAt > Math.floor(now / 1000) || Math.floor(now / 1000) - paidAt > 7 * 24 * 60 * 60) return null;
  return { event_name: 'Purchase', event_time: paidAt, event_id: 'baker_first_payment_' + hash(invoice.id), action_source: 'website', event_source_url: 'https://www.fieldworkbybaker.com/upgrade/success', user_data: userData, custom_data: { currency: 'USD', value: invoice.amount_paid / 100, content_name: 'Fieldwork membership' } };
}
export async function sendAdEvent(event: any, testCode?: string) {
  if (!adMeasurementConfigured()) return false;
  const preview = process.env.VERCEL_ENV === 'preview';
  if (preview && (!testCode || process.env.BAKER_META_TESTING !== 'true')) return false;
  if (!preview && testCode) throw new CloudError('AD_TEST_NOT_ALLOWED', 403);
  const response = await fetch('https://graph.facebook.com/v25.0/' + process.env.META_DATASET_ID + '/events', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.META_CAPI_ACCESS_TOKEN }, body: JSON.stringify({ data: [event], ...(preview && testCode ? { test_event_code: testCode } : {}) }) });
  let result: any; try { result = await response.json(); } catch { throw new CloudError('AD_MEASUREMENT_DELIVERY_FAILED', 502); }
  if (!response.ok || result.events_received !== 1) throw new CloudError('AD_MEASUREMENT_DELIVERY_FAILED', 502);
  return true;
}
export async function reportFirstPayment(invoiceId: string, subscriptionId: string) {
  if (!adMeasurementConfigured() || process.env.VERCEL_ENV === 'preview') return false;
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId) || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return false;
  const invoice = await stripeRequest('/v1/invoices/' + encodeURIComponent(invoiceId));
  const invoiceSubscription = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if ((typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription?.id) !== subscriptionId) throw new CloudError('AD_PAYMENT_MISMATCH', 400);
  const subscription = await stripeRequest('/v1/subscriptions/' + encodeURIComponent(subscriptionId));
  if (subscription.livemode !== true || subscription.metadata?.baker_mode !== 'live' || subscription.customer !== invoice.customer) return false;
  if (!adUserData(subscription.metadata) || invoice.billing_reason !== 'subscription_create' || invoice.amount_paid <= 0) return false;
  const previous = await stripeRequest('/v1/invoices?customer=' + encodeURIComponent(invoice.customer) + '&status=paid&limit=100');
  if (!Array.isArray(previous.data) || previous.has_more) return false;
  const event = firstPaymentEvent(invoice, subscription.metadata, previous.data);
  if (!event) return false;
  // Reuse the existing server-only billing event ledger; keep provider payloads out of it.
  const { url } = cloudConfiguration();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith('sb_secret_')) throw new CloudError('AD_MEASUREMENT_LEDGER_REQUIRED');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  const marker = 'meta/' + event.event_id;
  const checked = await fetch(url + '/rest/v1/billing_events?mode=eq.live&event_id=eq.' + encodeURIComponent(marker) + '&select=event_id', { headers, signal: AbortSignal.timeout(10000) });
  if (!checked.ok) throw new CloudError('AD_MEASUREMENT_LEDGER_UNAVAILABLE', 502);
  const existing = await checked.json();
  if (!Array.isArray(existing)) throw new CloudError('AD_MEASUREMENT_LEDGER_UNAVAILABLE', 502);
  if (existing.length) return true;
  await sendAdEvent(event);
  const saved = await fetch(url + '/rest/v1/billing_events', { method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ mode: 'live', event_id: marker }) });
  if (!saved.ok) throw new CloudError('AD_MEASUREMENT_LEDGER_UNAVAILABLE', 502);
  return true;
}

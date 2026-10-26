import { waitUntil } from '@vercel/functions';
import { adMeasurementConfigured, adUserData, attributionMetadata, sendAdEvent } from './ad-measurement.js';
import { billingMode, planForPrice, stripeRequest } from './billing.js';
import { CloudError } from './cloud-client.js';
import { digest, funnelKey, hasFunnelMarker, isFunnelQaEmail, normalizeFunnelContext, recordFunnelStage, writeFunnelMarker, type FunnelContext, type FunnelStage } from './funnel-ledger.js';

export type MeasuredEvent = { stage: Exclude<FunnelStage, 'first_paid_membership'>; context: FunnelContext; adMeasurement?: unknown; email?: string; userAgent?: unknown; occurredAt?: string; path?: '/' | '/signup'; subjectId?: string };
const META_NAMES = { landing_page_loaded: 'ViewContent', account_created: 'AccountCreated', email_verified: 'CompleteRegistration', checkout_opened: 'InitiateCheckout' } as const;
export function stageMetaEvent(args: MeasuredEvent, now = Date.now()) {
  if (args.context.qa || isFunnelQaEmail(args.email) || (args.adMeasurement as {consent?:string}|undefined)?.consent !== 'ads-v2') return null;
  const metadata = attributionMetadata(args.adMeasurement, args.email || '', args.userAgent, now);
  if (!Object.keys(metadata).length) return null;
  let data: any = adUserData(metadata, now);
  if (!data) return null;
  if (!args.email) { const { em: _email, ...rest } = data; data = rest; }
  if (!data.client_user_agent) return null;
  const source = args.stage === 'landing_page_loaded' ? args.path === '/signup' ? '/signup' : '/' : args.stage === 'account_created' ? '/signup' : args.stage === 'email_verified' ? '/login' : '/upgrade';
  return { event_name: META_NAMES[args.stage], event_time: Math.floor(now / 1000), event_id: 'baker_funnel_' + digest(funnelKey(args.stage, args.context, args.subjectId)), action_source: 'website', event_source_url: 'https://www.fieldworkbybaker.com' + source, user_data: data,
    custom_data: { content_name: 'Fieldwork membership', funnel_version: 'funnel-v1' } };
}
export async function reportFunnelEvent(args: MeasuredEvent) {
  const marker = await recordFunnelStage(args.stage, args.context, args.occurredAt, args.subjectId);
  if (process.env.VERCEL_ENV === 'preview' || !adMeasurementConfigured()) return { recorded: process.env.VERCEL_ENV !== 'preview', metaAccepted: false };
  const event = stageMetaEvent(args); if (!event) return { recorded: true, metaAccepted: false };
  const sentMarker = marker.replace(/^funnel-v1\//, 'funnel-meta-v1/');
  if (await hasFunnelMarker(sentMarker)) return { recorded: true, metaAccepted: true };
  await sendAdEvent(event);
  await writeFunnelMarker(sentMarker);
  return { recorded: true, metaAccepted: true };
}
export function scheduleFunnelEvent(event: MeasuredEvent) {
  // Vercel keeps this bounded side effect alive after returning the user's account/checkout response.
  // Analytics failure must never block signup, login, saved hours, or a legitimate payment.
  waitUntil(reportFunnelEvent(event).catch(error => { console.warn('Funnel measurement incomplete', { stage: event.stage, code: error instanceof CloudError ? error.code : 'FUNNEL_DELIVERY_FAILED' }); }));
}
export function subscriptionFunnelMetadata(value: unknown): Record<string, string> {
  const context = normalizeFunnelContext(value); if (!context) return {};
  return { baker_funnel_version: context.version, baker_funnel_flow: context.flowId, baker_funnel_variant: context.variant, baker_funnel_campaign: context.campaign, baker_funnel_qa: context.qa ? 'true' : 'false' };
}
export function contextFromSubscription(metadata: any): FunnelContext | null {
  return normalizeFunnelContext({ version: metadata?.baker_funnel_version, flowId: metadata?.baker_funnel_flow, variant: metadata?.baker_funnel_variant, campaign: metadata?.baker_funnel_campaign, qa: metadata?.baker_funnel_qa === 'true' });
}
export function eligibleFirstMembership(invoice: any, subscription: any, priorInvoices: any[]): boolean {
  if (invoice?.livemode !== true || subscription?.livemode !== true || invoice.status !== 'paid' || invoice.paid === false || invoice.billing_reason !== 'subscription_create' || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0 || invoice.currency !== 'usd') return false;
  if (invoice.customer !== subscription.customer || subscription.metadata?.baker_mode !== 'live') return false;
  const invoiceSub = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if ((typeof invoiceSub === 'string' ? invoiceSub : invoiceSub?.id) !== subscription.id) return false;
  const items = subscription.items?.data;
  if (!Array.isArray(items) || items.length !== 1 || items[0].quantity !== 1 || planForPrice(items[0].price?.id || '', 'live') === 'none') return false;
  return !priorInvoices.some(item => item.id !== invoice.id && item.livemode === true && item.status === 'paid' && item.amount_paid > 0);
}
export async function recordFirstPaidMembership(invoiceId: string, subscriptionId: string) {
  if (process.env.VERCEL_ENV === 'preview' || billingMode() !== 'live') return false;
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId) || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return false;
  const [invoice, subscription] = await Promise.all([stripeRequest('/v1/invoices/' + encodeURIComponent(invoiceId)), stripeRequest('/v1/subscriptions/' + encodeURIComponent(subscriptionId))]);
  const context = contextFromSubscription(subscription.metadata); if (!context) return false;
  const previous = await stripeRequest('/v1/invoices?customer=' + encodeURIComponent(subscription.customer) + '&status=paid&limit=100');
  if (!Array.isArray(previous.data) || previous.has_more || !eligibleFirstMembership(invoice, subscription, previous.data)) return false;
  const paidAt = invoice.status_transitions?.paid_at;
  if (!Number.isSafeInteger(paidAt) || paidAt > Math.floor(Date.now() / 1000)) return false;
  await recordFunnelStage('first_paid_membership', context, new Date(paidAt * 1000).toISOString(), subscription.metadata?.baker_account_id);
  // Purchase advertising stays with the existing, separately consent-checked Stripe webhook integration.
  return true;
}
export function scheduleFirstPaidMembership(invoiceId: string, subscriptionId: string) {
  waitUntil(recordFirstPaidMembership(invoiceId, subscriptionId).catch(error => { console.warn('Funnel payment measurement incomplete', { code: error instanceof CloudError ? error.code : 'FUNNEL_DELIVERY_FAILED' }); }));
}

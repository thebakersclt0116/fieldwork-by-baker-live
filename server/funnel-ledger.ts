import { createHash, randomUUID } from 'node:crypto';
import { CloudError, cloudConfiguration } from './cloud-client.js';

export const FUNNEL_VERSION = 'funnel-v1';
export const LAUNCH_CAMPAIGN = '120251729153710531';
export const FUNNEL_STAGES = ['landing_page_loaded', 'account_created', 'email_verified', 'checkout_opened', 'first_paid_membership'] as const;
export type FunnelStage = typeof FUNNEL_STAGES[number];
export type FunnelContext = { version: 'funnel-v1'; flowId: string; variant: 'home' | 'signup' | 'direct'; campaign: string; qa: boolean };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function normalizeFunnelContext(value: any): FunnelContext | null {
  if (!value || value.version !== FUNNEL_VERSION || typeof value.flowId !== 'string' || !uuid.test(value.flowId)) return null;
  const attributed = value.campaign === LAUNCH_CAMPAIGN;
  const variant = attributed && ['home', 'signup'].includes(value.variant) ? value.variant : 'direct';
  // A QA flag changes analytics classification ONLY. It grants no account, billing or authorization privileges.
  return { version: FUNNEL_VERSION, flowId: value.flowId.toLowerCase(), variant, campaign: attributed ? LAUNCH_CAMPAIGN : 'direct', qa: value.qa === true };
}
export function newFunnelContext(input: unknown, qaEmail = false): FunnelContext {
  const context = normalizeFunnelContext(input) || { version: FUNNEL_VERSION, flowId: randomUUID(), variant: 'direct', campaign: 'direct', qa: false } as FunnelContext;
  return { ...context, qa: context.qa || qaEmail };
}
export function isFunnelQaEmail(email: unknown): boolean {
  return typeof email === 'string' && (/\+fieldwork-funnel-qa-[a-f0-9]+@/i.test(email) || /@example\.(?:com|org|net)$/i.test(email));
}
export function funnelKey(stage: FunnelStage, context: FunnelContext, subjectId?: string): string {
  if (!FUNNEL_STAGES.includes(stage) || !normalizeFunnelContext(context)) throw new CloudError('INVALID_FUNNEL_EVENT', 400);
  return [FUNNEL_VERSION, context.qa ? 'qa' : 'live', context.campaign, context.variant, stage, digest(stage !== 'landing_page_loaded' && subjectId && uuid.test(subjectId) ? subjectId : context.flowId)].join('/');
}
function ledgerHeaders() {
  const { url } = cloudConfiguration();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith('sb_secret_')) throw new CloudError('FUNNEL_LEDGER_NOT_CONFIGURED');
  return { url, headers: { apikey: key, 'Content-Type': 'application/json' } };
}
export async function writeFunnelMarker(eventId: string, occurredAt = new Date().toISOString()): Promise<boolean> {
  if (!/^(?:funnel-v1|funnel-meta-v1)\//.test(eventId) || eventId.length > 200) throw new CloudError('INVALID_FUNNEL_EVENT', 400);
  if (process.env.VERCEL_ENV === 'preview') return false;
  const { url, headers } = ledgerHeaders();
  const response = await fetch(url + '/rest/v1/billing_events', { method: 'POST', signal: AbortSignal.timeout(8000), headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ mode: 'live', event_id: eventId, processed_at: occurredAt }) });
  if (!response.ok) throw new CloudError('FUNNEL_LEDGER_WRITE_FAILED', 502);
  return true;
}
export async function hasFunnelMarker(eventId: string): Promise<boolean> {
  const { url, headers } = ledgerHeaders();
  const response = await fetch(url + '/rest/v1/billing_events?mode=eq.live&event_id=eq.' + encodeURIComponent(eventId) + '&select=event_id&limit=1', { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new CloudError('FUNNEL_LEDGER_READ_FAILED', 502);
  const rows = await response.json(); if (!Array.isArray(rows)) throw new CloudError('FUNNEL_LEDGER_READ_FAILED', 502);
  return rows.length > 0;
}
export async function recordFunnelStage(stage: FunnelStage, context: FunnelContext, occurredAt?: string, subjectId?: string) {
  const key = funnelKey(stage, context, subjectId);
  const time = occurredAt && Number.isFinite(Date.parse(occurredAt)) && Date.parse(occurredAt) <= Date.now() + 1000 ? occurredAt : new Date().toISOString();
  await writeFunnelMarker(key, time); return key;
}
export function summarizeFunnelRows(rows: Array<{ event_id: string; processed_at: string }>, limited = false) {
  const groups: Record<string, { campaign: string; variant: string; stages: Record<FunnelStage, number>; metaAccepted: number }> = {};
  const seen = new Set<string>(); let qaEvents = 0; let earliest: string | null = null;
  for (const row of rows) {
    if (seen.has(row.event_id)) continue; seen.add(row.event_id);
    const parts = row.event_id.split('/');
    if (parts[0] === 'funnel-v1' && parts[1] === 'qa') { qaEvents++; continue; }
    if (!['funnel-v1', 'funnel-meta-v1'].includes(parts[0]) || parts[1] !== 'live' || parts.length !== 6 || !FUNNEL_STAGES.includes(parts[4] as FunnelStage) || !/^[a-f0-9]{64}$/.test(parts[5])) continue;
    const groupKey = parts[2] + '/' + parts[3];
    groups[groupKey] ||= { campaign: parts[2], variant: parts[3], stages: Object.fromEntries(FUNNEL_STAGES.map(stage => [stage, 0])) as Record<FunnelStage, number>, metaAccepted: 0 };
    if (parts[0] === 'funnel-meta-v1') groups[groupKey].metaAccepted++;
    else { groups[groupKey].stages[parts[4] as FunnelStage]++; if (!earliest || row.processed_at < earliest) earliest = row.processed_at; }
  }
  return { version: FUNNEL_VERSION, groups: Object.values(groups), qaEventsExcluded: qaEvents, earliestEvent: earliest, limited,
    definitions: { landing_page_loaded: 'Unique consenting journeys whose public page mounted. Not total visitors or Meta Landing Page Views.', account_created: 'A new real managed account created after instrumentation; not a form click or verification-email resend.', email_verified: 'Supabase confirmed the email, observed at the first successful verified sign-in after signup.', checkout_opened: 'Stripe created a usable hosted Checkout session and the app could redirect. A server event alone cannot prove Stripe finished rendering.', first_paid_membership: 'First nonzero live paid subscription invoice, verified against Stripe and this application. Excludes renewals, returning members, QA, and zero-value tests.' },
    note: 'Stage counts are unique journeys, not a historical backfill. The same time window can contain stages from journeys started earlier; do not treat these raw counts as a controlled cohort conversion rate.' };
}
export async function readFunnelSummary(days = 30) {
  const { url, headers } = ledgerHeaders();
  const since = new Date(Date.now() - Math.max(1, Math.min(90, days)) * 86400000).toISOString();
  const rows: Array<{ event_id: string; processed_at: string }> = []; let limited = false;
  for (let offset = 0; offset < 20000; offset += 1000) {
    const query = new URLSearchParams({ mode: 'eq.live', or: '(event_id.like.funnel-v1/*,event_id.like.funnel-meta-v1/*)', processed_at: 'gte.' + since, select: 'event_id,processed_at', order: 'processed_at.asc,event_id.asc', limit: '1000', offset: String(offset) });
    const r = await fetch(url + '/rest/v1/billing_events?' + query, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new CloudError('FUNNEL_LEDGER_READ_FAILED', 502);
    const batch = await r.json(); if (!Array.isArray(batch)) throw new CloudError('FUNNEL_LEDGER_READ_FAILED', 502);
    rows.push(...batch); if (batch.length < 1000) break; if (offset === 19000) limited = true;
  }
  return { ...summarizeFunnelRows(rows, limited), since, checkedAt: new Date().toISOString() };
}

export async function readOwnFunnelStages(context: FunnelContext, verifiedUserId: string) {
  if (!uuid.test(verifiedUserId)) throw new CloudError('AUTH_REQUIRED',401);
  const values=await Promise.all(FUNNEL_STAGES.map(async stage=>({stage,recorded:await hasFunnelMarker(funnelKey(stage,context,verifiedUserId))})));
  return {version:FUNNEL_VERSION,qa:context.qa,stages:values};
}

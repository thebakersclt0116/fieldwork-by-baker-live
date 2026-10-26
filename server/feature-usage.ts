import { createHmac } from 'node:crypto';
import { CloudError, cloudConfiguration } from './cloud-client.js';
import { USAGE_VERSION, USAGE_INTRODUCED, USAGE_RETENTION_DAYS, USAGE_BUCKET_MS, USAGE_FEATURES, validUsageEvent } from '../src/lib/featureUsageSchema.js';
const DAY = 86400000;
export function usageIdentity(userId: string) {
  const secret = process.env.BAKER_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret || secret.length < 32) throw new CloudError('USAGE_NOT_CONFIGURED');
  return createHmac('sha256', secret).update('fieldwork/optional-usage/v1/' + userId).digest('hex');
}
async function ledger(query: string, method = 'GET', body?: unknown, prefer?: string): Promise<any> {
  const { url } = cloudConfiguration(); const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith('sb_secret_')) throw new CloudError('USAGE_NOT_CONFIGURED');
  const response = await fetch(url + '/rest/v1/billing_events' + query, {
    method, signal: AbortSignal.timeout(10000),
    headers: { apikey: key, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new CloudError('USAGE_UNAVAILABLE', 502);
  return response.status === 204 ? null : response.json().catch(() => null);
}
export async function readUsageConsent(identity: string, now = Date.now()) {
  const rows = await ledger('?mode=eq.live&event_id=eq.' + USAGE_VERSION + '-consent/' + identity + '&select=processed_at&limit=1');
  if (!Array.isArray(rows)) throw new CloudError('USAGE_UNAVAILABLE');
  const created = Date.parse(rows[0]?.processed_at);
  const enabled = Number.isFinite(created) && created <= now && created + USAGE_RETENTION_DAYS * DAY > now;
  return { enabled, expiresAt: enabled ? new Date(created + USAGE_RETENTION_DAYS * DAY).toISOString() : null };
}
// Only optional usage namespaces are touched. Actual billing/funnel records are never deleted.
export async function purgeExpiredUsage(now = Date.now()) {
  const cutoff = new Date(now - USAGE_RETENTION_DAYS * DAY).toISOString();
  for (const prefix of [USAGE_VERSION + '/', USAGE_VERSION + '-consent/']) {
    await ledger('?mode=eq.live&event_id=like.' + encodeURIComponent(prefix + '*') + '&processed_at=lt.' + encodeURIComponent(cutoff), 'DELETE');
  }
}
export async function setUsageConsent(identity: string, enabled: boolean, now = Date.now()) {
  const consentId = USAGE_VERSION + '-consent/' + identity;
  if (!enabled) {
    // Revoke first, so subsequent requests cannot create more optional events.
    await ledger('?mode=eq.live&event_id=eq.' + consentId, 'DELETE');
    await ledger('?mode=eq.live&event_id=like.' + encodeURIComponent(USAGE_VERSION + '/*/*/' + identity + '/*'), 'DELETE');
    return { enabled: false, expiresAt: null };
  }
  await purgeExpiredUsage(now);
  await ledger('?on_conflict=mode,event_id', 'POST', { mode: 'live', event_id: consentId, processed_at: new Date(now).toISOString() }, 'resolution=merge-duplicates,return=minimal');
  return { enabled: true, expiresAt: new Date(now + USAGE_RETENTION_DAYS * DAY).toISOString() };
}
export function usageEventId(identity: string, feature: string, action: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(identity) || !validUsageEvent(feature, action)) throw new CloudError('INVALID_USAGE_EVENT', 400);
  return [USAGE_VERSION, feature, action, identity, Math.floor(now / USAGE_BUCKET_MS)].join('/');
}
export async function recordUsageEvent(identity: string, feature: string, action: string, now = Date.now()) {
  if (!(await readUsageConsent(identity, now)).enabled) return { recorded: false, reason: 'CONSENT_REQUIRED' };
  await purgeExpiredUsage(now);
  const eventId = usageEventId(identity, feature, action, now);
  const result = await ledger('?on_conflict=mode,event_id', 'POST', { mode: 'live', event_id: eventId, processed_at: new Date(Math.floor(now / USAGE_BUCKET_MS) * USAGE_BUCKET_MS).toISOString() }, 'resolution=ignore-duplicates,return=representation');
  if (!Array.isArray(result)) throw new CloudError('USAGE_UNAVAILABLE');
  // An opt-out racing an in-flight event must not leave that event behind.
  if (!(await readUsageConsent(identity, now)).enabled) {
    await ledger('?mode=eq.live&event_id=eq.' + eventId, 'DELETE');
    return { recorded: false, reason: 'CONSENT_REVOKED' };
  }
  return { recorded: result.length > 0, reason: result.length ? 'RECORDED' : 'DUPLICATE_WINDOW' };
}
export function summarizeUsage(rows: Array<{ event_id: string; processed_at: string }>, since: string, now = Date.now()) {
  const allUsers = new Set<string>(), seen = new Set<string>(); let earliest: string | null = null;
  const groups: Record<string, { feature: string; label: string; visits: number; visitors: Set<string>; actionUsers: Set<string>; actions: Record<string, number> }> = Object.fromEntries(Object.entries(USAGE_FEATURES).map(([key, value]) => [key, { feature: key, label: value.label, visits: 0, visitors: new Set<string>(), actionUsers: new Set<string>(), actions: Object.fromEntries(value.actions.filter(action => action !== 'tab_open').map(action => [action, 0])) }]));
  for (const row of rows) {
    if (seen.has(row.event_id)) continue; seen.add(row.event_id);
    const [version, feature, action, person, bucket, ...extra] = row.event_id.split('/');
    const timestamp = Date.parse(row.processed_at);
    if (version !== USAGE_VERSION || extra.length || !validUsageEvent(feature, action) || !/^[a-f0-9]{64}$/.test(person || '') || !/^\d+$/.test(bucket || '') || timestamp < Date.parse(since) || timestamp > now || !Number.isFinite(timestamp) || Math.floor(timestamp / USAGE_BUCKET_MS) !== Number(bucket)) continue;
    const group = groups[feature]; allUsers.add(person);
    if (!earliest || timestamp < Date.parse(earliest)) earliest = row.processed_at;
    if (action === 'tab_open') { group.visits++; group.visitors.add(person); }
    else { group.actions[action]++; group.actionUsers.add(person); }
  }
  return { version: USAGE_VERSION, introducedOn: USAGE_INTRODUCED, since, checkedAt: new Date(now).toISOString(), firstRetainedEventAt: earliest, uniqueActiveUsers: allUsers.size,
    groups: Object.values(groups).map(group => ({ feature: group.feature, label: group.label, visits: group.visits, uniqueVisitors: group.visitors.size, actionWindows: Object.values(group.actions).reduce((a, b) => a + b, 0), uniqueActionUsers: group.actionUsers.size, actions: group.actions })), retentionDays: USAGE_RETENTION_DAYS };
}
export async function readUsageSummary(days: number, now = Date.now()) {
  const since = new Date(Math.max(Date.parse(USAGE_INTRODUCED), now - days * DAY)).toISOString();
  const rows: Array<{ event_id: string; processed_at: string }> = []; const seen = new Set<string>();
  for (let page = 0; page < 200; page++) {
    const batch = await ledger('?mode=eq.live&event_id=like.' + encodeURIComponent(USAGE_VERSION + '/*') + '&processed_at=gte.' + encodeURIComponent(since) + '&select=event_id,processed_at&order=processed_at.asc,event_id.asc&limit=100&offset=' + page * 100);
    if (!Array.isArray(batch)) throw new CloudError('USAGE_UNAVAILABLE');
    for (const row of batch) { if (typeof row.event_id !== 'string' || seen.has(row.event_id)) throw new CloudError('USAGE_REPORT_INCOMPLETE'); seen.add(row.event_id); }
    rows.push(...batch);
    if (batch.length < 100) return summarizeUsage(rows, since, now);
  }
  throw new CloudError('USAGE_REPORT_TOO_LARGE');
}

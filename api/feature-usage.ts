import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';
import { isFunnelQaEmail } from '../server/funnel-ledger.js';
import { readUsageConsent, readUsageSummary, recordUsageEvent, setUsageConsent, usageIdentity } from '../server/feature-usage.js';
import { USAGE_VERSION, validUsageEvent } from '../src/lib/featureUsageSchema.js';
const recent = new Map<string, { count: number; until: number }>();
export function usageRateAllowed(identity: string, now = Date.now()) {
  const prior = recent.get(identity);
  if (prior && prior.until > now && prior.count >= 30) throw new CloudError('USAGE_RATE_LIMIT', 429);
  if (recent.size >= 5000) recent.delete(recent.keys().next().value!);
  recent.set(identity, prior && prior.until > now ? { count: prior.count + 1, until: prior.until } : { count: 1, until: now + 60000 });
}
function sameOrigin(req: any) {
  const allowed = new Set(['https://www.fieldworkbybaker.com', 'https://fieldworkbybaker.com']);
  if (!allowed.has(String(req.headers?.origin || '')) || !String(req.headers?.['content-type'] || '').startsWith('application/json')) throw new CloudError('INVALID_USAGE_ORIGIN', 403);
}
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Authorization');
  try {
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
    if (req.method === 'POST') sameOrigin(req);
    const token = getBearerToken(req); if (!token) throw new CloudError('AUTH_REQUIRED', 401);
    const user = await verifyCloudUser(token);
    const profiles: any = await cloudRequest('/rest/v1/profiles?select=role&id=eq.' + user.id, token);
    if (!profiles?.[0]?.role) throw new CloudError('AUTH_REQUIRED', 401);
    const identity = usageIdentity(user.id);
    if (req.method === 'GET' && req.query?.view !== 'self') {
      if (profiles[0].role !== 'owner') throw new CloudError('OWNER_REQUIRED', 403);
      const days = Number(req.query?.days || 7);
      if (![1, 7, 30].includes(days)) throw new CloudError('INVALID_USAGE_WINDOW', 400);
      return res.status(200).json(await readUsageSummary(days));
    }
    const excluded = profiles[0].role === 'owner' || isFunnelQaEmail(user.email) || (user.user_metadata?.baker_funnel as { qa?: unknown } | undefined)?.qa === true;
    if (req.method === 'GET') return res.status(200).json({ version: USAGE_VERSION, ...(excluded || process.env.VERCEL_ENV === 'preview' ? { enabled: false, expiresAt: null } : await readUsageConsent(identity)), excluded });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 500) throw new CloudError('INVALID_USAGE_EVENT', 400);
    const expected = body.type === 'consent' ? ['type', 'enabled'] : ['type', 'feature', 'action', 'consent'];
    if (Object.keys(body).some(key => !expected.includes(key)) || (body.type === 'consent' ? typeof body.enabled !== 'boolean' : body.type !== 'event' || !validUsageEvent(body.feature, body.action) || body.consent !== USAGE_VERSION)) throw new CloudError('INVALID_USAGE_EVENT', 400);
    if (process.env.VERCEL_ENV === 'preview') return res.status(200).json({ recorded: false, enabled: false, reason: 'PREVIEW_EXCLUDED' });
    // Opt-out remains available even after hitting the event limiter, or when GPC is enabled.
    if (body.type === 'consent' && !body.enabled) return res.status(200).json({ version: USAGE_VERSION, ...await setUsageConsent(identity, false) });
    if (excluded || process.env.VERCEL_ENV === 'preview' || req.headers?.['sec-gpc'] === '1') return res.status(200).json({ recorded: false, enabled: false, reason: 'MEASUREMENT_EXCLUDED' });
    usageRateAllowed(identity);
    if (body.type === 'consent') return res.status(200).json({ version: USAGE_VERSION, ...await setUsageConsent(identity, true) });
    return res.status(200).json(await recordUsageEvent(identity, body.feature, body.action));
  } catch (error) {
    const failure = error instanceof CloudError ? error : new CloudError('USAGE_UNAVAILABLE');
    return res.status(failure.status).json({ code: failure.code, recorded: false });
  }
}

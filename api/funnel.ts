import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';
import { adMeasurementConfigured, attributionMetadata } from '../server/ad-measurement.js';
import { normalizeFunnelContext, readFunnelSummary, readOwnFunnelStages } from '../server/funnel-ledger.js';
import { reportFunnelEvent } from '../server/funnel-events.js';
import { createHash } from 'node:crypto';
const recent = new Map<string, { count: number; until: number }>();
function requestAllowed(req: any) {
  const origin = String(req.headers?.origin || '');
  const allowed = new Set(['https://www.fieldworkbybaker.com', 'https://fieldworkbybaker.com']);
  if (process.env.VERCEL_ENV === 'preview') for (const value of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (value && /^[a-z0-9.-]+\.vercel\.app$/i.test(value)) allowed.add('https://' + value);
  if (!allowed.has(origin) || !String(req.headers?.['content-type'] || '').startsWith('application/json')) throw new CloudError('INVALID_MEASUREMENT_ORIGIN', 403);
  const ip = String(req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].slice(0, 80);
  const key = createHash('sha256').update(ip).digest('hex'), now = Date.now(), previous = recent.get(key);
  if (previous && previous.until > now && previous.count >= 40) throw new CloudError('MEASUREMENT_RATE_LIMIT', 429);
  if (recent.size >= 5000) recent.delete(recent.keys().next().value!);
  recent.set(key, previous && previous.until > now ? { ...previous, count: previous.count + 1 } : { count: 1, until: now + 60000 });
}
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      const token = getBearerToken(req); if (!token) throw new CloudError('AUTH_REQUIRED', 401);
      const user = await verifyCloudUser(token);
      if(req.query?.view==='self') {
        const context=normalizeFunnelContext(user.user_metadata?.baker_funnel);
        if(!context)return res.status(200).json({version:'funnel-v1',stages:[],instrumented:false});
        // Identity comes from the provider, not a user ID or journey supplied in the request.
        return res.status(200).json({...await readOwnFunnelStages(context,user.id),instrumented:true});
      }
      const rows: any = await cloudRequest('/rest/v1/profiles?select=role&id=eq.' + user.id, token);
      if (rows?.[0]?.role !== 'owner') throw new CloudError('OWNER_REQUIRED', 403);
      const days = Number(req.query?.days || 30);
      if (!Number.isSafeInteger(days) || days < 1 || days > 90) throw new CloudError('INVALID_DATE_RANGE', 400);
      return res.status(200).json({ ...await readFunnelSummary(days), metaConfigured: adMeasurementConfigured(), purchaseOptimizationUnchanged: true });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
    requestAllowed(req);
    if (JSON.stringify(req.body || {}).length > 3000) throw new CloudError('REQUEST_TOO_LARGE', 413);
    const { stage, context: raw, path, adMeasurement } = req.body || {};
    // Browsers cannot claim signup, verification, checkout or payment success. Those stages are server-owned.
    if (stage !== 'landing_page_loaded' || !['/', '/signup'].includes(path)) throw new CloudError('INVALID_FUNNEL_EVENT', 400);
    const context = normalizeFunnelContext(raw); if (!context) throw new CloudError('INVALID_FUNNEL_CONTEXT', 400);
    if(adMeasurement?.consent!=='ads-v2')return res.status(200).json({recorded:false,reason:'CURRENT_CONSENT_REQUIRED'});
    const consent = attributionMetadata(adMeasurement, '', req.headers?.['user-agent']);
    if (!Object.keys(consent).length) return res.status(200).json({ recorded: false, reason: 'CONSENT_REQUIRED' });
    if (req.headers?.['sec-gpc'] === '1') return res.status(200).json({ recorded: false, reason: 'PRIVACY_SIGNAL' });
    const result = await reportFunnelEvent({ stage, context, path, adMeasurement, userAgent: req.headers?.['user-agent'] });
    return res.status(200).json({ ...result, qa: context.qa });
  } catch (error) {
    const failure = error instanceof CloudError ? error : new CloudError('FUNNEL_UNAVAILABLE');
    return res.status(failure.status).json({ code: failure.code, recorded: false });
  }
}

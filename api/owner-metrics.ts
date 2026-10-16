import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';
import { readOwnerMetrics } from '../server/owner-metrics.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  try {
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
    const token = getBearerToken(req);
    if (!token) throw new CloudError('AUTH_REQUIRED', 401);
    const user = await verifyCloudUser(token);
    const rows: any = await cloudRequest('/rest/v1/profiles?select=role&id=eq.' + user.id, token);
    if (rows?.[0]?.role !== 'owner') throw new CloudError('OWNER_REQUIRED', 403);
    const page = Number(req.query?.page || 1), status = String(req.query?.status || 'all');
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !['all', 'active', 'canceled', 'trialing', 'past_due', 'unpaid'].includes(status)) throw new CloudError('INVALID_REPORT_FILTER', 400);
    return res.status(200).json(await readOwnerMetrics(page, status));
  } catch (error) {
    const failure = error instanceof CloudError ? error : new CloudError('OWNER_REPORT_UNAVAILABLE');
    return res.status(failure.status).json({ code: failure.code });
  }
}

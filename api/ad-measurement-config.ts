import { adMeasurementConfigured } from '../server/ad-measurement.js';
export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  return res.status(200).json({ enabled: adMeasurementConfigured() && process.env.VERCEL_ENV !== 'preview', serverSide: true, consentRequired: true });
}

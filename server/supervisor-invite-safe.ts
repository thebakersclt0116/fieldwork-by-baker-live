import { canUseSupervisorTools, requireSession, signSession } from '../api/_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function sanitizeReviewEntry(value: any) {
  if (!value || typeof value !== 'object') return undefined;
  const id = String(value.id || '').trim();
  const date = String(value.date || '').trim();
  const duration = Number(value.duration || 0);
  const activityCategory = value.activityCategory === 'RESTRICTED'
    ? 'RESTRICTED'
    : value.activityCategory === 'UNKNOWN'
      ? 'UNKNOWN'
      : 'UNRESTRICTED';
  const narrative = String(value.narrative || value.notes || '').trim().slice(0, 1600);
  if (!id || !date || !(duration > 0)) return undefined;
  return {
    id,
    date,
    duration,
    activityCategory,
    narrative,
    supervisorName: String(value.supervisorName || '').trim().slice(0, 120) || undefined,
    supervisionMinutes: Math.max(0, Number(value.supervisionMinutes || 0)) || undefined,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req);
  if (!session || !canUseSupervisorTools(session)) {
    return send(res, 401, { error: 'Professional supervisor workflow access is required.' });
  }

  const supervisorName = String(req.body?.supervisorName || '').trim();
  const supervisorEmail = String(req.body?.supervisorEmail || '').trim().toLowerCase();
  const requestedSupervisee = String(req.body?.superviseeEmail || session.email).trim().toLowerCase();
  const superviseeEmail = session.role === 'owner' ? requestedSupervisee : session.email.toLowerCase();
  const reviewEntry = sanitizeReviewEntry(req.body?.reviewEntry);

  if (!supervisorName || !/^\S+@\S+\.\S+$/.test(supervisorEmail)) {
    return send(res, 400, { error: 'Supervisor name and a valid email are required.' });
  }

  const token = signSession({
    email: supervisorEmail,
    name: supervisorName,
    role: 'supervisor',
    superviseeEmail,
    reviewEntry,
  } as any, 60 * 60 * 24 * 14);

  if (!token) return send(res, 503, { error: 'Secure invite signing is unavailable on this deployment.' });

  return send(res, 200, {
    token,
    expiresInDays: 14,
    superviseeEmail,
    supervisorEmail,
    reviewEntry: reviewEntry || null,
    path: `/supervisor/${encodeURIComponent(token)}`,
  });
}

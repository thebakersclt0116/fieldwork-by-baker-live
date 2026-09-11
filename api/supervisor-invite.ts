import { requireSession, signSession } from './_auth';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req, ['owner', 'paid', 'professional']);
  if (!session) return send(res, 401, { error: 'Authorized supervisee or owner access is required.' });

  const supervisorName = String(req.body?.supervisorName || '').trim();
  const supervisorEmail = String(req.body?.supervisorEmail || '').trim().toLowerCase();
  const requestedSupervisee = String(req.body?.superviseeEmail || session.email).trim().toLowerCase();
  const superviseeEmail = session.role === 'owner' ? requestedSupervisee : session.email.toLowerCase();

  if (!supervisorName || !/^\S+@\S+\.\S+$/.test(supervisorEmail)) {
    return send(res, 400, { error: 'Supervisor name and a valid email are required.' });
  }

  const token = signSession(
    {
      email: supervisorEmail,
      name: supervisorName,
      role: 'supervisor',
      superviseeEmail,
    },
    60 * 60 * 24 * 14
  );

  if (!token) return send(res, 503, { error: 'Secure invite signing is unavailable on this deployment.' });

  return send(res, 200, {
    token,
    expiresInDays: 14,
    superviseeEmail,
    supervisorEmail,
    path: `/supervisor/${encodeURIComponent(token)}`,
  });
}

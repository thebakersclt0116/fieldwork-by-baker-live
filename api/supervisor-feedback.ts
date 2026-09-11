import { requireSession, signSession } from './_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req, ['supervisor']);
  if (!session || !session.superviseeEmail) {
    return send(res, 401, { error: 'A valid supervisor invite is required.' });
  }

  const status = ['VERIFIED', 'PENDING', 'REJECTED'].includes(String(req.body?.status))
    ? String(req.body.status) as 'VERIFIED' | 'PENDING' | 'REJECTED'
    : 'PENDING';
  const note = String(req.body?.note || '').trim().slice(0, 2000);
  const message = String(req.body?.message || '').trim().slice(0, 2000);
  const entryId = String(req.body?.entryId || session.reviewEntry?.id || '').trim();

  if (!entryId) return send(res, 400, { error: 'This invite is not tied to a reviewable entry.' });
  if (!note && !message && status === 'PENDING') {
    return send(res, 400, { error: 'Add a note, message, or review status before sending.' });
  }

  const feedbackToken = signSession(
    {
      email: session.email,
      name: session.name,
      role: 'supervisor',
      superviseeEmail: session.superviseeEmail,
      reviewEntry: session.reviewEntry,
      feedback: {
        entryId,
        status,
        note,
        message,
      },
    },
    60 * 60 * 24 * 7
  );

  if (!feedbackToken) return send(res, 503, { error: 'Secure feedback signing is unavailable.' });

  return send(res, 200, {
    feedbackToken,
    path: `/feedback/${encodeURIComponent(feedbackToken)}`,
    superviseeEmail: session.superviseeEmail,
    subject: `Fieldwork by Baker supervisor feedback – ${session.reviewEntry?.date || 'fieldwork entry'}`,
  });
}

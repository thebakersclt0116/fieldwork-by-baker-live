import { canUseSupervisorTools, requireSession, signSession } from '../api/_auth.js';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function notificationConfigured() {
  return Boolean(
    (process.env.RESEND_API_KEY && process.env.BAKER_NOTIFICATION_FROM) ||
    process.env.BAKER_NOTIFICATION_WEBHOOK_URL
  );
}

function appOrigin(req: any): string {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || 'https';
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.fieldworkbybaker.com').split(',')[0].trim();
  return `${protocol}://${host}`;
}

async function deliverRevisionNotification(args: {
  supervisorName: string;
  supervisorEmail: string;
  superviseeEmail: string;
  changeReason: string;
  reviewUrl: string;
  date?: string;
  duration?: number;
}) {
  const result = {
    configured: notificationConfigured(),
    emailSent: false,
    webhookSent: false,
    channel: 'none' as 'none' | 'email' | 'webhook' | 'email+webhook',
  };

  const emailKey = process.env.RESEND_API_KEY;
  const from = process.env.BAKER_NOTIFICATION_FROM;
  if (emailKey && from) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [args.supervisorEmail],
          subject: `Fieldwork entry changed — re-approval needed${args.date ? ` (${args.date})` : ''}`,
          text: [
            `Hi ${args.supervisorName},`,
            '',
            `${args.superviseeEmail} changed a fieldwork entry that you previously approved. The entry has automatically returned to Pending and needs your review again.`,
            args.date ? `Entry date: ${args.date}` : '',
            args.duration ? `Current duration: ${args.duration} hours` : '',
            `Reason for change: ${args.changeReason}`,
            '',
            `Review the updated entry: ${args.reviewUrl}`,
            '',
            'Fieldwork by Baker',
          ].filter(Boolean).join('\n'),
        }),
      });
      result.emailSent = response.ok;
      if (!response.ok) console.error('Revision notification email failed', response.status, (await response.text()).slice(0, 300));
    } catch (error) {
      console.error('Revision notification email failed', error);
    }
  }

  const webhook = process.env.BAKER_NOTIFICATION_WEBHOOK_URL;
  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'fieldwork.entry.reapproval_required',
          supervisorName: args.supervisorName,
          supervisorEmail: args.supervisorEmail,
          superviseeEmail: args.superviseeEmail,
          changeReason: args.changeReason,
          reviewUrl: args.reviewUrl,
          date: args.date,
          duration: args.duration,
        }),
      });
      result.webhookSent = response.ok;
      if (!response.ok) console.error('Revision notification webhook failed', response.status, (await response.text()).slice(0, 300));
    } catch (error) {
      console.error('Revision notification webhook failed', error);
    }
  }

  if (result.emailSent && result.webhookSent) result.channel = 'email+webhook';
  else if (result.emailSent) result.channel = 'email';
  else if (result.webhookSent) result.channel = 'webhook';
  return result;
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
  const narrative = String(value.narrative || value.notes || '').trim().slice(0, 2400);
  if (!id || !date || !(duration > 0)) return undefined;
  return {
    id,
    date,
    duration,
    activityCategory,
    narrative,
    supervisorName: String(value.supervisorName || '').trim().slice(0, 120) || undefined,
    supervisionMinutes: Math.max(0, Number(value.supervisionMinutes || 0)) || undefined,
    revision: Math.max(0, Math.floor(Number(value.revision || 0))),
    changeReason: String(value.changeReason || '').trim().slice(0, 1000) || undefined,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return send(res, 200, {
      service: 'Supervisor invite and revision notification',
      status: 'ready',
      notificationDeliveryConfigured: notificationConfigured(),
      channels: {
        email: Boolean(process.env.RESEND_API_KEY && process.env.BAKER_NOTIFICATION_FROM),
        webhook: Boolean(process.env.BAKER_NOTIFICATION_WEBHOOK_URL),
      },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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
  const notificationMode = String(req.body?.notificationMode || 'none');
  const changeReason = String(req.body?.changeReason || reviewEntry?.changeReason || '').trim().slice(0, 1000);

  if (!supervisorName || !/^\S+@\S+\.\S+$/.test(supervisorEmail)) {
    return send(res, 400, { error: 'Supervisor name and a valid email are required.' });
  }
  if (notificationMode === 'revision' && !changeReason) {
    return send(res, 400, { error: 'A reason for the approved-entry change is required.' });
  }

  const token = signSession({
    email: supervisorEmail,
    name: supervisorName,
    role: 'supervisor',
    superviseeEmail,
    reviewEntry,
  } as any, 60 * 60 * 24 * 14);

  if (!token) return send(res, 503, { error: 'Secure invite signing is unavailable on this deployment.' });

  const path = `/supervisor/${encodeURIComponent(token)}`;
  const reviewUrl = `${appOrigin(req)}${path}`;
  const notification = notificationMode === 'revision'
    ? await deliverRevisionNotification({
        supervisorName,
        supervisorEmail,
        superviseeEmail,
        changeReason,
        reviewUrl,
        date: reviewEntry?.date,
        duration: reviewEntry?.duration,
      })
    : {
        configured: notificationConfigured(),
        emailSent: false,
        webhookSent: false,
        channel: 'none' as const,
      };

  return send(res, 200, {
    token,
    expiresInDays: 14,
    superviseeEmail,
    supervisorEmail,
    reviewEntry: reviewEntry || null,
    path,
    notification,
  });
}

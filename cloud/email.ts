import { createHash } from 'node:crypto';

export interface AuthEmail {
  to: string;
  subject: string;
  text: string;
  /** Stable for retries of the same verification/reset link, never logged. */
  deliveryKey: string;
}

export type AuthEmailSender = (message: AuthEmail) => Promise<void>;

export function isAuthEmailConfigured(): boolean {
  const from = process.env.FIELDWORK_AUTH_FROM?.trim();
  return Boolean(process.env.RESEND_API_KEY?.trim() && from && !/[\r\n]/.test(from));
}

/** No development mailbox, console-link fallback, or implicit real email delivery. */
export const sendAuthEmail: AuthEmailSender = async (message) => {
  if (!isAuthEmailConfigured()) {
    throw new Error('Account email delivery is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `fieldwork-auth-${createHash('sha256').update(message.deliveryKey).digest('hex')}`,
    },
    body: JSON.stringify({
      from: process.env.FIELDWORK_AUTH_FROM!.trim(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  // Provider error bodies can contain email addresses or request content.
  // Never log them, the verification URL, or any credentials.
  if (!response.ok) {
    throw new Error(`Account email delivery failed (${response.status}).`);
  }
};

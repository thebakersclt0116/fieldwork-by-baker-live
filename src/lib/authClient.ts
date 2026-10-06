/** Same-origin account requests. Session cookies are never copied into browser storage. */
export class AccountRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = 'ACCOUNT_SERVICE_UNAVAILABLE') {
    super(message);
    this.name = 'AccountRequestError';
    this.status = status;
    this.code = code;
  }
}

function accountErrorMessage(status: number, code: string): string {
  if (code === 'EMAIL_NOT_VERIFIED') return 'Verify your email before signing in. You can request another verification email below.';
  if (['INVALID_EMAIL_OR_PASSWORD', 'INVALID_PASSWORD', 'USER_NOT_FOUND'].includes(code) || status === 401) {
    return 'We could not sign you in with those details. Check your email and password, or reset your password.';
  }
  if (['INVALID_TOKEN', 'TOKEN_EXPIRED', 'INVALID_RESET_TOKEN'].includes(code)) {
    return 'This link is invalid or has expired. Request a new email to continue.';
  }
  if (code.includes('PASSWORD_TOO_SHORT')) return 'Use a password with at least 12 characters.';
  if (code.includes('PASSWORD_TOO_LONG')) return 'Use a password with no more than 128 characters.';
  if (code.includes('RESERVED') || code === 'BETA_ACCOUNT_EXISTS') {
    return 'This account already has beta access. Sign in with your existing password or use password recovery.';
  }
  if (status === 429) return 'There have been too many attempts. Please wait a few minutes and try again.';
  if (status >= 500 || status === 0 || status === 404) return 'Secure account services are temporarily unavailable. Please try again shortly.';
  return 'We could not complete that account request. Please check your details and try again.';
}

export async function accountRequest(path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AccountRequestError(accountErrorMessage(0, 'ACCOUNT_SERVICE_UNAVAILABLE'));
  }

  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const nested = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : {};
    const rawCode = record.code || nested.code;
    const code = typeof rawCode === 'string' ? rawCode : 'ACCOUNT_REQUEST_FAILED';
    throw new AccountRequestError(accountErrorMessage(response.status, code), response.status, code);
  }
  if (!payload || typeof payload !== 'object') {
    throw new AccountRequestError(accountErrorMessage(503, 'INVALID_ACCOUNT_RESPONSE'), 503, 'INVALID_ACCOUNT_RESPONSE');
  }
  return payload;
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some((character) => character.charCodeAt(0) < 32)) return '/dashboard';
  try {
    const origin = typeof window === 'undefined' ? 'https://www.fieldworkbybaker.com' : window.location.origin;
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch { return '/dashboard'; }
}

export function accountCallbackURL(path: string): string {
  return new URL(safeReturnPath(path), window.location.origin).href;
}

export function sendVerificationEmail(email: string, returnTo = '/dashboard'): Promise<unknown> {
  return accountRequest('/api/cloud/auth/send-verification-email', {
    email: email.trim().toLowerCase(),
    callbackURL: accountCallbackURL(`/login?verified=1&return=${encodeURIComponent(safeReturnPath(returnTo))}`),
  });
}

export function requestPasswordRecovery(email: string): Promise<unknown> {
  return accountRequest('/api/cloud/auth/request-password-reset', {
    email: email.trim().toLowerCase(),
    redirectTo: accountCallbackURL('/reset-password'),
  });
}

export function resetAccountPassword(token: string, newPassword: string): Promise<unknown> {
  return accountRequest('/api/cloud/auth/reset-password', { token, newPassword });
}

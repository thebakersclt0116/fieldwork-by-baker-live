import type { BakerSession } from '../api/_auth.js';

export function cloudApiOrigin(): string | null {
  const configured = process.env.FIELDWORK_CLOUD_API_ORIGIN;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function readCloudSession(req: { headers?: Record<string, string | string[] | undefined> }): Promise<BakerSession | null> {
  const origin = cloudApiOrigin();
  const cookie = req.headers?.cookie;
  const authorization = req.headers?.authorization;
  const betaAuthorization = typeof authorization === 'string' && /^Bearer b2\./i.test(authorization) ? authorization : null;
  if (!origin || (!cookie && !betaAuthorization)) return null;
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (cookie) headers.cookie = Array.isArray(cookie) ? cookie.join('; ') : cookie;
  if (betaAuthorization) headers.authorization = betaAuthorization;
  if (process.env.FIELDWORK_ORIGIN_SECRET) headers['x-fieldwork-origin-secret'] = process.env.FIELDWORK_ORIGIN_SECRET;
  try {
    const response = await fetch(`${origin}/api/cloud/session`, {
      headers, redirect: 'error', signal: AbortSignal.timeout(6000), cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      user?: Partial<BakerSession> & { authMethod?: string };
      authMethod?: string;
      hasCloudAccount?: boolean;
    };
    const user = payload.user;
    const authMethod = payload.authMethod || user?.authMethod;
    if (!user || payload.hasCloudAccount !== true || !['cookie', 'beta'].includes(String(authMethod))) return null;
    if (!user.email || !user.name || !['owner', 'free', 'paid', 'professional'].includes(String(user.role))) return null;
    return {
      userId: user.userId,
      workspaceId: user.workspaceId,
      authMethod,
      email: user.email,
      name: user.name,
      role: user.role as BakerSession['role'],
      subscription: user.subscription,
      exportPass: user.exportPass === true,
      trialEndsAt: user.trialEndsAt,
      exp: Math.floor(Date.now() / 1000) + 60,
    };
  } catch {
    // A cloud outage never turns a client-supplied profile into authenticated access.
    return null;
  }
}

export async function readCloudReadiness(): Promise<Record<string, unknown> | null> {
  const origin = cloudApiOrigin();
  if (!origin) return null;
  try {
    const response = await fetch(`${origin}/api/cloud/health`, {
      redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    return response.ok ? await response.json() as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

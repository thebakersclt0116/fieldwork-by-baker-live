import { createPublicKey, verify } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import type { Pool } from 'pg';
import type { CloudIdentity } from '../shared/cloudTypes.js';
import { ensureDefaultEntitlement, getAuth, RESERVED_BETA_ACCOUNTS } from './auth.js';
import { getPool } from './db.js';

export interface IdentityRequest {
  headers?: Record<string, string | string[] | undefined>;
}

const BETA_PUBLIC_KEYS = new Map([
  ['ayalaemily52@gmail.com', 'MCowBQYDK2VwAyEA3mxdQfx0eHqbYKff7KO5J3Ecu8E23MJlKdriCp2SCbM='],
  ['justin@bakerholdings.co', 'MCowBQYDK2VwAyEASvSw2YHydkRdsXdZnrz328w4flO7rZvONuF1VW7DQYE='],
]);

function authorization(req: IdentityRequest): string | undefined {
  const entries = Object.entries(req.headers ?? {}).filter(([name]) => name.toLowerCase() === 'authorization');
  if (entries.length === 0) return undefined;
  if (entries.length !== 1) return '';
  const value = entries[0][1];
  return typeof value === 'string' ? value : '';
}

/** Canonical beta privileges are pinned server-side, never accepted from claims. */
export function verifiedBetaIdentity(req: IdentityRequest): CloudIdentity | null {
  const header = authorization(req);
  if (!header || header.length > 8192) return null;
  const match = /^Bearer (b2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
  if (!match) return null;
  const [, token] = match;
  const [, encoded, suppliedSignature] = token.split('.');

  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const claims = parsed as Record<string, unknown>;
    if (typeof claims.email !== 'string' || !Number.isSafeInteger(claims.exp)) return null;
    if ((claims.exp as number) <= Math.floor(Date.now() / 1000)) return null;
    const email = claims.email.trim().toLowerCase();
    const account = RESERVED_BETA_ACCOUNTS.find((candidate) => candidate.email === email);
    const key = BETA_PUBLIC_KEYS.get(email);
    if (!account || !key) return null;
    const signature = Buffer.from(suppliedSignature, 'base64url');
    if (signature.length !== 64) return null;
    if (!verify(null, Buffer.from(encoded, 'utf8'), createPublicKey({
      key: Buffer.from(key, 'base64'),
      format: 'der',
      type: 'spki',
    }), signature)) return null;

    return {
      userId: account.userId,
      workspaceId: `workspace-${account.userId}`,
      email: account.email,
      name: account.name,
      role: account.role,
      ...(account.subscription ? { subscription: account.subscription } : {}),
      exportPass: account.exportPass,
      trialEndsAt: null,
      authMethod: 'beta',
    };
  } catch {
    return null;
  }
}

interface EntitlementRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string;
  subscription: 'individual' | 'professional' | 'enterprise' | null;
  export_pass: boolean;
  billing_access_ends_at: Date | null;
  legacy_beta_enabled: boolean;
  trial_ends_at: Date | null;
}

type AuthSession = {
  user: { id: string; email: string; emailVerified: boolean };
  session: { expiresAt: Date | string };
} | null;

export interface IdentityDependencies {
  pool: Pool;
  getSession: (headers: Headers) => Promise<AuthSession>;
}

/** Dependency injection is used only by isolated tests, never by HTTP input. */
export function createIdentityResolver(dependencies: IdentityDependencies) {
  return async (req: IdentityRequest): Promise<CloudIdentity | null> => {
    const suppliedAuthorization = authorization(req);
    const beta = suppliedAuthorization !== undefined ? verifiedBetaIdentity(req) : null;
    // Explicit credentials must not silently select a different browser account.
    // In particular, legacy free HMAC/supervisor tokens grant no cloud identity.
    if (suppliedAuthorization !== undefined && !beta) return null;

    const session = beta ? null : await dependencies.getSession(fromNodeHeaders(req.headers ?? {}));
    const expiresAt = session ? new Date(session.session.expiresAt).getTime() : Number.NaN;
    if (!beta && (!session?.user.emailVerified || !Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
      return null;
    }
    const userId = beta?.userId ?? session!.user.id;
    const email = beta?.email ?? session!.user.email.trim().toLowerCase();
    const reserved = RESERVED_BETA_ACCOUNTS.find((account) => account.email === email);
    if (reserved && reserved.userId !== userId) return null;

    if (!beta) await ensureDefaultEntitlement(dependencies.pool, userId);
    const result = await dependencies.pool.query<EntitlementRow>(
      `SELECT u.id, u.email, u.name, u."emailVerified", e.role, e.subscription,
              e.export_pass, e.trial_ends_at, e.billing_access_ends_at, e.legacy_beta_enabled
       FROM fieldwork_auth_user u
       JOIN fieldwork_entitlements e ON e.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row || !row.emailVerified || row.email.toLowerCase() !== email) return null;
    if (beta && !row.legacy_beta_enabled) return null;
    const permanentBeta = RESERVED_BETA_ACCOUNTS.some((account) => account.userId === row.id && account.email === row.email.toLowerCase());
    const billingEndsAt = row.billing_access_ends_at ? new Date(row.billing_access_ends_at).getTime() : Number.NaN;
    const expiredPaidAccess = !permanentBeta
      && (row.role === 'paid' || row.role === 'professional' || row.subscription !== null)
      && (!Number.isFinite(billingEndsAt) || billingEndsAt <= Date.now());

    return {
      userId: row.id,
      workspaceId: `workspace-${row.id}`,
      email: row.email.toLowerCase(),
      name: row.name,
      role: expiredPaidAccess ? 'free' : row.role,
      ...(!expiredPaidAccess && row.subscription ? { subscription: row.subscription } : {}),
      exportPass: expiredPaidAccess ? false : row.export_pass,
      trialEndsAt: row.trial_ends_at ? Math.floor(new Date(row.trial_ends_at).getTime() / 1000) : null,
      authMethod: beta ? 'beta' : 'cookie',
    };
  };
}

export async function resolveIdentity(req: IdentityRequest): Promise<CloudIdentity | null> {
  return createIdentityResolver({
    pool: getPool(),
    getSession: (headers) => getAuth().api.getSession({ headers }),
  })(req);
}

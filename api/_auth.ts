import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { BAKER_RUNTIME_SECRET } from './_runtime-secret.js';

export type BakerRole = 'owner' | 'free' | 'paid' | 'professional' | 'supervisor';

export interface ReviewEntrySnapshot {
  id: string;
  date: string;
  duration: number;
  activityCategory: 'RESTRICTED' | 'UNRESTRICTED';
  narrative: string;
  supervisorName?: string;
  supervisionMinutes?: number;
}

export interface SupervisorFeedbackPayload {
  entryId: string;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  note: string;
  message: string;
}

export interface BakerSession {
  email: string;
  name: string;
  role: BakerRole;
  subscription?: 'individual' | 'professional' | 'enterprise';
  exportPass?: boolean;
  superviseeEmail?: string;
  reviewEntry?: ReviewEntrySnapshot;
  feedback?: SupervisorFeedbackPayload;
  exp: number;
}

const OWNER_EMAIL = 'justin@bakerholdings.co';
const EMILY_EMAIL = 'ayalaemily52@gmail.com';

// Legacy owner credential kept unchanged for the private beta.
const OWNER_PASSWORD_HASH = 'a2382d6202a69228c36f59db10c71e09bd9e826153b784b65cc13068cc19123b';

// Emily uses a salted scrypt verifier so her password is never stored in source control.
const EMILY_PASSWORD_SALT_B64 = 'MTQtXqMueoKDuGssOKm1xg==';
const EMILY_PASSWORD_SCRYPT_B64 = 'QZkFFYAumiLaVGcEmXf9Vr9D+0jKiq6Qvp/Vw4ov0HfKu39o7Wee3U5RfODbNfOkbF8SZ4wiOwM66fM4elOcpA==';

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sessionSecret(): string | null {
  return process.env.BAKER_SESSION_SECRET || BAKER_RUNTIME_SECRET || null;
}

export function hasSessionSigningSecret(): boolean {
  return Boolean(sessionSecret());
}

function signatureFor(encodedPayload: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function signSession(payload: Omit<BakerSession, 'exp'>, ttlSeconds = 60 * 60 * 12): string | null {
  const session: BakerSession = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = base64Url(JSON.stringify(session));
  const signature = signatureFor(encoded);
  return signature ? `${encoded}.${signature}` : null;
}

export function verifySession(token: string | undefined | null): BakerSession | null {
  if (!token) return null;
  const [encoded, suppliedSignature] = token.split('.');
  if (!encoded || !suppliedSignature) return null;
  const expectedSignature = signatureFor(encoded);
  if (!expectedSignature) return null;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as BakerSession;
    if (!parsed.email || !parsed.role || !parsed.exp) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getBearerToken(req: { headers?: Record<string, string | string[] | undefined> }): string | null {
  const raw = req.headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

export function requireSession(
  req: { headers?: Record<string, string | string[] | undefined> },
  roles: BakerRole[] = ['owner', 'free', 'paid', 'professional', 'supervisor']
): BakerSession | null {
  const session = verifySession(getBearerToken(req));
  if (!session || !roles.includes(session.role)) return null;
  return session;
}

function matchesLegacyOwnerPassword(password: string): boolean {
  const suppliedHash = createHash('sha256').update(password).digest('hex');
  return suppliedHash.length === OWNER_PASSWORD_HASH.length && timingSafeEqual(
    Buffer.from(suppliedHash),
    Buffer.from(OWNER_PASSWORD_HASH)
  );
}

function matchesEmilyPassword(password: string): boolean {
  const expected = Buffer.from(EMILY_PASSWORD_SCRYPT_B64, 'base64');
  const supplied = scryptSync(
    password,
    Buffer.from(EMILY_PASSWORD_SALT_B64, 'base64'),
    expected.length,
    { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
  );
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyBetaCredentials(email: string, password: string): Omit<BakerSession, 'exp'> | null {
  const normalized = email.trim().toLowerCase();

  if (normalized === OWNER_EMAIL) {
    if (!matchesLegacyOwnerPassword(password)) return null;
    return { email: OWNER_EMAIL, name: 'Justin Baker', role: 'owner' };
  }

  if (normalized === EMILY_EMAIL) {
    if (!matchesEmilyPassword(password)) return null;
    return {
      email: EMILY_EMAIL,
      name: 'Emily Ayala',
      role: 'professional',
      subscription: 'professional',
    };
  }

  return null;
}

export function canUsePaidTools(session: BakerSession): boolean {
  return session.role === 'owner' || session.role === 'paid' || session.role === 'professional';
}

export function canExportOfficialForms(session: BakerSession): boolean {
  return canUsePaidTools(session) || Boolean(session.exportPass);
}

export const BAKER_OWNER_EMAIL = OWNER_EMAIL;
export const BAKER_EMILY_EMAIL = EMILY_EMAIL;

import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign as signDetached,
  timingSafeEqual,
  verify as verifyDetached,
  type KeyObject,
} from 'node:crypto';
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
  trialEndsAt?: number;
  superviseeEmail?: string;
  reviewEntry?: ReviewEntrySnapshot;
  feedback?: SupervisorFeedbackPayload;
  exp: number;
}

const OWNER_EMAIL = 'justin@bakerholdings.co';
const EMILY_EMAIL = 'ayalaemily52@gmail.com';

// Public verification keys only. Beta private signing material is derived transiently
// from the password supplied at login and is never stored in source control.
const BETA_PUBLIC_KEYS: Record<string, string> = {
  [EMILY_EMAIL]: 'MCowBQYDK2VwAyEA3mxdQfx0eHqbYKff7KO5J3Ecu8E23MJlKdriCp2SCbM=',
  [OWNER_EMAIL]: 'MCowBQYDK2VwAyEASvSw2YHydkRdsXdZnrz328w4flO7rZvONuF1VW7DQYE=',
};

const ED25519_PKCS8_SEED_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

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

function betaUserForEmail(email: string): Omit<BakerSession, 'exp'> | null {
  const normalized = email.trim().toLowerCase();
  if (normalized === OWNER_EMAIL) return { email: OWNER_EMAIL, name: 'Justin Baker', role: 'owner' };
  if (normalized === EMILY_EMAIL) {
    return {
      email: EMILY_EMAIL,
      name: 'Emily Ayala',
      role: 'professional',
      subscription: 'professional',
      exportPass: true,
    };
  }
  return null;
}

function deriveBetaPrivateKey(email: string, password: string): KeyObject {
  const normalized = email.trim().toLowerCase();
  const seed = createHash('sha256')
    .update(`fieldwork-by-baker:beta:v2:${normalized}:${password}`)
    .digest();
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
}

function betaCredentialMatches(email: string, password: string): KeyObject | null {
  const normalized = email.trim().toLowerCase();
  const expectedBase64 = BETA_PUBLIC_KEYS[normalized];
  if (!expectedBase64 || !password) return null;

  try {
    const privateKey = deriveBetaPrivateKey(normalized, password);
    const derived = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer;
    const expected = Buffer.from(expectedBase64, 'base64');
    if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) return null;
    return privateKey;
  } catch {
    return null;
  }
}

export function issueBetaSessionFromCredentials(
  email: string,
  password: string,
  ttlSeconds = 60 * 60 * 24 * 365
): { user: Omit<BakerSession, 'exp'>; token: string } | null {
  const normalized = email.trim().toLowerCase();
  const user = betaUserForEmail(normalized);
  const privateKey = betaCredentialMatches(normalized, password);
  if (!user || !privateKey) return null;

  const session: BakerSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64Url(JSON.stringify(session));
  const signature = signDetached(null, Buffer.from(encoded, 'utf8'), privateKey).toString('base64url');
  return { user, token: `b2.${encoded}.${signature}` };
}

export function signSession(payload: Omit<BakerSession, 'exp'>, ttlSeconds = 60 * 60 * 12): string | null {
  const session: BakerSession = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = base64Url(JSON.stringify(session));
  const signature = signatureFor(encoded);
  return signature ? `${encoded}.${signature}` : null;
}

function verifyStableBetaSession(token: string): BakerSession | null {
  const [version, encoded, suppliedSignature] = token.split('.');
  if (version !== 'b2' || !encoded || !suppliedSignature) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as BakerSession;
    const normalized = parsed.email?.trim().toLowerCase();
    if (!normalized || !parsed.role || !parsed.exp) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;

    const publicKeyBase64 = BETA_PUBLIC_KEYS[normalized];
    if (!publicKeyBase64) return null;
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const valid = verifyDetached(
      null,
      Buffer.from(encoded, 'utf8'),
      publicKey,
      Buffer.from(suppliedSignature, 'base64url')
    );
    if (!valid) return null;

    const canonicalUser = betaUserForEmail(normalized);
    if (!canonicalUser) return null;
    return { ...parsed, ...canonicalUser, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function verifySession(token: string | undefined | null): BakerSession | null {
  if (!token) return null;
  if (token.startsWith('b2.')) return verifyStableBetaSession(token);

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

export function verifyBetaCredentials(email: string, password: string): Omit<BakerSession, 'exp'> | null {
  const normalized = email.trim().toLowerCase();
  if (!betaCredentialMatches(normalized, password)) return null;
  return betaUserForEmail(normalized);
}

export function isEmilyBetaAccount(session: Pick<BakerSession, 'email'>): boolean {
  return session.email.trim().toLowerCase() === EMILY_EMAIL;
}

export function isEmilySupervisor(session: Pick<BakerSession, 'role' | 'superviseeEmail'>): boolean {
  return session.role === 'supervisor' && session.superviseeEmail?.trim().toLowerCase() === EMILY_EMAIL;
}

export function isTrialActive(session: Pick<BakerSession, 'trialEndsAt'>): boolean {
  return typeof session.trialEndsAt === 'number' && session.trialEndsAt > Math.floor(Date.now() / 1000);
}

export function canUsePaidTools(session: BakerSession): boolean {
  return isEmilyBetaAccount(session) || session.role === 'owner' || session.role === 'paid' || session.role === 'professional' || isTrialActive(session);
}

export function canUseSupervisorTools(session: BakerSession): boolean {
  return isEmilyBetaAccount(session) || isEmilySupervisor(session) || session.role === 'owner' || session.role === 'professional' || session.subscription === 'professional' || session.subscription === 'enterprise' || isTrialActive(session);
}

export function canExportOfficialForms(session: BakerSession): boolean {
  return canUsePaidTools(session) || Boolean(session.exportPass);
}

export const BAKER_OWNER_EMAIL = OWNER_EMAIL;
export const BAKER_EMILY_EMAIL = EMILY_EMAIL;

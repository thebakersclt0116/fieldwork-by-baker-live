import { useEffect, useSyncExternalStore } from 'react';
import { AccountRequestError, accountCallbackURL, accountRequest, safeReturnPath } from '@/lib/authClient';

export type SubscriptionTier = 'individual' | 'professional' | 'enterprise' | 'none';
export type BillingCycle = 'monthly' | 'annual';
export type AuthMethod = 'cookie' | 'beta';

export interface AuthUser {
  name: string;
  email: string;
  role: 'owner' | 'free' | 'paid' | 'professional' | 'supervisor';
  initials: string;
  subscription?: SubscriptionTier;
  billingCycle?: BillingCycle;
  exportPass?: boolean;
  trialEndsAt?: number;
  userId?: string;
  workspaceId?: string;
  authMethod?: AuthMethod;
}

interface AuthSnapshot {
  user: AuthUser | null;
  isLoading: boolean;
  accessToken: string | null;
  hasCloudAccount: boolean;
  authMethod: AuthMethod | null;
  sessionError: string | null;
  checkedAt: number;
}

const USER_KEY = 'authUser';
const TOKEN_KEY = 'bakerSessionToken';
const SESSION_UPGRADE_KEY = 'bakerSessionUpgradeRequired';
const CHANGE_KEY = 'bakerAccountSessionChanged';
const RESERVED_BETA_EMAILS = new Set(['ayalaemily52@gmail.com', 'justin@bakerholdings.co']);
// Compatibility with existing feature checks only. This value is not a credential.
const COOKIE_SESSION_MARKER = 'cloud-session';
const roles: AuthUser['role'][] = ['owner', 'free', 'paid', 'professional', 'supervisor'];
const subscriptions: SubscriptionTier[] = ['individual', 'professional', 'enterprise', 'none'];

const initialSnapshot: AuthSnapshot = {
  user: null, isLoading: true, accessToken: null, hasCloudAccount: false, authMethod: null, sessionError: null, checkedAt: Math.floor(Date.now() / 1000),
};
let snapshot: AuthSnapshot = initialSnapshot;
const listeners = new Set<() => void>();
let initialized = false;
let generation = 0;
let inFlight: Promise<void> | null = null;
let lastVerifiedAt = 0;
let trialTimer: ReturnType<typeof setTimeout> | null = null;

function setSnapshot(next: AuthSnapshot): void {
  snapshot = { ...next, checkedAt: Math.floor(Date.now() / 1000) };
  if (trialTimer) clearTimeout(trialTimer);
  const remaining = (snapshot.user?.trialEndsAt || 0) - snapshot.checkedAt;
  trialTimer = remaining > 0 ? setTimeout(() => { setSnapshot({ ...snapshot }); }, Math.min((remaining + 1) * 1000, 2_147_483_647)) : null;
  listeners.forEach((notify) => notify());
}

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function rememberEmailHint(): void {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const previous = raw ? JSON.parse(raw) as { email?: unknown } : null;
    if (typeof previous?.email === 'string') sessionStorage.setItem('bakerRefreshEmail', previous.email);
  } catch { /* Account hints are optional; fieldwork records are never touched here. */ }
}

function clearStoredIdentity(requireUpgrade = false): void {
  try {
    if (requireUpgrade) {
      rememberEmailHint();
      localStorage.setItem(SESSION_UPGRADE_KEY, '1');
    }
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* A verified cookie session does not require local storage. */ }
}

function persistIdentity(user: AuthUser, token: string | null): void {
  try {
    // This is a namespace hint for existing local records, never authentication evidence.
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token?.startsWith('b2.')) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_UPGRADE_KEY);
  } catch { /* Cookie authentication still works if local storage is unavailable. */ }
}

function parseIdentity(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== 'string' || typeof raw.email !== 'string' || !roles.includes(raw.role as AuthUser['role'])) return null;
  const name = raw.name.trim();
  const email = raw.email.trim().toLowerCase();
  if (!name || !email) return null;
  return {
    name,
    email,
    role: raw.role as AuthUser['role'],
    initials: name.split(/\s+/).map((part) => part[0]).join('').toUpperCase().slice(0, 2),
    subscription: subscriptions.includes(raw.subscription as SubscriptionTier) ? raw.subscription as SubscriptionTier : 'none',
    ...(raw.billingCycle === 'monthly' || raw.billingCycle === 'annual' ? { billingCycle: raw.billingCycle } : {}),
    exportPass: raw.exportPass === true,
    ...(typeof raw.trialEndsAt === 'number' && Number.isFinite(raw.trialEndsAt) ? { trialEndsAt: raw.trialEndsAt } : {}),
    ...(typeof raw.userId === 'string' ? { userId: raw.userId } : {}),
    ...(typeof raw.workspaceId === 'string' ? { workspaceId: raw.workspaceId } : {}),
    ...(raw.authMethod === 'cookie' || raw.authMethod === 'beta' ? { authMethod: raw.authMethod } : {}),
  };
}

async function verifySession(token: string | null, expectedEmail?: string): Promise<AuthSnapshot> {
  const payload = await accountRequest('/api/cloud/session', undefined, token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, unknown>;
  if (payload.user === null) return { ...initialSnapshot, isLoading: false };
  const user = parseIdentity(payload.user);
  const method = user?.authMethod || payload.authMethod;
  if (!user || (method !== 'cookie' && method !== 'beta') || (method === 'beta' && !token?.startsWith('b2.'))) {
    throw new AccountRequestError('We could not verify your account. Please sign in again.', 503, 'INVALID_SESSION_RESPONSE');
  }
  if (expectedEmail && user.email !== expectedEmail) {
    throw new AccountRequestError('The signed-in account does not match that email. Please sign out and try again.', 409, 'ACCOUNT_MISMATCH');
  }
  const nextUser: AuthUser = {
    ...user,
    authMethod: method,
    userId: user.userId || (typeof payload.userId === 'string' ? payload.userId : undefined),
    workspaceId: user.workspaceId || (typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined),
  };
  return {
    user: nextUser,
    isLoading: false,
    accessToken: method === 'beta' ? token : COOKIE_SESSION_MARKER,
    hasCloudAccount: typeof payload.hasCloudAccount === 'boolean' ? payload.hasCloudAccount : payload.cloud === true,
    authMethod: method,
    sessionError: null,
    checkedAt: Math.floor(Date.now() / 1000),
  };
}

function publishVerified(next: AuthSnapshot): void {
  if (next.user) persistIdentity(next.user, next.authMethod === 'beta' ? next.accessToken : null);
  else clearStoredIdentity(Boolean(readStorage(TOKEN_KEY)));
  lastVerifiedAt = Date.now();
  setSnapshot(next);
}

/** One shared request/state for every useAuth consumer; local profiles never grant access. */
export function refreshSession(): Promise<void> {
  if (inFlight) return inFlight;
  initialized = true;
  const requestGeneration = generation;
  const storedToken = readStorage(TOKEN_KEY);
  const betaToken = storedToken?.startsWith('b2.') ? storedToken : null;
  if (storedToken && !betaToken) clearStoredIdentity(true);
  const request = (async () => {
    try {
      const next = await verifySession(betaToken);
      if (requestGeneration === generation) publishVerified(next);
    } catch (error) {
      if (requestGeneration !== generation) return;
      const unauthorized = error instanceof AccountRequestError && (error.status === 401 || error.status === 403);
      if (unauthorized) clearStoredIdentity(Boolean(storedToken));
      setSnapshot({
        ...initialSnapshot,
        isLoading: false,
        sessionError: unauthorized ? null : error instanceof Error ? error.message : 'Secure access could not be verified. Please try again.',
      });
    }
  })();
  inFlight = request;
  void request.finally(() => { if (inFlight === request) inFlight = null; });
  return request;
}

function announceSessionChange(): void {
  try { localStorage.setItem(CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* Cross-tab refresh is optional. */ }
}

async function login(email: string, password: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const requestGeneration = ++generation;
  inFlight = null;
  setSnapshot({ ...initialSnapshot });
  let betaToken: string | null = null;
  try {
    try {
      await accountRequest('/api/cloud/auth/sign-in/email', { email: normalizedEmail, password, rememberMe: true });
    } catch (error) {
      // Reserved beta credentials remain usable while their owner establishes a cloud password.
      if (!RESERVED_BETA_EMAILS.has(normalizedEmail) || (error instanceof AccountRequestError && (error.status === 429 || error.code === 'EMAIL_NOT_VERIFIED'))) throw error;
      const legacy = await accountRequest('/api/auth', { email: normalizedEmail, password }) as Record<string, unknown>;
      if (typeof legacy.token !== 'string' || !legacy.token.startsWith('b2.')) throw error;
      betaToken = legacy.token;
    }
    const next = await verifySession(betaToken, normalizedEmail);
    if (!next.user) throw new AccountRequestError('Your account could not be verified. Please sign in again.', 401, 'SESSION_MISSING');
    if (requestGeneration !== generation) return false;
    publishVerified(next);
    announceSessionChange();
    return true;
  } catch (error) {
    if (requestGeneration === generation) setSnapshot({ ...initialSnapshot, isLoading: false, sessionError: error instanceof Error ? error.message : 'Could not sign in.' });
    throw error;
  }
}

async function registerFree(name: string, email: string, password: string, returnTo = '/dashboard'): Promise<boolean> {
  await accountRequest('/api/cloud/auth/sign-up/email', {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    callbackURL: accountCallbackURL(`/login?verified=1&return=${encodeURIComponent(safeReturnPath(returnTo))}`),
  });
  // Email verification completes registration. Never create a local account or claim a session here.
  return true;
}

async function logout(): Promise<void> {
  ++generation;
  inFlight = null;
  clearStoredIdentity();
  setSnapshot({ ...initialSnapshot, isLoading: false });
  announceSessionChange();
  try {
    await accountRequest('/api/cloud/auth/sign-out', {});
    announceSessionChange();
    window.location.assign('/');
  } catch {
    // An HttpOnly cookie can only be revoked by the server. Do not report success on failure.
    window.location.assign('/login?reason=signout-incomplete');
  }
}

export function getStoredAccessToken(): string | null {
  return snapshot.accessToken;
}

export function getAuthorizationHeaders(): Record<string, string> {
  return snapshot.authMethod === 'beta' && snapshot.accessToken?.startsWith('b2.')
    ? { Authorization: `Bearer ${snapshot.accessToken}` }
    : {};
}

export function getStoredAuthUser(): AuthUser | null {
  return snapshot.user;
}

export async function saveUpgradedSession(_user: AuthUser, token: string): Promise<void> {
  // Stripe entitlements are read back from the server. An API payload/local profile cannot grant them.
  if (snapshot.authMethod === 'beta' && token.startsWith('b2.') && snapshot.user) persistIdentity(snapshot.user, token);
  await refreshSession();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === CHANGE_KEY || event.key === TOKEN_KEY || event.key === null) {
      ++generation;
      inFlight = null;
      setSnapshot({ ...initialSnapshot });
      void refreshSession();
    }
  });
  window.addEventListener('focus', () => {
    if (initialized && Date.now() - lastVerifiedAt > 30_000) void refreshSession();
  });
}

export function useAuth() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => initialSnapshot);
  useEffect(() => { if (!initialized) void refreshSession(); }, []);
  const { user, accessToken } = state;
  const isOwner = user?.role === 'owner';
  const activeTrial = Boolean(user?.trialEndsAt && user.trialEndsAt > state.checkedAt);
  const trialExpired = Boolean(user?.trialEndsAt && user.trialEndsAt <= state.checkedAt);
  const isProfessional = user?.role === 'professional';
  const isFree = user?.role === 'free' && !activeTrial;
  const subscription = user?.subscription || 'none';
  const isPaid = Boolean(user?.role === 'paid' || ['individual', 'professional', 'enterprise'].includes(subscription));
  const hasPaidFeatures = Boolean(isOwner || isProfessional || isPaid || activeTrial);
  const hasSupervisorFeatures = Boolean(isOwner || isProfessional || subscription === 'professional' || subscription === 'enterprise' || activeTrial);
  const canExportOfficialForms = Boolean(hasPaidFeatures || user?.exportPass);
  const isAuthenticated = Boolean(user && accessToken);

  return {
    ...state,
    userId: user?.userId,
    workspaceId: user?.workspaceId,
    isAuthenticated,
    hasAppAccess: isAuthenticated,
    isOwner,
    isProfessional,
    isFree,
    isDemo: false,
    isPaid,
    activeTrial,
    trialExpired,
    trialEndsAt: user?.trialEndsAt,
    hasPaidFeatures,
    hasSupervisorFeatures,
    canExportOfficialForms,
    login,
    registerFree,
    logout,
    refreshSession,
  };
}

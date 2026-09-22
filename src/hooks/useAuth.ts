import { useState, useEffect, useCallback } from 'react';

export type SubscriptionTier = 'individual' | 'professional' | 'enterprise' | 'none';
export type BillingCycle = 'monthly' | 'annual';

export interface AuthUser {
  name: string;
  email: string;
  role: 'owner' | 'free' | 'paid' | 'professional' | 'supervisor';
  initials: string;
  subscription?: SubscriptionTier;
  billingCycle?: BillingCycle;
  exportPass?: boolean;
  trialEndsAt?: number;
}

const USER_KEY = 'authUser';
const TOKEN_KEY = 'bakerSessionToken';
const SESSION_UPGRADE_KEY = 'bakerSessionUpgradeRequired';
const EMILY_EMAIL = 'ayalaemily52@gmail.com';
const OWNER_EMAIL = 'justin@bakerholdings.co';

function getInitials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
}

function normalizeUser(user: AuthUser): AuthUser {
  if (user.email.trim().toLowerCase() !== EMILY_EMAIL) return user;
  return {
    ...user,
    name: 'Emily Ayala',
    email: EMILY_EMAIL,
    role: 'professional',
    subscription: 'professional',
    billingCycle: 'annual',
    exportPass: true,
    initials: 'EA',
  };
}

function isStableBetaToken(token: string): boolean {
  return token.startsWith('b2.');
}

function isReservedBetaEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === EMILY_EMAIL || normalized === OWNER_EMAIL;
}

function storeSession(user: AuthUser, token: string): void {
  const normalized = normalizeUser(user);
  localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(SESSION_UPGRADE_KEY);
}

export function getStoredAccessToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? normalizeUser(JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
}

export function saveUpgradedSession(user: AuthUser, token: string): void {
  storeSession(user, token);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedUser && storedToken) {
        const normalized = normalizeUser(JSON.parse(storedUser) as AuthUser);
        if (isReservedBetaEmail(normalized.email) && !isStableBetaToken(storedToken)) {
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.setItem(SESSION_UPGRADE_KEY, '1');
          setUser(null);
        } else {
          setUser(normalized);
          localStorage.setItem(USER_KEY, JSON.stringify(normalized));
        }
      } else {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) return false;
      const payload = await response.json() as {
        user?: {
          name?: string;
          email?: string;
          role?: 'owner' | 'professional' | 'paid';
          subscription?: SubscriptionTier;
          exportPass?: boolean;
          trialEndsAt?: number;
        };
        token?: string;
      };
      if (!payload.user?.email || !payload.user.name || !payload.user.role || !payload.token) return false;

      const nextUser = normalizeUser({
        name: payload.user.name,
        email: payload.user.email,
        role: payload.user.role,
        initials: getInitials(payload.user.name),
        subscription: payload.user.subscription,
        exportPass: payload.user.exportPass,
        trialEndsAt: payload.user.trialEndsAt,
        billingCycle: payload.user.email.toLowerCase() === EMILY_EMAIL ? 'annual' : undefined,
      });
      setUser(nextUser);
      storeSession(nextUser, payload.token);
      return true;
    } catch { return false; }
  }, []);

  const registerFree = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/free-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json() as {
        user?: { name?: string; email?: string; role?: 'free'; trialEndsAt?: number };
        token?: string;
      };
      if (!response.ok || !payload.user?.name || !payload.user.email || !payload.token) return false;
      const nextUser = normalizeUser({
        name: payload.user.name,
        email: payload.user.email,
        role: 'free',
        initials: getInitials(payload.user.name),
        subscription: 'none',
        exportPass: false,
        trialEndsAt: payload.user.trialEndsAt,
      });
      setUser(nextUser);
      storeSession(nextUser, payload.token);
      return true;
    } catch { return false; }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/';
  }, []);

  const accessToken = getStoredAccessToken();
  const isEmilyBeta = user?.email.trim().toLowerCase() === EMILY_EMAIL;
  const isOwner = user?.role === 'owner';
  const activeTrial = Boolean(user?.trialEndsAt && user.trialEndsAt > Math.floor(Date.now() / 1000));
  const trialExpired = Boolean(user?.trialEndsAt && user.trialEndsAt <= Math.floor(Date.now() / 1000));
  const isProfessional = user?.role === 'professional' || isEmilyBeta;
  const isFree = user?.role === 'free' && !isEmilyBeta && !activeTrial;
  const isDemo = false;
  const subscription = isEmilyBeta ? 'professional' : (user?.subscription || 'none');
  const isPaid = Boolean(isEmilyBeta || user?.role === 'paid' || ['individual', 'professional', 'enterprise'].includes(subscription));
  const hasPaidFeatures = Boolean(isEmilyBeta || isOwner || isProfessional || isPaid || activeTrial);
  const hasSupervisorFeatures = Boolean(isEmilyBeta || isOwner || isProfessional || subscription === 'professional' || subscription === 'enterprise' || activeTrial);
  const canExportOfficialForms = Boolean(isEmilyBeta || hasPaidFeatures || user?.exportPass);
  const isAuthenticated = !!user && !!accessToken;
  const hasAppAccess = !!user && !!accessToken && ['owner', 'free', 'paid', 'professional', 'supervisor'].includes(user.role);

  return {
    user,
    isLoading,
    isAuthenticated,
    hasAppAccess,
    accessToken,
    isOwner,
    isProfessional,
    isFree,
    isDemo,
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
  };
}

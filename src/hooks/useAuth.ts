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
}

const USER_KEY = 'authUser';
const TOKEN_KEY = 'bakerSessionToken';

function getInitials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
}

function storeSession(user: AuthUser, token: string): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredAccessToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as AuthUser : null;
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
      if (storedUser && storedToken) setUser(JSON.parse(storedUser) as AuthUser);
      else {
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
        };
        token?: string;
      };
      if (!payload.user?.email || !payload.user.name || !payload.user.role || !payload.token) return false;

      const nextUser: AuthUser = {
        name: payload.user.name,
        email: payload.user.email,
        role: payload.user.role,
        initials: getInitials(payload.user.name),
        subscription: payload.user.subscription,
        exportPass: payload.user.exportPass,
        billingCycle: payload.user.email.toLowerCase() === 'ayalaemily52@gmail.com' ? 'annual' : undefined,
      };
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
        user?: { name?: string; email?: string; role?: 'free' };
        token?: string;
      };
      if (!response.ok || !payload.user?.name || !payload.user.email || !payload.token) return false;
      const nextUser: AuthUser = {
        name: payload.user.name,
        email: payload.user.email,
        role: 'free',
        initials: getInitials(payload.user.name),
        subscription: 'none',
        exportPass: false,
      };
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
  const isOwner = user?.role === 'owner';
  const isProfessional = user?.role === 'professional';
  const isFree = user?.role === 'free';
  const subscription = user?.subscription || 'none';
  const isPaid = user?.role === 'paid' || ['individual', 'professional', 'enterprise'].includes(subscription);
  const hasPaidFeatures = Boolean(isOwner || isProfessional || isPaid);
  const hasSupervisorFeatures = Boolean(isOwner || isProfessional || subscription === 'professional' || subscription === 'enterprise');
  const canExportOfficialForms = Boolean(hasPaidFeatures || user?.exportPass);
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
    isPaid,
    hasPaidFeatures,
    hasSupervisorFeatures,
    canExportOfficialForms,
    login,
    registerFree,
    logout,
  };
}

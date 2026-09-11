import { useState, useEffect, useCallback } from 'react';

export type SubscriptionTier = 'individual' | 'professional' | 'enterprise' | 'none';
export type BillingCycle = 'monthly' | 'annual';

export interface AuthUser {
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'supervisee' | 'supervisor' | 'demo' | 'professional' | 'paid';
  initials: string;
  subscription?: SubscriptionTier;
  billingCycle?: BillingCycle;
}

const USER_KEY = 'authUser';
const TOKEN_KEY = 'bakerSessionToken';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser) as AuthUser);
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
        billingCycle: payload.user.email.toLowerCase() === 'ayalaemily52@gmail.com' ? 'annual' : undefined,
      };

      setUser(nextUser);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      localStorage.setItem(TOKEN_KEY, payload.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginAsDemo = useCallback(() => {
    const demoUser: AuthUser = {
      name: 'Sarah Chen',
      email: 'sarah.chen@email.com',
      role: 'demo',
      initials: 'SC',
      subscription: 'none',
    };
    setUser(demoUser);
    localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('demoMode');
    window.location.href = '/';
  }, []);

  const accessToken = getStoredAccessToken();
  const isOwner = user?.role === 'owner';
  const isDemo = user?.role === 'demo';
  const isProfessional = user?.role === 'professional';
  const isPaid = user?.role === 'paid' || ['individual', 'professional', 'enterprise'].includes(user?.subscription || 'none');
  const isAuthenticated = !!user && !!accessToken;
  const hasAppAccess = !!user && !!accessToken && (isOwner || isPaid || user.role === 'supervisor');

  return {
    user,
    isLoading,
    isAuthenticated,
    hasAppAccess,
    accessToken,
    isOwner,
    isDemo,
    isProfessional,
    isPaid,
    login,
    loginAsDemo,
    logout,
  };
}

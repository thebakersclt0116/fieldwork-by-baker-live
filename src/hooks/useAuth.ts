import { useState, useEffect, useCallback } from 'react';

export type SubscriptionTier = 'individual' | 'professional' | 'enterprise' | 'none';
export type BillingCycle = 'monthly' | 'annual';

export interface AuthUser {
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'supervisee' | 'supervisor' | 'demo' | 'professional';
  initials: string;
  subscription?: SubscriptionTier;
  billingCycle?: BillingCycle;
}

/* ------------------------------------------------------------------ */
/*  AUTHORIZED USERS                                                   */
/* ------------------------------------------------------------------ */

const OWNER_EMAIL = 'Justin@bakerholdings.co';
const OWNER_PASSWORD = 'Thebakers0116@';
const OWNER_NAME = 'Justin Baker';

const GF_EMAIL = 'ayalaemily52@gmail.com';
const GF_PASSWORD = 'Thebakers0116@';
const GF_NAME = 'Emily Ayala';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  HOOK                                                               */
/* ------------------------------------------------------------------ */

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('authUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, password: string): boolean => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOwner = OWNER_EMAIL.toLowerCase();
    const normalizedGf = GF_EMAIL.toLowerCase();

    // Owner login
    if (normalizedEmail === normalizedOwner && password === OWNER_PASSWORD) {
      const ownerUser: AuthUser = {
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        role: 'owner',
        initials: getInitials(OWNER_NAME),
      };
      setUser(ownerUser);
      localStorage.setItem('authUser', JSON.stringify(ownerUser));
      return true;
    }

    // Girlfriend — Professional Annual Subscriber
    if (normalizedEmail === normalizedGf && password === GF_PASSWORD) {
      const gfUser: AuthUser = {
        name: GF_NAME,
        email: GF_EMAIL,
        role: 'professional',
        initials: getInitials(GF_NAME),
        subscription: 'professional',
        billingCycle: 'annual',
      };
      setUser(gfUser);
      localStorage.setItem('authUser', JSON.stringify(gfUser));
      return true;
    }

    return false;
  }, []);

  const loginAsDemo = useCallback(() => {
    const demoUser: AuthUser = {
      name: 'Sarah Chen',
      email: 'sarah.chen@email.com',
      role: 'demo',
      initials: 'SC',
    };
    setUser(demoUser);
    localStorage.setItem('authUser', JSON.stringify(demoUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('authUser');
    localStorage.removeItem('demoMode');
    window.location.href = '/';
  }, []);

  const isOwner = user?.role === 'owner';
  const isDemo = user?.role === 'demo';
  const isProfessional = user?.role === 'professional';
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isOwner,
    isDemo,
    isProfessional,
    login,
    loginAsDemo,
    logout,
  };
}

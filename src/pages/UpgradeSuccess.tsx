import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { getStoredAccessToken, getStoredAuthUser, saveUpgradedSession, type AuthUser, type SubscriptionTier } from '@/hooks/useAuth';

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
}

export default function UpgradeSuccess() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your Stripe purchase…');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    let active = true;
    const applyPurchase = async () => {
      const sessionId = params.get('session_id') || '';
      const token = getStoredAccessToken();
      const existing = getStoredAuthUser();
      if (!sessionId || !token || !existing) {
        if (active) {
          setState('error');
          setMessage('Your signed-in Baker session or Stripe Checkout ID is missing.');
        }
        return;
      }

      try {
        const response = await fetch('/api/checkout-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId }),
        });
        const payload = await response.json() as {
          token?: string;
          plan?: string;
          user?: {
            email?: string;
            name?: string;
            role?: 'owner' | 'free' | 'paid' | 'professional';
            subscription?: SubscriptionTier;
            exportPass?: boolean;
          };
          error?: string;
        };
        if (!response.ok || !payload.token || !payload.user?.email || !payload.user.name || !payload.user.role) {
          throw new Error(payload.error || 'The purchase could not be applied to your Baker account.');
        }

        const nextUser: AuthUser = {
          ...existing,
          name: payload.user.name,
          email: payload.user.email,
          role: payload.user.role,
          initials: initials(payload.user.name),
          subscription: payload.user.subscription || existing.subscription,
          exportPass: Boolean(payload.user.exportPass),
        };
        saveUpgradedSession(nextUser, payload.token);
        if (active) {
          setPlan(payload.plan || 'purchase');
          setState('success');
          setMessage('Your paid entitlement is active.');
        }
      } catch (error) {
        if (active) {
          setState('error');
          setMessage(error instanceof Error ? error.message : 'Could not verify your purchase.');
        }
      }
    };

    void applyPurchase();
    return () => { active = false; };
  }, [params]);

  return (
    <div className="min-h-[70vh] bg-[#FFFCF9] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-[#F2EDEA] p-8 lg:p-10 text-center shadow-sm">
        {state === 'loading' && <LoaderCircle size={38} className="mx-auto text-[#E85D70] mb-4 animate-spin" />}
        {state === 'success' && <CheckCircle2 size={42} className="mx-auto text-[#5FA37E] mb-4" />}
        {state === 'error' && <XCircle size={42} className="mx-auto text-[#C9445A] mb-4" />}
        <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">{state === 'success' ? 'You’re unlocked' : state === 'error' ? 'Purchase needs attention' : 'Finishing your upgrade'}</h1>
        <p className="text-[#6B5D54] mb-6">{message}</p>
        {state === 'success' && <p className="text-xs text-[#A8998E] mb-6">Applied entitlement: {plan.replaceAll('_', ' ')}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {state === 'success' && <Link to="/dashboard" className="btn-primary px-5 py-3 rounded-xl">Open dashboard</Link>}
          {state === 'success' && <Link to="/export" className="px-5 py-3 rounded-xl border border-[#E2DAD5] text-sm font-semibold text-[#6B5D54]">Open Export Center</Link>}
          {state === 'error' && <Link to="/upgrade" className="btn-primary px-5 py-3 rounded-xl">Return to upgrade</Link>}
        </div>
      </div>
    </div>
  );
}

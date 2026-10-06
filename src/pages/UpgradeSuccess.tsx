import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Clock3, LoaderCircle, XCircle } from 'lucide-react';
import { getAuthorizationHeaders, getStoredAuthUser, refreshSession, useAuth } from '@/hooks/useAuth';

type PurchaseState = 'loading' | 'pending' | 'success' | 'error';

export default function UpgradeSuccess() {
  const [params] = useSearchParams();
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<PurchaseState>('loading');
  const [message, setMessage] = useState('Verifying your Stripe purchase…');
  const [plan, setPlan] = useState('');
  const [checkAttempt, setCheckAttempt] = useState(0);
  const sessionId = params.get('session_id') || '';
  const email = user?.email;
  const workspaceId = user?.workspaceId;

  useEffect(() => {
    if (isLoading) return;
    const controller = new AbortController();
    const sameAccount = () => {
      const current = getStoredAuthUser();
      return !controller.signal.aborted && current?.email === email && current?.workspaceId === workspaceId;
    };
    const applyPurchase = async () => {
      if (!sessionId || !email || !workspaceId) {
        setState('error');
        setMessage('Sign in to the account used for this purchase and reopen the Stripe confirmation link.');
        return;
      }
      setState('loading');
      setMessage('Verifying your Stripe purchase…');
      try {
        const response = await fetch('/api/checkout-complete', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
          headers: { 'Content-Type': 'application/json', ...getAuthorizationHeaders() },
          body: JSON.stringify({ sessionId }),
        });
        const payload = await response.json() as {
          status?: 'active' | 'pending'; plan?: string;
          user?: { email?: string; workspaceId?: string };
          error?: string;
        };
        if (!sameAccount()) return;
        if (!response.ok) throw new Error(payload.error || 'The purchase could not be verified. Check your account before starting another checkout.');
        if (response.status === 202 || payload.status === 'pending') {
          setState('pending');
          setMessage('Stripe is still confirming this payment. Your account will update when confirmation arrives. You can check again without making another purchase.');
          return;
        }
        if (payload.status !== 'active' || payload.user?.email !== email || payload.user.workspaceId !== workspaceId) {
          throw new Error('This purchase did not return a verified entitlement for your account. Check your billing details before trying another checkout.');
        }
        // Refresh the authoritative session; a checkout never creates a browser token.
        await refreshSession();
        if (!sameAccount()) return;
        const verified = getStoredAuthUser();
        if (!verified || !['owner', 'paid', 'professional'].includes(verified.role)) {
          throw new Error('Payment was received, but account access could not be refreshed yet. Check again; no additional payment is needed.');
        }
        setPlan(payload.plan || 'purchase');
        setState('success');
        setMessage('Your paid access is saved to your account and is ready to use.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Could not verify your purchase.');
      }
    };
    void applyPurchase();
    return () => { controller.abort(); };
  }, [sessionId, email, workspaceId, isLoading, checkAttempt]);

  return (
    <div className="min-h-[70vh] bg-[#FFFCF9] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-[#F2EDEA] p-8 lg:p-10 text-center shadow-sm">
        {state === 'loading' && <LoaderCircle size={38} className="mx-auto text-[#E85D70] mb-4 animate-spin" />}
        {state === 'pending' && <Clock3 size={42} className="mx-auto text-[#B77722] mb-4" />}
        {state === 'success' && <CheckCircle2 size={42} className="mx-auto text-[#5FA37E] mb-4" />}
        {state === 'error' && <XCircle size={42} className="mx-auto text-[#C9445A] mb-4" />}
        <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">{state === 'success' ? 'Your upgrade is ready' : state === 'pending' ? 'Payment confirmation pending' : state === 'error' ? 'Purchase needs attention' : 'Finishing your upgrade'}</h1>
        <p role="status" aria-live="polite" className="text-[#6B5D54] mb-6">{message}</p>
        {state === 'success' && <p className="text-xs text-[#A8998E] mb-6">Active plan: {plan.replaceAll('_', ' ')}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {(state === 'pending' || state === 'error') && <button type="button" onClick={() => setCheckAttempt((attempt) => attempt + 1)} className="btn-primary px-5 py-3 rounded-xl">Check payment again</button>}
          <Link to="/dashboard" className="px-5 py-3 rounded-xl border border-[#E2DAD5] text-sm font-semibold text-[#6B5D54]">Open dashboard</Link>
          {state === 'success' && <Link to="/export" className="btn-primary px-5 py-3 rounded-xl">Open Export Center</Link>}
          {state !== 'loading' && <Link to="/upgrade" className="px-5 py-3 rounded-xl border border-[#E2DAD5] text-sm font-semibold text-[#6B5D54]">View billing</Link>}
        </div>
      </div>
    </div>
  );
}

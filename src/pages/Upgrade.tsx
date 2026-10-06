import { useEffect, useState } from 'react';
import { Check, CreditCard, FileDown, LockKeyhole, Sparkles, UserCheck, Upload } from 'lucide-react';
import { getAuthorizationHeaders, useAuth } from '@/hooks/useAuth';

type PlanId = 'individual_monthly' | 'professional_monthly' | 'professional_annual';

interface BillingSubscription {
  plan: PlanId | null;
  status: string;
  currentPeriodEnd: string | null;
  paidAccessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
}

function stripeDestination(value: string | undefined, host: string): string {
  try {
    const url = new URL(value || '');
    if (url.protocol === 'https:' && url.hostname === host && !url.username && !url.password) return url.href;
  } catch { /* An incomplete response must not redirect the signed-in browser. */ }
  throw new Error('Stripe did not return a valid billing link. Please try again.');
}

function billingStatusLabel(subscription: BillingSubscription): string {
  if (subscription.status === 'active' && subscription.cancelAtPeriodEnd) return 'Cancellation scheduled';
  return ({ active: 'Active', trialing: 'Trial', past_due: 'Payment overdue', incomplete: 'Payment incomplete',
    unpaid: 'Payment needed', canceled: 'Canceled', paused: 'Paused', incomplete_expired: 'Checkout expired' } as Record<string, string>)[subscription.status] || 'Review billing details';
}

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  description: string;
  badge?: string;
  features: string[];
}> = [
  {
    id: 'individual_monthly',
    name: 'Individual',
    price: '$16.99',
    cadence: '/month',
    badge: '3-day trial',
    description: 'The connected BCBA workspace for candidates who want more than a basic tracker.',
    features: ['Fieldwork tracking', 'Baker Brain', 'Full Exam Lab + weak-area plans', 'Ripley/CSV migration', 'Form-ready exports', 'Resource Vault'],
  },
  {
    id: 'professional_monthly',
    name: 'Professional',
    price: '$34.99',
    cadence: '/month',
    badge: 'Supervisor workflow',
    description: 'Everything in Individual plus active supervisor collaboration.',
    features: ['Everything in Individual', 'Signed supervisor review links', 'Supervisor notes + messages', 'Revision + re-approval workflow', 'Multiple supervisors + organizations'],
  },
  {
    id: 'professional_annual',
    name: 'Professional Annual',
    price: '$349',
    cadence: '/year',
    badge: '$29.08/mo equivalent',
    description: 'Professional access billed annually.',
    features: ['Everything in Professional', 'Save $70.88/year vs monthly Professional', 'One annual payment'],
  },
];

export default function Upgrade() {
  const { user, isOwner, hasPaidFeatures, activeTrial, trialEndsAt } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState('');
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [hasBillingAccount, setHasBillingAccount] = useState(false);
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [billingStatusError, setBillingStatusError] = useState('');
  const [stripeMode, setStripeMode] = useState<'checking' | 'live' | 'test' | 'configured' | 'unconfigured'>('checking');

  useEffect(() => {
    let active = true;
    fetch('/api/health?billing=1', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { stripeCheckoutConfigured?: boolean; stripeMode?: string; liveBillingEnabled?: boolean }) => {
        if (!active) return;
        setBillingEnabled(payload.liveBillingEnabled === true && payload.stripeMode === 'live');
        if (!payload.stripeCheckoutConfigured) setStripeMode('unconfigured');
        else if (payload.stripeMode === 'live') setStripeMode('live');
        else if (payload.stripeMode === 'test') setStripeMode('test');
        else setStripeMode('configured');
      })
      .catch(() => { if (active) setStripeMode('unconfigured'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setHasBillingAccount(false);
    setSubscriptions([]);
    setBillingStatusError('');
    if (!user) return () => controller.abort();
    void fetch('/api/cloud/billing/status', {
      credentials: 'include', cache: 'no-store', headers: getAuthorizationHeaders(), signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('We could not load your subscription details. Please refresh this page to try again.');
      const payload = await response.json() as { hasBillingAccount?: boolean; subscriptions?: BillingSubscription[] };
      if (controller.signal.aborted) return;
      setHasBillingAccount(payload.hasBillingAccount === true);
      setSubscriptions(Array.isArray(payload.subscriptions) ? payload.subscriptions : []);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setBillingStatusError(failure instanceof Error ? failure.message : 'Subscription details are temporarily unavailable.');
    });
    return () => controller.abort();
  }, [user]);

  const currentSubscription = subscriptions.find((subscription) => !['canceled', 'incomplete_expired'].includes(subscription.status)) || subscriptions[0];
  const hasExistingSubscription = subscriptions.some((subscription) => !['canceled', 'incomplete_expired'].includes(subscription.status));
  const includedAccess = isOwner || ['beta-justin-baker', 'beta-emily-ayala'].includes(user?.userId || '');

  const openPortal = async () => {
    if (!user) { window.location.href = '/login?return=%2Fupgrade'; return; }
    setLoadingPortal(true);
    setError('');
    try {
      const response = await fetch('/api/cloud/billing/portal', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...getAuthorizationHeaders() }, body: '{}',
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not open your billing settings.');
      window.location.href = stripeDestination(payload.url, 'billing.stripe.com');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open your billing settings.');
      setLoadingPortal(false);
    }
  };

  const startCheckout = async (plan: PlanId) => {
    if (!billingEnabled) { setError('Paid checkout is paused while the account and billing backend is connected. No payment has been created.'); return; }
    if (!user) {
      window.location.href = '/login?return=%2Fupgrade';
      return;
    }
    setLoadingPlan(plan);
    setError('');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizationHeaders(),
        },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json() as { url?: string; error?: string; code?: string };
      if (!response.ok || !payload.url) {
        if (payload.code === 'SUBSCRIPTION_EXISTS') {
          setHasBillingAccount(true);
          throw new Error('Your account already has a subscription. Use Manage subscription to change your plan, update payment details, or cancel.');
        }
        if (payload.code === 'STRIPE_NOT_CONFIGURED') {
          throw new Error('Checkout is built but Stripe is not connected to this deployment yet.');
        }
        throw new Error(payload.error || 'Could not open Stripe Checkout.');
      }
      window.location.href = stripeDestination(payload.url, 'checkout.stripe.com');
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Could not open Stripe Checkout.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F7] text-[#E85D70] px-3 py-1.5 text-xs font-semibold mb-4"><Sparkles size={14} /> 3-day full-access trial</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#332C28] mb-4">Choose your plan after trying the real product.</h1>
          <p className="text-[#6B5D54] text-lg">Your 3-day trial includes the connected experience. After the trial, continue with Individual or Professional.</p>
        </div>

        {stripeMode !== 'checking' && stripeMode !== 'live' && (
          <div className={`max-w-3xl mx-auto mb-7 rounded-2xl border px-5 py-4 text-sm text-center ${stripeMode === 'test' ? 'border-[#F1D8B9] bg-[#FFF9F2] text-[#8A5D36]' : 'border-[#F0D5DA] bg-[#FFF7F8] text-[#C9445A]'}`}>
            {stripeMode === 'test'
              ? 'Stripe is connected in TEST MODE. Public checkout is disabled; test payments cannot unlock production access.'
              : 'Stripe Checkout is not ready for production charges on this deployment yet.'}
          </div>
        )}

        {!billingEnabled && <div role="status" className="mx-auto mb-6 max-w-3xl rounded-2xl border border-[#F1D8B9] bg-[#FFF9F2] p-4 text-center text-sm text-[#8A5D36] dark:border-amber-500/30 dark:bg-amber-900/15 dark:text-amber-100"><strong>New subscriptions are temporarily paused.</strong> Existing subscriptions continue under their current terms. Use Manage subscription to update or cancel an existing plan. <a href="/audit-history" className="font-semibold underline">Open your saved audit records and downloads.</a></div>}

        {hasBillingAccount && <section aria-label="Your subscription" className="mx-auto mb-8 max-w-3xl rounded-2xl border border-[#E2DAD5] bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <h2 className="font-semibold text-[#332C28]">{currentSubscription ? plans.find((plan) => plan.id === currentSubscription.plan)?.name || 'Your Fieldwork subscription' : 'Your billing account'}</h2>
            {currentSubscription && <p className="mt-1 text-sm text-[#6B5D54]">{billingStatusLabel(currentSubscription)}{currentSubscription.cancelAtPeriodEnd && currentSubscription.paidAccessEndsAt && <> · Paid access through {new Date(currentSubscription.paidAccessEndsAt).toLocaleDateString()}</>}</p>}
            <p className="mt-1 text-sm text-[#6B5D54]">Review invoices, update payment details, change your plan, or cancel in Stripe.</p>
          </div>
          <button type="button" onClick={() => { void openPortal(); }} disabled={loadingPortal || Boolean(loadingPlan)} className="mt-4 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:mt-0"><CreditCard size={16} />{loadingPortal ? 'Opening billing…' : 'Manage subscription'}</button>
        </section>}
        {includedAccess && !hasBillingAccount && <p role="status" className="mx-auto mb-7 max-w-3xl rounded-2xl border border-[#CFE7D9] bg-[#F4FBF7] px-5 py-4 text-center text-sm text-[#376B47]">Your included full access remains active. You do not need to purchase a subscription.</p>}
        {billingStatusError && user && !includedAccess && <p role="status" className="mx-auto mb-6 max-w-3xl text-center text-sm text-[#6B5D54]">{billingStatusError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {plans.map((plan) => (
            <div key={plan.id} className={`relative bg-white rounded-3xl border p-6 shadow-sm flex flex-col ${plan.id === 'professional_monthly' ? 'border-[#E85D70]' : 'border-[#F2EDEA]'}`}>
              {plan.badge && <div className="absolute -top-3 left-5 rounded-full bg-[#332C28] text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">{plan.badge}</div>}
              <h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-3"><span className="font-mono text-3xl text-[#E85D70]">{plan.price}</span><span className="text-sm text-[#A8998E]">{plan.cadence}</span></div>
              <p className="text-sm text-[#6B5D54] leading-relaxed mb-5">{plan.description}</p>
              <ul className="space-y-2 mb-6 flex-1">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-[#4D423C]"><Check size={15} className="text-[#5FA37E] mt-0.5 shrink-0" />{feature}</li>)}</ul>
              <button onClick={() => void startCheckout(plan.id)} disabled={!billingEnabled || Boolean(loadingPlan) || loadingPortal || includedAccess || hasExistingSubscription || (hasPaidFeatures && !activeTrial)} className="w-full rounded-xl bg-[#332C28] text-white py-3 text-sm font-semibold disabled:opacity-40">
                {loadingPlan === plan.id ? 'Opening Stripe…' : includedAccess ? 'Access included' : hasExistingSubscription ? 'Use Manage subscription' : !billingEnabled ? 'Checkout reopening soon' : activeTrial ? 'Choose this plan now' : hasPaidFeatures ? 'Paid plan active' : stripeMode === 'test' ? 'Open Stripe test checkout' : 'Continue to Stripe'}
              </button>
            </div>
          ))}
        </div>

        {error && <div className="max-w-2xl mx-auto rounded-2xl bg-[#FFF5F7] border border-[#FFC1CC] px-5 py-4 text-sm text-[#C9445A] text-center mb-8">{error}</div>}

        {activeTrial && trialEndsAt && <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-[#CFE7D9] bg-[#F4FBF7] px-5 py-4 text-center text-sm text-[#4B8C69]">Your 3-day trial is active until {new Date(trialEndsAt * 1000).toLocaleString()}.</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><FileDown size={18} className="text-[#E85D70] mb-2" /><strong className="block text-[#332C28] mb-1">3-day trial</strong>Use the connected platform before choosing a paid plan.</div>
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><Upload size={18} className="text-[#D4A574] mb-2" /><strong className="block text-[#332C28] mb-1">Individual</strong>AI, Exam Lab, migration, exports, and the candidate workspace.</div>
          
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><UserCheck size={18} className="text-[#5FA37E] mb-2" /><strong className="block text-[#332C28] mb-1">Professional</strong>Secure supervisor review, notes, and messages.</div>
        </div>

        <div className="max-w-3xl mx-auto mt-8 rounded-2xl bg-[#FAF8F6] p-5 flex items-start gap-3 text-sm text-[#6B5D54]"><LockKeyhole size={18} className="text-[#A8998E] shrink-0 mt-0.5" /><div><strong className="text-[#332C28]">Your data stays yours.</strong> After the 3-day trial, an active plan is required to keep using the connected app. Keep independent backups of fieldwork records you are professionally required to retain.</div></div>
        {user && <p className="text-center text-xs text-[#A8998E] mt-6">Signed in as {user.email}</p>}
      </div>
    </div>
  );
}

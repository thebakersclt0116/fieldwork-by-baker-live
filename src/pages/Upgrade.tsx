import { useEffect, useState } from 'react';
import { Check, FileDown, LockKeyhole, Sparkles, UserCheck, Upload } from 'lucide-react';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

type PlanId = 'export_pass' | 'individual_monthly' | 'professional_monthly' | 'professional_annual';

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
    id: 'export_pass',
    name: 'Export Pass',
    price: '$19',
    cadence: 'one time',
    description: 'Unlock the BACB form-ready export center without starting a subscription.',
    features: ['BACB M-FVF/F-FVF export center', 'One-time payment', 'Keep tracking on Free'],
  },
  {
    id: 'individual_monthly',
    name: 'Individual',
    price: '$12',
    cadence: '/month',
    description: 'For candidates who want Baker AI and fast migration tools.',
    features: ['Unlimited form-ready export tools', 'Baker AI text + voice logging', 'Ripley/CSV batch import', 'Compliance Oracle'],
  },
  {
    id: 'professional_monthly',
    name: 'Professional',
    price: '$24',
    cadence: '/month',
    badge: 'Supervisor workflow',
    description: 'Everything in Individual plus secure supervisor collaboration.',
    features: ['Everything in Individual', 'Signed supervisor review links', 'Supervisor notes + messages', 'Priority beta features'],
  },
  {
    id: 'professional_annual',
    name: 'Professional Annual',
    price: '$228',
    cadence: '/year',
    badge: '$19/mo equivalent',
    description: 'Professional access billed annually at the pricing you specified.',
    features: ['Everything in Professional', '$60/year less than monthly Professional', 'One annual payment'],
  },
];

export default function Upgrade() {
  const { user, isOwner, hasPaidFeatures, canExportOfficialForms } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState('');
  const [stripeMode, setStripeMode] = useState<'checking' | 'live' | 'test' | 'configured' | 'unconfigured'>('checking');

  useEffect(() => {
    let active = true;
    fetch('/api/health?billing=1', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { stripeCheckoutConfigured?: boolean; stripeMode?: string }) => {
        if (!active) return;
        if (!payload.stripeCheckoutConfigured) setStripeMode('unconfigured');
        else if (payload.stripeMode === 'live') setStripeMode('live');
        else if (payload.stripeMode === 'test') setStripeMode('test');
        else setStripeMode('configured');
      })
      .catch(() => { if (active) setStripeMode('unconfigured'); });
    return () => { active = false; };
  }, []);

  const startCheckout = async (plan: PlanId) => {
    const token = getStoredAccessToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setLoadingPlan(plan);
    setError('');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json() as { url?: string; error?: string; code?: string };
      if (!response.ok || !payload.url) {
        if (payload.code === 'STRIPE_NOT_CONFIGURED') {
          throw new Error('Checkout is built but Stripe is not connected to this deployment yet.');
        }
        throw new Error(payload.error || 'Could not open Stripe Checkout.');
      }
      window.location.href = payload.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Could not open Stripe Checkout.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F7] text-[#E85D70] px-3 py-1.5 text-xs font-semibold mb-4"><Sparkles size={14} /> Track free forever</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#332C28] mb-4">Pay only when you need premium leverage.</h1>
          <p className="text-[#6B5D54] text-lg">Free users can log unlimited hours and keep their underlying records. Form-ready export convenience, AI, imports, and supervisor workflow are paid tools.</p>
        </div>

        {stripeMode !== 'checking' && stripeMode !== 'live' && (
          <div className={`max-w-3xl mx-auto mb-7 rounded-2xl border px-5 py-4 text-sm text-center ${stripeMode === 'test' ? 'border-[#F1D8B9] bg-[#FFF9F2] text-[#8A5D36]' : 'border-[#F0D5DA] bg-[#FFF7F8] text-[#C9445A]'}`}>
            {stripeMode === 'test'
              ? 'Stripe is connected in TEST MODE. Checkout is safe to test, but it will not create real production charges until a live Stripe secret key is installed.'
              : 'Stripe Checkout is not ready for production charges on this deployment yet.'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          {plans.map((plan) => (
            <div key={plan.id} className={`relative bg-white rounded-3xl border p-6 shadow-sm flex flex-col ${plan.id === 'professional_monthly' ? 'border-[#E85D70]' : 'border-[#F2EDEA]'}`}>
              {plan.badge && <div className="absolute -top-3 left-5 rounded-full bg-[#332C28] text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">{plan.badge}</div>}
              <h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-3"><span className="font-mono text-3xl text-[#E85D70]">{plan.price}</span><span className="text-sm text-[#A8998E]">{plan.cadence}</span></div>
              <p className="text-sm text-[#6B5D54] leading-relaxed mb-5">{plan.description}</p>
              <ul className="space-y-2 mb-6 flex-1">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-[#4D423C]"><Check size={15} className="text-[#5FA37E] mt-0.5 shrink-0" />{feature}</li>)}</ul>
              <button onClick={() => void startCheckout(plan.id)} disabled={Boolean(loadingPlan) || isOwner || (hasPaidFeatures && plan.id !== 'export_pass') || (canExportOfficialForms && plan.id === 'export_pass')} className="w-full rounded-xl bg-[#332C28] text-white py-3 text-sm font-semibold disabled:opacity-40">
                {loadingPlan === plan.id ? 'Opening Stripe…' : isOwner ? 'Owner unlocked' : plan.id === 'export_pass' && canExportOfficialForms ? 'Export unlocked' : hasPaidFeatures && plan.id !== 'export_pass' ? 'Paid plan active' : stripeMode === 'test' ? 'Open Stripe test checkout' : 'Continue to Stripe'}
              </button>
            </div>
          ))}
        </div>

        {error && <div className="max-w-2xl mx-auto rounded-2xl bg-[#FFF5F7] border border-[#FFC1CC] px-5 py-4 text-sm text-[#C9445A] text-center mb-8">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><FileDown size={18} className="text-[#E85D70] mb-2" /><strong className="block text-[#332C28] mb-1">Free</strong>Unlimited manual hour logging, dashboard, calendar-style history, compliance basics.</div>
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><Upload size={18} className="text-[#D4A574] mb-2" /><strong className="block text-[#332C28] mb-1">Paid import</strong>Move a large Ripley/CSV history into Baker in batches.</div>
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><Sparkles size={18} className="text-[#E85D70] mb-2" /><strong className="block text-[#332C28] mb-1">Paid AI</strong>Voice/text-to-entry and richer compliance guidance.</div>
          <div className="rounded-2xl bg-white border border-[#F2EDEA] p-4 text-sm text-[#6B5D54]"><UserCheck size={18} className="text-[#5FA37E] mb-2" /><strong className="block text-[#332C28] mb-1">Professional</strong>Secure supervisor review, notes, and messages.</div>
        </div>

        <div className="max-w-3xl mx-auto mt-8 rounded-2xl bg-[#FAF8F6] p-5 flex items-start gap-3 text-sm text-[#6B5D54]"><LockKeyhole size={18} className="text-[#A8998E] shrink-0 mt-0.5" /><div><strong className="text-[#332C28]">Your data stays yours.</strong> The paywall is for premium automation and official-form generation convenience—not for seeing or manually copying the fieldwork records you entered.</div></div>
        {user && <p className="text-center text-xs text-[#A8998E] mt-6">Signed in as {user.email}</p>}
      </div>
    </div>
  );
}

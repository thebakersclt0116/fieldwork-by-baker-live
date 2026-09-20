import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { getStoredAccessToken } from '@/hooks/useAuth';

type PlanId = 'export_pass' | 'individual_monthly' | 'professional_monthly' | 'professional_annual';

interface StripeCheckoutProps {
  priceId?: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  planId?: PlanId;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

function inferPlanId(planId: PlanId | undefined, priceId: string | undefined, planName: string, billingCycle: 'monthly' | 'annual'): PlanId | null {
  if (planId) return planId;
  const explicit = String(priceId || '');
  if (['export_pass', 'individual_monthly', 'professional_monthly', 'professional_annual'].includes(explicit)) return explicit as PlanId;
  const lower = planName.toLowerCase();
  if (lower.includes('export')) return 'export_pass';
  if (lower.includes('professional')) return billingCycle === 'annual' ? 'professional_annual' : 'professional_monthly';
  if (lower.includes('individual')) return 'individual_monthly';
  return null;
}

export default function StripeCheckout({
  priceId,
  planName,
  billingCycle,
  planId,
  onSuccess,
  onError,
}: StripeCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    const token = getStoredAccessToken();
    const selectedPlan = inferPlanId(planId, priceId, planName, billingCycle);
    if (!token) {
      window.location.href = '/login?return=/upgrade';
      return;
    }
    if (!selectedPlan) {
      onError?.('This plan is not mapped to a Baker checkout option.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Stripe Checkout could not be opened.');
      onSuccess?.();
      window.location.assign(payload.url);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Stripe Checkout failed.');
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCheckout()}
      disabled={isLoading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#332C28] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-[#E85D70]"
    >
      {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
      {isLoading ? 'Opening secure checkout…' : 'Continue to secure Stripe checkout'}
    </button>
  );
}

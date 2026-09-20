import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Brain, CheckCircle2, CreditCard, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

type State = 'checking' | 'pass' | 'warn' | 'fail';

type Check = {
  key: string;
  label: string;
  state: State;
  detail: string;
};

export default function AdminLaunchCheck() {
  const { isOwner } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    const token = getStoredAccessToken();
    if (!token) return;
    setRunning(true);
    const next: Check[] = [];

    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const health = await response.json() as {
        aiGatewayAuthAvailable?: boolean;
        secureSessionSigningAvailable?: boolean;
        stripeCheckoutConfigured?: boolean;
        stripeMode?: string;
      };
      next.push({
        key: 'gateway',
        label: 'AI Gateway',
        state: health.aiGatewayAuthAvailable ? 'pass' : 'fail',
        detail: health.aiGatewayAuthAvailable ? 'AI Gateway credentials are available.' : 'AI Gateway credentials are missing.',
      });
      next.push({
        key: 'session',
        label: 'Secure session signing',
        state: health.secureSessionSigningAvailable ? 'pass' : 'fail',
        detail: health.secureSessionSigningAvailable ? 'Signed Baker sessions are available.' : 'Session signing is not configured.',
      });
      const stripeState: State = !health.stripeCheckoutConfigured ? 'fail' : health.stripeMode === 'live' ? 'pass' : 'warn';
      next.push({
        key: 'stripe',
        label: 'Stripe Checkout',
        state: stripeState,
        detail: !health.stripeCheckoutConfigured
          ? 'STRIPE_SECRET_KEY is not configured on production.'
          : health.stripeMode === 'live'
            ? 'Stripe is configured with a live secret key.'
            : health.stripeMode === 'test'
              ? 'Stripe is configured in TEST mode. Payments will not be production charges.'
              : 'Stripe is configured, but the key mode could not be identified.',
      });
    } catch (error) {
      next.push({ key: 'health', label: 'Production health endpoint', state: 'fail', detail: error instanceof Error ? error.message : 'Health check failed.' });
    }

    try {
      const response = await fetch('/api/baker-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          mode: 'bcba-brain',
          message: 'Launch diagnostic: in one sentence, explain the difference between duration and latency in behavior measurement.',
          context: { diagnostic: true },
          history: [],
        }),
      });
      const payload = await response.json() as { answer?: string; provider?: string; error?: string };
      next.push({
        key: 'brain',
        label: 'Baker Brain live response',
        state: response.ok && Boolean(payload.answer) ? 'pass' : 'fail',
        detail: response.ok && payload.answer
          ? 'Real authenticated AI response received from ' + (payload.provider || 'configured model') + ': “' + payload.answer.slice(0, 180) + (payload.answer.length > 180 ? '…' : '') + '”'
          : payload.error || 'Baker Brain did not return an answer.',
      });
    } catch (error) {
      next.push({ key: 'brain', label: 'Baker Brain live response', state: 'fail', detail: error instanceof Error ? error.message : 'Live Baker Brain test failed.' });
    }

    setChecks(next);
    setRunning(false);
  };

  useEffect(() => {
    if (isOwner) void runChecks();
  }, [isOwner]);

  if (!isOwner) return <Navigate to="/dashboard" replace />;

  const failures = checks.filter((item) => item.state === 'fail').length;
  const warnings = checks.filter((item) => item.state === 'warn').length;

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-10 dark:bg-[#171412]">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><ShieldCheck size={17} /> Owner launch diagnostics</div>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Is the production core actually live?</h1>
            <p className="mt-2 max-w-2xl text-[#6B5D54] dark:text-[#CFC4BE]">This page performs a real authenticated Baker Brain request and checks production payment/session configuration. It does not create a charge.</p>
          </div>
          <button onClick={() => void runChecks()} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-[#E85D70]">{running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Run again</button>
        </div>

        <div className="mt-7 rounded-[28px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]">
          {running && checks.length === 0 ? <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-[#A8998E]"><Loader2 size={18} className="animate-spin text-[#E85D70]" /> Running production checks…</div> : (
            <div className="space-y-3">
              {checks.map((check) => <CheckRow key={check.key} check={check} />)}
            </div>
          )}
        </div>

        {checks.length > 0 && (
          <div className={'mt-5 rounded-[24px] border p-5 ' + (failures ? 'border-[#F0D5DA] bg-[#FFF7F8]' : warnings ? 'border-[#F1D8B9] bg-[#FFF9F2]' : 'border-[#CFE7D9] bg-[#F4FBF7]')}>
            <div className="font-semibold text-[#332C28]">{failures ? 'Launch blockers detected' : warnings ? 'Core works, but configuration warning remains' : 'Core launch checks passed'}</div>
            <p className="mt-1 text-sm text-[#6B5D54]">{failures ? failures + ' required check(s) failed.' : warnings ? warnings + ' configuration warning(s) remain.' : 'AI, signed sessions, and live Stripe configuration all reported green.'}</p>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link to="/baker-brain" className="flex items-center gap-3 rounded-2xl border border-[#F2EDEA] bg-white p-4 text-sm font-semibold text-[#5F5149] dark:border-white/10 dark:bg-[#211D1A] dark:text-white"><Brain size={18} className="text-[#E85D70]" /> Open Baker Brain as a user</Link>
          <Link to="/upgrade" className="flex items-center gap-3 rounded-2xl border border-[#F2EDEA] bg-white p-4 text-sm font-semibold text-[#5F5149] dark:border-white/10 dark:bg-[#211D1A] dark:text-white"><CreditCard size={18} className="text-[#D4A574]" /> Inspect billing screen</Link>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.state === 'pass' ? CheckCircle2 : check.state === 'fail' ? XCircle : ShieldCheck;
  const tone = check.state === 'pass' ? 'text-[#4B8C69]' : check.state === 'fail' ? 'text-[#C9445A]' : 'text-[#B77722]';
  return <div className="flex items-start gap-3 rounded-2xl bg-[#FAF8F6] p-4 dark:bg-white/5"><Icon size={19} className={'mt-0.5 shrink-0 ' + tone} /><div><div className={'font-semibold ' + tone}>{check.label}</div><p className="mt-1 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{check.detail}</p></div></div>;
}

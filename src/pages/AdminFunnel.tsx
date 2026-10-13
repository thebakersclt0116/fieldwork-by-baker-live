import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { currentManagedToken } from '@/lib/managedSession';
const stages = ['landing_page_loaded', 'account_created', 'email_verified', 'checkout_opened', 'first_paid_membership'] as const;
const labels = ['Landing page loaded', 'Account created', 'Email verified', 'Checkout opened', 'First paid membership'];
type Summary = { version: string; groups: Array<{campaign: string; variant: string; stages: Record<typeof stages[number], number>; metaAccepted: number}>; qaEventsExcluded: number; earliestEvent: string | null; limited: boolean; definitions: Record<string, string>; note: string; since: string; checkedAt: string; metaConfigured: boolean };
export default function AdminFunnel() {
  const { user, isOwner, isLoading } = useAuth();
  const [days, setDays] = useState(30), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  async function load() {
    setBusy(true); setError('');
    try {
      const token = await currentManagedToken();
      const response = await fetch('/api/funnel?days=' + days, { cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { Authorization: 'Bearer ' + token } });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.groups)) throw new Error(data.code === 'OWNER_REQUIRED' ? 'Only the verified owner account can read acquisition counts.' : 'Funnel counts could not be loaded. An unavailable report is not a zero-conversion result.');
      setSummary(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Funnel counts are unavailable.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (isOwner && user?.authProvider === 'supabase') void load(); }, [isOwner, user?.authProvider, days]);
  if (isLoading) return <div role="status" className="p-8">Opening owner acquisition report…</div>;
  if (!isOwner) return <Navigate to="/dashboard" replace />;
  return <div className="min-h-screen bg-[#FFFCF9] px-4 py-8 text-[#332C28] dark:bg-[#171412] dark:text-white"><div className="mx-auto max-w-6xl">
    <header className="mb-6"><div className="text-xs font-bold uppercase text-[#E85D70]">Owner · Acquisition measurement</div><h1 className="mt-2 font-serif text-4xl">See where prospects stop.</h1><p className="mt-3 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">First-party server evidence beside consent-based advertising delivery. No fieldwork content, customer email addresses or payment credentials appear in this report.</p></header>
    <div className="mb-5 flex flex-wrap items-end gap-3"><label className="text-sm">Reporting window<select className="ml-3 rounded-xl border border-[#E2DAD5] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#211D1A]" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label><button type="button" disabled={busy} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16}/>{busy ? 'Loading…' : 'Refresh counts'}</button><Link to="/admin/launch-check" className="p-3 text-sm underline">Launch diagnostics</Link></div>
    {user?.authProvider !== 'supabase' && <p role="alert" className="mb-4 rounded-xl border border-amber-400 p-4 text-sm">Sign in with your cloud owner account. A browser-local owner label cannot authorize this report.</p>}
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400 p-4 text-sm">{error}</p>}
    {summary && <>
      <div className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-900/15 dark:text-amber-100"><strong>This starts with the new instrumentation, not historical clicks.</strong> Public arrivals include only consenting visitors. Server account and payment stages remain separate from optional Meta consent. These are unique journeys, not a same-start-date cohort; do not divide the columns to declare a test winner. {summary.limited && 'The report reached its 20,000-event safety limit; shorten the date range.'}</div>
      <div className="overflow-x-auto rounded-2xl border border-[#F2EDEA] bg-white dark:border-white/10 dark:bg-[#211D1A]"><table className="min-w-[920px] w-full text-left text-sm"><thead><tr className="border-b dark:border-white/10"><th className="p-4">Journey group</th>{labels.map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{summary.groups.length ? summary.groups.map(group => <tr key={group.campaign + group.variant} className="border-b dark:border-white/10"><th className="p-4 font-semibold">{group.campaign === 'direct' ? 'Direct / unattributed' : 'Fieldwork destination test'}<div className="mt-1 font-normal">{group.variant}</div></th>{stages.map(stage => <td key={stage} className="p-4 font-mono">{group.stages[stage]}</td>)}</tr>) : <tr><td className="p-5" colSpan={6}>No measured production journeys in this window yet. QA checks are intentionally excluded.</td></tr>}</tbody></table></div>
      <p className="my-4 text-xs leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Checked {new Date(summary.checkedAt).toLocaleString()} · {summary.qaEventsExcluded} QA event(s) excluded · Meta sending configured: {summary.metaConfigured ? 'yes' : 'no'}. A configured connection does not prove Meta accepted every event or attributed a purchase to an ad.</p>
      <section className="rounded-2xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><h2 className="font-serif text-2xl">Exactly what each stage proves</h2><dl className="mt-4 space-y-4">{stages.map((stage, index) => <div key={stage}><dt className="font-semibold">{labels[index]}</dt><dd className="mt-1 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{summary.definitions[stage]}</dd></div>)}</dl></section>
      <p className="mt-5 text-sm leading-6">Homepage and signup destinations are assigned 50/50 per browsing session from <code>/start</code>. Both share the same ad, audience, placements, objective and existing campaign budget. Cross-device visits, ad blockers, consent and email verification delays can affect attribution. Confirm paid customers against Stripe before scaling.</p>
    </>}
  </div></div>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { currentManagedToken } from '@/lib/managedSession';
type Report = { introducedOn: string; since: string; checkedAt: string; firstRetainedEventAt: string | null; uniqueActiveUsers: number; groups: Array<{ feature: string; label: string; visits: number; uniqueVisitors: number; actionWindows: number; uniqueActionUsers: number; actions: Record<string, number> }> };
export default function FeatureEngagement() {
  const { user } = useAuth(); const [days, setDays] = useState(7), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null), [clock, setClock] = useState(() => Date.now());
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current; setBusy(true); setError('');
    try {
      const token = await currentManagedToken();
      const response = await fetch('/api/feature-usage?days=' + days, { cache: 'no-store', signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok || result.version !== 'usage-v1' || !Array.isArray(result.groups)) throw new Error('Feature usage is unavailable. This does not mean zero activity.');
      if (request === sequence.current) { setReport(result); setClock(Date.now()); }
    } catch (failure) { if (request === sequence.current) setError(failure instanceof Error ? failure.message : 'Usage unavailable.'); }
    finally { if (request === sequence.current) setBusy(false); }
  }, [days]);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { if (user?.authProvider === 'supabase') void load(); }, 0);
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); invalidate(); };
  }, [user?.authProvider, load, invalidate]);
  const stale = report && (Boolean(error) || clock - Date.parse(report.checkedAt) > 300000);
  return <section className="rounded-2xl border bg-white p-5 text-[#332C28]"><h3 className="text-xl font-semibold">Feature and tab engagement</h3>
    <p className="mt-2 text-sm leading-6">Optional, browser-reported usage from consenting managed members only. Owner, QA and preview traffic is excluded. Introduced October 16, 2026; earlier feature history was not collected. These counts do not represent all members.</p>
    <div className="my-4 flex flex-wrap gap-3"><label>Window <select value={days} onChange={event => setDays(Number(event.target.value))} className="ml-2 rounded-lg border p-2"><option value={1}>24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option></select></label><button type="button" disabled={busy || user?.authProvider !== 'supabase'} onClick={() => void load()} className="rounded-xl border px-4 py-2 disabled:opacity-40">{busy ? 'Loading…' : 'Refresh usage'}</button></div>
    {user?.authProvider !== 'supabase' && <p><Link to="/login?mode=cloud-owner&amp;return=%2Fdashboard" className="underline">Sign in to your cloud owner account</Link> to read usage aggregates.</p>}
    {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
    {report && <><p role="status" className="mb-3 text-sm">{stale ? 'Stale snapshot. ' : ''}Checked {new Date(report.checkedAt).toLocaleString()} · {report.uniqueActiveUsers} distinct consenting active accounts · window begins {new Date(report.since).toLocaleString()} (UTC duration).</p><p className="mb-3 text-sm">{report.firstRetainedEventAt ? 'First retained event in this window: ' + new Date(report.firstRetainedEventAt).toLocaleString() : 'No consented production activity recorded in this window yet. Earlier history is unavailable, not a zero-usage result.'}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Feature / tab', 'Tab-open windows', 'Distinct tab visitors', 'Action windows', 'Distinct action users'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{report.groups.map(group => <tr key={group.feature} className="border-t"><th className="p-2 font-medium">{group.label}{Object.entries(group.actions).map(([action, count]) => <div className="text-xs font-normal" key={action}>{action.replaceAll('_', ' ')}: {count}</div>)}</th><td className="p-2">{group.visits}</td><td className="p-2">{group.uniqueVisitors}</td><td className="p-2">{group.actionWindows}</td><td className="p-2">{group.uniqueActionUsers}</td></tr>)}</tbody></table></div></>}
    <p className="mt-4 text-xs leading-6">A tab-open window counts an allowlisted route opening at most once per account/feature/30-minute UTC bucket. Repeated clicks are not extra people. Action windows count selected control requests (open manual form, request full simulation, request a Baker Brain quick start, request billing portal), not successful completion or saved content. Distinct accounts are deduplicated within the selected window; do not sum row-level people across features. No time-on-page or engagement before introduction is inferred. Consent expiry, opt-outs and blocked requests limit coverage. Reports are limited to 30 days and refresh manually; snapshots become stale after five minutes.</p>
  </section>;
}

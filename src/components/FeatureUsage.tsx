import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { currentManagedToken } from '@/lib/managedSession';
import { USAGE_BUCKET_MS, USAGE_ROUTES, USAGE_VERSION, validUsageEvent } from '@/lib/featureUsageSchema';
type Choice = { account: string; enabled: boolean; expiresAt: string | null };
async function usageRequest(body?: Record<string, unknown>, signal?: AbortSignal) {
  const token = await currentManagedToken();
  const response = await fetch('/api/feature-usage' + (body ? '' : '?view=self'), {
    method: body ? 'POST' : 'GET', cache: 'no-store', signal: signal || AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error('Usage privacy settings are unavailable. Optional measurement stays off.');
  return result;
}
export default function FeatureUsage() {
  const { user, isOwner, isDemo } = useAuth(); const { pathname } = useLocation();
  const [choice, setChoice] = useState<Choice | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const [dismissedAccount, setDismissedAccount] = useState('');
  const eligible = user?.authProvider === 'supabase' && !isOwner && !isDemo;
  const account = eligible ? user.email : '';
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  const enabled = Boolean(account && choice?.account === account && choice.enabled && Date.parse(choice.expiresAt || '') > clock && !gpc);
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    void usageRequest(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setChoice({ account, enabled: result.enabled === true, expiresAt: result.expiresAt || null });
    }).catch(() => { if (!controller.signal.aborted) setError('Usage privacy settings are unavailable. Optional measurement stays off.'); });
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [account]);
  const send = useCallback(async (feature: string, action: string) => {
    if (!enabled || document.visibilityState !== 'visible' || !validUsageEvent(feature, action)) return;
    const key = account + '/' + feature + '/' + action + '/' + Math.floor(Date.now() / USAGE_BUCKET_MS);
    if (sent.current.has(key)) return;
    if (sent.current.size > 1000) sent.current.clear();
    sent.current.add(key);
    try {
      const result = await usageRequest({ type: 'event', consent: USAGE_VERSION, feature, action });
      if (result.reason === 'CONSENT_REQUIRED' || result.reason === 'CONSENT_REVOKED') setChoice({ account, enabled: false, expiresAt: null });
    } catch { /* Optional measurement never interrupts a feature or retries content requests. */ }
  }, [account, enabled]);
  useEffect(() => {
    const feature = USAGE_ROUTES[pathname];
    const opened = () => {
      // Only count a rendered feature, after access/cloud-loading guards have passed.
      if (feature && document.querySelector('[data-usage-tab]')?.getAttribute('data-usage-tab') === feature) void send(feature, 'tab_open');
    };
    opened(); document.addEventListener('visibilitychange', opened); window.addEventListener('fieldwork:usage-tab-ready', opened);
    return () => { document.removeEventListener('visibilitychange', opened); window.removeEventListener('fieldwork:usage-tab-ready', opened); };
  }, [pathname, send]);
  useEffect(() => {
    if (!enabled) return;
    const clicked = (event: MouseEvent) => {
      const control = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-usage-feature][data-usage-action]') : null;
      if (control && !control.hasAttribute('disabled')) void send(control.dataset.usageFeature || '', control.dataset.usageAction || '');
    };
    document.addEventListener('click', clicked, true);
    return () => document.removeEventListener('click', clicked, true);
  }, [enabled, send]);
  async function choose(allow: boolean) {
    setBusy(true); setError('');
    if (!allow) { setChoice({ account, enabled: false, expiresAt: null }); sent.current.clear(); }
    try {
      const result = await usageRequest({ type: 'consent', enabled: allow });
      setChoice({ account, enabled: result.enabled === true, expiresAt: result.expiresAt || null });
      setDismissedAccount(account);
    } catch (failure) { setError(allow ? (failure instanceof Error ? failure.message : 'Usage settings unavailable.') : 'Could not finish saving your opt-out. This page has stopped sending; retry to revoke collection across browsers and remove retained usage.'); }
    finally { setBusy(false); }
  }
  if (!account || (!choice && !error)) return null;
  const settings = pathname === '/settings';
  if (!settings && (enabled || dismissedAccount === account)) return null;
  return <aside aria-label="Optional usage measurement" className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-2xl rounded-2xl border border-[#E2DAD5] bg-white p-5 text-[#332C28] shadow-xl dark:border-white/10 dark:bg-[#211D1A] dark:text-white">
    <h2 className="font-semibold">Optional usage measurement · {enabled ? 'on' : 'off'}</h2>
    <p className="mt-2 text-sm leading-6">Help improve Fieldwork by sharing which tabs you open and selected feature controls you use. We store fixed feature/action codes, a protected account pseudonym and a 30-minute UTC time bucket. No fieldwork entries, messages, names, emails or full URLs enter these events. The owner sees aggregate counts.</p>
    <p className="mt-2 text-xs leading-5">Permission expires after 30 days. Reports cover up to 30 days; older optional records are purged when the next consented event or opt-in is processed. Turning off removes your retained usage and stops future collection across browsers. Backups may follow the storage provider’s backup lifecycle. <Link to="/privacy" className="underline">Privacy details</Link></p>
    {gpc && <p className="mt-2 text-sm">Global Privacy Control is enabled; optional collection is blocked.</p>}
    <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy || gpc || enabled} onClick={() => void choose(true)} className="rounded-xl bg-[#E85D70] px-4 py-2 font-semibold text-white disabled:opacity-40">Allow usage measurement</button><button type="button" disabled={busy} onClick={() => void choose(false)} className="rounded-xl border px-4 py-2">{enabled ? 'Turn off & delete usage' : 'Keep off & delete usage'}</button>{settings && <Link to="/dashboard" className="p-2 underline">Done</Link>}</div>
    {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    <p className="mt-2 text-xs">Change this anytime in Account settings. {choice?.expiresAt && enabled ? 'Permission expires ' + new Date(choice.expiresAt).toLocaleDateString() + '.' : ''}</p>
  </aside>;
}

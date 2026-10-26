import { useRef, useState } from 'react';
import { Copy, UserCheck } from 'lucide-react';
import type { HourEntry } from '@/types';
import { getStoredAccessToken, getStoredAuthUser } from '@/hooks/useAuth';
import { getCurrentUserEmail, loadEntries } from '@/lib/fieldworkStore';
import { waitForCloudSave } from '@/lib/cloudWorkspace';
import { currentManagedToken } from '@/lib/managedSession';
import { timerNeedsDetails } from '@/lib/fieldworkTimer';
import { formatTime } from '@/lib/timeDisplay';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fieldClass = 'mt-1.5 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm text-[#332C28] dark:border-white/15 dark:bg-[#211D1A] dark:text-white';

export default function SupervisorReview({ entry, email, enabled }: { entry: HourEntry; email: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.supervisorName === 'Not specified' ? '' : entry.supervisorName || '');
  const [address, setAddress] = useState(entry.supervisorEmail || '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [reviewUrl, setReviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!enabled || entry.status === 'DRAFT' || timerNeedsDetails(entry)) return null;

  const createReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || reviewUrl) return;
    if (!confirmed || !name.trim() || !/^\S+@\S+\.\S+$/.test(address.trim())) {
      setError('Confirm the supervisor name, email, and permission to review this entry.'); return;
    }
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (getCurrentUserEmail() !== email) throw new Error('Your account changed. Sign in again before sharing.');
      const managed = getStoredAuthUser()?.authProvider === 'supabase';
      if (managed) await waitForCloudSave();
      const token = managed ? await currentManagedToken() : getStoredAccessToken();
      if (!token || getCurrentUserEmail() !== email) throw new Error('Sign in again before creating a supervisor review link.');
      const current = loadEntries(email).find(item => item.id === entry.id);
      if (!current || current.status === 'DRAFT' || timerNeedsDetails(current)) throw new Error('This entry is unavailable or still needs activity details.');
      const narrative = [
        current.organizationName ? `Organization: ${current.organizationName}` : '',
        `Time: ${formatTime(current.startTime)}–${formatTime(current.endTime)}`,
        `Category: ${current.activityCategory}`,
        current.workPresence ? `Activity type: ${current.workPresence}` : '',
        `Supervision: ${current.supervisionMinutes || 0} minutes`,
        `Client observation: ${current.observationMinutes || 0} minutes`,
        current.setting ? `Setting: ${current.setting}` : '',
        '', current.notes || 'No narrative supplied.',
      ].filter(Boolean).join('\n');
      const response = await fetch('/api/supervisor-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          supervisorName: name.trim(), supervisorEmail: address.trim().toLowerCase(), notificationMode: 'none',
          reviewEntry: { id: current.id, revision: current.revision || 0, date: current.date, duration: current.duration,
            activityCategory: current.activityCategory, narrative, supervisorName: current.supervisorName,
            supervisionMinutes: current.supervisionMinutes || 0 },
        }), signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json() as { path?: string; error?: string };
      if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create the supervisor review link.');
      const url = new URL(payload.path, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/supervisor/')) throw new Error('The review link could not be verified.');
      if (getCurrentUserEmail() !== email) throw new Error('Your account changed. Reopen this entry in the correct account.');
      setReviewUrl(url.href); setMessage('Review access granted. Copy this secure link to share with the confirmed supervisor.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The invitation was not confirmed. Check the entry and supervisor address before retrying.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(reviewUrl); setMessage('Review link copied.'); }
    catch { setError('Copy was unavailable. Select and copy the review link below.'); }
  };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E2DAD5] px-3 py-2 text-xs font-semibold text-[#4B8C69] dark:border-white/15 dark:text-[#9BD5B4]"><UserCheck size={15} /> Supervisor review</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FFFCF9] sm:max-w-lg dark:bg-[#171412]"><DialogHeader><DialogTitle>Share this entry for review</DialogTitle><DialogDescription>{entry.date} · {entry.duration.toFixed(2)} hours. Confirm who can review this entry’s narrative and details.</DialogDescription></DialogHeader>
      <form onSubmit={event => void createReview(event)} className="space-y-4">
        <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervisor name<input required maxLength={120} value={name} disabled={busy || Boolean(reviewUrl)} onChange={event => { setName(event.target.value); setConfirmed(false); }} className={fieldClass} /></label>
        <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervisor email<input required type="email" maxLength={254} value={address} disabled={busy || Boolean(reviewUrl)} onChange={event => { setAddress(event.target.value); setConfirmed(false); }} className={fieldClass} /></label>
        <label className="flex items-start gap-2 text-sm text-[#6B5D54] dark:text-[#CFC4BE]"><input type="checkbox" required checked={confirmed} disabled={busy || Boolean(reviewUrl)} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I confirm this supervisor may review this entry’s narrative and details.</label>
        <p className="text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Access lasts 14 days. For cloud accounts, the supervisor must sign in with this verified email, and editing the entry invalidates its invitation. Creating the link does not send an email.</p>
        {error && <p role="alert" className="rounded-xl bg-[#FFF5F7] p-3 text-sm text-[#C9445A]">{error}</p>}
        {message && <p role="status" className="text-sm text-[#4B8C69] dark:text-[#9BD5B4]">{message}</p>}
        {reviewUrl ? <div className="space-y-2"><label className="block text-xs text-[#6B5D54] dark:text-[#CFC4BE]">Secure review link<input readOnly value={reviewUrl} onFocus={event => event.target.select()} className={fieldClass} /></label><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/15 dark:text-white"><Copy size={15} /> Copy review link</button></div> : <button type="submit" disabled={busy || !confirmed} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><UserCheck size={15} />{busy ? 'Creating…' : 'Allow supervisor to review this entry'}</button>}
      </form>
    </DialogContent></Dialog>
  </>;
}

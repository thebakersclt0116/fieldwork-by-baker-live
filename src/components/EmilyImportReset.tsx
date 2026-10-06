import { useState } from 'react';
import { getCurrentUserEmail } from '@/lib/fieldworkStore';
import { archiveFile } from '@/lib/migrationArchive';
import { EMILY_RESET_EMAIL, readEmilyReset, resetEmilyTrackedHours, type ResetReceipt } from '@/lib/emilyReset';
import { useAuth } from '@/hooks/useAuth';

export default function EmilyImportReset() {
  const { user } = useAuth();
  const email = (user?.email || '').trim().toLowerCase();
  const [receipt, setReceipt] = useState<ResetReceipt | null>(() => {
    try { return email === EMILY_RESET_EMAIL ? readEmilyReset(localStorage, email) : null; } catch { return null; }
  });
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (email !== EMILY_RESET_EMAIL) return null;

  async function clearForImport() {
    if (confirmation !== 'RESET' || busy) return;
    setBusy(true); setError('');
    try {
      const run = () => resetEmilyTrackedHours({
        storage: localStorage, email, currentEmail: getCurrentUserEmail,
        backup: async (data, name) => { await archiveFile(new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' }), email, 'supporting-document'); },
      });
      const result = navigator.locks
        ? await navigator.locks.request('baker-emily-clean-import-reset', run)
        : await run();
      setReceipt(result); setConfirmation('');
      window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Reset failed. Check the backup before trying anything else.'); }
    finally { setBusy(false); }
  }

  return <section aria-label="Emily fresh import reset" className="rounded-2xl border border-[#E85D70]/35 bg-[#FFF7F8] p-5 dark:bg-[#E85D70]/10">
    <h2 className="font-serif text-2xl">Emily’s fresh Ripley import</h2>
    {receipt?.state === 'completed' ? <div role="status" className="mt-3 text-sm leading-6">
      <strong>The one-time reset is complete on this browser.</strong> {receipt.count} previous tracked records were cleared on {new Date(receipt.createdAt).toLocaleString()}. Anything imported afterward is kept; revisiting or refreshing will not clear it again.
      <p className="mt-2">Your account, supervisors, original files, and other users’ records were not removed. The before-reset backup is under Supporting documents: <span className="break-all">{receipt.backupName}</span>.</p>
    </div> : <>
      <p className="mt-3 text-sm leading-6">Start with an empty tracker on this computer. This removes only Emily’s currently tracked hours after a backup is saved and verified. It keeps your account, supervisor list, original Ripley files, and supporting documents. It does not delete or change anything in Ripley.</p>
      <p className="mt-2 text-sm leading-6">Use the same browser where your old hours appear. Close other Baker tabs before resetting. Upload your detailed export after the reset—not just monthly verification PDFs.</p>
      {receipt?.state === 'prepared' ? <p role="alert" className="mt-3 font-semibold">A previous reset was interrupted. Automatic repeat is blocked to protect new imports. Check the current tracker and its preserved backup first.</p> : <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-sm font-semibold">Type RESET to confirm<input aria-label="Emily reset confirmation" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} className="mt-2 block rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 dark:border-white/20 dark:bg-[#171412]" /></label>
        <button type="button" disabled={busy || confirmation !== 'RESET'} onClick={() => void clearForImport()} className="rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Backing up and clearing…' : 'Back up and reset my tracked hours'}</button>
      </div>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
  </section>;
}

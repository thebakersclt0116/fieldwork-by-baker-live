import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArrowRight, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { archiveFile, downloadBytes } from '@/lib/migrationArchive';
import { RESET_ACCOUNT, createResetBackup, readResetSnapshot, resetEmilyTrackedHours, type ResetSnapshot } from '@/lib/emilyFieldworkReset';

export default function ResetEmilyFieldwork() {
  const { user, isLoading } = useAuth();
  const allowed = user?.email?.trim().toLowerCase() === RESET_ACCOUNT;
  const [snapshot, setSnapshot] = useState<ResetSnapshot | null>(null);
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [backupSaved, setBackupSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const input = 'mt-2 w-full rounded-xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm dark:border-white/15 dark:bg-[#171412]';
  const alternateOrigin = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
  useEffect(() => {
    if (!allowed) { setSnapshot(null); setCurrentCount(null); return; }
    const reload = () => { try { setCurrentCount(readResetSnapshot().count); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not read this device’s records.'); } };
    reload(); window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, [allowed]);
  async function backup() {
    setBusy(true); setMessage(''); setSnapshot(null); setBackupSaved(false); setConfirmation('');
    try {
      const captured = readResetSnapshot();
      const content = createResetBackup(captured);
      const filename = 'baker-before-ripley-reimport-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      await archiveFile(new File([content], filename, { type: 'application/json' }), RESET_ACCOUNT, 'supporting-document');
      downloadBytes(filename, content, 'application/json');
      setSnapshot(captured); setCurrentCount(captured.count);
      setMessage('Backup preserved in your original-document vault and download started. Check the downloaded file before confirming the reset.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Backup failed. Nothing has been removed.'); }
    finally { setBusy(false); }
  }
  function reset() {
    if (!snapshot || busy) return;
    try {
      if (!window.confirm(`Remove ${snapshot.count} tracked entries (${snapshot.hours.toFixed(2)} hours) from Emily’s ledger on THIS browser only? The saved backup, account, supervisors and original documents will remain.`)) return;
      const result = resetEmilyTrackedHours(snapshot, confirmation, backupSaved);
      setCurrentCount(0); setSnapshot(null); setConfirmation(''); setBackupSaved(false);
      // Navigating to the import page mounts its ledger afresh. Do not globally remount this success message.
      setMessage(`Reset verified: ${result.removed} entries removed from this device’s active ledger. It now contains 0 tracked entries. You can import the detailed Ripley history next.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Reset failed. Check the ledger before retrying.'); }
  }
  if (isLoading) return <div className="p-10" role="status">Checking your account…</div>;
  return <div className="min-h-[75vh] bg-[#FFFCF9] px-4 py-10 text-[#332C28] dark:bg-[#171412] dark:text-white"><div className="mx-auto max-w-3xl space-y-5">
    <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><ShieldCheck size={18}/>Emily’s clean-import test</div>
    <h1 className="font-serif text-4xl font-semibold">Start fresh without losing the originals.</h1>
    <p className="text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">Remove only Emily’s existing tracked hours from this browser so she can test importing her detailed Ripley session history. Nothing is deleted just by opening this page. This is not account deletion.</p>
    {!allowed ? <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-5 text-sm text-amber-950 dark:bg-amber-900/15 dark:text-amber-100">This reset is available only while Emily is signed in, on the computer and browser where her hours were saved. Opening it from the owner’s computer cannot clear her device. No records have been changed.</div> : <>
      {alternateOrigin && <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-900/15 dark:text-amber-100"><strong>You are on the temporary Vercel address.</strong> Browser records saved under www.fieldworkbybaker.com are separate and cannot be read or reset here. Use the original domain once its contact-verification suspension is resolved.</div>}
      <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]">
        <h2 className="font-serif text-2xl">Tracked entries on this device: {currentCount ?? 'checking'}</h2>
        <p className="mt-3 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">Keep: sign-in, beta access, supervisors, organizations stored outside entries, study progress, source files, supporting documents, and past import journals. Remove: active tracked entries, including monthly totals and test sessions. Existing review links cannot approve entries that no longer exist; review any new imports separately.</p>
        <button type="button" disabled={busy || !currentCount} onClick={() => void backup()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-bold text-white disabled:opacity-40 dark:bg-[#E85D70]"><Archive size={16}/>{busy ? 'Preserving backup…' : '1. Download pre-reset backup'}</button>
        {snapshot && <div className="mt-5 space-y-4 border-t border-[#F2EDEA] pt-5 dark:border-white/10">
          <p className="text-sm">Ready to remove <strong>{snapshot.count} entries / {snapshot.hours.toFixed(2)} hours</strong> captured in that backup. Close other editing tabs first. If the records change before confirmation, reset stops.</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={backupSaved} onChange={e => setBackupSaved(e.target.checked)} className="mt-1"/>I have saved the backup and want to clear these tracked hours for a fresh Ripley import.</label>
          <label className="block text-sm font-semibold">Type RESET to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} className={input}/></label>
          <button type="button" disabled={busy || !backupSaved || confirmation !== 'RESET'} onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-[#C9445A] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><Trash2 size={16}/>2. Remove these tracked hours</button>
        </div>}
        {currentCount === 0 && <p className="mt-4 font-semibold text-[#4B8C69] dark:text-[#8FD0AD]">This device’s active ledger is empty. No new imports will be automatically deleted.</p>}
      </section>
    </>}
    {message && <p role="status" className="rounded-2xl border border-[#E85D70]/40 p-4 text-sm leading-7">{message}</p>}
    <div className="flex flex-wrap gap-3"><Link className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-bold text-white" to="/import">Import detailed Ripley entries <ArrowRight size={16}/></Link><Link className="p-3 text-sm underline" to="/audit-history">Original files & audit history</Link><Link className="p-3 text-sm underline" to="/dashboard">Back to tracked hours</Link></div>
  </div></div>;
}

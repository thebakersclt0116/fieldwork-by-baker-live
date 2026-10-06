import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getStoredAccessToken } from '@/hooks/useAuth';
import { captureResetSnapshot, commitResetSnapshot, preserveResetSnapshot, loadResetSnapshot, RESET_ACCOUNT, RESET_MARKER, type ResetSnapshot } from '@/lib/emilyTestReset';
import { downloadBytes } from '@/lib/migrationArchive';

async function verifyEmily() {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Sign into Emily’s account on the computer that contains her hours first.');
  const r = await fetch('/api/auth', { method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
  const payload = await r.json();
  if (!r.ok || payload.user?.email?.toLowerCase() !== RESET_ACCOUNT || !payload.canResetOwnTestHours) throw new Error('Emily’s valid signed-in session is required. No one else’s account can run this reset.');
  return token;
}
export default function ResetEmilyFieldwork() {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('Checking your signed-in account…');
  const [snapshot, setSnapshot] = useState<ResetSnapshot | null>(null), [complete, setComplete] = useState(false);
  useEffect(() => {
    let active = true;
    void verifyEmily().then(async () => {
      const marker = localStorage.getItem(RESET_MARKER);
      if (marker) {
        const backup = await loadResetSnapshot(JSON.parse(marker).snapshotId);
        if (active) { setComplete(true); setReady(true); setSnapshot(backup); setMessage('The one-time reset already completed on this browser. Any entries imported afterward remain untouched.'); }
      } else {
        const current = captureResetSnapshot(localStorage);
        if (active) { setSnapshot(current); setReady(true); setMessage(`${current.entryCount} existing tracked entries found on this browser.`); }
      }
    }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Unable to check this browser. No entries were deleted.'); });
    return () => { active = false; };
  }, []);
  async function reset() {
    if (!ready || complete || busy || !snapshot) return;
    if (!window.confirm(`Clear Emily’s ${snapshot.entryCount} tracked entries from this browser for a clean Ripley import? A recovery copy will be kept. Her sign-in, supervisors, original documents, study progress, and other users’ records stay unchanged.`)) return;
    setBusy(true);
    try {
      const token = await verifyEmily();
      const backedUp = await preserveResetSnapshot(snapshot);
      if (getStoredAccessToken() !== token) throw new Error('The signed-in session changed while backing up. Reset stopped.');
      commitResetSnapshot(localStorage, snapshot, backedUp);
      setComplete(true); setMessage(`Reset complete on this browser: ${snapshot.entryCount} old tracked entries cleared. Emily is ready to import her detailed Ripley history. Newly imported entries will not be reset automatically.`);
      window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Reset failed. Check records and recovery backup before trying again.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-[70vh] bg-[#FFFCF9] px-4 py-10 text-[#332C28] dark:bg-[#171412] dark:text-white"><section className="mx-auto max-w-2xl rounded-3xl border border-[#F2EDEA] bg-white p-7 dark:border-white/10 dark:bg-[#211D1A]">
    <p className="text-sm font-bold text-[#E85D70]">EMILY’S RIPLEY IMPORT TEST</p><h1 className="mt-2 font-serif text-3xl">Start with a clean hour tracker.</h1>
    <p className="mt-4 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">Run this on Emily’s normal computer and browser, signed into her Fieldwork account. It removes her existing tracked entries from the active hour totals only. It does not delete her account, password, supervisors, original source files, archived evidence, exam results, or anyone else’s data.</p>
    <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">A verified recovery copy of the current entry list is required before clearing. Download it to secure storage as well. This cannot reset another device remotely. There is no automatic reset on page load or after a future import.</div>
    <p role="status" className="my-5 whitespace-pre-wrap text-sm leading-6">{message}</p>
    {ready && snapshot && <button type="button" className="mb-4 rounded-xl border border-[#E2DAD5] px-4 py-3 text-sm font-semibold dark:border-white/15" onClick={() => downloadBytes('emily-fieldwork-before-reset.json', JSON.stringify(snapshot, null, 2), 'application/json')}>Download pre-reset recovery copy</button>}
    <div className="flex flex-wrap gap-3">{!complete && <button type="button" disabled={!ready || busy || !snapshot} onClick={() => void reset()} className="rounded-xl bg-[#C9445A] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Backing up and resetting…' : 'Back up and clear Emily’s tracked hours'}</button>}
      <Link className="rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-bold text-white" to="/import">{complete ? 'Import detailed Ripley entries' : 'Return to import'}</Link>
    </div>
    <p className="mt-5 text-xs leading-6 text-[#A8998E]">Use a detailed CSV/TSV/JSON export or the authorized Detail Bridge capture for individual sessions. Monthly verification PDFs contain totals, not each original activity narrative.</p>
  </section></div>;
}

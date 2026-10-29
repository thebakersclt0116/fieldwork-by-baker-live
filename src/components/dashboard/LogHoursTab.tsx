import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Play, Plus, Square } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { HourEntry } from '@/types';
import HourEntryForm from '@/components/HourEntryForm';
import type { HourEntrySubmission } from '@/components/HourEntryForm';
import { allocateEntry } from '@/lib/hourEntryFlow';
import TrackedHoursEditor from '@/components/TrackedHoursEditor';
import SupervisorReview from './SupervisorReview';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { appendEntries, getCurrentUserEmail, loadEntries, loadSupervisors } from '@/lib/fieldworkStore';
import { cloudState, managedEmail, subscribeCloud, waitForCloudSave } from '@/lib/cloudWorkspace';
import {
  acknowledgeTimerDetails, completeAllocatedTimerDetails, elapsedTimerSeconds, localDate, readTimerJournal,
  restoreTimerEntries, startTimerSession, stopTimerSession, timerNeedsDetails,
} from '@/lib/fieldworkTimer';
import type { TimerJournal } from '@/lib/fieldworkTimer';
import { formatTime } from '@/lib/timeDisplay';

const emptyJournal: TimerJournal = { version: 1, running: null, stopped: [] };
function timerLabel(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Your hours could not be saved. Keep this page open and check your saving status.'; }
function entriesChanged() { window.dispatchEvent(new CustomEvent('fieldwork:entries-changed')); }
async function withTimerLock<T>(email: string, action: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(`fieldwork-timer:${email}`, action);
  return action();
}

export default function LogHoursTab() {
  const { user, hasSupervisorFeatures } = useAuth();
  const email = getCurrentUserEmail() || user?.email?.trim().toLowerCase() || '';
  if (!email) return <p className="text-sm text-[#6B5D54]">Sign in to track your hours.</p>;
  return <AccountHours key={email} email={email} hasSupervisorFeatures={hasSupervisorFeatures} />;
}

function AccountHours({ email, hasSupervisorFeatures }: { email: string; hasSupervisorFeatures: boolean }) {
  const [timerSupervisor, setTimerSupervisor] = useState('');
  const [timerOrganization, setTimerOrganization] = useState('');
  const [journal, setJournal] = useState<TimerJournal>(emptyJournal);
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [now, setNow] = useState(Date.now);
  const [selectedSession, setSelectedSession] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [savingState, setSavingState] = useState(cloudState);

  const refresh = useCallback(() => {
    if (getCurrentUserEmail() !== email) return;
    try {
      setJournal(readTimerJournal(email));
      setEntries(loadEntries(email));
      setSavingState(cloudState());
      setNow(Date.now());
    } catch (error) { setMessage(errorMessage(error)); }
  }, [email]);

  useEffect(() => {
    const recover = () => {
      if (getCurrentUserEmail() !== email) return;
      try {
        if (!managedEmail() || cloudState() === 'saved') restoreTimerEntries(email);
      } catch (error) { setMessage(errorMessage(error)); }
      refresh();
    };
    recover();
    const offCloud = subscribeCloud(recover);
    window.addEventListener('storage', refresh);
    window.addEventListener('fieldwork:entries-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      offCloud();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('fieldwork:entries-changed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [email, refresh]);

  useEffect(() => {
    if (!journal.running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [journal.running]);

  const start = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      if (!timerSupervisor.trim() || !timerOrganization.trim()) throw new Error('Choose a supervisor and organization before starting the timer.');
      await withTimerLock(email, () => startTimerSession(email, Date.now(), { supervisor: timerSupervisor.trim(), organization: timerOrganization.trim() })); refresh();
    }
    catch (error) { setMessage(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const stop = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      const session = await withTimerLock(email, () => stopTimerSession(email));
      refresh();
      if (session) {
        setSelectedSession(session.id);
        try { restoreTimerEntries(email); entriesChanged(); }
        catch (error) { setMessage(`The timer has stopped. Your elapsed time is retained on this device. ${errorMessage(error)}`); }
        refresh();
      }
    } catch (error) { setMessage(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const pendingSessions = new Map<string, HourEntry[]>();
  for (const entry of entries.filter(timerNeedsDetails)) {
    const id = entry.timerSession!.id;
    pendingSessions.set(id, [...(pendingSessions.get(id) || []), entry]);
  }
  // A blocked cloud save still leaves an actionable reminder backed by the journal.
  for (const session of journal.stopped) {
    if (!pendingSessions.has(session.id) && session.entries.some(timerNeedsDetails)) pendingSessions.set(session.id, session.entries);
  }
  const selectedEntries = selectedSession ? entries.filter(entry => entry.timerSession?.id === selectedSession) : [];
  const selectedFallback = journal.stopped.find(session => session.id === selectedSession)?.entries || [];
  const selected = selectedEntries.length ? selectedEntries : selectedFallback;
  const sorted = [...entries].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));
  const seconds = elapsedTimerSeconds(journal.running, now);
  const selectedDateCount = new Set(selected.map(entry => entry.date)).size;

  const knownSupervisors = [...new Set([...loadSupervisors(email).map(item => item.name), ...entries.map(entry => entry.supervisorName)].filter(name => name && name !== 'Not specified'))].sort();
  const knownOrganizations = [...new Set(entries.map(entry => entry.organizationName || entry.setting).filter((name): name is string => Boolean(name)))].sort();

  const finishDetails = async ({ detailsByEntry }: HourEntrySubmission) => {
    completeAllocatedTimerDetails(email, selectedSession, detailsByEntry);
    entriesChanged(); refresh();
    if (managedEmail()) await waitForCloudSave();
    acknowledgeTimerDetails(email, selectedSession);
    setSelectedSession(''); refresh();
    setMessage(managedEmail() ? 'Activity details and hours saved to your account.' : 'Activity details and hours saved on this device.');
  };
  const saveManual = async ({ sources, detailsByEntry }: HourEntrySubmission) => {
    if (getCurrentUserEmail() !== email) throw new Error('Your account changed. Sign in again before saving.');
    const allocated = sources.flatMap(source => allocateEntry({ ...source, userId: email }, detailsByEntry[source.id]));
    appendEntries(allocated, email); entriesChanged(); refresh();
    setManualOpen(false);
    if (managedEmail()) await waitForCloudSave();
    setMessage(managedEmail() ? 'Hours saved to your account.' : 'Hours saved on this device.');
  };

  return <div className="space-y-6">
    <section aria-labelledby="hours-timer-title" className="rounded-2xl border border-[#F2EDEA] bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-[#211D1A]">
      <datalist id="timer-supervisors">{knownSupervisors.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="timer-organizations">{knownOrganizations.map(name => <option key={name} value={name} />)}</datalist>
      <fieldset disabled={Boolean(journal.running)} className="mb-5 grid gap-4 sm:grid-cols-3"><legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#7B6B62] dark:text-[#CFC4BE]">Start with your session details</legend><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervisor<input list="timer-supervisors" value={journal.running?.context?.supervisor || timerSupervisor} onChange={event => setTimerSupervisor(event.target.value)} placeholder="Select or enter supervisor" className="field-input" /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Organization<input list="timer-organizations" value={journal.running?.context?.organization || timerOrganization} onChange={event => setTimerOrganization(event.target.value)} placeholder="Select or enter organization" className="field-input" /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Date<input type="date" value={localDate(journal.running?.startedAt || now)} readOnly className="field-input" /></label></fieldset>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="hours-timer-title" className="flex items-center gap-2 font-semibold text-[#332C28] dark:text-white"><Clock3 size={20} className="text-[#E85D70]" /> Fieldwork timer</h2><p className="mt-1 max-w-md text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Choose your supervisor and organization, then start. Stopping fills your date and session times automatically.</p></div>
        <div className="flex flex-wrap items-center gap-4"><output aria-label="Elapsed time" className="font-mono text-3xl tabular-nums text-[#332C28] dark:text-white">{timerLabel(seconds)}</output>{journal.running ? <button type="button" disabled={busy} onClick={() => void stop()} className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Square size={16} /> Stop & log</button> : <button type="button" disabled={busy || !timerSupervisor.trim() || !timerOrganization.trim()} onClick={() => void start()} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play size={16} /> Start timer</button>}</div>
      </div>
      <p className="mt-4 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">{journal.running ? 'Timer running. It continues if you leave this page or close this browser. Return here to stop it.' : 'Your timer is kept on this device. Stopped hours stay marked “Needs details” until you finish the activity description.'}</p>
    </section>

    {message && <div role="status" className="flex gap-2 rounded-xl border border-[#E2DAD5] bg-white p-4 text-sm text-[#6B5D54] dark:border-white/15 dark:bg-[#211D1A] dark:text-[#CFC4BE]"><CheckCircle2 size={17} className="shrink-0 mt-0.5" />{message}</div>}
    {managedEmail() && savingState === 'blocked' && <p role="alert" className="rounded-xl bg-[#FFF3E0] p-4 text-sm text-[#8A5D36]">Cloud saving needs review. Your local timer and entry drafts are retained. Use the saving controls to review your backup before continuing.</p>}

    {pendingSessions.size > 0 && <section aria-labelledby="timer-reminders-title" className="rounded-2xl border border-[#E8C39F] bg-[#FFF8F3] p-5"><h2 id="timer-reminders-title" className="flex items-center gap-2 font-semibold text-[#8A5D36]"><AlertCircle size={18} /> Finish your activity details</h2><p className="mt-1 text-sm text-[#8A5D36]">Your time is recorded. These entries need a description and details before they are ready for monthly verification.</p><div className="mt-4 space-y-2">{[...pendingSessions].map(([id, group]) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><div className="text-sm text-[#6B5D54]">{group[0].date} · {group.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hours <span className="ml-2 text-xs text-[#A36F45]">Needs details</span></div><button type="button" onClick={() => setSelectedSession(id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#C9445A] hover:bg-[#FFF5F7]">Add description</button></div>)}</div></section>}

    <section aria-labelledby="hour-history-title" className="overflow-hidden rounded-2xl border border-[#F2EDEA] bg-white dark:border-white/10 dark:bg-[#211D1A]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDEA] p-5 dark:border-white/10"><div><h2 id="hour-history-title" className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">My hour history</h2><p className="mt-1 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {entries.reduce((sum, entry) => sum + Number(entry.duration || 0), 0).toFixed(2)} recorded hours</p></div><div className="flex flex-wrap gap-2"><TrackedHoursEditor inline /><button type="button" data-usage-feature="fieldwork" data-usage-action="manual_form_open" onClick={() => setManualOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/15 dark:text-white"><Plus size={16} /> Add hours manually</button></div></div>
      {sorted.length === 0 ? <div className="px-5 py-12 text-center"><FileText size={28} className="mx-auto text-[#C9BDB5]" /><p className="mt-3 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">Your logged hours will appear here. Start the timer or add a past activity.</p></div> : <div className="max-h-[640px] divide-y divide-[#F2EDEA] overflow-y-auto dark:divide-white/10">{sorted.map(entry => <article key={entry.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2 text-sm"><strong className="font-semibold text-[#332C28] dark:text-white">{entry.date}</strong><span className="font-mono text-[#C9445A] dark:text-[#FF8EA0]">{entry.duration.toFixed(2)} hrs</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${timerNeedsDetails(entry) ? 'bg-[#FFF3E0] text-[#8A5D36]' : 'bg-[#FAF8F6] text-[#6B5D54]'}`}>{timerNeedsDetails(entry) ? 'Needs details' : entry.status === 'VERIFIED' ? 'Verified' : entry.status === 'DRAFT' ? 'Draft' : entry.status === 'REJECTED' ? 'Needs review' : 'Pending review'}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-[#4D423C] dark:text-[#E5DDD8]">{entry.notes || 'Activity description still needed.'}</p><p className="mt-2 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">{entry.allocationSession ? `Session ${formatTime(entry.allocationSession.startTime)}–${formatTime(entry.allocationSession.endTime)} · category allocation` : `${formatTime(entry.startTime)}–${formatTime(entry.endTime)}`} · {entry.organizationName || entry.setting || 'Organization not specified'} · {entry.supervisorName || 'Supervisor not specified'}{entry.activityCategory !== 'UNKNOWN' ? ` · ${entry.activityCategory === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}` : ''}</p></div>{timerNeedsDetails(entry) && <button type="button" onClick={() => setSelectedSession(entry.timerSession!.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#C9445A] hover:bg-[#FFF5F7]">Add description</button>}</div><SupervisorReview key={`${entry.id}:${entry.revision || 0}:${entry.updatedAt}`} entry={entry} email={email} enabled={hasSupervisorFeatures} /></article>)}</div>}
    </section>

    <Dialog open={Boolean(selectedSession)} onOpenChange={open => { if (!open) setSelectedSession(''); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FFFCF9] sm:max-w-3xl dark:bg-[#171412]"><DialogHeader><DialogTitle>Add your activity details</DialogTitle><DialogDescription>{selected.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hours recorded{selectedDateCount > 1 ? ` across ${selectedDateCount} dates` : ''}. You can finish later; a reminder will stay in My Hours.</DialogDescription></DialogHeader>{selected.length > 0 && <HourEntryForm key={selectedSession} segments={selected} supervisors={knownSupervisors} organizations={knownOrganizations} onSave={finishDetails} onLater={() => setSelectedSession('')} />}</DialogContent></Dialog>
    <Dialog open={manualOpen} onOpenChange={setManualOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FFFCF9] sm:max-w-3xl dark:bg-[#171412]"><DialogHeader><DialogTitle>Add hours manually</DialogTitle><DialogDescription>Enter a past activity and its description.</DialogDescription></DialogHeader><HourEntryForm supervisors={knownSupervisors} organizations={knownOrganizations} onSave={saveManual} onLater={() => setManualOpen(false)} /></DialogContent></Dialog>
  </div>;
}


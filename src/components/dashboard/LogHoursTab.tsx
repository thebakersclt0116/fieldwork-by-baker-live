import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, CircleX, Clock3, FileText, Play, Plus, Settings2, Square, Upload } from 'lucide-react';
import { Link } from 'react-router';
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
import { entriesForMonth, loggedHoursLabel, loggedMonths } from '@/lib/loggedMonths';
import { monthLabel, summarizeMonth } from '@/lib/monthlyProgress';
import { monthlyRequirements } from '@/lib/monthlyRequirements';

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

export default function LogHoursTab({ month }: { month?: string } = {}) {
  const { user, hasSupervisorFeatures } = useAuth();
  const email = getCurrentUserEmail() || user?.email?.trim().toLowerCase() || '';
  if (!email) return <p className="text-sm text-[#6B5D54]">Sign in to track your hours.</p>;
  return <AccountHours key={email} email={email} hasSupervisorFeatures={hasSupervisorFeatures} month={month} />;
}

function AccountHours({ email, hasSupervisorFeatures, month }: { email: string; hasSupervisorFeatures: boolean; month?: string }) {
  const [timerSupervisor, setTimerSupervisor] = useState('');
  const [timerOrganization, setTimerOrganization] = useState('');
  const [journal, setJournal] = useState<TimerJournal>(emptyJournal);
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [now, setNow] = useState(Date.now);
  const [selectedSession, setSelectedSession] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [timerDetailsOpen, setTimerDetailsOpen] = useState(false);
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
    if (!timerSupervisor.trim() || !timerOrganization.trim()) {
      setTimerDetailsOpen(true);
      return;
    }
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      if (!timerSupervisor.trim() || !timerOrganization.trim()) throw new Error('Choose a supervisor and organization before starting the timer.');
      await withTimerLock(email, () => startTimerSession(email, Date.now(), { supervisor: timerSupervisor.trim(), organization: timerOrganization.trim() }));
      setTimerDetailsOpen(false); refresh();
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
  const months = useMemo(() => loggedMonths(entries), [entries]);
  const sorted = useMemo(() => month ? entriesForMonth(entries, month) : [], [entries, month]);
  const monthSummary = useMemo(() => month ? summarizeMonth(entries, month) : null, [entries, month]);
  const requirements = useMemo(() => month ? monthlyRequirements(entries, month) : null, [entries, month]);
  const incompleteCount = monthSummary ? sorted.length - monthSummary.sessions.length : 0;
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

  return <div className="space-y-5">
    <datalist id="timer-supervisors">{knownSupervisors.map(name => <option key={name} value={name} />)}</datalist>
    <datalist id="timer-organizations">{knownOrganizations.map(name => <option key={name} value={name} />)}</datalist>

    {!month && <>
      <section aria-labelledby="hours-timer-title" className="rounded-xl border border-[#D8C9B3] bg-[#FBF8F1] px-4 py-3 dark:border-white/15 dark:bg-[#222A20] sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
            <h2 id="hours-timer-title" className="flex items-center gap-2 font-semibold text-[#333B2F] dark:text-[#F5F1E8]"><Clock3 size={20} className="text-[#4C5D46] dark:text-[#B6BCA4]" />Fieldwork timer</h2>
            <output aria-label="Elapsed time" className="font-mono text-3xl font-semibold tabular-nums text-[#333B2F] dark:text-[#F5F1E8]">{timerLabel(seconds)}</output>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setTimerDetailsOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#6B513E] hover:bg-[#E8E9DA] dark:text-[#D8C9B3] dark:hover:bg-white/5"><Settings2 size={16} />Session details</button>
            {journal.running ? <button type="button" disabled={busy} onClick={() => void stop()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4C5D46] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] hover:bg-[#3E4E38] disabled:opacity-50"><Square size={16} />Stop &amp; log</button> : <button type="button" disabled={busy} onClick={() => void start()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4C5D46] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] hover:bg-[#3E4E38] disabled:opacity-50"><Play size={16} />Start timer</button>}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-[#655F50] dark:text-[#D8C9B3]">{journal.running ? 'Timer running. You can leave this page and return here to stop it.' : 'Choose your supervisor and organization when you start. Your timer is kept on this device.'}</p>
      </section>

      <button type="button" data-usage-feature="fieldwork" data-usage-action="manual_form_open" onClick={() => setManualOpen(true)} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-[#4C5D46] px-5 py-5 text-lg font-bold text-[#F5F1E8] transition-colors hover:bg-[#3E4E38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4C5D46]"><Plus size={23} aria-hidden="true" />Add hours manually</button>

      <section aria-labelledby="hour-history-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to="/import" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#6B513E] px-4 py-2 text-sm font-semibold text-[#6B513E] hover:bg-[#E8E9DA] dark:border-[#D8C9B3] dark:text-[#D8C9B3] dark:hover:bg-white/5"><Upload size={16} aria-hidden="true" />Import hours</Link>
            <h2 id="hour-history-title" className="text-xl font-bold text-[#333B2F] dark:text-[#F5F1E8] sm:text-2xl">My hours (by month)</h2>
          </div>
          {months.length > 1 && <span className="text-sm text-[#655F50] dark:text-[#D8C9B3]">Most recent first</span>}
        </div>
        {months.length === 0 ? <div className="rounded-xl border border-[#D8C9B3] bg-[#FBF8F1] px-5 py-10 text-center dark:border-white/15 dark:bg-[#222A20]"><FileText size={28} className="mx-auto text-[#6B513E] dark:text-[#D8C9B3]" /><p className="mt-3 text-sm text-[#655F50] dark:text-[#D8C9B3]">Your months will appear here after you log or import hours.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {months.map(group => <Link key={group.month} to={'/dashboard/' + group.month} className="flex min-h-32 items-center justify-between gap-4 rounded-xl bg-[#4C5D46] px-6 py-5 text-[#F5F1E8] transition-colors hover:bg-[#3E4E38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4C5D46]">
            <span className="min-w-0"><strong className="block text-2xl font-bold leading-tight">{monthLabel(group.month)}</strong><span className="mt-2 block text-base font-normal">{loggedHoursLabel(group.totalHours)} hours logged</span><MonthStatus status={monthlyRequirements(entries, group.month).status} />{group.incompleteCount > 0 && <span className="mt-2 block text-xs font-normal">{group.incompleteCount} {group.incompleteCount === 1 ? 'entry needs' : 'entries need'} details</span>}</span><ArrowUpRight size={23} className="shrink-0" aria-hidden="true" />
          </Link>)}
        </div>}
      </section>
    </>}

    {month && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"><section aria-labelledby="month-entries-title" className="overflow-hidden rounded-xl border border-[#D8C9B3] bg-[#FBF8F1] dark:border-white/15 dark:bg-[#222A20]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8C9B3] p-5 dark:border-white/15">
        <div><h2 id="month-entries-title" className="text-xl font-bold text-[#333B2F] dark:text-[#F5F1E8]">{loggedHoursLabel(monthSummary?.totalHours || 0)} hours logged</h2><p className="mt-1 text-sm text-[#655F50] dark:text-[#D8C9B3]">{sorted.length} {sorted.length === 1 ? 'entry' : 'entries'} in {monthLabel(month)}{incompleteCount > 0 ? ' · ' + incompleteCount + (incompleteCount === 1 ? ' entry needs details' : ' entries need details') : ''}</p></div>
        <button type="button" onClick={() => setManualOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4C5D46] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] hover:bg-[#3E4E38]"><Plus size={17} />Add hours manually</button>
      </div>
      {incompleteCount > 0 && <p className="border-b border-[#D8C9B3] bg-[#E8E9DA] px-5 py-3 text-sm text-[#333B2F] dark:border-white/15 dark:bg-[#303A2A] dark:text-[#F5F1E8]">Draft entries are listed below. Finish their activity details to include them in your logged total and monthly verification.</p>}
      {sorted.length === 0 ? <div className="px-5 py-12 text-center"><FileText size={28} className="mx-auto text-[#6B513E] dark:text-[#D8C9B3]" /><p className="mt-3 text-sm text-[#655F50] dark:text-[#D8C9B3]">No entries are saved for {monthLabel(month)}.</p><Link to="/dashboard" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#4C5D46] underline dark:text-[#B6BCA4]">Choose another month</Link></div> : <div className="divide-y divide-[#D8C9B3] dark:divide-white/15">
        {sorted.map(entry => <article key={entry.id} aria-label={'Entry on ' + entry.date} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm"><strong className="font-bold text-[#333B2F] dark:text-[#F5F1E8]">{entry.date}</strong><span className="font-mono font-medium text-[#4C5D46] dark:text-[#B6BCA4]">{loggedHoursLabel(entry.duration)} hours</span><span className="rounded-full bg-[#E8E9DA] px-2 py-1 text-xs font-medium text-[#333B2F] dark:bg-[#303A2A] dark:text-[#F5F1E8]">{timerNeedsDetails(entry) ? 'Needs details' : entry.status === 'VERIFIED' ? 'Verified' : entry.status === 'DRAFT' ? 'Draft' : entry.status === 'REJECTED' ? 'Needs review' : 'Pending review'}</span></div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#333B2F] dark:text-[#F5F1E8]">{entry.notes || 'Activity description still needed.'}</p>
              <p className="mt-2 text-xs leading-5 text-[#655F50] dark:text-[#D8C9B3]">{entry.allocationSession ? 'Session ' + formatTime(entry.allocationSession.startTime) + '–' + formatTime(entry.allocationSession.endTime) + ' · category allocation' : formatTime(entry.startTime) + '–' + formatTime(entry.endTime)} · {entry.organizationName || entry.setting || 'Organization not specified'} · {entry.supervisorName || 'Supervisor not specified'}{entry.activityCategory !== 'UNKNOWN' ? ' · ' + (entry.activityCategory === 'RESTRICTED' ? 'Restricted' : 'Unrestricted') : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {timerNeedsDetails(entry) && <button type="button" onClick={() => setSelectedSession(entry.timerSession!.id)} className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-[#6B513E] underline dark:text-[#D8C9B3]">Add description</button>}
              <TrackedHoursEditor inline entryId={entry.id} />
            </div>
          </div>
          <SupervisorReview key={entry.id + ':' + (entry.revision || 0) + ':' + entry.updatedAt} entry={entry} email={email} enabled={hasSupervisorFeatures} />
        </article>)}
      </div>}
    </section>
      {requirements && <aside className="rounded-xl border border-[#C9CFBD] bg-[#FBF8F1] shadow-sm dark:border-[#58664B] dark:bg-[#222A20] lg:sticky lg:top-5" aria-label="Monthly requirements checklist">
        <button type="button" onClick={() => setRequirementsOpen(value => !value)} className="flex w-full items-center justify-between gap-2 rounded-t-xl px-4 py-4 text-left font-semibold text-[#333B2F] dark:text-[#F5F1E8]" aria-expanded={requirementsOpen}>
          <span>Monthly Requirements Checklist</span><span className="text-sm">{requirementsOpen ? 'Hide' : 'Show'}</span>
        </button>
        {requirementsOpen && <div className="space-y-4 border-t border-[#C9CFBD] p-4 dark:border-[#58664B]">
          <div><p className="font-semibold text-[#333B2F] dark:text-[#F5F1E8]">{monthLabel(month)}</p><p className="mt-1 text-xs text-[#655F50] dark:text-[#D8C9B3]">2027 BCBA · {requirements.concentrated ? 'Concentrated supervised fieldwork' : 'Supervised fieldwork'}</p><p className="mt-2 text-sm text-[#655F50] dark:text-[#D8C9B3]">{requirements.totalHours.toFixed(3)} hours logged</p></div>
          <MonthStatus status={requirements.status} />
          {requirements.items.map(item => <div key={item.label} className="flex items-start gap-2 border-t border-[#E1E6D8] pt-3 dark:border-[#58664B]">
            {item.met ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-green-700 dark:text-green-400" /> : <CircleX size={19} className="mt-0.5 shrink-0 text-red-700 dark:text-red-400" />}
            <div className={item.met ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}><p className="text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs">{item.detail}</p></div>
          </div>)}
          <p className="border-t border-[#C9CFBD] pt-3 text-xs leading-5 text-[#655F50] dark:border-[#58664B] dark:text-[#D8C9B3]">Based on entered hours and the 2027 BCBA monthly numeric criteria. Supervision minimums increase when more hours are logged. Unrestricted hours are evaluated over the full fieldwork period. This checklist does not replace supervisor review or signed BACB verification.</p>
        </div>}
      </aside>}
    </div>}

    {message && <div role="status" className="flex gap-2 rounded-xl border border-[#D8C9B3] bg-[#FBF8F1] p-4 text-sm text-[#655F50] dark:border-white/15 dark:bg-[#222A20] dark:text-[#D8C9B3]"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{message}</div>}
    {managedEmail() && savingState === 'blocked' && <p role="alert" className="rounded-xl bg-[#FFF3E0] p-4 text-sm text-[#8A5D36]">Cloud saving needs review. Your local timer and entry drafts are retained. Use the saving controls to review your backup before continuing.</p>}

    {!month && pendingSessions.size > 0 && <section aria-labelledby="timer-reminders-title" className="rounded-xl border border-[#D8C9B3] bg-[#FBF8F1] p-5 dark:border-white/15 dark:bg-[#222A20]">
      <h2 id="timer-reminders-title" className="flex items-center gap-2 font-semibold text-[#6B513E] dark:text-[#D8C9B3]"><AlertCircle size={18} />Finish your activity details</h2><p className="mt-1 text-sm text-[#655F50] dark:text-[#D8C9B3]">Your time is recorded. These entries need their activity details before they count toward logged hours and monthly verification.</p>
      <div className="mt-4 space-y-2">{[...pendingSessions].map(([id, group]) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F5F1E8] p-3 dark:bg-[#171C16]"><div className="text-sm text-[#655F50] dark:text-[#D8C9B3]">{group[0].date} · {loggedHoursLabel(group.reduce((sum, entry) => sum + entry.duration, 0))} hours <span className="ml-2 text-xs">Needs details</span></div><button type="button" onClick={() => setSelectedSession(id)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-[#4C5D46] underline dark:text-[#B6BCA4]">Add description</button></div>)}</div>
    </section>}

    <Dialog open={timerDetailsOpen} onOpenChange={setTimerDetailsOpen}>
      <DialogContent className="rounded-2xl bg-[#FBF8F1] sm:max-w-lg dark:bg-[#222A20]">
        <DialogHeader><DialogTitle>{journal.running ? 'Your current session' : 'Start your session'}</DialogTitle><DialogDescription>{journal.running ? 'The supervisor and organization are saved with this running timer.' : 'Choose your supervisor and organization before starting the timer.'}</DialogDescription></DialogHeader>
        <fieldset disabled={Boolean(journal.running)} className="grid gap-4">
          <label className="text-sm text-[#655F50] dark:text-[#D8C9B3]">Supervisor<input list="timer-supervisors" value={journal.running?.context?.supervisor || timerSupervisor} onChange={event => setTimerSupervisor(event.target.value)} placeholder="Select or enter supervisor" className="field-input" /></label>
          <label className="text-sm text-[#655F50] dark:text-[#D8C9B3]">Organization<input list="timer-organizations" value={journal.running?.context?.organization || timerOrganization} onChange={event => setTimerOrganization(event.target.value)} placeholder="Select or enter organization" className="field-input" /></label>
          <label className="text-sm text-[#655F50] dark:text-[#D8C9B3]">Date<input type="date" value={localDate(journal.running?.startedAt || now)} readOnly className="field-input" /></label>
        </fieldset>
        {!journal.running && <button type="button" disabled={busy || !timerSupervisor.trim() || !timerOrganization.trim()} onClick={() => void start()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4C5D46] px-4 py-3 font-semibold text-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-40"><Play size={16} />Start timer</button>}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedSession)} onOpenChange={open => { if (!open) setSelectedSession(''); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FBF8F1] sm:max-w-3xl dark:bg-[#222A20]"><DialogHeader><DialogTitle>Add your activity details</DialogTitle><DialogDescription>{loggedHoursLabel(selected.reduce((sum, entry) => sum + entry.duration, 0))} hours recorded{selectedDateCount > 1 ? ' across ' + selectedDateCount + ' dates' : ''}. You can finish later; a reminder will stay in My Hours.</DialogDescription></DialogHeader>{selected.length > 0 && <HourEntryForm key={selectedSession} segments={selected} supervisors={knownSupervisors} organizations={knownOrganizations} onSave={finishDetails} onLater={() => setSelectedSession('')} />}</DialogContent></Dialog>
    <Dialog open={manualOpen} onOpenChange={setManualOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FBF8F1] sm:max-w-3xl dark:bg-[#222A20]"><DialogHeader><DialogTitle>Add hours manually</DialogTitle><DialogDescription>Enter a past activity and its description.</DialogDescription></DialogHeader><HourEntryForm initialDate={month && month !== localDate(Date.now()).slice(0, 7) ? `${month}-01` : undefined} supervisors={knownSupervisors} organizations={knownOrganizations} onSave={saveManual} onLater={() => setManualOpen(false)} /></DialogContent></Dialog>
  </div>;
}

function MonthStatus({ status }: { status: 'Meeting Monthly Requirements' | 'Not Meeting Monthly Requirements' | 'Not Started' }) {
  const met = status === 'Meeting Monthly Requirements';
  const notStarted = status === 'Not Started';
  return <span className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${met ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : notStarted ? 'bg-white/20 text-inherit dark:bg-white/10' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
    {met ? <CheckCircle2 size={15} /> : notStarted ? <Clock3 size={15} /> : <CircleX size={15} />}{status}
  </span>;
}

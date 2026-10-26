import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Play, Plus, Square } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { HourEntry } from '@/types';
import TimeInput from '@/components/TimeInput';
import TrackedHoursEditor from '@/components/TrackedHoursEditor';
import SupervisorReview from './SupervisorReview';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { cloudState, managedEmail, subscribeCloud, waitForCloudSave } from '@/lib/cloudWorkspace';
import {
  acknowledgeTimerDetails, completeTimerDetails, elapsedTimerSeconds, localDate, readTimerJournal,
  restoreTimerEntries, startTimerSession, stopTimerSession, supervisionForDetails, timerNeedsDetails,
} from '@/lib/fieldworkTimer';
import type { TimerDetails, TimerJournal } from '@/lib/fieldworkTimer';
import { formatTime } from '@/lib/timeDisplay';

const inputClass = 'mt-1.5 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-2 focus:ring-[#E85D70]/15 dark:border-white/15 dark:bg-[#211D1A] dark:text-white';
const emptyJournal: TimerJournal = { version: 1, running: null, stopped: [] };
const emptyDetails: TimerDetails = { notes: '', category: 'UNRESTRICTED', fieldworkType: 'SUPERVISED', organization: '', supervisor: '', setting: '', presence: 'INDEPENDENT', supervisionMinutes: 0, observationMinutes: 0, supervisionFormat: 'INDIVIDUAL', observationMode: 'IN_PERSON' };
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
    try { await withTimerLock(email, () => startTimerSession(email)); refresh(); }
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

  const finishDetails = async (details: TimerDetails) => {
    completeTimerDetails(email, selectedSession, details);
    entriesChanged(); refresh();
    if (managedEmail()) await waitForCloudSave();
    acknowledgeTimerDetails(email, selectedSession);
    setSelectedSession(''); refresh();
    setMessage(managedEmail() ? 'Activity details and hours saved to your account.' : 'Activity details and hours saved on this device.');
  };
  const saveManual = async (details: TimerDetails, date: string, startTime: string, endTime: string) => {
    const duration = hoursBetween(startTime, endTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || duration <= 0) throw new Error('Choose a date and an end time after the start time.');
    if (getCurrentUserEmail() !== email) throw new Error('Your account changed. Sign in again before saving.');
    const timestamp = new Date().toISOString();
    const entry: HourEntry = {
      id: newId('manual'), userId: email, date, startTime, endTime, duration,
      fieldworkType: details.fieldworkType, activityType: details.category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER',
      activityCategory: details.category, supervisorId: `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      supervisorName: details.supervisor.trim(), organizationName: details.organization.trim(), setting: details.setting.trim(),
      notes: details.notes.trim(), workPresence: details.presence, status: 'PENDING', createdAt: timestamp, updatedAt: timestamp,
      ...supervisionForDetails(details, '', duration),
    };
    addEntry(entry, email); entriesChanged(); refresh();
    // Close after the local queue accepts the entry so a slow connection cannot cause a duplicate manual submission.
    setManualOpen(false);
    if (managedEmail()) await waitForCloudSave();
    setMessage(managedEmail() ? 'Hours saved to your account.' : 'Hours saved on this device.');
  };

  return <div className="space-y-6">
    <section aria-labelledby="hours-timer-title" className="rounded-2xl border border-[#F2EDEA] bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-[#211D1A]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="hours-timer-title" className="flex items-center gap-2 font-semibold text-[#332C28] dark:text-white"><Clock3 size={20} className="text-[#E85D70]" /> Fieldwork timer</h2><p className="mt-1 max-w-md text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Start when you begin. Stop to log your time and add what you worked on.</p></div>
        <div className="flex flex-wrap items-center gap-4"><output aria-label="Elapsed time" className="font-mono text-3xl tabular-nums text-[#332C28] dark:text-white">{timerLabel(seconds)}</output>{journal.running ? <button type="button" disabled={busy} onClick={() => void stop()} className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Square size={16} /> Stop & log</button> : <button type="button" disabled={busy} onClick={() => void start()} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Play size={16} /> Start timer</button>}</div>
      </div>
      <p className="mt-4 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">{journal.running ? 'Timer running. It continues if you leave this page or close this browser. Return here to stop it.' : 'Your timer is kept on this device. Stopped hours stay marked “Needs details” until you finish the activity description.'}</p>
    </section>

    {message && <div role="status" className="flex gap-2 rounded-xl border border-[#E2DAD5] bg-white p-4 text-sm text-[#6B5D54] dark:border-white/15 dark:bg-[#211D1A] dark:text-[#CFC4BE]"><CheckCircle2 size={17} className="shrink-0 mt-0.5" />{message}</div>}
    {managedEmail() && savingState === 'blocked' && <p role="alert" className="rounded-xl bg-[#FFF3E0] p-4 text-sm text-[#8A5D36]">Cloud saving needs review. Your local timer and entry drafts are retained. Use the saving controls to review your backup before continuing.</p>}

    {pendingSessions.size > 0 && <section aria-labelledby="timer-reminders-title" className="rounded-2xl border border-[#E8C39F] bg-[#FFF8F3] p-5"><h2 id="timer-reminders-title" className="flex items-center gap-2 font-semibold text-[#8A5D36]"><AlertCircle size={18} /> Finish your activity details</h2><p className="mt-1 text-sm text-[#8A5D36]">Your time is recorded. These entries need a description and details before they are ready for monthly verification.</p><div className="mt-4 space-y-2">{[...pendingSessions].map(([id, group]) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><div className="text-sm text-[#6B5D54]">{group[0].date} · {group.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hours <span className="ml-2 text-xs text-[#A36F45]">Needs details</span></div><button type="button" onClick={() => setSelectedSession(id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#C9445A] hover:bg-[#FFF5F7]">Add description</button></div>)}</div></section>}

    <section aria-labelledby="hour-history-title" className="overflow-hidden rounded-2xl border border-[#F2EDEA] bg-white dark:border-white/10 dark:bg-[#211D1A]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDEA] p-5 dark:border-white/10"><div><h2 id="hour-history-title" className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">My hour history</h2><p className="mt-1 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {entries.reduce((sum, entry) => sum + Number(entry.duration || 0), 0).toFixed(2)} recorded hours</p></div><div className="flex flex-wrap gap-2"><TrackedHoursEditor inline /><button type="button" data-usage-feature="fieldwork" data-usage-action="manual_form_open" onClick={() => setManualOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/15 dark:text-white"><Plus size={16} /> Add hours manually</button></div></div>
      {sorted.length === 0 ? <div className="px-5 py-12 text-center"><FileText size={28} className="mx-auto text-[#C9BDB5]" /><p className="mt-3 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">Your logged hours will appear here. Start the timer or add a past activity.</p></div> : <div className="max-h-[640px] divide-y divide-[#F2EDEA] overflow-y-auto dark:divide-white/10">{sorted.map(entry => <article key={entry.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2 text-sm"><strong className="font-semibold text-[#332C28] dark:text-white">{entry.date}</strong><span className="font-mono text-[#C9445A] dark:text-[#FF8EA0]">{entry.duration.toFixed(2)} hrs</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${timerNeedsDetails(entry) ? 'bg-[#FFF3E0] text-[#8A5D36]' : 'bg-[#FAF8F6] text-[#6B5D54]'}`}>{timerNeedsDetails(entry) ? 'Needs details' : entry.status === 'VERIFIED' ? 'Verified' : entry.status === 'DRAFT' ? 'Draft' : entry.status === 'REJECTED' ? 'Needs review' : 'Pending review'}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-[#4D423C] dark:text-[#E5DDD8]">{entry.notes || 'Activity description still needed.'}</p><p className="mt-2 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">{formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {entry.organizationName || entry.setting || 'Organization not specified'} · {entry.supervisorName || 'Supervisor not specified'}{entry.activityCategory !== 'UNKNOWN' ? ` · ${entry.activityCategory === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}` : ''}</p></div>{timerNeedsDetails(entry) && <button type="button" onClick={() => setSelectedSession(entry.timerSession!.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#C9445A] hover:bg-[#FFF5F7]">Add description</button>}</div><SupervisorReview key={`${entry.id}:${entry.revision || 0}:${entry.updatedAt}`} entry={entry} email={email} enabled={hasSupervisorFeatures} /></article>)}</div>}
    </section>

    <Dialog open={Boolean(selectedSession)} onOpenChange={open => { if (!open) setSelectedSession(''); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FFFCF9] sm:max-w-2xl dark:bg-[#171412]"><DialogHeader><DialogTitle>Add your activity details</DialogTitle><DialogDescription>{selected.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hours recorded{selectedDateCount > 1 ? ` across ${selectedDateCount} dates` : ''}. You can finish later; a reminder will stay in My Hours.</DialogDescription></DialogHeader>{selected.length > 0 && <DetailsForm key={selectedSession} initial={selected[0]} segments={selected} onSave={finishDetails} onLater={() => setSelectedSession('')} />}</DialogContent></Dialog>
    <Dialog open={manualOpen} onOpenChange={setManualOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FFFCF9] sm:max-w-2xl dark:bg-[#171412]"><DialogHeader><DialogTitle>Add hours manually</DialogTitle><DialogDescription>Enter a past activity and its description.</DialogDescription></DialogHeader><DetailsForm manual onSave={saveManual} onLater={() => setManualOpen(false)} /></DialogContent></Dialog>
  </div>;
}

function DetailsForm({ initial, segments = [], manual = false, onSave, onLater }: { initial?: HourEntry; segments?: HourEntry[]; manual?: boolean; onSave: (details: TimerDetails, date: string, start: string, end: string) => Promise<void>; onLater: () => void }) {
  const [details, setDetails] = useState<TimerDetails>(() => ({ ...emptyDetails, notes: initial?.notes || '', category: initial?.activityCategory === 'RESTRICTED' ? 'RESTRICTED' : 'UNRESTRICTED', fieldworkType: initial?.fieldworkType || 'SUPERVISED', organization: initial?.organizationName || '', supervisor: initial?.supervisorName === 'Not specified' ? '' : initial?.supervisorName || '', setting: initial?.setting || '', presence: initial?.workPresence || 'INDEPENDENT', supervisionMinutes: initial?.supervisionMinutes || 0, observationMinutes: initial?.observationMinutes || 0, supervisionFormat: initial?.supervisionFormat || 'INDIVIDUAL', observationMode: initial?.observationMode || 'IN_PERSON', supervisionByEntry: Object.fromEntries(segments.map(entry => [entry.id, { supervisionMinutes: entry.supervisionMinutes || 0, observationMinutes: entry.observationMinutes || 0 }])) }));
  const [categoryConfirmed, setCategoryConfirmed] = useState(Boolean(initial && initial.activityCategory !== 'UNKNOWN'));
  const [presenceConfirmed, setPresenceConfirmed] = useState(Boolean(initial?.workPresence));
  const [today] = useState(() => localDate(Date.now()));
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const update = <K extends keyof TimerDetails>(key: K, value: TimerDetails[K]) => setDetails(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (!categoryConfirmed || !presenceConfirmed) { setError('Choose the category and whether this work was supervised.'); return; }
    if (!details.notes.trim() || !details.organization.trim() || !details.supervisor.trim()) { setError('Add an activity description, organization, and responsible supervisor.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try { await onSave(details, date, start, end); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <form onSubmit={event => void submit(event)} className="space-y-4">
    {manual && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Date<input required type="date" value={date} max={today} onChange={event => setDate(event.target.value)} className={inputClass} /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Start time<TimeInput label="Start time" value={start} onChange={setStart} className={inputClass} /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">End time<TimeInput label="End time" value={end} onChange={setEnd} className={inputClass} /></label></div>}
    <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Activity description<textarea autoFocus required rows={3} maxLength={10000} value={details.notes} onChange={event => update('notes', event.target.value)} placeholder="Describe what you worked on during this time." className={inputClass} /></label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Organization<input required value={details.organization} onChange={event => update('organization', event.target.value)} className={inputClass} /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Responsible supervisor<input required value={details.supervisor} onChange={event => update('supervisor', event.target.value)} className={inputClass} /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Activity category<select required value={categoryConfirmed ? details.category : ''} onChange={event => { update('category', event.target.value as TimerDetails['category']); setCategoryConfirmed(Boolean(event.target.value)); }} className={inputClass}><option value="" disabled>Choose category</option><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervision during this activity<select required value={presenceConfirmed ? details.presence : ''} onChange={event => { update('presence', event.target.value as TimerDetails['presence']); setPresenceConfirmed(Boolean(event.target.value)); }} className={inputClass}><option value="" disabled>Choose activity type</option><option value="INDEPENDENT">Independent</option><option value="SUPERVISED">Supervised</option></select></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Fieldwork type<select value={details.fieldworkType} onChange={event => update('fieldworkType', event.target.value as TimerDetails['fieldworkType'])} className={inputClass}><option value="SUPERVISED">Supervised fieldwork</option><option value="CONCENTRATED">Concentrated supervised fieldwork</option></select></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Setting / location (optional)<input value={details.setting} onChange={event => update('setting', event.target.value)} className={inputClass} /></label></div>
    {details.presence === 'SUPERVISED' && presenceConfirmed && <div className="space-y-4 rounded-xl border border-[#E2DAD5] p-4 dark:border-white/10"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervision format<select value={details.supervisionFormat} onChange={event => update('supervisionFormat', event.target.value as TimerDetails['supervisionFormat'])} className={inputClass}><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></select></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Observation mode<select value={details.observationMode} onChange={event => update('observationMode', event.target.value as TimerDetails['observationMode'])} className={inputClass}><option value="IN_PERSON">In person</option><option value="ONLINE">Online / video</option><option value="PHONE">Phone</option></select></label></div>{segments.length ? segments.map(entry => <div key={entry.id}><p className="mb-2 text-xs font-semibold text-[#6B5D54] dark:text-[#CFC4BE]">{entry.date} · {formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {(entry.duration * 60).toFixed(1)} recorded minutes</p><SupervisionFields values={details.supervisionByEntry?.[entry.id] || { supervisionMinutes: 0, observationMinutes: 0 }} maximum={entry.duration * 60} onChange={(key, value) => update('supervisionByEntry', { ...details.supervisionByEntry, [entry.id]: { ...(details.supervisionByEntry?.[entry.id] || { supervisionMinutes: 0, observationMinutes: 0 }), [key]: value } })} /></div>) : <SupervisionFields values={details} maximum={hoursBetween(start, end) * 60} onChange={update} />}</div>}
    {error && <p role="alert" className="rounded-xl bg-[#FFF5F7] p-3 text-sm text-[#C9445A]">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-[#E2DAD5] pt-4 dark:border-white/10"><button type="button" onClick={onLater} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#6B5D54] disabled:opacity-50 dark:text-[#CFC4BE]">{manual ? 'Cancel' : 'Finish later'}</button><button disabled={saving} type="submit" className="rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save activity'}</button></div>
  </form>;
}

function SupervisionFields({ values, maximum, onChange }: { values: { supervisionMinutes: number; observationMinutes: number }; maximum: number; onChange: (key: 'supervisionMinutes' | 'observationMinutes', value: number) => void }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Supervision minutes<input required type="number" min="0.01" max={maximum} step="any" value={values.supervisionMinutes} onChange={event => onChange('supervisionMinutes', Number(event.target.value))} className={inputClass} /></label><label className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Client observation minutes<input required type="number" min="0" max={Math.min(maximum, values.supervisionMinutes)} step="any" value={values.observationMinutes} onChange={event => onChange('observationMinutes', Number(event.target.value))} className={inputClass} /></label></div>;
}

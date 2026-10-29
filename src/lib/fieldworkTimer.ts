import type { ActivityCategory, FieldworkType, HourEntry, ObservationMode, SupervisionFormat, WorkPresence } from '../types/index.ts';
import { getCurrentUserEmail, loadEntries, newId, saveEntries } from './fieldworkStore.ts';
import { allocateEntry, type HourEntryFlowDetails } from './hourEntryFlow.ts';

export interface TimerContext { supervisor: string; organization: string }
export interface RunningTimer { id: string; startedAt: number; context?: TimerContext }
export interface StoppedTimer extends RunningTimer { stoppedAt: number; entries: HourEntry[] }
export interface TimerJournal { version: 1; running: RunningTimer | null; stopped: StoppedTimer[] }
export interface TimerDetails {
  notes: string;
  category: Exclude<ActivityCategory, 'UNKNOWN'>;
  fieldworkType: FieldworkType;
  organization: string;
  supervisor: string;
  setting: string;
  presence: WorkPresence;
  supervisionMinutes: number;
  observationMinutes: number;
  supervisionFormat: SupervisionFormat;
  observationMode: ObservationMode;
  supervisionByEntry?: Record<string, { supervisionMinutes: number; observationMinutes: number }>;
}

const PREFIX = 'fieldworkByBaker:timer:v1:';
function accountKey(email: string) {
  if (!email || getCurrentUserEmail() !== email.trim().toLowerCase()) throw new Error('Your account changed. Sign in again before using the timer.');
  return PREFIX + encodeURIComponent(email.trim().toLowerCase());
}
export function readTimerJournal(email: string): TimerJournal {
  const raw = localStorage.getItem(accountKey(email));
  if (!raw) return { version: 1, running: null, stopped: [] };
  const journal = JSON.parse(raw) as TimerJournal;
  if (journal.version !== 1 || !Array.isArray(journal.stopped) || (journal.running && (!journal.running.id || !Number.isFinite(journal.running.startedAt)))) {
    throw new Error('The saved timer needs review. Its browser copy has been preserved.');
  }
  if (journal.stopped.some(session => !session.id || !Array.isArray(session.entries) || !Number.isFinite(session.startedAt) || !Number.isFinite(session.stoppedAt))) {
    throw new Error('The saved timer needs review. Its browser copy has been preserved.');
  }
  return journal;
}
function writeJournal(email: string, journal: TimerJournal) {
  localStorage.setItem(accountKey(email), JSON.stringify(journal));
}
export function startTimerSession(email: string, now = Date.now(), context?: TimerContext): RunningTimer {
  if (!Number.isFinite(now)) throw new Error('A valid start time is required.');
  const journal = readTimerJournal(email);
  if (journal.running) return journal.running;
  if (context && (!context.supervisor.trim() || !context.organization.trim())) throw new Error('Choose a responsible supervisor and organization before starting the timer.');
  const running = { id: newId('session'), startedAt: now, ...(context ? { context: { supervisor: context.supervisor.trim(), organization: context.organization.trim() } } : {}) };
  writeJournal(email, { ...journal, running });
  return running;
}
export function localDate(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function localTime(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
// Split at local midnight so each day retains its exact share, including DST days.
export function entriesForTimer(email: string, timer: RunningTimer, stoppedAt: number): HourEntry[] {
  const entries: HourEntry[] = [];
  for (let start = timer.startedAt; start < stoppedAt;) {
    const day = new Date(start);
    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    // The existing workspace permits at most 24 elapsed hours per record. A
    // fall-back daylight-saving day can contain 25, so retain it in two parts.
    const end = Math.min(stoppedAt, midnight, start + 86_400_000);
    const timestamp = new Date(stoppedAt).toISOString();
    entries.push({
      id: `timer_${timer.id}_${entries.length}`, userId: email, date: localDate(start),
      startTime: localTime(start), endTime: localTime(end), duration: (end - start) / 3_600_000,
      fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN',
      supervisorId: timer.context ? `manual_${timer.context.supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'not_specified',
      supervisorName: timer.context?.supervisor || 'Not specified', organizationName: timer.context?.organization, setting: '',
      status: 'DRAFT', createdAt: timestamp, updatedAt: timestamp,
      timerSession: { id: timer.id, startedAt: new Date(start).toISOString(), stoppedAt: new Date(end).toISOString(), detailsComplete: false },
    });
    start = end;
  }
  return entries;
}
export function stopTimerSession(email: string, now = Date.now()): StoppedTimer | null {
  const journal = readTimerJournal(email);
  if (!journal.running) return null;
  if (!Number.isFinite(now) || now < journal.running.startedAt) throw new Error('The device clock changed. Correct it before stopping the timer.');
  const session: StoppedTimer = { ...journal.running, stoppedAt: now, entries: entriesForTimer(email, journal.running, now) };
  // Commit the recovery copy before attempting the normal entry/cloud save.
  writeJournal(email, { ...journal, running: null, stopped: session.entries.length ? [...journal.stopped, session] : journal.stopped });
  return session.entries.length ? session : null;
}
export function restoreTimerEntries(email: string): HourEntry[] {
  const journal = readTimerJournal(email);
  const current = loadEntries(email);
  const snapshots = [...new Map(journal.stopped.flatMap(session => session.entries).map(entry => [entry.id, entry])).values()];
  const completedAllocations = snapshots.filter(entry => entry.timerSession?.detailsComplete && entry.allocationSession);
  // A saved allocation replaces its source draft. If the browser write failed
  // after journaling, recovering both would otherwise count the same time twice.
  const replacedSources = new Set(completedAllocations.filter(snapshot => !current.some(entry => entry.id === snapshot.allocationSession!.sourceEntryId && isReviewed(entry))).map(snapshot => timerSourceKey(snapshot)));
  const blockedSources = new Set(completedAllocations.filter(snapshot => current.some(entry => entry.id === snapshot.allocationSession!.sourceEntryId && isReviewed(entry))).map(snapshot => timerSourceKey(snapshot)));
  const retained = current.filter(entry => !(entry.status === 'DRAFT' && !entry.timerSession?.detailsComplete && replacedSources.has(timerSourceKey(entry)) && !snapshots.some(snapshot => snapshot.id === entry.id)));
  const ids = new Set(retained.map(entry => entry.id));
  const completedSources = new Set(retained.filter(entry => entry.timerSession?.detailsComplete).map(timerSourceKey));
  const missing = snapshots.filter(entry => !ids.has(entry.id) && !blockedSources.has(timerSourceKey(entry)) && (entry.timerSession?.detailsComplete || !completedSources.has(timerSourceKey(entry))));
  const recoveredDetails = new Map(snapshots.filter(entry => entry.timerSession?.detailsComplete && !blockedSources.has(timerSourceKey(entry))).map(entry => [entry.id, entry]));
  let changed = missing.length > 0 || retained.length !== current.length;
  const recovered = retained.map(entry => {
    const snapshot = recoveredDetails.get(entry.id);
    if (snapshot && entry.status === 'DRAFT' && !entry.timerSession?.detailsComplete && !isReviewed(entry)) { changed = true; return snapshot; }
    return entry;
  });
  if (changed) saveEntries([...recovered, ...missing].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)), email);
  return loadEntries(email);
}
function timerSourceKey(entry: HourEntry): string {
  return `${entry.timerSession?.id || ''}:${entry.allocationSession?.sourceEntryId || entry.id}`;
}
function isReviewed(entry: HourEntry): boolean {
  return entry.status === 'VERIFIED' || Boolean(entry.requiresReapproval || entry.lastApprovedAt || entry.lastApprovalRevision !== undefined);
}
export function supervisionForDetails(details: TimerDetails, entryId: string, duration: number) {
  if (details.presence === 'INDEPENDENT') return { supervisionMinutes: 0, observationMinutes: 0, individualSupervisionMinutes: 0, supervisionFormat: undefined, observationMode: undefined };
  const minutes = details.supervisionByEntry?.[entryId] || details;
  if (!Number.isFinite(minutes.supervisionMinutes) || !Number.isFinite(minutes.observationMinutes) || minutes.supervisionMinutes <= 0 || minutes.observationMinutes < 0 || minutes.supervisionMinutes > duration * 60 + 0.000001 || minutes.observationMinutes > minutes.supervisionMinutes) {
    throw new Error('For each supervised entry, enter positive supervision minutes within its recorded time. Observation minutes cannot exceed supervision minutes.');
  }
  if (!['INDIVIDUAL', 'GROUP'].includes(details.supervisionFormat)) throw new Error('Choose the supervision format.');
  return {
    supervisionMinutes: minutes.supervisionMinutes, observationMinutes: minutes.observationMinutes,
    individualSupervisionMinutes: details.supervisionFormat === 'INDIVIDUAL' ? minutes.supervisionMinutes : 0,
    supervisionFormat: details.supervisionFormat, observationMode: minutes.observationMinutes > 0 ? details.observationMode : undefined,
  };
}
export function completeTimerDetails(email: string, sessionId: string, details: TimerDetails): HourEntry[] {
  if (!details.notes.trim() || !details.organization.trim() || !details.supervisor.trim()) throw new Error('Add an activity description, organization, and responsible supervisor.');
  if (!['RESTRICTED', 'UNRESTRICTED'].includes(details.category) || !['INDEPENDENT', 'SUPERVISED'].includes(details.presence)) throw new Error('Choose the category and whether this work was supervised.');
  const journal = readTimerJournal(email);
  const session = journal.stopped.find(item => item.id === sessionId);
  const current = loadEntries(email);
  const targets = current.filter(entry => entry.timerSession?.id === sessionId);
  if (!targets.length && !session) throw new Error('This timer entry is no longer available.');
  if (targets.some(isReviewed)) throw new Error('Use the tracked-hours editor to change an approved entry.');
  const sourceEntries = new Map((session?.entries || []).map(entry => [entry.id, entry]));
  for (const entry of targets) sourceEntries.set(entry.id, entry);
  if (sourceEntries.size > 1 && details.presence === 'SUPERVISED' && [...sourceEntries.keys()].some(id => !details.supervisionByEntry?.[id])) throw new Error('Enter supervision and observation minutes separately for each recorded date.');
  const snapshots = [...sourceEntries.values()].map(entry => ({
    ...entry, notes: details.notes.trim(), organizationName: details.organization.trim(), supervisorName: details.supervisor.trim(),
    supervisorId: `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    setting: details.setting.trim(), fieldworkType: details.fieldworkType, activityCategory: details.category,
    activityType: details.category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' as const : 'UNRESTRICTED_OTHER' as const,
    workPresence: details.presence, status: 'PENDING' as const, updatedAt: new Date().toISOString(),
    ...supervisionForDetails(details, entry.id, entry.duration),
    timerSession: { ...entry.timerSession!, detailsComplete: true },
  }));
  // Retain completed descriptions too until the existing cloud queue confirms success.
  if (session) writeJournal(email, { ...journal, stopped: journal.stopped.map(item => item.id === sessionId ? { ...item, entries: snapshots } : item) });
  const replacements = new Map(snapshots.map(entry => [entry.id, entry]));
  const next = current.map(entry => replacements.get(entry.id) || entry);
  for (const entry of snapshots) if (!next.some(item => item.id === entry.id)) next.push(entry);
  saveEntries(next, email);
  return next;
}
export function completeAllocatedTimerDetails(email: string, sessionId: string, detailsByEntry: Record<string, HourEntryFlowDetails>): HourEntry[] {
  const journal = readTimerJournal(email);
  const session = journal.stopped.find(item => item.id === sessionId);
  const current = loadEntries(email);
  const targets = current.filter(entry => entry.timerSession?.id === sessionId);
  if (!targets.length && !session) throw new Error('This timer entry is no longer available.');
  // A retry after a successful journal commit only finishes recovery. It cannot
  // allocate an already apportioned duration a second time or revise approvals.
  if (session?.entries.length && session.entries.every(entry => entry.timerSession?.detailsComplete)) return restoreTimerEntries(email);
  if (!session && targets.length && targets.every(entry => entry.timerSession?.detailsComplete)) return current;
  if (targets.some(isReviewed)) throw new Error('Use the tracked-hours editor to change an approved entry.');
  const sources = new Map((session?.entries || []).map(entry => [entry.id, entry]));
  // The tracked-hours editor may have corrected an unfinished draft since the
  // timer stopped. Its saved range and revision take precedence over the journal.
  for (const entry of targets) sources.set(entry.id, entry);
  if ([...sources.values()].some(entry => entry.timerSession?.detailsComplete || entry.allocationSession)) throw new Error('Use the tracked-hours editor to change completed timer allocations.');
  if (Object.keys(detailsByEntry).length !== sources.size || [...sources.keys()].some(id => !Object.hasOwn(detailsByEntry, id))) throw new Error('Complete the hour allocation separately for each recorded date.');
  // Validate every date before changing the recovery journal or normal storage.
  const snapshots = [...sources.values()].flatMap(entry => allocateEntry(entry, detailsByEntry[entry.id]));
  const snapshotIds = new Set(snapshots.map(entry => entry.id));
  if (current.some(entry => snapshotIds.has(entry.id) && !sources.has(entry.id))) throw new Error('An existing record conflicts with this timer allocation. Use the tracked-hours editor to review it.');
  const recoverySession = session || {
    id: sessionId,
    startedAt: Math.min(...[...sources.values()].map(entry => Date.parse(entry.timerSession!.startedAt))),
    stoppedAt: Math.max(...[...sources.values()].map(entry => Date.parse(entry.timerSession!.stoppedAt))),
    entries: [],
  };
  if (!Number.isFinite(recoverySession.startedAt) || !Number.isFinite(recoverySession.stoppedAt)) throw new Error('The saved timer needs review. Its browser copy has been preserved.');
  const completedSession = { ...recoverySession, entries: snapshots };
  writeJournal(email, { ...journal, stopped: session ? journal.stopped.map(item => item.id === sessionId ? completedSession : item) : [...journal.stopped, completedSession] });
  const next = current.filter(entry => !sources.has(entry.id));
  next.push(...snapshots);
  saveEntries(next, email);
  return loadEntries(email);
}
export function acknowledgeTimerDetails(email: string, sessionId: string): void {
  const current = loadEntries(email);
  const journal = readTimerJournal(email);
  const session = journal.stopped.find(item => item.id === sessionId);
  if (session && session.entries.every(entry => current.some(item => item.id === entry.id && item.timerSession?.detailsComplete && item.notes?.trim()))) {
    writeJournal(email, { ...journal, stopped: journal.stopped.filter(item => item.id !== sessionId) });
  }
}
export function timerNeedsDetails(entry: HourEntry): boolean {
  return Boolean(entry.timerSession && (!entry.timerSession.detailsComplete || !entry.notes?.trim() || entry.status === 'DRAFT'));
}
export function elapsedTimerSeconds(timer: RunningTimer | null, now = Date.now()): number {
  return timer ? Math.max(0, Math.floor((now - timer.startedAt) / 1000)) : 0;
}


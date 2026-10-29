import type { ActivityCategory, FieldworkType, HourEntry, ObservationMode, SupervisionFormat, WorkPresence } from '../types/index.ts';
import { getCurrentUserEmail, loadEntries, newId, saveEntries } from './fieldworkStore.ts';

export interface RunningTimer { id: string; startedAt: number; fieldworkType?: FieldworkType; requirementsSelection?: 'BEFORE_2027' | 'FROM_2027' | 'BOTH' }
export interface StoppedTimer { id: string; startedAt: number; stoppedAt: number; entries: HourEntry[] }
export interface TimerJournal { version: 1; running: RunningTimer | null; stopped: StoppedTimer[] }
export interface TimerDetails {
  notes: string;
  organizationId?: string;
  supervisorId?: string;
  supervisorEmail?: string;
  requirementsSelection?: 'BEFORE_2027' | 'FROM_2027' | 'BOTH';
  fieldworkProfileUpdatedAt?: string;
  clientObservationCount?: number;
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
  supervisionByEntry?: Record<string, { supervisionMinutes: number; observationMinutes: number; clientObservationCount?: number }>;
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
export function startTimerSession(email: string, now = Date.now(), plan?: { fieldworkType: FieldworkType; requirementsSelection: 'BEFORE_2027' | 'FROM_2027' | 'BOTH' }): RunningTimer {
  if (!Number.isFinite(now)) throw new Error('A valid start time is required.');
  const journal = readTimerJournal(email);
  if (journal.running) return journal.running;
  const running: RunningTimer = { id: newId('session'), startedAt: now, ...(plan || {}) };
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
      fieldworkType: timer.fieldworkType || 'SUPERVISED', requirementsSelection: timer.requirementsSelection, activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN',
      supervisorId: 'not_specified', supervisorName: 'Not specified', setting: '',
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
  const ids = new Set(current.map(entry => entry.id));
  const missing = journal.stopped.flatMap(session => session.entries).filter(entry => !ids.has(entry.id));
  const recoveredDetails = new Map(journal.stopped.flatMap(session => session.entries).filter(entry => entry.timerSession?.detailsComplete).map(entry => [entry.id, entry]));
  let changed = missing.length > 0;
  const recovered = current.map(entry => {
    const snapshot = recoveredDetails.get(entry.id);
    if (snapshot && entry.status === 'DRAFT' && !entry.timerSession?.detailsComplete) { changed = true; return snapshot; }
    return entry;
  });
  if (changed) saveEntries([...recovered, ...missing].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)), email);
  return loadEntries(email);
}
export function supervisionForDetails(details: TimerDetails, entryId: string, duration: number) {
  if (details.presence === 'INDEPENDENT') return { supervisionMinutes: 0, observationMinutes: 0, individualSupervisionMinutes: 0, supervisionFormat: undefined, observationMode: undefined };
  const minutes = details.supervisionByEntry?.[entryId] || details;
  if (minutes.clientObservationCount !== undefined && (!Number.isInteger(minutes.clientObservationCount) || minutes.clientObservationCount < 0 || (minutes.observationMinutes > 0 && minutes.clientObservationCount < 1))) throw new Error('Record the number of client observations; positive minutes need at least one observation.');
  if (!Number.isFinite(minutes.supervisionMinutes) || !Number.isFinite(minutes.observationMinutes) || minutes.supervisionMinutes <= 0 || minutes.observationMinutes < 0 || minutes.supervisionMinutes > duration * 60 + 0.000001 || minutes.observationMinutes > minutes.supervisionMinutes) {
    throw new Error('For each supervised entry, enter positive supervision minutes within its recorded time. Observation minutes cannot exceed supervision minutes.');
  }
  if (!['INDIVIDUAL', 'GROUP'].includes(details.supervisionFormat)) throw new Error('Choose the supervision format.');
  return {
    supervisionMinutes: minutes.supervisionMinutes, observationMinutes: minutes.observationMinutes, clientObservationCount: minutes.clientObservationCount,
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
  if (targets.some(entry => entry.status === 'VERIFIED' || entry.requiresReapproval)) throw new Error('Use the tracked-hours editor to change an approved entry.');
  const sourceEntries = new Map((session?.entries || []).map(entry => [entry.id, entry]));
  for (const entry of targets) sourceEntries.set(entry.id, entry);
  if (sourceEntries.size > 1 && details.presence === 'SUPERVISED' && [...sourceEntries.keys()].some(id => !details.supervisionByEntry?.[id])) throw new Error('Enter supervision and observation minutes separately for each recorded date.');
  const snapshots = [...sourceEntries.values()].map(entry => ({
    ...entry, notes: details.notes.trim(), organizationName: details.organization.trim(), supervisorName: details.supervisor.trim(),
    supervisorId: details.supervisorId || `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    supervisorEmail: details.supervisorEmail, organizationId: details.organizationId, requirementsSelection: details.requirementsSelection, fieldworkProfileUpdatedAt: details.fieldworkProfileUpdatedAt,
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

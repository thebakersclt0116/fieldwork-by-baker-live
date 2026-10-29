/** Source: BACB's January 2026 transition guide, pages 1–4. This is not a full eligibility audit. */
export const TRANSITION_SOURCE = 'https://www.bacb.com/wp-content/uploads/2025/06/BCBA-2027-Requirements-Transition-260130-a.pdf';
export const FIELDWORK_PROFILE_VERSION = 1;
export const APPLICATION_CUTOFF = '2027-01-01';
export type ApplicationTiming = 'BEFORE_2027' | 'FROM_2027' | 'BOTH';
export type RequirementsYear = '2022' | '2027';
export type FieldworkTrack = 'SUPERVISED' | 'CONCENTRATED';
export type SavedOrganization = { id: string; name: string; active: boolean };
export type SavedSupervisor = { id: string; name: string; email: string; bacbNumber: string; active: boolean };
export type FieldworkSetup = {
  version: 1; applicationTiming: ApplicationTiming; fieldworkType: FieldworkTrack;
  organizations: SavedOrganization[]; supervisors: SavedSupervisor[];
  applicationDateAcknowledged: true; completedAt: string; updatedAt: string;
};
export type FieldworkRule = {
  year: RequirementsYear; type: FieldworkTrack; targetHours: number; supervisionPercent: number;
  minimumMonthlyHours: number; maximumMonthlyHours: number; observationCount: number | null; observationMinutes: number | null;
};
export function ruleFor(year: RequirementsYear, type: FieldworkTrack): FieldworkRule {
  if (!['2022','2027'].includes(year) || !['SUPERVISED','CONCENTRATED'].includes(type)) throw new Error('Choose a requirements year and fieldwork type.');
  const concentrated = type === 'CONCENTRATED';
  return { year, type, targetHours: concentrated ? 1500 : 2000,
    supervisionPercent: concentrated ? year === '2022' ? 10 : 7.5 : 5,
    minimumMonthlyHours: 20, maximumMonthlyHours: year === '2022' ? 130 : 160,
    observationCount: year === '2022' ? 1 : null, observationMinutes: year === '2027' ? concentrated ? 90 : 60 : null };
}
export function yearsFor(timing: ApplicationTiming): RequirementsYear[] {
  if (timing === 'BEFORE_2027') return ['2022'];
  if (timing === 'FROM_2027') return ['2027'];
  if (timing === 'BOTH') return ['2022','2027'];
  throw new Error('Choose when you plan to apply for BCBA certification.');
}
export const trackLabel = (track: FieldworkTrack) => track === 'CONCENTRATED' ? 'Concentrated Supervised Fieldwork' : 'Supervised Fieldwork';
const text = (v: unknown, limit: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= limit;
const identity = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
export function setupError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Complete your fieldwork profile before starting to track hours.';
  const p = value as FieldworkSetup;
  if (p.version !== FIELDWORK_PROFILE_VERSION || !['BEFORE_2027','FROM_2027','BOTH'].includes(p.applicationTiming)) return 'Choose when you plan to submit your certification application.';
  if (!['SUPERVISED','CONCENTRATED'].includes(p.fieldworkType)) return 'Choose your fieldwork type.';
  if (p.applicationDateAcknowledged !== true) return 'Confirm that the application date—not the exam date—determines the requirements.';
  if (!Array.isArray(p.organizations) || !p.organizations.length || p.organizations.length > 200 || !p.organizations.some(o => o && o.active === true)) return 'Add at least one active organization (maximum 200).';
  if (!Array.isArray(p.supervisors) || !p.supervisors.length || p.supervisors.length > 200 || !p.supervisors.some(s => s && s.active === true)) return 'Add at least one active supervisor (maximum 200).';
  const ids = new Set<string>(), names = new Set<string>();
  for (const org of p.organizations) {
    if (!org || !identity(org.id) || ids.has(org.id) || !text(org.name, 200) || typeof org.active !== 'boolean') return 'Each organization needs a valid name and unique ID.';
    ids.add(org.id); const name = org.name.trim().toLowerCase();
    if (org.active && names.has(name)) return 'An active organization with that name is already listed.';
    if (org.active) names.add(name);
  }
  const people = new Set<string>();
  for (const s of p.supervisors) {
    if (!s || !identity(s.id) || ids.has(s.id) || !text(s.name, 200) || typeof s.active !== 'boolean' || typeof s.email !== 'string' || typeof s.bacbNumber !== 'string' || s.bacbNumber.length > 100) return 'Each supervisor needs a valid name and unique ID.';
    if (s.email && (!/^\S+@\S+\.\S+$/.test(s.email) || s.email.length > 254)) return 'Correct the supervisor email address, or leave it blank.';
    ids.add(s.id); const signature = [s.name.trim().toLowerCase(), s.email.toLowerCase(), s.bacbNumber].join('|');
    if (s.active && people.has(signature)) return 'That supervisor is already listed.';
    if (s.active) people.add(signature);
  }
  if (![p.completedAt,p.updatedAt].every(t => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(t) && Number.isFinite(Date.parse(t)))) return 'Save the completed profile before continuing.';
  return null;
}
export function completeSetup(value: unknown): value is FieldworkSetup { return setupError(value) === null; }

// Counts are recorded evidence, not a certification decision. Splits from one source session must not multiply observations.
export type CheckEntry = { id: string; date: string; duration: number; fieldworkType: string; activityCategory: string; status: string; notes?: string;
  organizationName?: string; supervisorName?: string; supervisionMinutes?: number; observationMinutes?: number; clientObservationCount?: number;
  timerSession?: { id: string; detailsComplete: boolean }; migration?: { sourceHash?: string; sourceRow?: number; sourceId?: string } };
export function completeActivity(entry: CheckEntry): boolean {
  return entry.status !== 'DRAFT' && entry.status !== 'REJECTED' && entry.timerSession?.detailsComplete !== false && Boolean(entry.notes?.trim() && entry.organizationName?.trim() && entry.supervisorName?.trim()) && Number.isFinite(entry.duration) && entry.duration > 0;
}
export function summarizeForPlan(entries: CheckEntry[], setup: FieldworkSetup, month: string, organization: string) {
  const usable = entries.filter(completeActivity);
  const selected = usable.filter(e => e.fieldworkType === setup.fieldworkType);
  const scoped = usable.filter(e => e.date.slice(0,7) === month && e.organizationName === organization);
  const sessions = scoped.filter(e => e.fieldworkType === setup.fieldworkType);
  const sum = (items: CheckEntry[], key: 'duration' | 'supervisionMinutes' | 'observationMinutes') => items.reduce((a,e) => a + (Number.isFinite(e[key]) ? e[key]! : 0), 0);
  const total = sum(sessions,'duration'), supervised = sum(sessions,'supervisionMinutes');
  const observed = new Map<string,number>();
  let inferredObservationCounts = false;
  for (const e of sessions) {
    const key = e.timerSession?.id ? `timer:${e.timerSession.id}:${e.date}` : e.migration ? `source:${e.migration.sourceHash}:${e.migration.sourceId || e.migration.sourceRow}` : e.id;
    const explicit = Number.isInteger(e.clientObservationCount) && e.clientObservationCount! >= 0;
    const count = explicit ? e.clientObservationCount! : (e.observationMinutes || 0) > 0 ? 1 : 0;
    if (!explicit && count) inferredObservationCounts = true;
    observed.set(key, Math.max(observed.get(key) || 0, count));
  }
  return { recordedSelectedHours: sum(selected,'duration'), otherTypeHours: sum(usable.filter(e => e.fieldworkType !== setup.fieldworkType),'duration'),
    excludedEntries: entries.length - usable.length, totalHours: total, organizationTotalHours: sum(scoped,'duration'),
    mixedMonth: scoped.some(e => e.fieldworkType !== setup.fieldworkType), supervisionPercent: total ? supervised / (total * 60) * 100 : 0,
    observationMinutes: sum(sessions,'observationMinutes'), observationCount: [...observed.values()].reduce((a,b) => a+b,0), inferredObservationCounts,
    restricted: sum(selected.filter(e => e.activityCategory === 'RESTRICTED'),'duration'), unrestricted: sum(selected.filter(e => e.activityCategory === 'UNRESTRICTED'),'duration'),
    pendingEntries: sessions.filter(e => e.status !== 'VERIFIED').length,
    rules: yearsFor(setup.applicationTiming).map(year => ruleFor(year,setup.fieldworkType)) };
}

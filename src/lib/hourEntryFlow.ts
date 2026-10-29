import type { FieldworkType, HourEntry, ObservationMode, WorkPresence } from '../types/index.ts';

export type AllocationKey = 'restricted' | 'unrestricted' | 'individualRestricted' | 'individualUnrestricted' | 'groupUnrestricted';
export interface HourAllocation {
  key: AllocationKey;
  hours: string;
  observation: 'YES' | 'NO' | '';
  observationMinutes: string;
}
export interface HourEntryFlowDetails {
  presence: WorkPresence;
  format: ObservationMode | '';
  notes: string;
  organization: string;
  supervisor: string;
  setting?: string;
  fieldworkType: FieldworkType;
  allocations: HourAllocation[];
}
export function allottedDecimal(duration: number): string {
  return duration > 0 && duration < 0.01 ? duration.toFixed(6) : duration.toFixed(2);
}
export function allocationKeys(presence: WorkPresence): AllocationKey[] {
  return presence === 'INDEPENDENT' ? ['restricted', 'unrestricted'] : ['individualRestricted', 'individualUnrestricted', 'groupUnrestricted'];
}
export function blankAllocations(presence: WorkPresence): HourAllocation[] {
  return allocationKeys(presence).map(key => ({ key, hours: '', observation: '', observationMinutes: '' }));
}
export function allocateEntry(source: HourEntry, details: HourEntryFlowDetails): HourEntry[] {
  if (!Number.isFinite(source.duration) || source.duration <= 0) throw new Error('Choose a valid start and end time.');
  if (!details.organization.trim() || !details.supervisor.trim() || !details.notes.trim()) throw new Error('Add a responsible supervisor, organization, and activity description.');
  if (!['INDEPENDENT', 'SUPERVISED'].includes(details.presence)) throw new Error('Choose an hour type.');
  if (!['SUPERVISED', 'CONCENTRATED'].includes(details.fieldworkType)) throw new Error('Choose a fieldwork type.');
  if (details.presence === 'SUPERVISED' && !['IN_PERSON', 'ONLINE', 'PHONE'].includes(details.format)) throw new Error('Choose a format type.');
  const allowed = allocationKeys(details.presence);
  const seen = new Set<AllocationKey>();
  const active: Array<HourAllocation & { value: number }> = [];
  for (const item of details.allocations) {
    if (!allowed.includes(item.key) || seen.has(item.key)) throw new Error('Review the hour allocation categories.');
    seen.add(item.key);
    if (item.hours.trim() === '') continue;
    const value = Number(item.hours);
    if (!Number.isFinite(value) || value < 0) throw new Error('Enter positive decimal hours, or leave unused categories blank.');
    if (value > 0) active.push({ ...item, value });
  }
  const total = active.reduce((sum, item) => sum + item.value, 0);
  if (!active.length || Math.abs(total - Number(allottedDecimal(source.duration))) > 0.0000001) throw new Error(`Allocated hours must total ${allottedDecimal(source.duration)} hours.`);
  const timestamp = new Date().toISOString();
  let used = 0;
  return active.map((item, index) => {
    // Reconcile display rounding once. Retain the original elapsed time exactly.
    const duration = index === active.length - 1 ? source.duration - used : source.duration * item.value / total;
    used += duration;
    const supervised = details.presence === 'SUPERVISED';
    const individual = supervised && item.key !== 'groupUnrestricted';
    let observed = 0;
    if (individual) {
      if (!['YES', 'NO'].includes(item.observation)) throw new Error('Choose Observation: yes or no for each individual allocation.');
      if (item.observation === 'YES') {
        observed = Number(item.observationMinutes);
        if (!Number.isFinite(observed) || observed <= 0 || observed > duration * 60 + 0.000001) throw new Error('Observation minutes must be positive and cannot exceed the individual supervised time.');
      }
    }
    const restricted = item.key === 'restricted' || item.key === 'individualRestricted';
    return {
      ...source, id: active.length === 1 ? source.id : `${source.id}_${item.key}`,
      // Category portions have no invented clock sequence. Keep the original range as evidence.
      startTime: active.length === 1 ? source.startTime : '', endTime: active.length === 1 ? source.endTime : '', duration,
      allocationSession: active.length > 1 ? { id: source.id, sourceEntryId: source.id, date: source.date, startTime: source.startTime, endTime: source.endTime, duration: source.duration } : source.allocationSession,
      fieldworkType: details.fieldworkType, activityCategory: restricted ? 'RESTRICTED' : 'UNRESTRICTED',
      activityType: restricted ? 'RESTRICTED_DIRECT' : supervised ? 'UNRESTRICTED_SUPERVISION' : 'UNRESTRICTED_OTHER',
      supervisorId: `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      supervisorName: details.supervisor.trim(), organizationName: details.organization.trim(),
      setting: details.setting?.trim() || details.organization.trim(), notes: details.notes.trim(),
      workPresence: details.presence, supervisionFormat: supervised ? individual ? 'INDIVIDUAL' : 'GROUP' : undefined,
      observationMode: supervised ? details.format as ObservationMode : undefined,
      supervisionMinutes: supervised ? duration * 60 : 0, individualSupervisionMinutes: individual ? duration * 60 : 0,
      observationMinutes: observed, clientInitials: undefined, status: 'PENDING', updatedAt: timestamp,
      timerSession: source.timerSession ? { ...source.timerSession, detailsComplete: true } : undefined,
    };
  });
}

import type { HourEntry, ActivityCategory, FieldworkType } from '../types';

export const MIGRATION_VERSION = 'entry-audit-v1';
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_ROWS = 20000;
export type SourceTable = { headers: string[]; rows: string[][]; originals: unknown[] };
export const FIELDS = {
  sourceId: ['Entry ID', 'id', 'entryId', 'recordId', 'hourId'],
  date: ['Date', 'serviceDate', 'activityDate', 'entryDate'],
  startTime: ['Start time', 'start', 'startTime'],
  endTime: ['End time', 'end', 'endTime'],
  duration: ['Total hours', 'duration', 'hours', 'fieldworkHours', 'hoursForAllotment'],
  category: ['Activity category', 'category', 'activityCategory', 'restrictedUnrestricted'],
  fieldworkType: ['Fieldwork type', 'fieldworkType', 'experienceType'],
  organization: ['Organization', 'organizationName', 'organisation', 'agency', 'employer'],
  supervisor: ['Supervisor', 'supervisorName', 'responsibleSupervisor', 'bcba'],
  supervisorEmail: ['Supervisor email', 'supervisorEmail'],
  description: ['Description of activity', 'activityDescription', 'description', 'activity', 'narrative'],
  notes: ['Notes', 'comments', 'additionalNotes'],
  presence: ['Hour type', 'workPresence', 'independentSupervised', 'presence'],
  format: ['Supervision format', 'supervisionFormat', 'individualGroup'],
  supervision: ['Supervision minutes', 'supervisionMinutes', 'supervisedMinutes'],
  observation: ['Observation minutes', 'observationMinutes', 'clientObservationMinutes'],
  individual: ['Individual supervision minutes', 'individualSupervisionMinutes'],
  observationMode: ['Observation mode', 'observationMode', 'formatType', 'modality'],
  contactType: ['Contact type', 'contactType'],
  client: ['Client initials', 'clientInitials'],
  setting: ['Setting', 'location', 'site'],
  status: ['Status', 'verificationStatus', 'approvalStatus'],
  restricted: ['Restricted hours', 'restrictedHours', 'restricted'],
  unrestricted: ['Unrestricted hours', 'unrestrictedHours', 'unrestricted'],
  group: ['Group unrestricted hours', 'groupUnrestricted', 'groupUnrestrictedHours'],
} as const;
export type Field = keyof typeof FIELDS;
export type Mapping = Partial<Record<Field, number>>;
export type ImportOptions = { sourceSystem: string; dateOrder: 'MDY' | 'DMY'; defaultFieldworkType?: FieldworkType };
export type Provenance = {
  version: typeof MIGRATION_VERSION; sourceSystem: string; sourceFile: string; sourceHash: string;
  sourceRow: number; sourceId: string; importedAt: string; mapping: Mapping;
  raw: Array<{ column: string; value: string }>; original: unknown;
  originalStatus: string; elapsedMinutes?: number; sourceStart: string; sourceEnd: string;
  allocation?: string; warnings: string[];
};
export type AuditEntry = HourEntry & { migration?: Provenance; contactType?: string };
export type RowResult = { row: number; entries: AuditEntry[]; errors: string[]; warnings: string[] };
export type MigrationPreview = { rows: RowResult[]; entries: AuditEntry[]; errors: number; warnings: number };
const cleanHeader = (v: string) => v.toLowerCase().replace(/\s*\((?:optional|required)\)/g, '').replace(/[^a-z0-9]/g, '');
const text = (v: unknown): string => v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
export function guessMapping(headers: string[]): Mapping {
  const result: Mapping = {};
  for (const key of Object.keys(FIELDS) as Field[]) {
    for (const alias of FIELDS[key]) {
      const matches = headers.map((v, i) => cleanHeader(v) === cleanHeader(alias) ? i : -1).filter(i => i >= 0);
      if (matches.length === 1) { result[key] = matches[0]; break; }
    }
  }
  return result;
}
export function parseCsv(input: string, delimiter: string): string[][] {
  const output: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const source = input.replace(/^\uFEFF/, '');
  const flush = () => { row.push(cell); cell = ''; closed = false; };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else if (c === delimiter) flush();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      flush(); if (row.some(v => v.trim())) output.push(row); row = [];
    } else if (closed && c.trim()) throw new Error('Invalid CSV quoting. Export the original CSV again; no rows were imported.');
    else if (!closed) cell += c;
  }
  if (quoted) throw new Error('The file ends inside a quoted cell. The export may be incomplete.');
  flush(); if (row.some(v => v.trim())) output.push(row);
  return output;
}
export function parseSource(input: string, filename: string): SourceTable {
  let headers: string[], rows: string[][], originals: unknown[];
  if (/\.json$/i.test(filename)) {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const items = Array.isArray(data) ? data : data?.entries || data?.records;
    if (!Array.isArray(items) || items.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('JSON must contain an entries/records array of individual entry objects. Monthly totals are not an entry export.');
    // No recursive guessing: nested fields remain verbatim in their cells and original objects.
    headers = [...new Set(items.flatMap(r => Object.keys(r)))];
    rows = items.map(r => headers.map(h => text(r[h]))); originals = items;
  } else {
    const first = input.replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '';
    const delim = /\.tsv$/i.test(filename) || first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
    const all = parseCsv(input, delim);
    headers = all[0] || []; rows = all.slice(1); originals = rows.map(values => ({ headers: [...headers], values: [...values] }));
  }
  if (!headers.length || !rows.length) throw new Error('No individual entry rows found. Use a detailed history export, not a monthly verification form.');
  if (headers.length > 500 || rows.length > MAX_SOURCE_ROWS) throw new Error('This import exceeds 500 columns or 20,000 rows. Export a smaller date range; nothing was truncated.');
  return { headers, rows, originals };
}
export async function sha256(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function parseDate(raw: string, order: 'MDY' | 'DMY'): string {
  const s = raw.trim(); let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (local) { year = Number(local[3]); month = Number(local[order === 'MDY' ? 1 : 2]); day = Number(local[order === 'MDY' ? 2 : 1]); }
  else return '';
  const d = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2200 && d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}
export function parseTime(raw: string): { time: string; minutes: number } | undefined {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i.exec(raw.trim());
  if (!m) return undefined;
  let hour = Number(m[1]); const minute = Number(m[2]), second = Number(m[3] || 0);
  if (minute > 59 || second > 59 || (m[4] ? hour < 1 || hour > 12 : hour > 23)) return undefined;
  if (m[4]) hour = hour % 12 + (m[4].toLowerCase() === 'pm' ? 12 : 0);
  return { time: `${String(hour).padStart(2, '0')}:${m[2]}`, minutes: hour * 60 + minute + second / 60 };
}
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return Number(s);
  const clock = /^(\d+):(\d{2})$/.exec(s);
  if (clock && Number(clock[2]) < 60) return Number(clock[1]) + Number(clock[2]) / 60;
  const hm = /^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/i.exec(s);
  if (hm && (hm[1] || hm[2])) return Number(hm[1] || 0) + Number(hm[2] || 0) / 60;
  return undefined;
}
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const enumText = (v: string) => v.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

export async function buildPreview(table: SourceTable, mapping: Mapping, options: ImportOptions, file: { name: string; hash: string }, email: string): Promise<MigrationPreview> {
  const rows: RowResult[] = [], importedAt = new Date().toISOString();
  for (let index = 0; index < table.rows.length; index++) {
    const values = table.rows[index];
    const get = (k: Field) => mapping[k] === undefined ? '' : values[mapping[k]!] || '';
    const errors: string[] = [], warnings: string[] = [];
    const date = parseDate(get('date'), options.dateOrder), start = parseTime(get('startTime')), end = parseTime(get('endTime'));
    if (!date) errors.push('A valid full entry date is required (not a month-only date).');
    if (values.length !== table.headers.length) errors.push('Row column count does not match the header.');
    const elapsed = start && end ? end.minutes - start.minutes : undefined;
    if (get('startTime').trim() && !start || get('endTime').trim() && !end) errors.push('Invalid time format.');
    if (elapsed !== undefined && elapsed <= 0) errors.push('End time must be after start time on the same date.');
    if (!start || !end) warnings.push('Clock times missing from source; no times were invented.');
    const sourceHours = parseAmount(get('duration'));
    if (get('duration').trim() && sourceHours === undefined) errors.push('Unrecognized hour total. Use decimal hours or h:mm.');
    let duration = sourceHours ?? (elapsed !== undefined && elapsed > 0 ? elapsed / 60 : undefined);
    const presenceValue = enumText(get('presence'));
    const presence = ['independent', 'unsupervised', 'bcba not present'].includes(presenceValue) ? 'INDEPENDENT' : ['supervised', 'supervisor present', 'bcba present'].includes(presenceValue) ? 'SUPERVISED' : undefined;
    const formatValue = enumText(get('format'));
    const format = formatValue === 'individual' ? 'INDIVIDUAL' : formatValue === 'group' ? 'GROUP' : undefined;
    const explicitCategory = enumText(get('category'));
    const category: ActivityCategory = explicitCategory === 'restricted' ? 'RESTRICTED' : explicitCategory === 'unrestricted' ? 'UNRESTRICTED' : 'UNKNOWN';
    const allocations: Array<{ category: ActivityCategory; hours: number; label: string; group?: boolean }> = [];
    for (const [key, cat] of [['restricted', 'RESTRICTED'], ['unrestricted', 'UNRESTRICTED'], ['group', 'UNRESTRICTED']] as const) {
      const v = get(key), n = parseAmount(v);
      if (v.trim() && n === undefined) errors.push(`Invalid ${key} hours.`);
      if (n !== undefined && n > 0) allocations.push({ category: cat, hours: n, label: key, group: key === 'group' });
    }
    const allocationTotal = round(allocations.reduce((s, a) => s + a.hours, 0));
    if (duration === undefined && allocationTotal > 0) duration = allocationTotal;
    if (allocations.length && duration !== undefined && Math.abs(duration - allocationTotal) > 0.011) errors.push('Category allocations do not match the entry total; resolve the source discrepancy before tracking.');
    if (allocations.length && category !== 'UNKNOWN' && allocations.some(a => a.category !== category)) errors.push('Category label conflicts with the explicit hour allocations.');
    if (!allocations.length && duration !== undefined) allocations.push({ category, hours: duration, label: 'whole-entry' });
    if (duration === undefined || duration <= 0 || duration > 24) errors.push('Individual entry hours must be greater than 0 and no more than 24. Monthly totals belong in supporting documents.');
    if (duration !== undefined && elapsed !== undefined && Math.abs(duration - elapsed / 60) > 0.011) warnings.push('Source hour total differs from clock duration. Source total preserved; supervisor review needed.');
    if (allocations.length > 1) warnings.push('Mixed allocations are linked to ONE original entry; no sub-session times or observation allocations were invented.');
    if (allocations.some(a => a.category === 'UNKNOWN')) warnings.push('Restricted/unrestricted is unknown in the source.');
    if (!presence) warnings.push('Independent/supervised not specified.');
    if (!get('organization').trim()) warnings.push('Organization missing.');
    if (!get('supervisor').trim()) warnings.push('Responsible supervisor missing.');
    if (!get('description').trim() && !get('notes').trim()) warnings.push('Activity narrative missing. It cannot be recovered from monthly totals.');
    const fwText = enumText(get('fieldworkType'));
    const fw = fwText === 'concentrated' || fwText === 'concentrated supervised fieldwork' ? 'CONCENTRATED' : fwText === 'supervised' || fwText === 'supervised fieldwork' ? 'SUPERVISED' : options.defaultFieldworkType;
    if (!fw) errors.push('Choose the actual fieldwork type or map its source column.');
    if (fwText && !['supervised', 'supervised fieldwork', 'concentrated', 'concentrated supervised fieldwork'].includes(fwText)) errors.push('Unrecognized source fieldwork type. Review it; do not silently replace it with a default.');
    if (!fwText && options.defaultFieldworkType) warnings.push(`Fieldwork type supplied by user: ${options.defaultFieldworkType}.`);
    const minuteValues: Partial<Record<'supervision' | 'observation' | 'individual', number>> = {};
    for (const key of ['supervision', 'observation', 'individual'] as const) {
      const raw = get(key).trim(); if (!raw) continue;
      if (!/^\d+(?:\.\d+)?$/.test(raw)) errors.push(`${key} must be decimal MINUTES, not hours.`);
      else { minuteValues[key] = Number(raw); if (duration !== undefined && Number(raw) > duration * 60 + 0.61) errors.push(`${key} minutes exceed entry duration.`); }
    }
    if (minuteValues.individual !== undefined && minuteValues.supervision !== undefined && minuteValues.individual > minuteValues.supervision) errors.push('Individual supervision exceeds total supervision.');
    if (presence === 'INDEPENDENT' && ((minuteValues.supervision || 0) > 0 || (minuteValues.observation || 0) > 0)) errors.push('Independent entry conflicts with supervision/observation minutes.');
    if (minuteValues.observation !== undefined && minuteValues.supervision !== undefined && minuteValues.observation > minuteValues.supervision) errors.push('Client observation exceeds total supervision.');
    if (format === 'GROUP' && (minuteValues.individual || 0) > 0) errors.push('Group format conflicts with individual supervision minutes.');
    if (presence === 'SUPERVISED' && !format && !get('group').trim()) warnings.push('Individual/group format missing.');
    const modeText = enumText(get('observationMode'));
    const mode = ['in person', 'onsite', 'on site'].includes(modeText) ? 'IN_PERSON' : ['online', 'video', 'telehealth', 'synchronous', 'asynchronous'].includes(modeText) ? 'ONLINE' : ['phone', 'telephone'].includes(modeText) ? 'PHONE' : undefined;
    const originalStatus = get('status');
    if (originalStatus.trim()) warnings.push('Historical source status retained as evidence; Baker approval starts Pending.');
    const raw = table.headers.map((column, i) => ({ column, value: values[i] || '' }));
    const sourceId = get('sourceId').trim();
    const baseId = await sha256(`${options.sourceSystem}\n${sourceId || file.hash + ':' + index}`);
    const noteParts = [get('description'), get('notes')].filter(v => v.trim());
    const entries: AuditEntry[] = errors.length ? [] : allocations.map((allocation, aIndex) => ({
      id: `detail_${baseId}_${aIndex}`, userId: email, date,
      startTime: allocations.length === 1 ? start?.time || '' : '', endTime: allocations.length === 1 ? end?.time || '' : '',
      duration: round(allocation.hours), fieldworkType: fw!, activityCategory: allocation.category,
      activityType: allocation.category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER',
      supervisorId: `source_${get('supervisor').trim().toLowerCase()}`, supervisorName: get('supervisor').trim() || 'Not specified',
      supervisorEmail: get('supervisorEmail').trim() || undefined, organizationName: get('organization').trim() || undefined,
      workPresence: presence, supervisionFormat: allocation.group ? 'GROUP' : format,
      observationMode: mode, contactType: get('contactType') || undefined, clientInitials: get('client').trim() || undefined, setting: get('setting'),
      notes: noteParts.join('\n\n'), status: 'PENDING', createdAt: importedAt, updatedAt: importedAt,
      // Whole-row supervision is never multiplied across split allocations. The original remains in the audit source.
      supervisionMinutes: allocations.length === 1 ? minuteValues.supervision : undefined,
      observationMinutes: allocations.length === 1 ? minuteValues.observation : undefined,
      individualSupervisionMinutes: allocations.length === 1 ? minuteValues.individual : undefined,
      aiSourceText: file.name,
      migration: { version: MIGRATION_VERSION, sourceSystem: options.sourceSystem, sourceFile: file.name, sourceHash: file.hash,
        sourceRow: index + 2, sourceId, importedAt, mapping: { ...mapping }, raw, original: table.originals[index], originalStatus,
        elapsedMinutes: elapsed, sourceStart: get('startTime'), sourceEnd: get('endTime'), allocation: allocation.label, warnings: [...warnings] },
    }));
    rows.push({ row: index + 2, entries, errors, warnings });
  }
  return { rows, entries: rows.flatMap(r => r.entries), errors: rows.filter(r => r.errors.length).length, warnings: rows.filter(r => r.warnings.length).length };
}
export function isMonthlySummary(entry: AuditEntry): boolean {
  return !entry.migration && (entry.duration > 24 || /monthly aggregate|monthly verification|summary.derived/i.test(`${entry.aiRationale || ''} ${entry.notes || ''}`));
}
export function entryFingerprint(entry: AuditEntry): string {
  return JSON.stringify([entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityCategory, entry.fieldworkType,
    entry.organizationName || '', entry.supervisorName, entry.workPresence || '', entry.supervisionFormat || '', entry.notes || '',
    entry.supervisionMinutes ?? null, entry.observationMinutes ?? null, entry.individualSupervisionMinutes ?? null, entry.setting || '', entry.observationMode || '', entry.clientInitials || '']);
}
export function planMerge(existing: AuditEntry[], incoming: AuditEntry[]) {
  const byId = new Map(existing.map(e => [e.id, e])), fingerprints = new Set(existing.map(entryFingerprint));
  const add: AuditEntry[] = [], duplicate: AuditEntry[] = [], conflicts: AuditEntry[] = [], possibleDuplicates: AuditEntry[] = [];
  for (const entry of incoming) {
    const prior = byId.get(entry.id), fingerprint = entryFingerprint(entry);
    if (prior) { (entryFingerprint(prior) === fingerprint && JSON.stringify(prior.migration?.original) === JSON.stringify(entry.migration?.original) ? duplicate : conflicts).push(entry); continue; }
    // Identical values without a matching source ID are flagged, NOT silently discarded.
    if (fingerprints.has(fingerprint)) possibleDuplicates.push(entry);
    add.push(entry); byId.set(entry.id, entry); fingerprints.add(fingerprint);
  }
  const months = new Set(add.map(e => e.date.slice(0, 7)));
  const overlappingSummaries = existing.filter(e => isMonthlySummary(e) && months.has(e.date.slice(0, 7)));
  return { add, duplicate, conflicts, possibleDuplicates, overlappingSummaries };
}
export function auditCsv(entries: AuditEntry[]): string {
  const headers = ['Entry ID', 'Date', 'Start time', 'End time', 'Hours', 'Activity category', 'Fieldwork type', 'Organization', 'Supervisor', 'Supervisor email', 'Hour type', 'Supervision format', 'Supervision minutes', 'Observation minutes', 'Individual supervision minutes', 'Observation mode', 'Client initials', 'Setting', 'Description of activity', 'Baker status', 'Supervisor note', 'Supervisor message', 'Revision history', 'Source file', 'Source SHA256', 'Source row', 'Source entry ID', 'Source status', 'Original entry start', 'Original entry end', 'Allocation', 'Source warnings', 'Contact type', 'All original fields'];
  const cell = (v: unknown) => { const raw = text(v); const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw; return '"' + safe.replace(/"/g, '""') + '"'; };
  return [headers, ...entries.map(e => [e.id, e.date, e.startTime, e.endTime, e.duration, e.activityCategory, e.fieldworkType, e.organizationName, e.supervisorName, e.supervisorEmail, e.workPresence, e.supervisionFormat, e.supervisionMinutes, e.observationMinutes, e.individualSupervisionMinutes, e.observationMode, e.clientInitials, e.setting, e.notes, e.status, e.supervisorNote, e.supervisorMessage, e.revisionHistory, e.migration?.sourceFile, e.migration?.sourceHash, e.migration?.sourceRow, e.migration?.sourceId, e.migration?.originalStatus, e.migration?.sourceStart, e.migration?.sourceEnd, e.migration?.allocation, e.migration?.warnings, e.contactType, e.migration?.raw])].map(row => row.map(cell).join(',')).join('\r\n');
}

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import TimeInput from './TimeInput';
import type { HourEntry, ObservationMode, WorkPresence } from '@/types';
import { hoursBetween, newId } from '@/lib/fieldworkStore';
import { localDate } from '@/lib/fieldworkTimer';
import { allocateEntry, allottedDecimal, blankAllocations } from '@/lib/hourEntryFlow';
import type { HourAllocation, HourEntryFlowDetails } from '@/lib/hourEntryFlow';

const inputClass = 'mt-1.5 w-full rounded-xl border border-[#DDD2CA] bg-white px-3 py-2.5 text-sm text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-2 focus:ring-[#E85D70]/20 disabled:cursor-not-allowed dark:border-white/20 dark:bg-[#211D1A] dark:text-[#F8F4F1]';
const labels = { restricted: 'Restricted', unrestricted: 'Unrestricted', individualRestricted: 'Individual restricted', individualUnrestricted: 'Individual unrestricted', groupUnrestricted: 'Group unrestricted' };
export interface HourEntrySubmission { sources: HourEntry[]; detailsByEntry: Record<string, HourEntryFlowDetails> }

export default function HourEntryForm({ segments = [], supervisors = [], organizations = [], onSave, onLater }: {
  segments?: HourEntry[]; supervisors?: string[]; organizations?: string[];
  onSave: (submission: HourEntrySubmission) => Promise<void>; onLater: () => void;
}) {
  const id = useId();
  const initial = segments[0];
  const manual = segments.length === 0;
  const [sourceId] = useState(() => newId('manual'));
  const [today] = useState(() => localDate(Date.now()));
  const [supervisor, setSupervisor] = useState(initial?.supervisorName === 'Not specified' ? '' : initial?.supervisorName || '');
  const [organization, setOrganization] = useState(initial?.organizationName || '');
  const [date, setDate] = useState(initial?.date || today);
  const [start, setStart] = useState(initial?.startTime || '');
  const [end, setEnd] = useState(initial?.endTime || '');
  const [presence, setPresence] = useState<WorkPresence | ''>('');
  const [format, setFormat] = useState<ObservationMode | ''>('');
  const [fieldworkType, setFieldworkType] = useState<'SUPERVISED' | 'CONCENTRATED'>(initial?.fieldworkType || 'SUPERVISED');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [allocations, setAllocations] = useState<Record<string, HourAllocation[]>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const timestamp = new Date().toISOString();
  const sources: HourEntry[] = manual ? [{ id: sourceId, userId: '', date, startTime: start, endTime: end, duration: hoursBetween(start, end), fieldworkType, activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN', supervisorId: '', supervisorName: '', setting: '', status: 'DRAFT', createdAt: timestamp, updatedAt: timestamp }] : segments;
  const contextReady = Boolean(supervisor.trim() && organization.trim() && sources.every(source => /^\d{4}-\d{2}-\d{2}$/.test(source.date) && source.date <= today && source.duration > 0));
  const allocationReady = contextReady && Boolean(presence) && (presence === 'INDEPENDENT' || Boolean(format));
  const rows = (source: HourEntry) => allocations[source.id] || blankAllocations(presence || 'INDEPENDENT');
  const totalsReady = allocationReady && sources.every(source => {
    const active = rows(source).filter(row => row.hours.trim() !== '');
    return active.length > 0 && active.every(row => Number.isFinite(Number(row.hours)) && Number(row.hours) >= 0) && Math.abs(active.reduce((sum, row) => sum + Number(row.hours), 0) - Number(allottedDecimal(source.duration))) < 0.0000001;
  });
  const observationReady = totalsReady && sources.every(source => {
    const total = Number(allottedDecimal(source.duration));
    return rows(source).filter(row => Number(row.hours) > 0 && row.key.startsWith('individual')).every(row => row.observation === 'NO' || row.observation === 'YES' && Number(row.observationMinutes) > 0 && Number(row.observationMinutes) <= source.duration * Number(row.hours) / total * 60 + 0.000001);
  });
  const descriptionReady = allocationReady && (presence === 'INDEPENDENT' || observationReady);
  const ready = totalsReady && descriptionReady && Boolean(notes.trim());
  const updateRow = (source: HourEntry, key: HourAllocation['key'], patch: Partial<HourAllocation>) => setAllocations(current => ({ ...current, [source.id]: (current[source.id] || blankAllocations(presence || 'INDEPENDENT')).map(row => row.key === key ? { ...row, ...patch } : row) }));
  const changePresence = (value: WorkPresence | '') => { setPresence(value); setFormat(''); setAllocations({}); setError(''); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (!ready || !presence) { setError('Complete each section and match your allocated hours to the allotted time.'); return; }
    const detailsByEntry = Object.fromEntries(sources.map(source => [source.id, { presence, format, notes, organization, supervisor, fieldworkType, allocations: rows(source) } satisfies HourEntryFlowDetails]));
    try {
      for (const source of sources) allocateEntry(source, detailsByEntry[source.id]);
      savingRef.current = true; setSaving(true); setError('');
      await onSave({ sources, detailsByEntry });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your hours could not be saved. Keep this page open and try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <form aria-label="Fieldwork hour entry" onSubmit={event => void submit(event)} className="space-y-4">
    <datalist id={`${id}-supervisors`}>{supervisors.map(name => <option key={name} value={name} />)}</datalist>
    <datalist id={`${id}-organizations`}>{organizations.map(name => <option key={name} value={name} />)}</datalist>
    <Stage number={1} title="Session details" enabled>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supervisor"><input required autoFocus list={`${id}-supervisors`} value={supervisor} onChange={event => setSupervisor(event.target.value)} placeholder="Select or enter supervisor" className={inputClass} /></Field>
        <Field label="Organization"><input required list={`${id}-organizations`} value={organization} onChange={event => setOrganization(event.target.value)} placeholder="Select or enter organization" className={inputClass} /></Field>
      </div>
      {manual ? <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Date"><input required type="date" max={today} value={date} onChange={event => setDate(event.target.value)} className={inputClass} /></Field>
        <div className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Start time<TimeInput label="Start time" value={start} onChange={setStart} className={inputClass} /></div>
        <div className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">End time<TimeInput label="End time" value={end} onChange={setEnd} className={inputClass} /></div>
      </div> : <div className="mt-4 space-y-4">{sources.map((source, index) => <fieldset key={source.id} disabled className="grid gap-4 sm:grid-cols-3"><legend className="mb-2 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Filled automatically when the timer stopped{sources.length > 1 ? ` · Part ${index + 1}` : ''}</legend><Field label="Date"><input aria-label={sources.length > 1 ? `Date part ${index + 1}` : 'Date'} type="date" value={source.date} readOnly className={inputClass} /></Field><div className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Start time<TimeInput label={sources.length > 1 ? `Start time part ${index + 1}` : 'Start time'} value={source.startTime} onChange={() => {}} className={inputClass} /></div><div className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">End time<TimeInput label={sources.length > 1 ? `End time part ${index + 1}` : 'End time'} value={source.endTime} onChange={() => {}} className={inputClass} /></div></fieldset>)}</div>}
      {manual && start && end && hoursBetween(start, end) <= 0 && <p className="mt-3 text-sm text-[#C9445A] dark:text-[#FF9CAE]">Choose an end time after the start time. Add separate entries for activities across midnight.</p>}
    </Stage>
    <Stage number={2} title="Hours for allotment" enabled={contextReady} hint="Complete your supervisor, organization, date, and times above.">
      <div aria-live="polite" className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Available to allocate</span><output aria-label="Hours for allotment" className="font-mono text-3xl font-semibold text-[#C9445A] dark:text-[#FF8EA0]">{contextReady ? allottedDecimal(sources.reduce((sum, source) => sum + source.duration, 0)) : '—'} <span className="text-sm">hours</span></output></div>
      <p className="mt-2 text-xs leading-5 text-[#7B6B62] dark:text-[#CFC4BE]">Your start and end times are converted to decimal hours automatically. For example, 1 hour 15 minutes = 1.25 hours.</p>
    </Stage>
    <Stage number={3} title="Hour type" enabled={contextReady} hint="Your hour type unlocks once the session time is complete.">
      <Field label="Hour type"><select aria-label="Hour type" required value={presence} onChange={event => changePresence(event.target.value as WorkPresence | '')} className={inputClass}><option value="">Choose independent or supervised</option><option value="INDEPENDENT">Independent</option><option value="SUPERVISED">Supervised</option></select></Field>
    </Stage>
    {presence === 'SUPERVISED' && <Stage number={4} title="Format type" enabled={contextReady}>
      <Field label="Format type"><select aria-label="Format type" required value={format} onChange={event => setFormat(event.target.value as ObservationMode | '')} className={inputClass}><option value="">Choose a format</option><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option><option value="PHONE">Phone call</option></select></Field>
    </Stage>}
    <Stage number={presence === 'SUPERVISED' ? 5 : 4} title="Allocate your hours" enabled={allocationReady} hint={presence === 'SUPERVISED' ? 'Choose your format type first.' : 'Choose your hour type first.'}>
      <p className="mb-4 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Enter decimal hours in the matching categories. Leave unused categories blank. The total must match your allotted hours.</p>
      {sources.map(source => <div key={source.id} className="space-y-3 border-t border-[#E2DAD5] pt-4 first:border-0 first:pt-0 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-[#332C28] dark:text-white">{source.date}</span><span className="font-mono text-[#C9445A] dark:text-[#FF8EA0]">{allottedDecimal(source.duration)} hours to allocate</span></div>
        <div className={`grid gap-3 ${presence === 'SUPERVISED' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{rows(source).map(row => <Field key={row.key} label={`${labels[row.key]} hours`}><input type="number" min="0" step="any" value={row.hours} onChange={event => updateRow(source, row.key, { hours: event.target.value })} placeholder="0.00" inputMode="decimal" className={inputClass} /></Field>)}</div>
        <p aria-live="polite" className="text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Allocated: {rows(source).reduce((sum, row) => sum + (Number(row.hours) || 0), 0).toFixed(source.duration < 0.01 ? 6 : 2)} / {allottedDecimal(source.duration)} hours</p>
        {rows(source).filter(row => Number(row.hours) > 0 && row.key.startsWith('individual')).map(row => <fieldset key={row.key} disabled={!totalsReady} className={`space-y-3 rounded-xl border border-[#E2DAD5] p-4 dark:border-white/15 ${totalsReady ? '' : 'opacity-45'}`}><legend className="px-1 text-sm font-semibold text-[#332C28] dark:text-white">{labels[row.key]} · Observation</legend><Field label={`Observation: yes or no · ${labels[row.key]}`}><select aria-label={`Observation: yes or no · ${labels[row.key]}`} required value={row.observation} onChange={event => updateRow(source, row.key, { observation: event.target.value as HourAllocation['observation'], observationMinutes: '' })} className={inputClass}><option value="">Choose yes or no</option><option value="YES">Yes</option><option value="NO">No</option></select></Field>{row.observation === 'YES' && <><Field label={`Direct client observation minutes · ${labels[row.key]}`}><input required type="number" min="0.01" step="any" max={source.duration * Number(row.hours) / Number(allottedDecimal(source.duration)) * 60} value={row.observationMinutes} onChange={event => updateRow(source, row.key, { observationMinutes: event.target.value })} placeholder="Minutes, not decimal hours" className={inputClass} /></Field><p className="text-xs leading-5 text-[#7B6B62] dark:text-[#CFC4BE]">Enter only the time, in minutes, that your supervisor directly observed you working with a client. This is tracked separately for the 2027 BCBA fieldwork observation requirement.</p></>}</fieldset>)}
      </div>)}
      {sources.some(source => rows(source).filter(row => Number(row.hours) > 0).length > 1) && <p className="mt-4 text-xs leading-5 text-[#7B6B62] dark:text-[#CFC4BE]">Each category is saved as a separate allocation linked to this session. The original time range is retained; category-specific start and end times are not inferred.</p>}
    </Stage>
    <Stage number={presence === 'SUPERVISED' ? 6 : 5} title="Description of activity" enabled={descriptionReady} hint={presence === 'SUPERVISED' ? 'Allocate your hours and complete the observation questions first.' : 'Choose your hour type to describe your activity.'}>
      <Field label="Description of activity"><textarea required rows={4} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Describe the activity completed during these hours." className={`${inputClass} resize-y`} /></Field>
      <details className="mt-4 text-sm text-[#6B5D54] dark:text-[#CFC4BE]"><summary className="cursor-pointer">Fieldwork requirements</summary><Field label="Fieldwork type"><select aria-label="Fieldwork type" value={fieldworkType} onChange={event => setFieldworkType(event.target.value as 'SUPERVISED' | 'CONCENTRATED')} className={inputClass}><option value="SUPERVISED">Supervised fieldwork</option><option value="CONCENTRATED">Concentrated supervised fieldwork</option></select></Field></details>
    </Stage>
    {error && <p role="alert" className="rounded-xl bg-[#FFF5F7] p-3 text-sm text-[#C9445A] dark:bg-[#E85D70]/10 dark:text-[#FF9CAE]">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-[#E2DAD5] pt-4 dark:border-white/15"><button type="button" disabled={saving} onClick={onLater} className="rounded-xl px-4 py-3 text-sm font-semibold text-[#6B5D54] disabled:opacity-45 dark:text-[#CFC4BE]">{manual ? 'Cancel' : 'Finish later'}</button><button type="submit" disabled={saving || !ready} className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={16} />{saving ? 'Saving…' : 'Save activity'}</button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">{label}{children}</label>;
}
function Stage({ number, title, enabled, hint, children }: { number: number; title: string; enabled: boolean; hint?: string; children: ReactNode }) {
  return <fieldset disabled={!enabled} aria-disabled={!enabled} className={`min-w-0 rounded-2xl border p-4 transition-colors sm:p-5 ${enabled ? 'border-[#E2DAD5] bg-white dark:border-white/15 dark:bg-[#211D1A]/50' : 'border-[#E2DAD5] bg-[#F2EDEA] opacity-45 dark:border-white/10 dark:bg-white/5'}`}><legend className="flex items-center gap-2 px-1 text-sm font-semibold text-[#332C28] dark:text-[#F8F4F1]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E85D70]/15 text-xs text-[#C9445A] dark:text-[#FF9CAE]">{number}</span>{title}{!enabled && <LockKeyhole size={13} aria-hidden="true" />}</legend>{!enabled && hint && <p className="mb-3 text-xs text-[#6B5D54] dark:text-[#CFC4BE]">{hint}</p>}{children}</fieldset>;
}

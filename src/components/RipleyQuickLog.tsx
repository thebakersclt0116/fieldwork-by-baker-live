import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { CheckCircle2, Clock3, Plus, X } from 'lucide-react';
import type { ActivityType, HourEntry, WorkPresence } from '@/types';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { useAuth } from '@/hooks/useAuth';

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED', presence: WorkPresence): ActivityType {
  if (category === 'RESTRICTED') return 'RESTRICTED_DIRECT';
  return presence === 'SUPERVISED' ? 'UNRESTRICTED_SUPERVISION' : 'UNRESTRICTED_OTHER';
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort();
}

export default function RipleyQuickLog() {
  const location = useLocation();
  const { user, isOwner } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const visible = location.pathname === '/dashboard' && !isOwner && Boolean(email);
  const existing = useMemo(() => visible ? loadEntries(email) : [], [email, visible]);
  const supervisors = useMemo(() => unique(existing.map((entry) => entry.supervisorName).filter((name) => name !== 'Not specified')), [existing]);
  const organizations = useMemo(() => unique(existing.map((entry) => entry.organizationName || entry.setting)), [existing]);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('08:30');
  const [end, setEnd] = useState('09:30');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [presence, setPresence] = useState<WorkPresence>('INDEPENDENT');
  const [organization, setOrganization] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [notes, setNotes] = useState('');
  const [supervisionMinutes, setSupervisionMinutes] = useState(0);
  const [message, setMessage] = useState('');

  const duration = hoursBetween(start, end);
  const minutes = Math.round(duration * 60);

  if (!visible) return null;

  const save = () => {
    if (!date || duration <= 0) return setMessage('Choose a valid start and end time.');
    if (!organization.trim()) return setMessage('Organization is required.');
    if (!supervisor.trim()) return setMessage('Responsible supervisor is required.');
    if (!notes.trim()) return setMessage('Add a short activity description.');
    const now = new Date().toISOString();
    const supervised = presence === 'SUPERVISED';
    const entry: HourEntry = {
      id: newId('quick'),
      userId: email,
      date,
      startTime: start,
      endTime: end,
      duration,
      fieldworkType: 'SUPERVISED',
      activityType: activityTypeFor(category, presence),
      activityCategory: category,
      supervisorId: `quick_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      supervisorName: supervisor.trim(),
      organizationName: organization.trim(),
      workPresence: presence,
      setting: organization.trim(),
      notes: notes.trim(),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      supervisionMinutes: supervised ? Math.min(minutes, Math.max(0, Number(supervisionMinutes) || minutes)) : undefined,
      individualSupervisionMinutes: supervised ? Math.min(minutes, Math.max(0, Number(supervisionMinutes) || minutes)) : undefined,
    };
    addEntry(entry, email);
    window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
    setMessage(`Saved ${duration.toFixed(2)} ${category.toLowerCase()} hours.`);
    setNotes('');
    window.setTimeout(() => { setOpen(false); setMessage(''); }, 850);
  };

  return <>
    <datalist id="quicklog-supervisors">{supervisors.map((name) => <option key={name} value={name} />)}</datalist>
    <datalist id="quicklog-organizations">{organizations.map((name) => <option key={name} value={name} />)}</datalist>
    <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[58] inline-flex items-center gap-2 rounded-2xl bg-[#E85D70] px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_38px_rgba(232,93,112,.35)] transition hover:-translate-y-0.5"><Plus size={17} /> Quick Log Hours</button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"><div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-[#FFFCF9] p-5 shadow-2xl dark:bg-[#211D1A] sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Clock3 size={17} /> Ripley-style Quick Log</div><h2 className="mt-2 font-serif text-3xl font-semibold text-[#332C28] dark:text-white">Start. End. Decimal. Done.</h2><p className="mt-2 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">Use the same mental model you already know: choose the time range and Baker converts it to the exact decimal automatically.</p></div><button onClick={() => setOpen(false)} className="rounded-xl p-2 text-[#A8998E] hover:bg-black/5 dark:hover:bg-white/5"><X size={20} /></button></div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" /></label><label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Start time<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field-input" /></label><label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">End time<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="field-input" /></label></div>

      <div className="mt-4 rounded-[24px] border border-[#F0D5DA] bg-[#FFF5F7] p-5 text-center dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10"><div className="text-xs font-bold uppercase tracking-[.18em] text-[#A8998E]">Exact decimal hours</div><div className="mt-1 font-mono text-5xl font-semibold text-[#E85D70]">{duration > 0 ? duration.toFixed(2) : '0.00'}</div><div className="mt-1 text-xs text-[#A8998E]">{minutes > 0 ? `${minutes} minutes • ${start} → ${end}` : 'Choose a valid time range'}</div></div>

      <div className="mt-6"><div className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">Restricted or unrestricted?</div><div className="grid grid-cols-2 gap-3"><button onClick={() => setCategory('UNRESTRICTED')} className={`rounded-[20px] border p-4 text-left transition ${category === 'UNRESTRICTED' ? 'border-[#5FA37E] bg-[#E8F5EE] ring-2 ring-[#5FA37E]/15 dark:bg-[#5FA37E]/15' : 'border-[#E2DAD5] bg-white dark:border-white/10 dark:bg-white/5'}`}><div className={`font-bold ${category === 'UNRESTRICTED' ? 'text-[#3F7F5C]' : 'text-[#5F5149] dark:text-white'}`}>Unrestricted</div><div className="mt-1 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Behavior-analyst work such as assessment, data analysis, plan development, training, and other qualifying analytic activities.</div></button><button onClick={() => setCategory('RESTRICTED')} className={`rounded-[20px] border p-4 text-left transition ${category === 'RESTRICTED' ? 'border-[#D4A574] bg-[#FFF3E0] ring-2 ring-[#D4A574]/15 dark:bg-[#D4A574]/15' : 'border-[#E2DAD5] bg-white dark:border-white/10 dark:bg-white/5'}`}><div className={`font-bold ${category === 'RESTRICTED' ? 'text-[#9D651B]' : 'text-[#5F5149] dark:text-white'}`}>Restricted</div><div className="mt-1 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Direct implementation/service activities. When unsure, record accurately and verify classification with your supervisor.</div></button></div></div>

      <div className="mt-6"><div className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">Was your BCBA/supervisor present?</div><div className="grid grid-cols-2 gap-3"><button onClick={() => setPresence('INDEPENDENT')} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${presence === 'INDEPENDENT' ? 'border-[#E85D70] bg-[#FFF4F6] text-[#C9445A] dark:bg-[#E85D70]/10' : 'border-[#E2DAD5] text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]'}`}>Independent</button><button onClick={() => setPresence('SUPERVISED')} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${presence === 'SUPERVISED' ? 'border-[#E85D70] bg-[#FFF4F6] text-[#C9445A] dark:bg-[#E85D70]/10' : 'border-[#E2DAD5] text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]'}`}>Supervised</button></div></div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Organization *<input list="quicklog-organizations" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Melmark Carolinas" className="field-input" /></label><label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Responsible supervisor *<input list="quicklog-supervisors" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Carrie, Christina, Brad…" className="field-input" /></label>{presence === 'SUPERVISED' && <label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Supervision minutes<input type="number" min="0" max={minutes || undefined} value={supervisionMinutes} onChange={(e) => setSupervisionMinutes(Number(e.target.value))} placeholder={String(minutes)} className="field-input" /></label>}<label className="text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE] sm:col-span-2">Activity description *<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What did you do during these hours?" className="field-input resize-none" /></label></div>

      <div className="mt-5 rounded-2xl bg-[#FAF8F6] p-4 text-sm text-[#6B5D54] dark:bg-white/5 dark:text-[#CFC4BE]"><strong className="text-[#332C28] dark:text-white">This will save as:</strong> {duration.toFixed(2)} {category.toLowerCase()} hours • {presence === 'SUPERVISED' ? 'supervised' : 'independent'} • Pending supervisor review.</div>
      {message && <div className="mt-3 text-sm font-semibold text-[#5FA37E]">{message}</div>}
      <button onClick={save} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#332C28] px-5 py-3.5 text-sm font-bold text-white dark:bg-[#E85D70]"><CheckCircle2 size={17} /> Save {duration.toFixed(2)} hours</button>
    </div></div>}
  </>;
}

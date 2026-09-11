import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Bot, CheckCircle2, Copy, FileDown, LockKeyhole, Mail, Plus, ShieldCheck, Upload, UserCheck } from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { evaluateCompliance } from '@/lib/compliance2027';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  return category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER';
}

export default function UserDashboard() {
  const { user, isFree, hasPaidFeatures, hasSupervisorFeatures, canExportOfficialForms } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [showLog, setShowLog] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [supervisionMinutes, setSupervisionMinutes] = useState(0);
  const [notice, setNotice] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [reviewEntryId, setReviewEntryId] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [reviewError, setReviewError] = useState('');

  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const supervisorCount = useMemo(() => new Set(entries.map((entry) => entry.supervisorName).filter((name) => name && name !== 'Not specified')).size, [entries]);

  const saveEntry = () => {
    const duration = hoursBetween(startTime, endTime);
    if (!email || !date || duration <= 0) return setNotice('Enter a valid date and time range.');
    const now = new Date().toISOString();
    const entry: HourEntry = {
      id: newId('manual'), userId: email, date, startTime, endTime, duration,
      fieldworkType: 'SUPERVISED', activityType: activityTypeFor(category), activityCategory: category,
      supervisorId: supervisor ? `manual_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'manual_unknown',
      supervisorName: supervisor || 'Not specified', setting: '', notes: activity || undefined,
      status: 'PENDING', createdAt: now, updatedAt: now,
      supervisionMinutes: supervisionMinutes > 0 ? supervisionMinutes : undefined,
      individualSupervisionMinutes: supervisionMinutes > 0 ? supervisionMinutes : undefined,
    };
    setEntries(addEntry(entry, email));
    setActivity('');
    setNotice('Entry saved. Your manual fieldwork logging is always available on Free.');
  };

  const createReviewInvite = async (entry: HourEntry) => {
    if (!hasSupervisorFeatures) return;
    const token = getStoredAccessToken();
    if (!token || !supervisorName.trim() || !supervisorEmail.trim()) return setReviewError('Enter the supervisor name and email first.');
    setReviewError(''); setReviewUrl('');
    try {
      const response = await fetch('/api/supervisor-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ supervisorName, supervisorEmail, reviewEntry: { id: entry.id, date: entry.date, duration: entry.duration, activityCategory: entry.activityCategory, narrative: entry.notes || '', supervisorName: entry.supervisorName, supervisionMinutes: entry.supervisionMinutes || 0 } }),
      });
      const payload = await response.json() as { path?: string; error?: string };
      if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create review link.');
      setReviewEntryId(entry.id);
      setReviewUrl(`${window.location.origin}${payload.path}`);
    } catch (error) { setReviewError(error instanceof Error ? error.message : 'Could not create review link.'); }
  };

  const planLabel = user?.role === 'professional' || user?.subscription === 'professional' ? 'PROFESSIONAL' : user?.subscription === 'individual' ? 'INDIVIDUAL' : isFree ? 'FREE' : 'PAID';

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7">
          <div><div className="flex items-center gap-2 mb-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${isFree ? 'bg-[#FAF8F6] text-[#7B6B62]' : 'bg-[#E8F5EE] text-[#5FA37E]'}`}>{planLabel}</span>{user?.exportPass && <span className="rounded-full bg-[#FFF5F7] text-[#E85D70] px-2.5 py-1 text-[10px] font-bold">EXPORT PASS</span>}</div><h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Welcome, {user?.name?.split(' ')[0] || 'there'}</h1><p className="text-[#6B5D54]">Track free forever. Upgrade only for automation, migration, official-form export convenience, and supervisor workflow.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => setShowLog((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] text-white px-4 py-2.5 text-sm font-semibold"><Plus size={16} /> Log Hours</button><Link to="/export" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${canExportOfficialForms ? 'bg-[#5FA37E] text-white' : 'border border-[#E2DAD5] bg-white text-[#6B5D54]'}`}>{canExportOfficialForms ? <FileDown size={16} /> : <LockKeyhole size={16} />} Export</Link></div>
        </div>

        {isFree && <div className="rounded-2xl bg-[#FFF5F7] border border-[#FFD5DC] p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="font-semibold text-[#C9445A]">You’re on Free — and your tracking does not expire.</div><p className="text-sm text-[#8C6B70] mt-1">Your hours stay visible. Upgrade when you want Baker AI, Ripley import, official-form export tools, or supervisor collaboration.</p></div><Link to="/upgrade" className="shrink-0 rounded-xl bg-[#E85D70] text-white px-4 py-2.5 text-sm font-semibold">See upgrade options</Link></div>}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><div className="text-xs text-[#A8998E]">Actual hours</div><div className="font-mono text-3xl mt-2 text-[#332C28]">{compliance.actualHours.toFixed(1)}</div></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><div className="text-xs text-[#A8998E]">Equivalent progress</div><div className="font-mono text-3xl mt-2 text-[#332C28]">{compliance.weightedEquivalentHours.toFixed(1)}</div></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><div className="text-xs text-[#A8998E]">Unrestricted</div><div className="font-mono text-3xl mt-2 text-[#5FA37E]">{(compliance.unrestrictedRatio * 100).toFixed(1)}%</div></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><div className="text-xs text-[#A8998E]">Supervisors</div><div className="font-mono text-3xl mt-2 text-[#332C28]">{supervisorCount}</div></div>
          <div className="bg-[#332C28] rounded-2xl p-5 text-white"><div className="text-xs text-white/60 flex items-center gap-1"><ShieldCheck size={13} /> Baker compliance guidance</div><div className="font-mono text-3xl mt-2">{compliance.bakerComplianceScore}</div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link to={hasPaidFeatures ? '/baker-ai' : '/upgrade'} className="bg-white rounded-2xl border border-[#F2EDEA] p-5 flex items-start gap-3 hover:border-[#E85D70] transition-colors"><div className="w-10 h-10 rounded-xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center"><Bot size={19} /></div><div><div className="flex items-center gap-2 font-semibold text-[#332C28]">Baker AI {!hasPaidFeatures && <LockKeyhole size={13} className="text-[#A8998E]" />}</div><p className="text-xs text-[#A8998E] mt-1">Voice/text-to-entry and richer guidance.</p></div></Link>
          <Link to={hasPaidFeatures ? '/import' : '/upgrade'} className="bg-white rounded-2xl border border-[#F2EDEA] p-5 flex items-start gap-3 hover:border-[#D4A574] transition-colors"><div className="w-10 h-10 rounded-xl bg-[#FFF8F3] text-[#D4A574] flex items-center justify-center"><Upload size={19} /></div><div><div className="flex items-center gap-2 font-semibold text-[#332C28]">Ripley Import {!hasPaidFeatures && <LockKeyhole size={13} className="text-[#A8998E]" />}</div><p className="text-xs text-[#A8998E] mt-1">Batch large histories with duplicate protection.</p></div></Link>
          <Link to={canExportOfficialForms ? '/export' : '/upgrade'} className="bg-white rounded-2xl border border-[#F2EDEA] p-5 flex items-start gap-3 hover:border-[#5FA37E] transition-colors"><div className="w-10 h-10 rounded-xl bg-[#E8F5EE] text-[#5FA37E] flex items-center justify-center"><FileDown size={19} /></div><div><div className="flex items-center gap-2 font-semibold text-[#332C28]">BACB Export {!canExportOfficialForms && <LockKeyhole size={13} className="text-[#A8998E]" />}</div><p className="text-xs text-[#A8998E] mt-1">Monthly/final form-ready worksheets.</p></div></Link>
        </div>

        {showLog && <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 mb-6"><h2 className="font-serif text-xl font-semibold text-[#332C28] mb-5">Manual fieldwork entry <span className="text-xs font-sans font-normal text-[#5FA37E] ml-2">FREE</span></h2><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><label className="text-xs text-[#A8998E]">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label><label className="text-xs text-[#A8998E]">Start<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label><label className="text-xs text-[#A8998E]">End<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label><label className="text-xs text-[#A8998E]">Supervision min<input type="number" min="0" value={supervisionMinutes} onChange={(e) => setSupervisionMinutes(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label><label className="text-xs text-[#A8998E]">Category<select value={category} onChange={(e) => setCategory(e.target.value as 'RESTRICTED' | 'UNRESTRICTED')} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label><label className="text-xs text-[#A8998E]">Supervisor<input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label><label className="text-xs text-[#A8998E] sm:col-span-2">Activity / notes<input value={activity} onChange={(e) => setActivity(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" /></label></div><div className="mt-4 flex items-center gap-3"><button onClick={saveEntry} className="btn-primary px-5 py-2.5 rounded-xl">Save Entry</button>{notice && <span className="text-sm text-[#5FA37E]">{notice}</span>}</div></section>}

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden"><div className="p-6 border-b border-[#F2EDEA]"><h2 className="font-serif text-xl font-semibold text-[#332C28]">Your tracked records</h2><p className="text-sm text-[#A8998E] mt-1">These remain visible regardless of plan.</p></div>{entries.length === 0 ? <div className="p-10 text-center text-sm text-[#A8998E]">No hours yet. Use “Log Hours” to start tracking free.</div> : <div className="divide-y divide-[#F2EDEA] max-h-[680px] overflow-y-auto">{entries.map((entry) => <div key={entry.id} className="p-5"><div className="flex flex-col md:flex-row md:items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2 mb-2"><span className="font-medium text-[#332C28]">{entry.date}</span><span className="font-mono text-sm text-[#E85D70]">{entry.duration.toFixed(2)} hrs</span><span className="text-[10px] rounded-full bg-[#FAF8F6] px-2 py-1">{entry.activityCategory}</span><span className="text-[10px] rounded-full bg-[#FAF8F6] px-2 py-1">{entry.status}</span></div><p className="text-sm text-[#4D423C]">{entry.notes || 'No narrative.'}</p><div className="text-xs text-[#A8998E] mt-2">{entry.supervisorName} • {entry.supervisionMinutes || 0} supervision min</div>{entry.supervisorNote && <div className="mt-3 rounded-xl bg-[#E8F5EE] p-3 text-sm text-[#4B8C69]"><strong>Supervisor note:</strong> {entry.supervisorNote}</div>}</div>{hasSupervisorFeatures ? <button onClick={() => void createReviewInvite(entry)} className="shrink-0 rounded-xl border border-[#E2DAD5] px-3 py-2 text-xs font-semibold text-[#6B5D54]"><UserCheck size={14} className="inline mr-1" />Send to supervisor</button> : <Link to="/upgrade" className="shrink-0 rounded-xl border border-[#E2DAD5] px-3 py-2 text-xs font-semibold text-[#A8998E]"><LockKeyhole size={13} className="inline mr-1" />Professional</Link>}</div>{reviewEntryId === entry.id && reviewUrl && <div className="mt-4 rounded-xl bg-[#FFF5F7] p-3 flex flex-wrap gap-2"><button onClick={() => void navigator.clipboard.writeText(reviewUrl)} className="rounded-lg bg-white border border-[#FFC1CC] px-3 py-2 text-xs text-[#C9445A]"><Copy size={13} className="inline mr-1" />Copy review link</button><a href={`mailto:${encodeURIComponent(supervisorEmail)}?subject=${encodeURIComponent('Fieldwork by Baker review request')}&body=${encodeURIComponent(`Please review this fieldwork entry:\n\n${reviewUrl}`)}`} className="rounded-lg bg-[#E85D70] text-white px-3 py-2 text-xs font-semibold"><Mail size={13} className="inline mr-1" />Email supervisor</a></div>}</div>)}</div>}</section>

          <aside className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6"><h2 className="font-serif text-lg font-semibold text-[#332C28] mb-4">Compliance attention</h2>{compliance.alerts.length === 0 ? <div className="flex gap-2 text-sm text-[#5FA37E]"><CheckCircle2 size={17} />No recorded-rule violations detected.</div> : <div className="space-y-3">{compliance.alerts.slice(0, 6).map((alert) => <div key={alert.id} className="rounded-xl bg-[#FFF8F3] p-3 flex gap-2"><AlertTriangle size={15} className="text-[#B36A2E] shrink-0 mt-0.5" /><div><div className="text-sm font-medium text-[#6B4A2E]">{alert.label}</div><div className="text-xs text-[#A36F45] mt-1">{alert.value} • {alert.requirement}</div></div></div>)}</div>}</section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6"><div className="flex items-center gap-2 mb-3"><UserCheck size={18} className="text-[#D4A574]" /><h2 className="font-serif text-lg font-semibold text-[#332C28]">Supervisor workflow</h2></div>{hasSupervisorFeatures ? <><p className="text-sm text-[#A8998E] mb-4">Enter the supervisor once, then send signed review links from any entry.</p><label className="block text-xs text-[#A8998E] mb-3">Name<input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label><label className="block text-xs text-[#A8998E]">Email<input type="email" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label>{reviewError && <div className="mt-3 text-xs text-[#C9445A]">{reviewError}</div>}</> : <div className="rounded-2xl bg-[#FAF8F6] p-5 text-center"><LockKeyhole size={23} className="mx-auto text-[#A8998E] mb-2" /><div className="font-semibold text-[#332C28]">Professional feature</div><p className="text-xs text-[#A8998E] mt-1 mb-4">Supervisor portal, notes, and messages are included with Professional.</p><Link to="/upgrade" className="text-sm font-semibold text-[#E85D70]">Upgrade to Professional</Link></div>}</section>
          </aside>
        </div>
      </div>
    </div>
  );
}

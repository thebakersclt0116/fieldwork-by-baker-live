import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Bot, CheckCircle2, Clock, Copy, Mail, Plus, ShieldCheck, Upload, UserCheck } from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { evaluateCompliance, BACB_2027_SOURCES } from '@/lib/compliance2027';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  return category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER';
}

export default function EmilyDashboard() {
  const { user } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [showLogForm, setShowLogForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [supervisionMinutes, setSupervisionMinutes] = useState(0);
  const [message, setMessage] = useState('');
  const [reviewEntryId, setReviewEntryId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const totalHours = compliance.actualHours;
  const unrestrictedHours = compliance.unrestrictedHours;
  const restrictedHours = compliance.restrictedHours;
  const unrestrictedPercent = compliance.unrestrictedRatio * 100;
  const supervisorCount = useMemo(
    () => new Set(entries.map((entry) => entry.supervisorName).filter((name) => name && name !== 'Not specified')).size,
    [entries]
  );

  const saveManualEntry = () => {
    const duration = hoursBetween(startTime, endTime);
    if (!email || !date || duration <= 0) {
      setMessage('Enter a valid date and time range.');
      return;
    }
    const now = new Date().toISOString();
    const entry: HourEntry = {
      id: newId('manual'),
      userId: email,
      date,
      startTime,
      endTime,
      duration,
      fieldworkType: 'SUPERVISED',
      activityType: activityTypeFor(category),
      activityCategory: category,
      supervisorId: supervisor ? `manual_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'manual_unknown',
      supervisorName: supervisor || 'Not specified',
      setting: '',
      notes: activity || undefined,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      supervisionMinutes: Math.max(0, Number(supervisionMinutes) || 0) || undefined,
      individualSupervisionMinutes: Math.max(0, Number(supervisionMinutes) || 0) || undefined,
    };
    const nextEntries = addEntry(entry, email);
    setEntries(nextEntries);
    setMessage('Entry saved as Pending for supervisor review.');
    setActivity('');
  };

  const createReviewInvite = async (entry: HourEntry) => {
    const token = getStoredAccessToken();
    if (!token || !supervisorName.trim() || !supervisorEmail.trim()) {
      setInviteError('Enter the supervisor name and email first.');
      return;
    }
    setCreatingInvite(true);
    setInviteError('');
    setReviewUrl('');
    try {
      const response = await fetch('/api/supervisor-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supervisorName,
          supervisorEmail,
          reviewEntry: {
            id: entry.id,
            date: entry.date,
            duration: entry.duration,
            activityCategory: entry.activityCategory,
            narrative: entry.notes || '',
            supervisorName: entry.supervisorName,
            supervisionMinutes: entry.supervisionMinutes || 0,
          },
        }),
      });
      const payload = await response.json() as { path?: string; error?: string };
      if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create review link.');
      setReviewEntryId(entry.id);
      setReviewUrl(`${window.location.origin}${payload.path}`);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not create review link.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const reviewMailBody = reviewUrl
    ? `I shared a fieldwork entry with you in Fieldwork by Baker. Open this secure review link:\n\n${reviewUrl}`
    : '';

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-sm font-semibold text-[#E85D70] mb-2">Private beta dashboard</div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Welcome, {user?.name?.split(' ')[0] || 'there'}</h1>
            <p className="text-[#6B5D54]">Your actual fieldwork data, Baker AI guidance, imports, and supervisor review links live here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/baker-ai" className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] text-white px-5 py-3 text-sm font-semibold"><Bot size={17} /> Baker AI</Link>
            <Link to="/import" className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white text-[#6B5D54] px-5 py-3 text-sm font-semibold"><Upload size={17} /> Batch Import</Link>
            <button onClick={() => setShowLogForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] text-white px-5 py-3 text-sm font-semibold"><Plus size={17} /> Log Hours</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_.42fr] gap-6 mb-6">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5 shadow-sm"><div className="text-xs uppercase tracking-wider text-[#A8998E]">Total hours</div><div className="font-mono text-3xl text-[#332C28] mt-2">{totalHours.toFixed(1)}</div><div className="text-xs text-[#A8998E] mt-1">actual recorded</div></div>
            <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5 shadow-sm"><div className="text-xs uppercase tracking-wider text-[#A8998E]">Unrestricted</div><div className="font-mono text-3xl text-[#5FA37E] mt-2">{unrestrictedPercent.toFixed(1)}%</div><div className="text-xs text-[#A8998E] mt-1">{unrestrictedHours.toFixed(1)} hrs</div></div>
            <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5 shadow-sm"><div className="text-xs uppercase tracking-wider text-[#A8998E]">Restricted</div><div className="font-mono text-3xl text-[#E8A838] mt-2">{restrictedHours.toFixed(1)}</div><div className="text-xs text-[#A8998E] mt-1">hours</div></div>
            <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5 shadow-sm"><div className="text-xs uppercase tracking-wider text-[#A8998E]">Supervisors</div><div className="font-mono text-3xl text-[#332C28] mt-2">{supervisorCount}</div><div className="text-xs text-[#A8998E] mt-1">from your records</div></div>
          </section>

          <section className="bg-[#332C28] text-white rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3"><ShieldCheck size={18} className="text-[#D4A574]" /><span className="font-semibold">Compliance Oracle</span></div>
            <div className="flex items-end gap-3 mb-2"><span className="font-mono text-5xl font-semibold">{compliance.bakerComplianceScore}</span><span className="text-sm text-white/60 pb-1">/ 100 guidance</span></div>
            <p className="text-sm text-white/70 mb-4">{compliance.scoreLabel}. This is a Baker guidance score, not a BACB-issued score.</p>
            <div className="text-xs text-white/60">Equivalent progress</div><div className="font-mono text-xl mt-1">{compliance.weightedEquivalentHours} / 2000</div>
            {compliance.projectedCompletion && <div className="text-xs text-white/60 mt-3">Projected completion: <span className="text-white font-medium">{compliance.projectedCompletion}</span></div>}
          </section>
        </div>

        {showLogForm && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-5"><Clock size={18} className="text-[#E85D70]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Manual fieldwork entry</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-xs text-[#A8998E]">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label>
              <label className="text-xs text-[#A8998E]">Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label>
              <label className="text-xs text-[#A8998E]">End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label>
              <label className="text-xs text-[#A8998E]">Supervision minutes<input type="number" min="0" value={supervisionMinutes} onChange={(event) => setSupervisionMinutes(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" /></label>
              <label className="text-xs text-[#A8998E]">Category<select value={category} onChange={(event) => setCategory(event.target.value as 'RESTRICTED' | 'UNRESTRICTED')} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label>
              <label className="text-xs text-[#A8998E]">Supervisor<input value={supervisor} onChange={(event) => setSupervisor(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" placeholder="Dr. Martinez" /></label>
              <label className="text-xs text-[#A8998E] sm:col-span-2">Activity / narrative<input value={activity} onChange={(event) => setActivity(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm" placeholder="What did you do?" /></label>
            </div>
            <div className="mt-4 flex items-center gap-3"><button onClick={saveManualEntry} className="btn-primary px-5 py-2.5 rounded-xl">Save entry</button>{message && <span className="text-sm text-[#5FA37E]">{message}</span>}</div>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F2EDEA] flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold text-[#332C28]">Tracked entries</h2><p className="text-sm text-[#A8998E]">AI, imports, and manual logs all land here.</p></div><span className="text-sm text-[#A8998E]">{entries.length} entries</span></div>
            {entries.length === 0 ? (
              <div className="p-10 text-center"><Upload size={30} className="mx-auto text-[#E2DAD5] mb-3" /><h3 className="font-serif text-xl font-semibold text-[#332C28] mb-2">Start with your real data</h3><p className="text-sm text-[#A8998E] mb-5">Import Ripley or use Baker AI to create your first entry.</p><div className="flex justify-center gap-2"><Link to="/import" className="btn-primary px-4 py-2.5 rounded-xl">Import Ripley</Link><Link to="/baker-ai" className="px-4 py-2.5 rounded-xl border border-[#E2DAD5] text-sm">Use Baker AI</Link></div></div>
            ) : (
              <div className="divide-y divide-[#F2EDEA] max-h-[680px] overflow-y-auto">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2"><span className="font-medium text-[#332C28]">{entry.date}</span><span className="font-mono text-sm text-[#E85D70]">{entry.duration.toFixed(2)} hrs</span><span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${entry.activityCategory === 'UNRESTRICTED' ? 'bg-[#E8F5EE] text-[#5FA37E]' : 'bg-[#FFF3E0] text-[#B77722]'}`}>{entry.activityCategory}</span><span className="text-[10px] px-2 py-1 rounded-full bg-[#FAF8F6] text-[#6B5D54]">{entry.status}</span>{entry.aiGenerated && <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFF5F7] text-[#E85D70]">BAKER AI {entry.aiConfidence ? `${Math.round(entry.aiConfidence * 100)}%` : ''}</span>}</div>
                        <p className="text-sm text-[#4D423C] leading-relaxed">{entry.notes || 'No narrative.'}</p>
                        <div className="text-xs text-[#A8998E] mt-2">Supervisor: {entry.supervisorName} • supervision {entry.supervisionMinutes || 0} min</div>
                        {entry.supervisorNote && <div className="mt-3 rounded-xl bg-[#E8F5EE] p-3 text-sm text-[#4B8C69]"><strong>Supervisor note:</strong> {entry.supervisorNote}</div>}
                        {entry.supervisorMessage && <div className="mt-2 rounded-xl bg-[#FFF8F3] p-3 text-sm text-[#8A5D36]"><strong>Message:</strong> {entry.supervisorMessage}</div>}
                      </div>
                      <button onClick={() => void createReviewInvite(entry)} disabled={creatingInvite} className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] px-3 py-2 text-xs font-semibold text-[#6B5D54] hover:border-[#E85D70] hover:text-[#E85D70]"><UserCheck size={14} /> Send to supervisor</button>
                    </div>
                    {reviewEntryId === entry.id && reviewUrl && <div className="mt-4 rounded-2xl bg-[#FFF5F7] p-4"><div className="text-sm font-semibold text-[#C9445A] mb-2">Secure review link ready</div><div className="flex flex-col sm:flex-row gap-2"><button onClick={() => void navigator.clipboard.writeText(reviewUrl)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#FFC1CC] px-3 py-2 text-xs text-[#C9445A]"><Copy size={14} /> Copy link</button><a href={`mailto:${encodeURIComponent(supervisorEmail)}?subject=${encodeURIComponent('Fieldwork by Baker review request')}&body=${encodeURIComponent(reviewMailBody)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] text-white px-3 py-2 text-xs font-semibold"><Mail size={14} /> Email supervisor</a></div></div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4"><UserCheck size={18} className="text-[#D4A574]" /><h2 className="font-serif text-lg font-semibold text-[#332C28]">Supervisor beta access</h2></div>
              <p className="text-sm text-[#A8998E] mb-4">Enter the supervisor once, then use “Send to supervisor” on any entry to generate a 14-day signed review link.</p>
              <label className="block text-xs text-[#A8998E] mb-3">Supervisor name<input value={supervisorName} onChange={(event) => setSupervisorName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" placeholder="Dr. Martinez" /></label>
              <label className="block text-xs text-[#A8998E] mb-3">Supervisor email<input type="email" value={supervisorEmail} onChange={(event) => setSupervisorEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" placeholder="supervisor@example.com" /></label>
              {inviteError && <div className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-xs text-[#C9445A]">{inviteError}</div>}
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#332C28] mb-4">Compliance attention</h2>
              {compliance.alerts.length === 0 ? <div className="flex gap-2 text-sm text-[#5FA37E]"><CheckCircle2 size={17} className="mt-0.5" />No recorded-rule violations detected.</div> : <div className="space-y-3">{compliance.alerts.slice(0, 8).map((alert) => <div key={alert.id} className="rounded-xl bg-[#FFF8F3] p-3"><div className="flex items-start gap-2"><AlertTriangle size={15} className="text-[#B36A2E] mt-0.5" /><div><div className="text-sm font-medium text-[#6B4A2E]">{alert.label}</div><div className="text-xs text-[#A36F45] mt-1">{alert.value} • {alert.requirement}</div></div></div></div>)}</div>}
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#332C28] mb-2">Official fieldwork sources</h2>
              <p className="text-xs text-[#A8998E] mb-4">Baker&apos;s deterministic checks are mapped to official BACB fieldwork documents. Supervisor judgment still controls activity acceptability.</p>
              <div className="space-y-2">{BACB_2027_SOURCES.slice(0, 7).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-sm text-[#E85D70] hover:underline">{source.title}</a>)}</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

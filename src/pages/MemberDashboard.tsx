import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bot, CheckCircle2, Clock, Copy, FileDown, Lock, Mail, Plus, ShieldCheck, Upload, UserCheck } from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import BakerAIEntryAssistant from '@/components/BakerAIEntryAssistant';
import { BACB_2027_SOURCES, evaluateCompliance } from '@/lib/compliance2027';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  return category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER';
}

export default function MemberDashboard() {
  const { user, isFree, hasPaidFeatures, hasSupervisorFeatures, canExportOfficialForms } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [showManual, setShowManual] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [supervisionMinutes, setSupervisionMinutes] = useState(0);
  const [manualMessage, setManualMessage] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [sharingEntryId, setSharingEntryId] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [creatingReview, setCreatingReview] = useState(false);

  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const supervisorCount = useMemo(
    () => new Set(entries.map((entry) => entry.supervisorName).filter((name) => name && name !== 'Not specified')).size,
    [entries]
  );

  const saveManualEntry = () => {
    const duration = hoursBetween(startTime, endTime);
    if (!email || !date || duration <= 0) {
      setManualMessage('Enter a valid date and time range.');
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
      supervisionMinutes: supervisionMinutes > 0 ? supervisionMinutes : undefined,
      individualSupervisionMinutes: supervisionMinutes > 0 ? supervisionMinutes : undefined,
    };
    setEntries(addEntry(entry, email));
    setActivity('');
    setManualMessage('Saved as Pending for supervisor review.');
  };

  const createReviewLink = async (entry: HourEntry) => {
    const token = getStoredAccessToken();
    if (!hasSupervisorFeatures) {
      setShareMessage('Supervisor workflow is a Professional feature.');
      return;
    }
    if (!token || !supervisorName.trim() || !supervisorEmail.trim()) {
      setShareMessage('Enter your supervisor’s name and email first.');
      return;
    }
    setCreatingReview(true);
    setShareMessage('');
    setReviewUrl('');
    try {
      const response = await fetch('/api/supervisor-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create supervisor review link.');
      setSharingEntryId(entry.id);
      setReviewUrl(`${window.location.origin}${payload.path}`);
      setShareMessage('Secure supervisor review link created.');
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Could not create supervisor review link.');
    } finally {
      setCreatingReview(false);
    }
  };

  const badge = isFree
    ? 'FREE'
    : user?.subscription === 'professional' || user?.role === 'professional'
      ? 'PROFESSIONAL'
      : user?.subscription === 'enterprise'
        ? 'ENTERPRISE'
        : 'INDIVIDUAL';

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-[#E85D70]">Fieldwork workspace</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${isFree ? 'bg-[#FAF8F6] text-[#6B5D54]' : 'bg-[#E8F5EE] text-[#4B8C69]'}`}>{badge}</span>
            </div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Welcome, {user?.name?.split(' ')[0] || 'there'}</h1>
            <p className="text-[#6B5D54]">Log fieldwork, see compliance guidance, and send entries to your supervisor from one workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={hasPaidFeatures ? '/import' : '/upgrade'} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54]">{hasPaidFeatures ? <Upload size={16} /> : <Lock size={15} />} Import</Link>
            <Link to={canExportOfficialForms ? '/export' : '/upgrade'} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white">{canExportOfficialForms ? <FileDown size={16} /> : <Lock size={15} />} {canExportOfficialForms ? 'Export Center' : 'Upgrade to export'}</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Total hours" value={compliance.actualHours.toFixed(1)} />
          <Metric label="Unrestricted" value={`${(compliance.unrestrictedRatio * 100).toFixed(1)}%`} accent />
          <Metric label="Equivalent" value={String(compliance.weightedEquivalentHours)} />
          <Metric label="Supervisors" value={String(supervisorCount)} />
          <div className="col-span-2 lg:col-span-1 rounded-2xl bg-[#332C28] p-5 text-white">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><ShieldCheck size={14} className="text-[#D4A574]" /> Baker score</div>
            <div className="font-mono text-3xl mt-2">{compliance.bakerComplianceScore}</div>
            <div className="text-xs text-white/60 mt-1">{compliance.scoreLabel}</div>
          </div>
        </div>

        <section id="log-hours" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#A8998E]">Log Hours</div>
              <h2 className="font-serif text-2xl font-semibold text-[#332C28] mt-1">Use Baker AI or enter it manually</h2>
            </div>
            <button onClick={() => setShowManual((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54]"><Plus size={16} /> {showManual ? 'Hide manual' : 'Manual entry'}</button>
          </div>

          <BakerAIEntryAssistant email={email} entries={entries} onEntriesChange={setEntries} />

          {showManual && (
            <div className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5"><Clock size={18} className="text-[#E85D70]" /><h3 className="font-serif text-xl font-semibold text-[#332C28]">Manual entry</h3></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InputLabel label="Date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field-input" /></InputLabel>
                <InputLabel label="Start"><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="field-input" /></InputLabel>
                <InputLabel label="End"><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="field-input" /></InputLabel>
                <InputLabel label="Supervision minutes"><input type="number" min="0" value={supervisionMinutes} onChange={(event) => setSupervisionMinutes(Number(event.target.value))} className="field-input" /></InputLabel>
                <InputLabel label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as 'RESTRICTED' | 'UNRESTRICTED')} className="field-input bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></InputLabel>
                <InputLabel label="Supervisor"><input value={supervisor} onChange={(event) => setSupervisor(event.target.value)} placeholder="Dr. Martinez" className="field-input" /></InputLabel>
                <label className="text-xs text-[#A8998E] sm:col-span-2">Activity / narrative<input value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="What did you do?" className="field-input" /></label>
              </div>
              <div className="mt-4 flex items-center gap-3"><button onClick={saveManualEntry} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-5 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Save entry</button>{manualMessage && <span className="text-sm text-[#5FA37E]">{manualMessage}</span>}</div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_.75fr] gap-6">
          <section className="rounded-3xl border border-[#F2EDEA] bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#F2EDEA]"><div><h2 className="font-serif text-xl font-semibold text-[#332C28]">Tracked entries</h2><p className="text-sm text-[#A8998E]">AI and manual entries appear here immediately.</p></div><span className="text-sm text-[#A8998E]">{entries.length}</span></div>
            {entries.length === 0 ? (
              <div className="p-10 text-center"><Bot size={30} className="mx-auto text-[#E85D70] mb-3" /><h3 className="font-serif text-xl font-semibold text-[#332C28] mb-2">Your first entry can take seconds</h3><p className="text-sm text-[#A8998E]">Use Baker AI above and describe the session naturally.</p></div>
            ) : (
              <div className="divide-y divide-[#F2EDEA] max-h-[720px] overflow-y-auto">
                {entries.map((entry) => (
                  <article key={entry.id} className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-semibold text-[#332C28]">{entry.date}</span>
                          <span className="font-mono text-sm text-[#E85D70]">{entry.duration.toFixed(2)} hrs</span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${entry.activityCategory === 'UNRESTRICTED' ? 'bg-[#E8F5EE] text-[#5FA37E]' : 'bg-[#FFF3E0] text-[#B77722]'}`}>{entry.activityCategory}</span>
                          <span className="rounded-full bg-[#FAF8F6] px-2 py-1 text-[10px] font-semibold text-[#6B5D54]">{entry.status}</span>
                          {entry.aiGenerated && <span className="rounded-full bg-[#FFF5F7] px-2 py-1 text-[10px] font-semibold text-[#E85D70]">BAKER AI {entry.aiConfidence ? `${Math.round(entry.aiConfidence * 100)}%` : ''}</span>}
                        </div>
                        <p className="text-sm leading-relaxed text-[#6B5D54]">{entry.notes || 'No narrative added.'}</p>
                        <div className="mt-2 text-xs text-[#A8998E]">Supervisor: {entry.supervisorName} · Supervision: {entry.supervisionMinutes || 0} min</div>
                      </div>
                      <button onClick={() => { setSharingEntryId(entry.id); setReviewUrl(''); setShareMessage(''); }} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shrink-0 ${hasSupervisorFeatures ? 'bg-[#E8F5EE] text-[#4B8C69]' : 'bg-[#FAF8F6] text-[#A8998E]'}`}>{hasSupervisorFeatures ? <UserCheck size={15} /> : <Lock size={14} />} Supervisor review</button>
                    </div>

                    {sharingEntryId === entry.id && (
                      <div className="mt-4 rounded-2xl bg-[#FAF8F6] p-4">
                        {hasSupervisorFeatures ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input value={supervisorName} onChange={(event) => setSupervisorName(event.target.value)} placeholder="Supervisor name" className="rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm" />
                              <input type="email" value={supervisorEmail} onChange={(event) => setSupervisorEmail(event.target.value)} placeholder="supervisor@email.com" className="rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => void createReviewLink(entry)} disabled={creatingReview} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><UserCheck size={15} /> {creatingReview ? 'Creating…' : 'Create secure review link'}</button>
                              {reviewUrl && <button onClick={() => void navigator.clipboard.writeText(reviewUrl)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm text-[#6B5D54]"><Copy size={15} /> Copy link</button>}
                              {reviewUrl && <a href={`mailto:${encodeURIComponent(supervisorEmail)}?subject=${encodeURIComponent('Fieldwork by Baker review request')}&body=${encodeURIComponent(`Please review my fieldwork entry here:\n\n${reviewUrl}`)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#5FA37E] px-4 py-2.5 text-sm font-semibold text-white"><Mail size={15} /> Email supervisor</a>}
                            </div>
                            {shareMessage && <p className="mt-2 text-xs text-[#6B5D54]">{shareMessage}</p>}
                          </>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p className="text-sm text-[#6B5D54]">Supervisor review, Baker AI co-pilot, notes, and messaging are Professional features.</p><Link to="/upgrade" className="rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white">Upgrade</Link></div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-[#332C28] p-6 text-white shadow-sm">
              <div className="flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold">Compliance Oracle</h2></div>
              <div className="text-5xl font-mono font-semibold">{compliance.bakerComplianceScore}</div>
              <div className="text-sm text-white/60 mt-1 mb-5">Baker guidance score · {compliance.scoreLabel}</div>
              <div className="space-y-3">
                {compliance.alerts.slice(0, 4).map((alert) => <div key={alert.id} className="rounded-xl bg-white/10 p-3"><div className="text-sm font-semibold">{alert.label}</div><div className="text-xs text-white/65 mt-1">{alert.requirement}</div></div>)}
                {compliance.alerts.length === 0 && <div className="rounded-xl bg-white/10 p-3 text-sm text-white/75">No recorded-rule violations detected in the current data.</div>}
              </div>
            </section>

            <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-3">Official BACB references</h3>
              <p className="text-xs leading-relaxed text-[#A8998E] mb-4">Baker applies deterministic checks against published 2027 requirements. Your qualified supervisor remains the final authority on fieldwork acceptability.</p>
              <div className="space-y-2">{BACB_2027_SOURCES.slice(0, 5).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-sm text-[#E85D70] hover:underline">{source.title}</a>)}</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-2xl border border-[#F2EDEA] bg-white p-5"><div className="text-xs uppercase tracking-wider text-[#A8998E]">{label}</div><div className={`font-mono text-3xl mt-2 ${accent ? 'text-[#5FA37E]' : 'text-[#332C28]'}`}>{value}</div></div>;
}

function InputLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-[#A8998E]">{label}{children}</label>;
}

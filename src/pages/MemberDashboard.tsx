import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  FileDown,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import BakerAIEntryAssistant from '@/components/BakerAIEntryAssistant';
import { BACB_2027_SOURCES, evaluateCompliance } from '@/lib/compliance2027';
import {
  addEntry,
  getCurrentUserEmail,
  hoursBetween,
  loadEntries,
  newId,
  saveEntries,
} from '@/lib/fieldworkStore';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

type WorkPresence = 'INDEPENDENT' | 'SUPERVISED';
type SupervisionFormat = 'INDIVIDUAL' | 'GROUP';
type ObservationMode = 'IN_PERSON' | 'ONLINE' | 'PHONE';

type DetailedHourEntry = HourEntry & {
  organizationName?: string;
  workPresence?: WorkPresence;
  supervisionFormat?: SupervisionFormat;
  observationMode?: ObservationMode;
};

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED', presence: WorkPresence): ActivityType {
  if (category === 'RESTRICTED') return 'RESTRICTED_DIRECT';
  if (presence === 'SUPERVISED') return 'UNRESTRICTED_SUPERVISION';
  return 'UNRESTRICTED_OTHER';
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort();
}

function labelize(value: string | undefined): string {
  if (!value) return 'Not specified';
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reviewNarrative(entry: DetailedHourEntry): string {
  const metadata = [
    entry.organizationName ? `Organization: ${entry.organizationName}` : '',
    entry.startTime && entry.endTime && entry.startTime !== '00:00' ? `Time: ${entry.startTime}–${entry.endTime}` : '',
    entry.workPresence ? `Entry type: ${labelize(entry.workPresence)}` : '',
    entry.supervisionFormat ? `Supervision format: ${labelize(entry.supervisionFormat)}` : '',
    entry.observationMinutes ? `Client observation: ${entry.observationMinutes} min${entry.observationMode ? ` (${labelize(entry.observationMode)})` : ''}` : '',
    entry.clientInitials ? `Client: ${entry.clientInitials}` : '',
  ].filter(Boolean);
  return `${metadata.join(' • ')}${metadata.length ? '\n\n' : ''}${entry.notes || 'No activity narrative supplied.'}`;
}

function categoryChip(entry: DetailedHourEntry) {
  if (entry.activityCategory === 'UNKNOWN') return 'bg-[#F2EDEA] text-[#6B5D54]';
  return entry.activityCategory === 'UNRESTRICTED'
    ? 'bg-[#E8F5EE] text-[#4B8C69]'
    : 'bg-[#FFF3E0] text-[#B77722]';
}

export default function MemberDashboard() {
  const { user, isFree, hasPaidFeatures, hasSupervisorFeatures, canExportOfficialForms } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const [entries, setEntries] = useState<DetailedHourEntry[]>(() => loadEntries(email) as DetailedHourEntry[]);
  const [showManual, setShowManual] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:30');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [presence, setPresence] = useState<WorkPresence>('INDEPENDENT');
  const [supervisionFormat, setSupervisionFormat] = useState<SupervisionFormat>('INDIVIDUAL');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [organization, setOrganization] = useState('');
  const [setting, setSetting] = useState('');
  const [supervisionMinutes, setSupervisionMinutes] = useState(0);
  const [observationMinutes, setObservationMinutes] = useState(0);
  const [observationMode, setObservationMode] = useState<ObservationMode>('IN_PERSON');
  const [clientInitials, setClientInitials] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [sharingEntryId, setSharingEntryId] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [creatingReview, setCreatingReview] = useState(false);

  const duration = hoursBetween(startTime, endTime);
  const durationMinutes = Math.round(duration * 60);
  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const knownSupervisors = useMemo(
    () => unique(entries.map((entry) => entry.supervisorName).filter((name) => name !== 'Not specified')),
    [entries]
  );
  const knownOrganizations = useMemo(
    () => unique(entries.map((entry) => entry.organizationName)),
    [entries]
  );
  const supervisorCount = knownSupervisors.length;
  const organizationCount = knownOrganizations.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const latestMonth = useMemo(
    () => [...compliance.months].sort((a, b) => b.month.localeCompare(a.month))[0] || null,
    [compliance.months]
  );

  const saveManualEntry = () => {
    if (!email || !date || duration <= 0) {
      setManualMessage('Enter a valid date and time range.');
      return;
    }
    if (!organization.trim()) {
      setManualMessage('Choose or enter the organization responsible for this entry.');
      return;
    }
    if (!supervisor.trim()) {
      setManualMessage('Choose or enter the supervisor responsible for this entry.');
      return;
    }
    if (!activity.trim()) {
      setManualMessage('Add a short description of the activity.');
      return;
    }

    const supervised = presence === 'SUPERVISED';
    const exactSupervisionMinutes = supervised
      ? Math.min(durationMinutes, Math.max(0, Number(supervisionMinutes) || durationMinutes))
      : 0;
    const exactObservationMinutes = supervised
      ? Math.min(durationMinutes, Math.max(0, Number(observationMinutes) || 0))
      : 0;
    const now = new Date().toISOString();
    const entry = {
      id: newId('manual'),
      userId: email,
      date,
      startTime,
      endTime,
      duration,
      fieldworkType: 'SUPERVISED' as const,
      activityType: activityTypeFor(category, presence),
      activityCategory: category,
      supervisorId: `manual_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      supervisorName: supervisor.trim(),
      organizationName: organization.trim(),
      workPresence: presence,
      supervisionFormat: supervised ? supervisionFormat : undefined,
      observationMode: exactObservationMinutes > 0 ? observationMode : undefined,
      setting: setting.trim() || organization.trim(),
      notes: activity.trim(),
      status: 'PENDING' as const,
      createdAt: now,
      updatedAt: now,
      supervisionMinutes: exactSupervisionMinutes || undefined,
      observationMinutes: exactObservationMinutes || undefined,
      individualSupervisionMinutes: supervised && supervisionFormat === 'INDIVIDUAL'
        ? exactSupervisionMinutes || undefined
        : undefined,
      clientInitials: exactObservationMinutes > 0 ? clientInitials.trim().toUpperCase() || undefined : undefined,
    } satisfies DetailedHourEntry;

    setEntries(addEntry(entry, email) as DetailedHourEntry[]);
    setActivity('');
    setObservationMinutes(0);
    setClientInitials('');
    setManualMessage(`Saved ${duration.toFixed(2)} hours as Pending for supervisor review.`);
  };

  const deleteEntry = (entryId: string) => {
    if (!window.confirm('Delete this tracked entry? This cannot be undone.')) return;
    const next = entries.filter((entry) => entry.id !== entryId);
    saveEntries(next, email);
    setEntries(next);
    setSelectedIds((current) => current.filter((id) => id !== entryId));
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected entr${selectedIds.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
    const next = entries.filter((entry) => !selectedSet.has(entry.id));
    saveEntries(next, email);
    setEntries(next);
    setSelectedIds([]);
  };

  const deleteAll = () => {
    if (entries.length === 0) return;
    if (!window.confirm(`Delete all ${entries.length} tracked entries? Use this before a clean re-import. This cannot be undone.`)) return;
    saveEntries([], email);
    setEntries([]);
    setSelectedIds([]);
  };

  const toggleSelection = (entryId: string) => {
    setSelectedIds((current) => current.includes(entryId)
      ? current.filter((id) => id !== entryId)
      : [...current, entryId]);
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : entries.map((entry) => entry.id));
  };

  const createReviewLink = async (entry: DetailedHourEntry) => {
    const token = getStoredAccessToken();
    if (!hasSupervisorFeatures) {
      setShareMessage('Supervisor workflow is a Professional feature.');
      return;
    }
    const recipientName = supervisorName.trim() || entry.supervisorName;
    if (!token || !recipientName || !supervisorEmail.trim()) {
      setShareMessage('Enter the supervisor email. The entry’s assigned supervisor name will be used automatically.');
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
          supervisorName: recipientName,
          supervisorEmail,
          reviewEntry: {
            id: entry.id,
            date: entry.date,
            duration: entry.duration,
            activityCategory: entry.activityCategory,
            narrative: reviewNarrative(entry),
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
      <datalist id="known-supervisors">{knownSupervisors.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id="known-organizations">{knownOrganizations.map((name) => <option key={name} value={name} />)}</datalist>
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-[#E85D70]">Fieldwork workspace</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${isFree ? 'bg-[#FAF8F6] text-[#6B5D54]' : 'bg-[#E8F5EE] text-[#4B8C69]'}`}>{badge}</span>
            </div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Welcome, {user?.name?.split(' ')[0] || 'there'}</h1>
            <p className="text-[#6B5D54]">Every entry now ties the hours to a supervisor, organization, category, and supervision/observation context.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={hasPaidFeatures ? '/import' : '/upgrade'} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54]">{hasPaidFeatures ? <Upload size={16} /> : <Lock size={15} />} Import</Link>
            <Link to={canExportOfficialForms ? '/export' : '/upgrade'} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white">{canExportOfficialForms ? <FileDown size={16} /> : <Lock size={15} />} {canExportOfficialForms ? 'Export Center' : 'Upgrade to export'}</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Metric label="Total hours" value={compliance.actualHours.toFixed(2)} />
          <Metric label="Unrestricted" value={`${compliance.unrestrictedHours.toFixed(2)}h`} accent />
          <Metric label="Restricted" value={`${compliance.restrictedHours.toFixed(2)}h`} warning />
          <Metric label="Supervisors" value={String(supervisorCount)} />
          <Metric label="Organizations" value={String(organizationCount)} />
          <div className="rounded-2xl bg-[#332C28] p-5 text-white">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><ShieldCheck size={14} className="text-[#D4A574]" /> Baker score</div>
            <div className="font-mono text-3xl mt-2">{compliance.bakerComplianceScore}</div>
            <div className="text-xs text-white/60 mt-1">{compliance.scoreLabel}</div>
          </div>
        </div>

        {latestMonth && (
          <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-[#A8998E]">Monthly compliance</div>
                <h2 className="font-serif text-2xl font-semibold text-[#332C28] mt-1">{latestMonth.month}</h2>
              </div>
              <p className="text-xs text-[#A8998E]">Baker flags the recorded data; a qualified supervisor makes the final determination.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {latestMonth.checks.map((check) => (
                <div key={check.id} className={`rounded-2xl border p-4 ${check.state === 'pass' ? 'border-[#CFE7D9] bg-[#F4FBF7]' : check.state === 'fail' ? 'border-[#F1D1C0] bg-[#FFF8F3]' : 'border-[#E2DAD5] bg-[#FAF8F6]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-[#4D423C]">{check.label.replace(/^.*?\s/, '')}</div>
                    <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 ${check.state === 'pass' ? 'bg-[#E8F5EE] text-[#4B8C69]' : check.state === 'fail' ? 'bg-[#FDE8E9] text-[#C9445A]' : 'bg-[#F2EDEA] text-[#6B5D54]'}`}>{check.state}</span>
                  </div>
                  <div className="font-mono text-xl text-[#332C28] mt-2">{check.value}</div>
                  <div className="text-xs text-[#A8998E] mt-1">{check.requirement}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <SummaryStrip label="Unrestricted" value={`${latestMonth.unrestrictedHours.toFixed(2)} hrs`} />
              <SummaryStrip label="Restricted" value={`${Math.max(0, latestMonth.totalHours - latestMonth.unrestrictedHours - latestMonth.unknownCategoryHours).toFixed(2)} hrs`} />
              <SummaryStrip label="Category unknown" value={`${latestMonth.unknownCategoryHours.toFixed(2)} hrs`} />
            </div>
          </section>
        )}

        <section id="log-hours" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#A8998E]">Log Hours</div>
              <h2 className="font-serif text-2xl font-semibold text-[#332C28] mt-1">Use Baker AI or enter the details manually</h2>
            </div>
            <button onClick={() => setShowManual((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54]"><Plus size={16} /> {showManual ? 'Hide manual' : 'Manual entry'}</button>
          </div>

          <BakerAIEntryAssistant email={email} entries={entries} onEntriesChange={(next) => setEntries(next as DetailedHourEntry[])} />

          {showManual && (
            <div className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5"><Clock size={18} className="text-[#E85D70]" /><h3 className="font-serif text-xl font-semibold text-[#332C28]">Manual fieldwork entry</h3></div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InputLabel label="Date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field-input" /></InputLabel>
                <InputLabel label="Start time"><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="field-input" /></InputLabel>
                <InputLabel label="End time"><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="field-input" /></InputLabel>
                <div className="rounded-xl border border-[#F0D5DA] bg-[#FFF5F7] px-4 py-3">
                  <div className="text-xs text-[#A8998E]">Exact decimal</div>
                  <div className="font-mono text-2xl text-[#E85D70] mt-1">{duration > 0 ? duration.toFixed(2) : '0.00'}h</div>
                  <div className="text-xs text-[#A8998E]">{durationMinutes > 0 ? `${durationMinutes} minutes` : 'Choose a valid range'}</div>
                </div>

                <InputLabel label="Organization *"><input list="known-organizations" value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Melmark Carolinas" className="field-input" /></InputLabel>
                <InputLabel label="Responsible supervisor *"><input list="known-supervisors" value={supervisor} onChange={(event) => setSupervisor(event.target.value)} placeholder="Carrie, Christina, Brad…" className="field-input" /></InputLabel>
                <InputLabel label="Setting / location"><input value={setting} onChange={(event) => setSetting(event.target.value)} placeholder="School, clinic, home…" className="field-input" /></InputLabel>
                <InputLabel label="Independent or supervised"><select value={presence} onChange={(event) => setPresence(event.target.value as WorkPresence)} className="field-input bg-white"><option value="INDEPENDENT">Independent — BCBA not present</option><option value="SUPERVISED">Supervised — BCBA present/contact</option></select></InputLabel>

                <InputLabel label="Restricted / unrestricted"><select value={category} onChange={(event) => setCategory(event.target.value as 'RESTRICTED' | 'UNRESTRICTED')} className="field-input bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></InputLabel>

                {presence === 'SUPERVISED' && (
                  <>
                    <InputLabel label="Supervision format"><select value={supervisionFormat} onChange={(event) => setSupervisionFormat(event.target.value as SupervisionFormat)} className="field-input bg-white"><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></select></InputLabel>
                    <InputLabel label="Supervision minutes"><input type="number" min="0" max={durationMinutes || undefined} value={supervisionMinutes} onChange={(event) => setSupervisionMinutes(Number(event.target.value))} placeholder={String(durationMinutes)} className="field-input" /></InputLabel>
                    <InputLabel label="Client observation minutes"><input type="number" min="0" max={durationMinutes || undefined} value={observationMinutes} onChange={(event) => setObservationMinutes(Number(event.target.value))} className="field-input" /></InputLabel>
                    {observationMinutes > 0 && (
                      <>
                        <InputLabel label="Observation mode"><select value={observationMode} onChange={(event) => setObservationMode(event.target.value as ObservationMode)} className="field-input bg-white"><option value="IN_PERSON">In person</option><option value="ONLINE">Online / video</option><option value="PHONE">Phone</option></select></InputLabel>
                        <InputLabel label="Client initials"><input value={clientInitials} onChange={(event) => setClientInitials(event.target.value)} placeholder="Leo / AB" className="field-input" /></InputLabel>
                      </>
                    )}
                  </>
                )}

                <label className="text-xs text-[#A8998E] sm:col-span-2 lg:col-span-4">Description of activity *<textarea value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="What did you do? Example: Reviewed behavior plans with Carrie and analyzed ABC data." rows={3} className="field-input resize-none" /></label>
              </div>

              <div className="mt-4 rounded-2xl bg-[#FAF8F6] p-4 text-sm text-[#6B5D54]">
                <strong className="text-[#332C28]">This entry will count as:</strong>{' '}
                {category === 'UNRESTRICTED' ? `${duration.toFixed(2)} unrestricted hours` : `${duration.toFixed(2)} restricted hours`}
                {' '}• {presence === 'SUPERVISED' ? `${labelize(supervisionFormat)} supervised entry` : 'Independent entry'}
                {observationMinutes > 0 ? ` • ${observationMinutes} observation min (${labelize(observationMode)})` : ''}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <button onClick={saveManualEntry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] px-5 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Save entry</button>
                {manualMessage && <span className="text-sm text-[#5FA37E]">{manualMessage}</span>}
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_.75fr] gap-6">
          <section className="rounded-3xl border border-[#F2EDEA] bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F2EDEA] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div><h2 className="font-serif text-xl font-semibold text-[#332C28]">Tracked entries</h2><p className="text-sm text-[#A8998E]">Each row shows who supervised it, where it belongs, and exactly how the hours are categorized.</p></div>
                <span className="text-sm text-[#A8998E]">{entries.length} entries</span>
              </div>
              {entries.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] px-3 py-2 text-xs font-semibold text-[#6B5D54]"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all</label>
                  <button onClick={deleteSelected} disabled={selectedIds.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-[#E8C4C8] px-3 py-2 text-xs font-semibold text-[#C9445A] disabled:opacity-40"><Trash2 size={14} /> Delete selected ({selectedIds.length})</button>
                  <button onClick={deleteAll} className="inline-flex items-center gap-2 rounded-xl bg-[#FDE8E9] px-3 py-2 text-xs font-semibold text-[#C9445A]"><Trash2 size={14} /> Delete all</button>
                </div>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="p-10 text-center"><Bot size={30} className="mx-auto text-[#E85D70] mb-3" /><h3 className="font-serif text-xl font-semibold text-[#332C28] mb-2">Ready for a clean start</h3><p className="text-sm text-[#A8998E]">Import Ripley or log your next session with Baker AI.</p></div>
            ) : (
              <div className="divide-y divide-[#F2EDEA] max-h-[820px] overflow-y-auto">
                {entries.map((entry) => {
                  const unrestricted = entry.activityCategory === 'UNRESTRICTED' ? entry.duration : 0;
                  const restricted = entry.activityCategory === 'RESTRICTED' ? entry.duration : 0;
                  return (
                    <article key={entry.id} className="p-5">
                      <div className="flex gap-3">
                        <input aria-label={`Select entry ${entry.date}`} type="checkbox" className="mt-1" checked={selectedSet.has(entry.id)} onChange={() => toggleSelection(entry.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-semibold text-[#332C28]">{entry.date}</span>
                            <span className="font-mono text-sm text-[#E85D70]">{entry.duration.toFixed(2)} hrs</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${categoryChip(entry)}`}>{entry.activityCategory}</span>
                            <span className="rounded-full bg-[#FAF8F6] px-2 py-1 text-[10px] font-semibold text-[#6B5D54]">{entry.status}</span>
                            {entry.aiGenerated && <span className="rounded-full bg-[#FFF5F7] px-2 py-1 text-[10px] font-semibold text-[#E85D70]">BAKER AI {entry.aiConfidence ? `${Math.round(entry.aiConfidence * 100)}%` : ''}</span>}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                            <EntryFact label="Organization" value={entry.organizationName || entry.setting || 'Not specified'} />
                            <EntryFact label="Responsible supervisor" value={entry.supervisorName || 'Not specified'} />
                            <EntryFact label="Time" value={entry.startTime && entry.endTime && entry.startTime !== '00:00' ? `${entry.startTime}–${entry.endTime}` : `${entry.duration.toFixed(2)} hours recorded`} />
                            <EntryFact label="Entry type" value={entry.workPresence ? `${labelize(entry.workPresence)}${entry.supervisionFormat ? ` · ${labelize(entry.supervisionFormat)}` : ''}` : entry.supervisionMinutes ? 'Supervised' : 'Not specified'} />
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="rounded-xl bg-[#E8F5EE] px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-[#5FA37E]">Unrestricted</div><div className="font-mono text-lg text-[#3F7F5C]">{unrestricted.toFixed(2)}h</div></div>
                            <div className="rounded-xl bg-[#FFF3E0] px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-[#B77722]">Restricted</div><div className="font-mono text-lg text-[#9D651B]">{restricted.toFixed(2)}h</div></div>
                          </div>

                          <p className="text-sm leading-relaxed text-[#6B5D54]">{entry.notes || 'No narrative added.'}</p>
                          <div className="mt-2 text-xs text-[#A8998E]">
                            Supervision {entry.supervisionMinutes || 0} min
                            {entry.observationMinutes ? ` • client observation ${entry.observationMinutes} min${entry.observationMode ? ` (${labelize(entry.observationMode)})` : ''}` : ' • no client observation recorded'}
                            {entry.clientInitials ? ` • client ${entry.clientInitials}` : ''}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => { setSharingEntryId(entry.id); setSupervisorName(entry.supervisorName || ''); setReviewUrl(''); setShareMessage(''); }} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${hasSupervisorFeatures ? 'bg-[#E8F5EE] text-[#4B8C69]' : 'bg-[#FAF8F6] text-[#A8998E]'}`}>{hasSupervisorFeatures ? <UserCheck size={15} /> : <Lock size={14} />} Supervisor review</button>
                            <button onClick={() => deleteEntry(entry.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#F0D5DA] px-3 py-2 text-xs font-semibold text-[#C9445A]"><Trash2 size={14} /> Delete entry</button>
                          </div>
                        </div>
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
                                <button onClick={() => void createReviewLink(entry)} disabled={creatingReview} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><UserCheck size={14} /> {creatingReview ? 'Creating…' : 'Create signed review link'}</button>
                                {reviewUrl && <button onClick={() => void navigator.clipboard.writeText(reviewUrl)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-xs text-[#6B5D54]"><Copy size={14} /> Copy link</button>}
                                {reviewUrl && <a href={`mailto:${encodeURIComponent(supervisorEmail)}?subject=${encodeURIComponent('Fieldwork by Baker review request')}&body=${encodeURIComponent(`Please review my fieldwork entry here:\n\n${reviewUrl}`)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-3 py-2.5 text-xs font-semibold text-white"><Mail size={14} /> Email supervisor</a>}
                              </div>
                              {shareMessage && <div className="mt-2 text-xs text-[#6B5D54]">{shareMessage}</div>}
                            </>
                          ) : (
                            <div className="text-sm text-[#6B5D54]">Upgrade to Professional to create signed supervisor review links.</div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4"><AlertTriangle size={18} className="text-[#D4A574]" /><h2 className="font-serif text-lg font-semibold text-[#332C28]">Compliance attention</h2></div>
              {compliance.alerts.length === 0
                ? <div className="flex gap-2 text-sm text-[#5FA37E]"><CheckCircle2 size={17} className="mt-0.5" />No recorded-rule violations detected.</div>
                : <div className="space-y-3">{compliance.alerts.slice(0, 10).map((alert) => <div key={alert.id} className="rounded-xl bg-[#FFF8F3] p-3"><div className="text-sm font-medium text-[#6B4A2E]">{alert.label}</div><div className="text-xs text-[#A36F45] mt-1">{alert.value} • {alert.requirement}</div></div>)}</div>}
            </section>

            <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#332C28] mb-2">What Baker tracks monthly</h2>
              <div className="space-y-3 text-sm text-[#6B5D54]">
                <TrackingLine title="20–160 fieldwork hours" description="Shows red when recorded monthly hours fall outside the supervisory-period range." />
                <TrackingLine title="Supervision percentage" description="Tracks supervision minutes against the fieldwork type’s required percentage." />
                <TrackingLine title="Client observation" description="Tracks cumulative client-observation minutes for the month." />
                <TrackingLine title="Restricted vs unrestricted" description="Shows both hour totals clearly and preserves Unknown when an imported summary does not provide the split." />
                <TrackingLine title="Individual vs group" description="Tracks the split without treating group supervision as individual supervision." />
              </div>
            </section>

            <section className="rounded-3xl border border-[#F2EDEA] bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#332C28] mb-2">Official fieldwork sources</h2>
              <p className="text-xs text-[#A8998E] mb-4">Baker provides documentation guidance, not BACB approval. Supervisor judgment controls activity acceptability and verification.</p>
              <div className="space-y-2">{BACB_2027_SOURCES.slice(0, 7).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-sm text-[#E85D70] hover:underline">{source.title}</a>)}</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false, warning = false }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  const color = accent ? 'text-[#5FA37E]' : warning ? 'text-[#B77722]' : 'text-[#332C28]';
  return <div className="rounded-2xl border border-[#F2EDEA] bg-white p-5"><div className="text-xs uppercase tracking-wider text-[#A8998E]">{label}</div><div className={`font-mono text-3xl mt-2 ${color}`}>{value}</div></div>;
}

function InputLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-[#A8998E]">{label}{children}</label>;
}

function EntryFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#FAF8F6] px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-[#A8998E]">{label}</div><div className="text-sm font-medium text-[#4D423C] mt-0.5">{value}</div></div>;
}

function SummaryStrip({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#F2EDEA] bg-[#FAF8F6] px-4 py-3 flex items-center justify-between gap-3"><span className="text-sm text-[#6B5D54]">{label}</span><strong className="font-mono text-[#332C28]">{value}</strong></div>;
}

function TrackingLine({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl bg-[#FAF8F6] p-3"><div className="font-semibold text-[#4D423C]">{title}</div><div className="text-xs text-[#A8998E] mt-1 leading-relaxed">{description}</div></div>;
}

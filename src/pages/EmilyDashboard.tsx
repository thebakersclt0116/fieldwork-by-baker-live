import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Clock, Upload } from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import { EMILY_EMAIL, addEntry, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  return category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER';
}

export default function EmilyDashboard() {
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(EMILY_EMAIL));
  const [showLogForm, setShowLogForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [message, setMessage] = useState('');

  const totalHours = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.duration, 0),
    [entries]
  );
  const unrestrictedHours = useMemo(
    () => entries
      .filter((entry) => entry.activityCategory === 'UNRESTRICTED')
      .reduce((sum, entry) => sum + entry.duration, 0),
    [entries]
  );
  const restrictedHours = totalHours - unrestrictedHours;
  const unrestrictedPercent = totalHours > 0 ? (unrestrictedHours / totalHours) * 100 : 0;
  const supervisorCount = useMemo(
    () => new Set(
      entries
        .map((entry) => entry.supervisorName)
        .filter((name) => name && name !== 'Not specified')
    ).size,
    [entries]
  );

  const saveManualEntry = () => {
    const duration = hoursBetween(startTime, endTime);
    if (!date || duration <= 0) {
      setMessage('Enter a valid date and time range.');
      return;
    }

    const now = new Date().toISOString();
    const entry: HourEntry = {
      id: newId('manual'),
      userId: EMILY_EMAIL,
      date,
      startTime,
      endTime,
      duration,
      fieldworkType: 'SUPERVISED',
      activityType: activityTypeFor(category),
      activityCategory: category,
      supervisorId: supervisor
        ? `manual_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
        : 'manual_unknown',
      supervisorName: supervisor || 'Not specified',
      setting: '',
      notes: activity || undefined,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const nextEntries = addEntry(entry, EMILY_EMAIL);
    setEntries(nextEntries);
    setMessage('Entry saved.');
    setActivity('');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-3xl font-semibold text-[#332C28]">Welcome, Emily</h1>
              <span className="px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#5FA37E] text-xs font-semibold">
                PRO • ANNUAL
              </span>
            </div>
            <p className="text-sm text-[#A8998E]">
              Your test account uses only your imported or manually logged fieldwork data.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLogForm((value) => !value)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#6B5D54] font-medium"
            >
              <Clock size={16} /> Log Hours
            </button>
            <Link
              to="/import"
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-xl"
            >
              <Upload size={16} /> Import Ripley
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Hours" value={totalHours.toFixed(2)} helper="of 2,000" />
          <StatCard
            label="Unrestricted"
            value={`${unrestrictedPercent.toFixed(1)}%`}
            helper={`${unrestrictedHours.toFixed(2)} hrs`}
          />
          <StatCard label="Restricted" value={restrictedHours.toFixed(2)} helper="hours" />
          <StatCard label="Supervisors" value={String(supervisorCount)} helper="from your records" />
        </div>

        {showLogForm && (
          <div className="bg-white rounded-3xl border border-[#F2EDEA] p-6 mb-6 shadow-sm">
            <h2 className="font-serif text-xl font-semibold text-[#332C28] mb-5">Log Fieldwork Hours</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date">
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field-input" />
              </Field>
              <Field label="Supervisor">
                <input value={supervisor} onChange={(event) => setSupervisor(event.target.value)} placeholder="Supervisor name" className="field-input" />
              </Field>
              <Field label="Start Time">
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="field-input" />
              </Field>
              <Field label="End Time">
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="field-input" />
              </Field>
              <Field label="Category">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as 'RESTRICTED' | 'UNRESTRICTED')}
                  className="field-input bg-white"
                >
                  <option value="UNRESTRICTED">Unrestricted</option>
                  <option value="RESTRICTED">Restricted</option>
                </select>
              </Field>
              <Field label="Activity">
                <input value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Activity description" className="field-input" />
              </Field>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <button onClick={saveManualEntry} className="btn-primary px-6 py-3 rounded-xl">Save Entry</button>
              {message && <span className="text-sm text-[#5FA37E]">{message}</span>}
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#F2EDEA] p-10 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mx-auto mb-5">
              <Upload size={28} />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">Brand-new account</h2>
            <p className="text-[#6B5D54] max-w-xl mx-auto mb-6">
              No sample fieldwork is loaded. Import your actual Ripley history to populate your progress.
            </p>
            <Link to="/import" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl">
              <Upload size={16} /> Import Ripley Hours
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#332C28]">Tracked Hours</h2>
                <p className="text-sm text-[#A8998E]">Imported and manually logged entries</p>
              </div>
              <span className="text-sm text-[#A8998E]">{entries.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-[#A8998E] border-b border-[#F2EDEA]">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Hours</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Supervisor</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-[#F2EDEA]/70 text-sm">
                      <td className="py-3 text-[#332C28]">{entry.date}</td>
                      <td className="py-3 font-mono">{entry.duration.toFixed(2)}</td>
                      <td className="py-3">{entry.activityCategory}</td>
                      <td className="py-3 text-[#6B5D54]">{entry.supervisorName}</td>
                      <td className="py-3 text-[#A8998E]">{entry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-[#A8998E] mt-5 text-center">
          Test-mode data is currently stored in this browser only and does not sync across devices.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#F2EDEA] p-6 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-[#A8998E] mb-2">{label}</p>
      <p className="font-mono text-3xl text-[#332C28] mb-1">{value}</p>
      <p className="text-xs text-[#A8998E]">{helper}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm text-[#6B5D54]">
      {label}
      <div className="mt-2 [&_.field-input]:w-full [&_.field-input]:border [&_.field-input]:border-[#E2DAD5] [&_.field-input]:rounded-xl [&_.field-input]:px-4 [&_.field-input]:py-3">
        {children}
      </div>
    </label>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  BarChart3,
  CalendarDays,
  Clock,
  FileText,
  Plus,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import type { ActivityType, HourEntry } from '@/types';
import {
  EMILY_EMAIL,
  addEntry,
  hoursBetween,
  loadEntries,
  newId,
} from '@/lib/fieldworkStore';

type Tab = 'overview' | 'log' | 'calendar' | 'analytics' | 'forms' | 'supervisors';

const tabs: Array<{ id: Tab; label: string; icon: typeof Clock }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'log', label: 'Log Hours', icon: Clock },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'supervisors', label: 'Supervisors', icon: Users },
];

function activityTypeFor(category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  return category === 'RESTRICTED' ? 'RESTRICTED_DIRECT' : 'UNRESTRICTED_OTHER';
}

export default function EmilyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(EMILY_EMAIL));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<'RESTRICTED' | 'UNRESTRICTED'>('UNRESTRICTED');
  const [activity, setActivity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [notes, setNotes] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const totalHours = useMemo(() => entries.reduce((sum, entry) => sum + entry.duration, 0), [entries]);
  const unrestrictedHours = useMemo(
    () => entries.filter((entry) => entry.activityCategory === 'UNRESTRICTED').reduce((sum, entry) => sum + entry.duration, 0),
    [entries]
  );
  const restrictedHours = totalHours - unrestrictedHours;
  const unrestrictedPct = totalHours > 0 ? (unrestrictedHours / totalHours) * 100 : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthHours = useMemo(
    () => entries.filter((entry) => entry.date.startsWith(currentMonth)).reduce((sum, entry) => sum + entry.duration, 0),
    [entries, currentMonth]
  );
  const supervisorNames = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.supervisorName).filter((name) => name && name !== 'Not specified'))),
    [entries]
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, HourEntry[]>();
    entries.forEach((entry) => {
      const current = groups.get(entry.date) || [];
      current.push(entry);
      groups.set(entry.date, current);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, { total: number; unrestricted: number; restricted: number }>();
    entries.forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const current = groups.get(month) || { total: 0, unrestricted: 0, restricted: 0 };
      current.total += entry.duration;
      if (entry.activityCategory === 'UNRESTRICTED') current.unrestricted += entry.duration;
      else current.restricted += entry.duration;
      groups.set(month, current);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const saveManualEntry = () => {
    const duration = hoursBetween(startTime, endTime);
    if (!date || duration <= 0) {
      setSavedMessage('Enter a valid date and time range.');
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
      supervisorId: supervisor ? `manual_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'manual_unknown',
      supervisorName: supervisor || 'Not specified',
      setting: '',
      notes: notes || activity || undefined,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    const next = addEntry(entry, EMILY_EMAIL);
    setEntries(next);
    setSavedMessage('Hours saved.');
    setActivity('');
    setNotes('');
  };

  const emptyState = (
    <div className="bg-white rounded-3xl border border-[#F2EDEA] p-10 text-center shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mx-auto mb-5">
        <Upload size={28} />
      </div>
      <h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">Your fieldwork starts here</h2>
      <p className="text-[#6B5D54] max-w-xl mx-auto mb-6">This account has no sample hours, supervisors, forms, or analytics. Import your real Ripley history to test the platform with your own data.</p>
      <Link to="/import" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl">
        <Upload size={16} /> Import Ripley Hours
      </Link>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-24 pb-16">
      <div className="container-2xl px-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-3xl font-semibold text-[#332C28]">Welcome, Emily</h1>
              <span className="px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#5FA37E] text-xs font-semibold">PRO • ANNUAL</span>
            </div>
            <p className="text-sm text-[#A8998E]">Clean test account • data is stored only in this browser for now</p>
          </div>
          <Link to="/import" className="btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-xl self-start">
            <Upload size={16} /> Import Hours
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-[#F2EDEA] p-2 mb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-[#FFF5F7] text-[#E85D70]' : 'text-[#6B5D54] hover:bg-[#FAF8F6]'}`}
                >
                  <Icon size={16} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Total Hours', totalHours.toFixed(2), 'of 2,000'],
                ['Unrestricted', `${unrestrictedPct.toFixed(1)}%`, `${unrestrictedHours.toFixed(2)} hrs`],
                ['This Month', thisMonthHours.toFixed(2), '130 max'],
                ['Supervisors', String(supervisorNames.length), 'from your records'],
              ].map(([label, value, helper]) => (
                <div key={label} className="bg-white rounded-2xl border border-[#F2EDEA] p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-[#A8998E] mb-2">{label}</p>
                  <p className="font-mono text-3xl text-[#332C28] mb-1">{value}</p>
                  <p className="text-xs text-[#A8998E]">{helper}</p>
                </div>
              ))}
            </div>
            {entries.length === 0 ? emptyState : (
              <div className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-semibold text-[#332C28]">Recent Entries</h2>
                  <button onClick={() => setActiveTab('log')} className="text-sm text-[#E85D70] font-medium">Log another entry</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead><tr className="text-left text-xs uppercase tracking-wider text-[#A8998E] border-b border-[#F2EDEA]"><th className="pb-3">Date</th><th className="pb-3">Hours</th><th className="pb-3">Category</th><th className="pb-3">Supervisor</th><th className="pb-3">Status</th></tr></thead>
                    <tbody>{entries.slice(0, 10).map((entry) => <tr key={entry.id} className="border-b border-[#F2EDEA]/70 text-sm"><td className="py-3 text-[#332C28]">{entry.date}</td><td className="py-3 font-mono">{entry.duration.toFixed(2)}</td><td className="py-3">{entry.activityCategory}</td><td className="py-3 text-[#6B5D54]">{entry.supervisorName}</td><td className="py-3 text-[#A8998E]">{entry.status}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="max-w-3xl bg-white rounded-3xl border border-[#F2EDEA] p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6"><Plus size={20} className="text-[#E85D70]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Log Fieldwork Hours</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-[#6B5D54]">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
              <label className="text-sm text-[#6B5D54]">Supervisor<input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Supervisor name" className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
              <label className="text-sm text-[#6B5D54]">Start Time<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
              <label className="text-sm text-[#6B5D54]">End Time<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
              <label className="text-sm text-[#6B5D54]">Category<select value={category} onChange={(e) => setCategory(e.target.value as 'RESTRICTED' | 'UNRESTRICTED')} className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3 bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label>
              <label className="text-sm text-[#6B5D54]">Activity<input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Activity description" className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
              <label className="sm:col-span-2 text-sm text-[#6B5D54]">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full border border-[#E2DAD5] rounded-xl px-4 py-3" /></label>
            </div>
            <div className="mt-5 flex items-center gap-4"><button onClick={saveManualEntry} className="btn-primary px-6 py-3 rounded-xl">Save Entry</button>{savedMessage && <span className="text-sm text-[#5FA37E]">{savedMessage}</span>}</div>
          </div>
        )}

        {activeTab === 'calendar' && (
          entries.length === 0 ? emptyState : <div className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm"><h2 className="font-serif text-xl font-semibold text-[#332C28] mb-5">Fieldwork Calendar</h2><div className="space-y-3">{byDate.map(([day, dayEntries]) => <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-[#FAF8F6] p-4"><div><div className="font-medium text-[#332C28]">{day}</div><div className="text-xs text-[#A8998E]">{dayEntries.length} entries</div></div><div className="font-mono text-[#E85D70]">{dayEntries.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hrs</div></div>)}</div></div>
        )}

        {activeTab === 'analytics' && (
          entries.length === 0 ? emptyState : <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white rounded-2xl border border-[#F2EDEA] p-6"><p className="text-xs text-[#A8998E] mb-2">Progress</p><p className="font-mono text-3xl text-[#332C28]">{((totalHours / 2000) * 100).toFixed(1)}%</p></div><div className="bg-white rounded-2xl border border-[#F2EDEA] p-6"><p className="text-xs text-[#A8998E] mb-2">Unrestricted</p><p className="font-mono text-3xl text-[#7EB89A]">{unrestrictedHours.toFixed(2)}</p></div><div className="bg-white rounded-2xl border border-[#F2EDEA] p-6"><p className="text-xs text-[#A8998E] mb-2">Restricted</p><p className="font-mono text-3xl text-[#E8A838]">{restrictedHours.toFixed(2)}</p></div></div><div className="bg-white rounded-3xl border border-[#F2EDEA] p-6"><h2 className="font-serif text-xl font-semibold text-[#332C28] mb-5">Monthly Trend</h2><div className="space-y-4">{byMonth.map(([month, values]) => <div key={month}><div className="flex justify-between text-sm mb-1"><span className="text-[#6B5D54]">{month}</span><span className="font-mono text-[#332C28]">{values.total.toFixed(2)} hrs</span></div><div className="h-3 rounded-full bg-[#F2EDEA] overflow-hidden"><div className="h-full bg-[#E85D70] rounded-full" style={{ width: `${Math.min((values.total / 130) * 100, 100)}%` }} /></div></div>)}</div></div></div>
        )}

        {activeTab === 'forms' && (
          entries.length === 0 ? emptyState : <div className="bg-white rounded-3xl border border-[#F2EDEA] p-8 shadow-sm"><h2 className="font-serif text-xl font-semibold text-[#332C28] mb-3">BACB Form Data</h2><p className="text-sm text-[#A8998E] mb-6">Imported hours are now available for monthly verification calculations.</p><div className="grid grid-cols-3 gap-4"><div className="rounded-xl bg-[#FAF8F6] p-4 text-center"><div className="font-mono text-2xl">{thisMonthHours.toFixed(2)}</div><div className="text-xs text-[#A8998E]">This Month</div></div><div className="rounded-xl bg-[#FAF8F6] p-4 text-center"><div className="font-mono text-2xl text-[#7EB89A]">{unrestrictedHours.toFixed(2)}</div><div className="text-xs text-[#A8998E]">Unrestricted</div></div><div className="rounded-xl bg-[#FAF8F6] p-4 text-center"><div className="font-mono text-2xl text-[#E8A838]">{restrictedHours.toFixed(2)}</div><div className="text-xs text-[#A8998E]">Restricted</div></div></div></div>
        )}

        {activeTab === 'supervisors' && (
          supervisorNames.length === 0 ? <div className="bg-white rounded-3xl border border-[#F2EDEA] p-10 text-center shadow-sm"><Users size={30} className="mx-auto text-[#E2DAD5] mb-3" /><h2 className="font-serif text-xl font-semibold text-[#332C28] mb-2">No supervisors yet</h2><p className="text-[#A8998E]">Supervisor names will populate automatically from imported Ripley records.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{supervisorNames.map((name) => { const hours = entries.filter((entry) => entry.supervisorName === name).reduce((sum, entry) => sum + entry.duration, 0); return <div key={name} className="bg-white rounded-2xl border border-[#F2EDEA] p-6 shadow-sm"><div className="w-11 h-11 rounded-full bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center font-semibold mb-3">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><h3 className="font-semibold text-[#332C28]">{name}</h3><p className="text-sm text-[#A8998E] mt-1">{hours.toFixed(2)} tracked hours</p></div>; })}</div>
        )}
      </div>
    </div>
  );
}

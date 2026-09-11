import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, ExternalLink, FileDown, LockKeyhole, Printer, ShieldCheck } from 'lucide-react';
import type { HourEntry } from '@/types';
import { getCurrentUserEmail, loadEntries } from '@/lib/fieldworkStore';
import { BACB_2027_SOURCES } from '@/lib/compliance2027';
import { useAuth } from '@/hooks/useAuth';

type FormRow = {
  month: string;
  supervisor: string;
  fieldworkType: 'SUPERVISED' | 'CONCENTRATED';
  independentHours: number;
  supervisedHours: number;
  observationHours: number;
  totalHours: number;
  supervisionPercent: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildMonthlyRows(entries: HourEntry[]): FormRow[] {
  const groups = new Map<string, HourEntry[]>();
  entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    const key = `${month}|${entry.supervisorName || 'Not specified'}|${entry.fieldworkType}`;
    const current = groups.get(key) || [];
    current.push(entry);
    groups.set(key, current);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const [month, supervisor, fieldworkType] = key.split('|') as [string, string, 'SUPERVISED' | 'CONCENTRATED'];
    const totalHours = group.reduce((sum, entry) => sum + entry.duration, 0);
    const supervisedHours = Math.min(totalHours, group.reduce((sum, entry) => sum + (entry.supervisionMinutes || 0) / 60, 0));
    const observationHours = group.reduce((sum, entry) => sum + (entry.observationMinutes || 0) / 60, 0);
    const independentHours = Math.max(0, totalHours - supervisedHours);
    return {
      month,
      supervisor,
      fieldworkType,
      independentHours: round(independentHours),
      supervisedHours: round(supervisedHours),
      observationHours: round(observationHours),
      totalHours: round(totalHours),
      supervisionPercent: totalHours > 0 ? round((supervisedHours / totalHours) * 100) : 0,
    };
  }).sort((a, b) => a.month.localeCompare(b.month) || a.supervisor.localeCompare(b.supervisor));
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ExportCenter() {
  const { canExportOfficialForms } = useAuth();
  const email = getCurrentUserEmail() || '';
  const entries = useMemo(() => loadEntries(email), [email]);
  const rows = useMemo(() => buildMonthlyRows(entries), [entries]);
  const [traineeName, setTraineeName] = useState('');
  const [bacbId, setBacbId] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('United States');
  const [supervisorCertification, setSupervisorCertification] = useState('');

  const finalTotals = useMemo(() => {
    const initial = {
      SUPERVISED: { independent: 0, supervised: 0, total: 0 },
      CONCENTRATED: { independent: 0, supervised: 0, total: 0 },
    };
    rows.forEach((row) => {
      initial[row.fieldworkType].independent += row.independentHours;
      initial[row.fieldworkType].supervised += row.supervisedHours;
      initial[row.fieldworkType].total += row.totalHours;
    });
    return initial;
  }, [rows]);

  const exportMonthly = () => {
    const header = [
      'Trainee Name','BACB ID','Month/Year','State','Country','Supervisor Name','Supervisor Certification/BACB ID','Fieldwork Type','Independent Hours','Supervised Hours','Observation Hours','Total Fieldwork Hours','Percentage Hours Supervised'
    ];
    const data = rows.map((row) => [
      traineeName,bacbId,row.month,state,country,row.supervisor,supervisorCertification,row.fieldworkType,row.independentHours,row.supervisedHours,row.observationHours,row.totalHours,`${row.supervisionPercent}%`
    ]);
    const csv = [header, ...data].map((line) => line.map(csvEscape).join(',')).join('\n');
    downloadText('baker-2027-monthly-fieldwork-verification-worksheet.csv', csv);
  };

  const exportFinal = () => {
    const dates = entries.map((entry) => entry.date).sort();
    const supervised = finalTotals.SUPERVISED;
    const concentrated = finalTotals.CONCENTRATED;
    const lines = [
      ['Trainee Name','BACB ID','Start Date','End Date','State','Country','Supervisor Certification/BACB ID','Supervised Independent Hours','Supervised Supervisor-Present Hours','Supervised Total Hours','Supervised % Supervised','Concentrated Independent Hours','Concentrated Supervisor-Present Hours','Concentrated Total Hours','Concentrated % Supervised'],
      [
        traineeName,bacbId,dates[0] || '',dates.at(-1) || '',state,country,supervisorCertification,
        round(supervised.independent),round(supervised.supervised),round(supervised.total),supervised.total > 0 ? `${round((supervised.supervised / supervised.total) * 100)}%` : '0%',
        round(concentrated.independent),round(concentrated.supervised),round(concentrated.total),concentrated.total > 0 ? `${round((concentrated.supervised / concentrated.total) * 100)}%` : '0%'
      ],
    ];
    downloadText('baker-2027-final-fieldwork-verification-worksheet.csv', lines.map((line) => line.map(csvEscape).join(',')).join('\n'));
  };

  if (!canExportOfficialForms) {
    return (
      <div className="min-h-[70vh] bg-[#FFFCF9] flex items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-[#F2EDEA] p-8 lg:p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mx-auto mb-5"><LockKeyhole size={28} /></div>
          <div className="inline-flex rounded-full bg-[#FAF8F6] px-3 py-1 text-xs font-semibold text-[#7B6B62] mb-3">FREE PLAN</div>
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">Your hours are safe. Export is premium.</h1>
          <p className="text-[#6B5D54] mb-6">You can keep logging, viewing, and manually copying your records for free. Unlock the BACB form-ready export package for $19 one time, or choose a subscription for unlimited exports plus premium tools.</p>
          <Link to="/upgrade" className="btn-primary inline-flex px-6 py-3 rounded-xl">Upgrade to Export</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div><div className="flex items-center gap-2 text-[#5FA37E] text-sm font-semibold mb-2"><ShieldCheck size={17} /> Export unlocked</div><h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">BACB 2027 Export Center</h1><p className="text-[#6B5D54] max-w-3xl">Generate form-ready monthly and final verification worksheets from your tracked data, then review and transfer the values into the official BACB PDF before signing.</p></div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm text-[#6B5D54]"><Printer size={16} /> Print review</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[.72fr_1.28fr] gap-6">
          <aside className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-[#332C28] mb-4">Form identity fields</h2>
              <div className="space-y-3">
                <label className="block text-xs text-[#A8998E]">Trainee name<input value={traineeName} onChange={(event) => setTraineeName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                <label className="block text-xs text-[#A8998E]">BACB ID<input value={bacbId} onChange={(event) => setBacbId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                <label className="block text-xs text-[#A8998E]">State where fieldwork occurred<input value={state} onChange={(event) => setState(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                <label className="block text-xs text-[#A8998E]">Country<input value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                <label className="block text-xs text-[#A8998E]">Supervisor certification / BACB ID<input value={supervisorCertification} onChange={(event) => setSupervisorCertification(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
              </div>
            </section>

            <section className="bg-[#332C28] text-white rounded-3xl p-6">
              <h2 className="font-serif text-xl font-semibold mb-3">Export package</h2>
              <p className="text-sm text-white/70 mb-5">Review the calculated supervisor-present time before using these values. Baker derives it from recorded supervision minutes.</p>
              <div className="space-y-3">
                <button onClick={exportMonthly} disabled={rows.length === 0} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-semibold disabled:opacity-40"><Download size={16} /> Download M-FVF worksheet</button>
                <button onClick={exportFinal} disabled={rows.length === 0} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold disabled:opacity-40"><FileDown size={16} /> Download F-FVF worksheet</button>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#332C28] mb-3">Official BACB documents</h2>
              <div className="space-y-2">{BACB_2027_SOURCES.filter((source) => source.title.includes('Verification Form')).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-sm text-[#E85D70] hover:underline"><ExternalLink size={14} className="mt-0.5 shrink-0" />{source.title}</a>)}</div>
            </section>
          </aside>

          <main className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#F2EDEA]"><h2 className="font-serif text-xl font-semibold text-[#332C28]">Monthly verification worksheet</h2><p className="text-sm text-[#A8998E] mt-1">One row per month, supervisor, and fieldwork type.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#FAF8F6] text-left text-xs uppercase tracking-wider text-[#A8998E]"><tr><th className="p-4">Month</th><th className="p-4">Supervisor</th><th className="p-4">Type</th><th className="p-4">Independent</th><th className="p-4">Supervised</th><th className="p-4">Observation</th><th className="p-4">Total</th><th className="p-4">% supervised</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.month}-${row.supervisor}-${row.fieldworkType}`} className="border-t border-[#F2EDEA]"><td className="p-4">{row.month}</td><td className="p-4">{row.supervisor}</td><td className="p-4">{row.fieldworkType}</td><td className="p-4 font-mono">{row.independentHours}</td><td className="p-4 font-mono">{row.supervisedHours}</td><td className="p-4 font-mono">{row.observationHours}</td><td className="p-4 font-mono">{row.totalHours}</td><td className="p-4 font-mono">{row.supervisionPercent}%</td></tr>)}</tbody></table></div>
              {rows.length === 0 && <div className="p-10 text-center text-sm text-[#A8998E]">No tracked fieldwork is available in this browser yet.</div>}
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-[#332C28] mb-4">Final verification totals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['SUPERVISED', 'CONCENTRATED'] as const).map((type) => { const values = finalTotals[type]; const percentage = values.total > 0 ? round((values.supervised / values.total) * 100) : 0; return <div key={type} className="rounded-2xl bg-[#FAF8F6] p-5"><div className="text-xs uppercase tracking-wider text-[#A8998E] mb-3">{type === 'SUPERVISED' ? 'Supervised Fieldwork' : 'Concentrated Supervised Fieldwork'}</div><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-[#A8998E]">Independent</span><div className="font-mono text-xl">{round(values.independent)}</div></div><div><span className="text-[#A8998E]">Supervised</span><div className="font-mono text-xl">{round(values.supervised)}</div></div><div><span className="text-[#A8998E]">Total</span><div className="font-mono text-xl">{round(values.total)}</div></div><div><span className="text-[#A8998E]">% supervised</span><div className="font-mono text-xl">{percentage}%</div></div></div></div>; })}
              </div>
            </section>

            <div className="rounded-2xl bg-[#FFF8F3] border border-[#F0D5BC] p-5 text-sm text-[#7B5737]">BACB&apos;s current 2027 forms require complete information, signatures, and retention. Baker&apos;s worksheet helps prepare values, but the supervisor and trainee remain responsible for reviewing and signing the official form.</div>
          </main>
        </div>
      </div>
    </div>
  );
}

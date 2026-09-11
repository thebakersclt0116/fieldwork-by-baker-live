import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import type { HourEntry } from '@/types';
import {
  EMILY_EMAIL,
  appendEntries,
  getCurrentUserEmail,
  hoursBetween,
  inferActivityType,
  inferCategory,
  inferFieldworkType,
  inferStatus,
  loadEntries,
  newId,
  normalizeDate,
  normalizeTime,
} from '@/lib/fieldworkStore';
import { evaluateCompliance } from '@/lib/compliance2027';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueFor(headers: string[], row: string[], aliases: string[]): string {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    const match = aliases.some((alias) => {
      const normalized = normalizeHeader(alias);
      return header === normalized || header.includes(normalized);
    });
    if (match) return String(row[index] || '').trim();
  }
  return '';
}

function numericValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEntry(headers: string[], row: string[], email: string): HourEntry | null {
  const date = normalizeDate(valueFor(headers, row, ['date', 'service date', 'activity date']));
  const startTime = normalizeTime(valueFor(headers, row, ['start time', 'start']));
  const endTime = normalizeTime(valueFor(headers, row, ['end time', 'end']));
  const hoursText = valueFor(headers, row, ['hours', 'duration', 'total hours', 'fieldwork hours']);
  const fieldworkTypeText = valueFor(headers, row, ['fieldwork type', 'type', 'experience']);
  const activity = valueFor(headers, row, ['activity', 'activity type', 'description', 'task']);
  const categoryText = valueFor(headers, row, ['category', 'activity category', 'restricted unrestricted']);
  const supervisor = valueFor(headers, row, ['supervisor', 'supervisor name', 'bcba']);
  const setting = valueFor(headers, row, ['setting', 'location', 'site', 'organization']);
  const notes = valueFor(headers, row, ['notes', 'comments']);
  const statusText = valueFor(headers, row, ['status', 'verification status', 'verified']);
  const supervisionText = valueFor(headers, row, ['supervision minutes', 'supervised minutes', 'supervision min']);
  const observationText = valueFor(headers, row, ['observation minutes', 'client observation minutes', 'observation min']);
  const individualText = valueFor(headers, row, ['individual supervision minutes', 'individual minutes']);

  const parsedHours = numericValue(hoursText);
  const duration = parsedHours > 0 ? Math.round(parsedHours * 100) / 100 : hoursBetween(startTime, endTime);
  if (!date || duration <= 0) return null;

  const activityCategory = inferCategory(categoryText, activity);
  const now = new Date().toISOString();
  return {
    id: newId('import'),
    userId: email,
    date,
    startTime: startTime || '00:00',
    endTime: endTime || '00:00',
    duration,
    fieldworkType: inferFieldworkType(fieldworkTypeText),
    activityType: inferActivityType(activity, activityCategory),
    activityCategory,
    supervisorId: supervisor ? `imported_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'imported_unknown',
    supervisorName: supervisor || 'Not specified',
    setting,
    notes: notes || activity || undefined,
    status: inferStatus(statusText),
    createdAt: now,
    updatedAt: now,
    supervisionMinutes: Math.max(0, numericValue(supervisionText)) || undefined,
    observationMinutes: Math.max(0, numericValue(observationText)) || undefined,
    individualSupervisionMinutes: Math.max(0, numericValue(individualText)) || undefined,
  };
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function EmilyImport() {
  const email = getCurrentUserEmail() || EMILY_EMAIL;
  const [fileName, setFileName] = useState('');
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [message, setMessage] = useState('');
  const [batchSize, setBatchSize] = useState(100);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const totalHours = useMemo(() => entries.reduce((sum, entry) => sum + entry.duration, 0), [entries]);
  const batches = Math.max(1, Math.ceil(entries.length / batchSize));
  const completedCompliance = importedCount !== null ? evaluateCompliance(loadEntries(email)) : null;

  const handleFile = async (file: File) => {
    setMessage('');
    setImportedCount(null);
    setProgress(0);
    setEntries([]);
    setInvalidRows(0);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Export your Ripley history as CSV, then upload the .csv file here.');
      return;
    }

    try {
      const parsedRows = parseCsv(await file.text());
      if (parsedRows.length < 2) {
        setMessage('That CSV does not contain any fieldwork rows.');
        return;
      }

      const [headers, ...dataRows] = parsedRows;
      const valid: HourEntry[] = [];
      let invalid = 0;
      for (const row of dataRows) {
        const entry = buildEntry(headers, row, email);
        if (entry) valid.push(entry);
        else invalid += 1;
      }

      setFileName(file.name);
      setEntries(valid);
      setInvalidRows(invalid);
      if (valid.length === 0) {
        setMessage('No valid hours were found. Rows need at least a readable date and duration (or start/end time).');
      }
    } catch {
      setMessage('The CSV could not be read. Export a fresh CSV from Ripley and try again.');
    }
  };

  const importInBatches = async () => {
    if (entries.length === 0 || isImporting) return;
    setIsImporting(true);
    setMessage('');
    setProgress(0);
    const before = loadEntries(email).length;

    try {
      for (let start = 0; start < entries.length; start += batchSize) {
        const batch = entries.slice(start, start + batchSize);
        appendEntries(batch, email);
        setProgress(Math.min(100, Math.round(((start + batch.length) / entries.length) * 100)));
        await yieldToBrowser();
      }
      const after = loadEntries(email).length;
      setImportedCount(Math.max(0, after - before));
      setProgress(100);
    } finally {
      setIsImporting(false);
    }
  };

  if (importedCount !== null && completedCompliance) {
    return (
      <div className="min-h-[75vh] bg-[#FFFCF9] py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-[#F2EDEA] p-8 lg:p-10 shadow-sm">
          <CheckCircle2 size={38} className="text-[#5FA37E] mb-4" />
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Batch import complete</h1>
          <p className="text-[#6B5D54] mb-6">{importedCount} new rows were added. Duplicate entries were skipped automatically.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Actual hours</div><div className="font-mono text-2xl text-[#332C28] mt-1">{completedCompliance.actualHours}</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Equivalent progress</div><div className="font-mono text-2xl text-[#332C28] mt-1">{completedCompliance.weightedEquivalentHours}</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Unrestricted</div><div className="font-mono text-2xl text-[#5FA37E] mt-1">{(completedCompliance.unrestrictedRatio * 100).toFixed(1)}%</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Baker score</div><div className="font-mono text-2xl text-[#E85D70] mt-1">{completedCompliance.bakerComplianceScore}</div></div>
          </div>
          <div className="flex flex-wrap gap-3"><Link to="/dashboard" className="btn-primary px-5 py-3 rounded-xl">Go to dashboard</Link><Link to="/baker-ai" className="px-5 py-3 rounded-xl border border-[#E2DAD5] text-sm font-semibold text-[#6B5D54]">Open Baker AI</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div><div className="text-sm font-semibold text-[#E85D70] mb-2">Smart migration</div><h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Batch import Ripley hours</h1><p className="text-[#6B5D54]">Parse once, review totals, then import large histories in controlled batches with duplicate protection.</p></div>
          <Link to="/dashboard" className="text-sm text-[#E85D70] font-medium">Back to dashboard</Link>
        </div>

        <section className="bg-white rounded-3xl border border-[#F2EDEA] p-7 shadow-sm mb-6">
          <label className="block w-full cursor-pointer border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] rounded-2xl p-10 text-center transition-colors">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
            <Upload size={30} className="mx-auto text-[#E85D70] mb-3" />
            <div className="font-semibold text-[#332C28]">Choose Ripley CSV</div>
            <div className="text-sm text-[#A8998E] mt-1">{fileName || 'CSV export from Ripley Fieldwork Tracker'}</div>
          </label>
          {message && <div className="mt-4 rounded-xl bg-[#FFF5F7] px-4 py-3 text-sm text-[#C9445A]">{message}</div>}
        </section>

        {entries.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div><div className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Import plan</h2></div><p className="text-sm text-[#A8998E] mt-1">{entries.length} valid rows • {invalidRows} skipped • {totalHours.toFixed(2)} hours detected</p></div>
              <label className="text-xs text-[#A8998E]">Batch size<select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="ml-2 rounded-lg border border-[#E2DAD5] bg-white px-3 py-2 text-sm text-[#332C28]"><option value={50}>50</option><option value={100}>100</option><option value={250}>250</option></select></label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-[#F2EDEA]">
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Rows</div><div className="font-mono text-2xl">{entries.length}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Batches</div><div className="font-mono text-2xl">{batches}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Detected hours</div><div className="font-mono text-2xl">{totalHours.toFixed(1)}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Invalid rows</div><div className="font-mono text-2xl">{invalidRows}</div></div>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="sticky top-0 bg-[#FAF8F6] text-left text-xs uppercase tracking-wider text-[#A8998E]"><tr><th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Type</th><th className="p-4">Category</th><th className="p-4">Supervisor</th><th className="p-4">Supervision</th></tr></thead>
                <tbody>{entries.slice(0, 300).map((entry) => <tr key={entry.id} className="border-t border-[#F2EDEA]"><td className="p-4">{entry.date}</td><td className="p-4 font-mono">{entry.duration}</td><td className="p-4">{entry.fieldworkType}</td><td className="p-4">{entry.activityCategory}</td><td className="p-4">{entry.supervisorName}</td><td className="p-4">{entry.supervisionMinutes || 0} min</td></tr>)}</tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[#F2EDEA]">
              {isImporting && <div className="mb-4"><div className="flex justify-between text-xs text-[#A8998E] mb-1"><span>Importing in batches…</span><span>{progress}%</span></div><div className="h-2 rounded-full bg-[#F2EDEA] overflow-hidden"><div className="h-full bg-[#E85D70] transition-all" style={{ width: `${progress}%` }} /></div></div>}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="text-sm text-[#6B5D54] flex items-center gap-2"><XCircle size={15} className="text-[#A8998E]" />Duplicate signatures are skipped automatically.</div><button onClick={() => void importInBatches()} disabled={isImporting} className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50">{isImporting ? 'Importing…' : `Import ${entries.length} rows in ${batches} batches`}</button></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

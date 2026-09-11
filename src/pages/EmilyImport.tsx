import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Save, Upload, XCircle } from 'lucide-react';
import type { HourEntry } from '@/types';
import {
  appendEntries,
  getCurrentUserEmail,
  hoursBetween,
  inferActivityType,
  inferCategory,
  inferFieldworkType,
  inferStatus,
  newId,
  normalizeDate,
  normalizeTime,
} from '@/lib/fieldworkStore';

type ReviewRow = {
  index: number;
  entry: HourEntry | null;
  error: string | null;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
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

function readValue(headers: string[], row: string[], aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
  return index >= 0 ? (row[index] || '').trim() : '';
}

function mapRow(headers: string[], row: string[], index: number, email: string): ReviewRow {
  const date = normalizeDate(readValue(headers, row, ['date', 'servicedate', 'activitydate']));
  const startTime = normalizeTime(readValue(headers, row, ['starttime', 'start']));
  const endTime = normalizeTime(readValue(headers, row, ['endtime', 'end']));
  const hoursText = readValue(headers, row, ['hours', 'duration', 'totalhours', 'fieldworkhours']);
  const typeText = readValue(headers, row, ['fieldworktype', 'type', 'experience']));
  const activity = readValue(headers, row, ['activity', 'activitytype', 'activitydescription', 'description', 'task']);
  const categoryText = readValue(headers, row, ['category', 'activitycategory', 'restrictedunrestricted']);
  const supervisor = readValue(headers, row, ['supervisor', 'supervisorname', 'bcba']);
  const setting = readValue(headers, row, ['setting', 'location', 'site', 'organization']);
  const notes = readValue(headers, row, ['notes', 'note', 'comments', 'comment']);
  const statusText = readValue(headers, row, ['status', 'verificationstatus', 'verified']);

  const parsedHours = Number.parseFloat(hoursText.replace(/[^0-9.\-]/g, ''));
  const duration = Number.isFinite(parsedHours) && parsedHours > 0
    ? Math.round(parsedHours * 100) / 100
    : hoursBetween(startTime, endTime);

  if (!date) return { index, entry: null, error: 'Missing or unreadable date' };
  if (!(duration > 0)) return { index, entry: null, error: 'Missing or unreadable hours' };

  const activityCategory = inferCategory(categoryText, activity);
  const now = new Date().toISOString();
  const entry: HourEntry = {
    id: newId('ripley'),
    userId: email,
    date,
    startTime: startTime || '00:00',
    endTime: endTime || '00:00',
    duration,
    fieldworkType: inferFieldworkType(typeText),
    activityType: inferActivityType(activity, activityCategory),
    activityCategory,
    supervisorId: supervisor ? `imported_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'imported_unknown',
    supervisorName: supervisor || 'Not specified',
    setting,
    notes: notes || activity || undefined,
    status: inferStatus(statusText),
    createdAt: now,
    updatedAt: now,
  };

  return { index, entry, error: null };
}

export default function EmilyImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const email = getCurrentUserEmail() || '';

  const validRows = useMemo(() => rows.filter((row) => row.entry !== null), [rows]);
  const selectedEntries = useMemo(
    () => validRows.filter((row) => selected.has(row.index) && row.entry).map((row) => row.entry as HourEntry),
    [validRows, selected]
  );
  const totalHours = selectedEntries.reduce((sum, entry) => sum + entry.duration, 0);

  const handleFile = async (file: File) => {
    setError('');
    setComplete(false);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('For this test, export Ripley as CSV and upload the .csv file.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setError('The CSV does not contain any data rows.');
        return;
      }
      const [headers, ...dataRows] = parsed;
      const mapped = dataRows.map((row, index) => mapRow(headers, row, index, email));
      setRows(mapped);
      setSelected(new Set(mapped.filter((row) => row.entry !== null).map((row) => row.index)));
      setFileName(file.name);
    } catch {
      setError('I could not read that CSV. Please export a fresh CSV from Ripley and try again.');
    }
  };

  const toggleRow = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const saveImport = () => {
    if (!email || selectedEntries.length === 0) return;
    const before = JSON.stringify(selectedEntries);
    const merged = appendEntries(selectedEntries, email);
    const importedSignatures = new Set(selectedEntries.map((entry) => `${entry.date}|${entry.startTime}|${entry.duration}|${entry.activityType}|${entry.supervisorName}`));
    const count = merged.filter((entry) => importedSignatures.has(`${entry.date}|${entry.startTime}|${entry.duration}|${entry.activityType}|${entry.supervisorName}`)).length;
    setSavedCount(Math.min(count, JSON.parse(before).length));
    setComplete(true);
  };

  if (complete) {
    return (
      <div className="min-h-[75vh] bg-[#FFFCF9] pt-24 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#F2EDEA] p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#E8F5EE] text-[#5FA37E] flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">Import complete</h1>
          <p className="text-[#6B5D54] mb-2">{savedCount} selected Ripley rows are now in Emily&apos;s test account.</p>
          <p className="text-sm text-[#A8998E] mb-8">The dashboard will calculate progress from the imported records.</p>
          <Link to="/dashboard" className="btn-primary inline-flex px-6 py-3 rounded-xl">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#A8998E] hover:text-[#E85D70] mb-5">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Import Ripley Hours</h1>
          <p className="text-[#6B5D54]">Upload Emily&apos;s real Ripley CSV. Nothing is prefilled with sample hours.</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#F2EDEA] p-8 mb-6 shadow-sm">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] rounded-2xl py-12 px-6 transition-colors"
          >
            <Upload size={30} className="mx-auto text-[#E85D70] mb-3" />
            <div className="font-semibold text-[#332C28]">Choose Ripley CSV</div>
            <div className="text-sm text-[#A8998E] mt-1">{fileName || 'CSV export from Ripley Fieldwork Tracker'}</div>
          </button>
          {error && <div className="mt-4 rounded-xl bg-[#FFF5F7] text-[#C9445A] px-4 py-3 text-sm">{error}</div>}
        </div>

        {rows.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#332C28]">Review import</h2>
                <p className="text-sm text-[#A8998E]">{validRows.length} valid rows • {rows.length - validRows.length} need attention</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl text-[#332C28]">{totalHours.toFixed(2)} hrs</div>
                <div className="text-xs text-[#A8998E]">selected for import</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAF8F6]">
                  <tr className="text-left text-xs uppercase tracking-wider text-[#A8998E]">
                    <th className="p-4">Use</th><th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Category</th><th className="p-4">Supervisor</th><th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.index} className="border-t border-[#F2EDEA] text-sm">
                      <td className="p-4">
                        {row.entry ? (
                          <input type="checkbox" checked={selected.has(row.index)} onChange={() => toggleRow(row.index)} className="w-4 h-4" />
                        ) : <XCircle size={17} className="text-[#C9445A]" />}
                      </td>
                      <td className="p-4 text-[#332C28]">{row.entry?.date || '—'}</td>
                      <td className="p-4 font-mono text-[#332C28]">{row.entry ? row.entry.duration.toFixed(2) : '—'}</td>
                      <td className="p-4">{row.entry?.activityCategory || '—'}</td>
                      <td className="p-4 text-[#6B5D54]">{row.entry?.supervisorName || '—'}</td>
                      <td className="p-4">
                        {row.error ? <span className="text-[#C9445A]">{row.error}</span> : <span className="text-[#5FA37E]">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[#F2EDEA] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-[#6B5D54]">
                <FileSpreadsheet size={16} className="text-[#D4A574]" />
                Duplicate rows are automatically skipped when saved.
              </div>
              <button
                onClick={saveImport}
                disabled={selectedEntries.length === 0}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl disabled:opacity-40"
              >
                <Save size={16} /> Import {selectedEntries.length} rows
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

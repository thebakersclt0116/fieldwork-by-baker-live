import { useState } from 'react';
import { Link } from 'react-router';
import type { HourEntry } from '@/types';
import {
  EMILY_EMAIL,
  appendEntries,
  hoursBetween,
  inferActivityType,
  inferCategory,
  inferFieldworkType,
  inferStatus,
  newId,
  normalizeDate,
  normalizeTime,
} from '@/lib/fieldworkStore';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueFor(headers: string[], row: string[], aliases: string[]): string {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    const match = aliases.some((alias) => {
      const normalizedAlias = normalizeHeader(alias);
      return header === normalizedAlias || header.includes(normalizedAlias);
    });
    if (match) return (row[index] || '').trim();
  }
  return '';
}

function buildEntry(headers: string[], row: string[]): HourEntry | null {
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

  const hoursNumber = Number.parseFloat(hoursText.replace(/[^0-9.-]/g, ''));
  const duration = Number.isFinite(hoursNumber) && hoursNumber > 0
    ? Math.round(hoursNumber * 100) / 100
    : hoursBetween(startTime, endTime);

  if (!date || duration <= 0) return null;

  const activityCategory = inferCategory(categoryText, activity);
  const timestamp = new Date().toISOString();

  return {
    id: newId('ripley'),
    userId: EMILY_EMAIL,
    date,
    startTime: startTime || '00:00',
    endTime: endTime || '00:00',
    duration,
    fieldworkType: inferFieldworkType(fieldworkTypeText),
    activityType: inferActivityType(activity, activityCategory),
    activityCategory,
    supervisorId: supervisor
      ? `imported_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      : 'imported_unknown',
    supervisorName: supervisor || 'Not specified',
    setting,
    notes: notes || activity || undefined,
    status: inferStatus(statusText),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export default function EmilyImport() {
  const [fileName, setFileName] = useState('');
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  const totalHours = entries.reduce((sum, entry) => sum + entry.duration, 0);

  const handleFile = async (file: File) => {
    setMessage('');
    setComplete(false);
    setEntries([]);
    setInvalidRows(0);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Please export your Ripley history as a CSV file.');
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) {
        setMessage('That CSV does not contain any fieldwork rows.');
        return;
      }

      const headers = rows[0];
      const parsedEntries: HourEntry[] = [];
      let invalidCount = 0;

      for (const row of rows.slice(1)) {
        const entry = buildEntry(headers, row);
        if (entry) parsedEntries.push(entry);
        else invalidCount += 1;
      }

      setFileName(file.name);
      setEntries(parsedEntries);
      setInvalidRows(invalidCount);
      if (parsedEntries.length === 0) {
        setMessage('No valid hours were found. The CSV needs at least a date and hours or start/end times.');
      }
    } catch {
      setMessage('The CSV could not be read. Please export a fresh CSV from Ripley and try again.');
    }
  };

  const importEntries = () => {
    if (entries.length === 0) return;
    appendEntries(entries, EMILY_EMAIL);
    setComplete(true);
  };

  if (complete) {
    return (
      <div className="min-h-[75vh] bg-[#FFFCF9] pt-24 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#F2EDEA] p-10 text-center shadow-sm">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">Import complete</h1>
          <p className="text-[#6B5D54] mb-8">
            Your Ripley hours are saved to Emily&apos;s clean test account in this browser.
          </p>
          <Link to="/dashboard" className="btn-primary inline-flex px-6 py-3 rounded-xl">
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <Link to="/dashboard" className="text-sm text-[#A8998E] hover:text-[#E85D70]">
          ← Back to Dashboard
        </Link>

        <div className="mt-5 mb-8">
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Import Ripley Hours</h1>
          <p className="text-[#6B5D54]">
            Upload the actual CSV export from Ripley. This account does not preload sample fieldwork.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#F2EDEA] p-8 shadow-sm mb-6">
          <label className="block border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] rounded-2xl py-12 px-6 text-center cursor-pointer transition-colors">
            <UploadIcon />
            <span className="block font-semibold text-[#332C28]">Choose Ripley CSV</span>
            <span className="block text-sm text-[#A8998E] mt-1">{fileName || 'Select a .csv file'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
          {message && <p className="mt-4 text-sm text-[#C9445A]">{message}</p>}
        </div>

        {entries.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#F2EDEA] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#332C28]">Review import</h2>
                <p className="text-sm text-[#A8998E]">
                  {entries.length} valid rows{invalidRows > 0 ? ` • ${invalidRows} skipped` : ''}
                </p>
              </div>
              <div className="font-mono text-xl text-[#332C28]">{totalHours.toFixed(2)} hrs</div>
            </div>

            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full min-w-[760px]">
                <thead className="bg-[#FAF8F6] sticky top-0">
                  <tr className="text-left text-xs uppercase tracking-wider text-[#A8998E]">
                    <th className="p-4">Date</th>
                    <th className="p-4">Hours</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Supervisor</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-[#F2EDEA] text-sm">
                      <td className="p-4">{entry.date}</td>
                      <td className="p-4 font-mono">{entry.duration.toFixed(2)}</td>
                      <td className="p-4">{entry.activityCategory}</td>
                      <td className="p-4 text-[#6B5D54]">{entry.supervisorName}</td>
                      <td className="p-4 text-[#A8998E]">{entry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[#F2EDEA] flex justify-end">
              <button onClick={importEntries} className="btn-primary px-6 py-3 rounded-xl">
                Import {entries.length} Entries
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <div className="w-14 h-14 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mx-auto mb-4 text-2xl">
      ↑
    </div>
  );
}

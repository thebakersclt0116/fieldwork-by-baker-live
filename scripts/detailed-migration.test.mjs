import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSource, parseCsv, guessMapping, buildPreview, parseDate, parseTime, parseAmount, planMerge, auditCsv, isMonthlySummary } from '../src/lib/detailedMigration.ts';
const headers = ['Entry ID','Date','Start time','End time','Total hours','Activity category','Fieldwork type','Organization','Supervisor','Description of activity','Notes','Hour type','Supervision format','Supervision minutes','Observation minutes','Status','Custom audit field'];
const row = ['original-1','09/12/2026','8:30 AM','10:15 AM','1.75','Unrestricted','Supervised Fieldwork','Sample Organization','Sample Supervisor','Analyzed de-identified behavior data.','Discussed next steps.','Independent','','0','0','Approved','Keep this EXACT value'];
const options = { sourceSystem: 'Ripley', dateOrder: 'MDY' };
async function preview(rows = [row], hs = headers, opts = options, hash = 'file-a') {
  const source = JSON.stringify({ entries: rows.map(r => Object.fromEntries(hs.map((h, i) => [h, r[i]]))) });
  const table = parseSource(source, 'original.json');
  return buildPreview(table, guessMapping(table.headers), opts, { name: 'original.json', hash }, 'audit-qa@example.com');
}
test('full original record, both narrative fields and extra columns survive', async () => {
  const p = await preview(); assert.equal(p.errors, 0); const e = p.entries[0];
  assert.equal(e.duration, 1.75); assert.equal(e.startTime, '08:30'); assert.equal(e.endTime, '10:15');
  assert.equal(e.organizationName, 'Sample Organization'); assert.equal(e.notes, row[9] + '\n\n' + row[10]);
  assert.equal(e.migration.raw.find(x => x.column === 'Custom audit field').value, row[16]);
  assert.equal(e.migration.originalStatus, 'Approved'); assert.equal(e.status, 'PENDING');
  assert.equal(e.migration.elapsedMinutes, 105);
});
test('missing classifications are unknown, not guessed from activity notes', async () => {
  const r = [...row]; r[5] = ''; r[9] = 'Implementation of direct therapy';
  const p = await preview([r]); assert.equal(p.entries[0].activityCategory, 'UNKNOWN'); assert.ok(p.warnings);
});
test('strict header matching never confuses Restricted with Unrestricted or total hours', () => {
  const m = guessMapping(['Unrestricted hours', 'Restricted hours', 'Supervision minutes', 'Total hours']);
  assert.equal(m.unrestricted, 0); assert.equal(m.restricted, 1); assert.equal(m.duration, 3); assert.equal(m.supervision, 2);
});
test('quoted multiline text, commas, quotes, accents and 80KB notes remain exact', async () => {
  const note = 'Line one, "quoted"\nLínea dos\n' + 'x'.repeat(80000);
  const csv = 'Date,Start time,End time,Fieldwork type,Description of activity\r\n2026-09-12,08:30,12:07,Supervised,"' + note.replace(/"/g, '""') + '"';
  const table = parseSource(csv, 'detail.csv'); assert.equal(table.rows[0][4], note);
  const p = await buildPreview(table, guessMapping(table.headers), options, { name: 'detail.csv', hash: 'h' }, 'qa@example.com');
  assert.equal(p.entries[0].notes, note); assert.equal(p.entries[0].migration.elapsedMinutes, 217); assert.equal(p.entries[0].duration.toFixed(2), '3.62');
});
test('TSV BOM and semicolon source variants', () => {
  assert.equal(parseSource('\uFEFFDate\tHours\n2026-09-12\t1.75', 'test.tsv').rows[0][1], '1.75');
  assert.equal(parseSource('Date;Hours\n2026-09-12;1.75', 'test.csv').rows[0][1], '1.75');
});
test('truncated quoted exports fail explicitly rather than silently omitting rows', () => {
  assert.throws(() => parseCsv('Date,Notes\n2026-09-12,"unfinished', ','), /quoted/);
  assert.throws(() => parseSource('{"totalHours":70}', 'monthly.json'), /entry export/);
});
test('monthly dates and impossible dates are rejected', () => {
  assert.equal(parseDate('2026-09', 'MDY'), ''); assert.equal(parseDate('2026-02-29', 'MDY'), '');
  assert.equal(parseDate('2024-02-29', 'MDY'), '2024-02-29');
  assert.equal(parseDate('12/09/2026', 'DMY'), '2026-09-12'); assert.equal(parseDate('13/09/2026', 'MDY'), '');
});
test('time parsing validates AM/PM and retains midnight only when actually recorded', () => {
  assert.equal(parseTime('12:00 AM').time, '00:00'); assert.equal(parseTime('12:00 PM').time, '12:00');
  assert.equal(parseTime('23:60'), undefined); assert.equal(parseTime('25:00'), undefined); assert.equal(parseTime(''), undefined);
  assert.equal(parseAmount('1:45'), 1.75); assert.equal(parseAmount('1h 45m'), 1.75); assert.equal(parseAmount('1.75'), 1.75); assert.equal(parseAmount('-2'), undefined);
});
test('unknown clock range is preserved as blank, not fabricated at midnight', async () => {
  const r = [...row]; r[2] = ''; r[3] = ''; const p = await preview([r]);
  assert.equal(p.entries[0].startTime, ''); assert.equal(p.entries[0].endTime, ''); assert.ok(p.warnings);
});
test('unknown fieldwork type requires explicit user decision', async () => {
  const r = [...row]; r[6] = ''; assert.equal((await preview([r])).errors, 1);
  assert.equal((await preview([r], headers, { ...options, defaultFieldworkType: 'CONCENTRATED' })).entries[0].fieldworkType, 'CONCENTRATED');
});
test('invalid or monthly-sized durations cannot become individual sessions', async () => {
  const r = [...row]; r[4] = '70.42'; assert.equal((await preview([r])).errors, 1);
  r[4] = '-2'; assert.equal((await preview([r])).errors, 1);
  r[4] = '1.75'; r[3] = '07:00'; assert.equal((await preview([r])).errors, 1);
});
test('exact source IDs are idempotent while corrected source IDs cause review conflicts', async () => {
  const first = (await preview()).entries, again = (await preview([row], headers, options, 'other-file')).entries;
  assert.equal(planMerge(first, again).duplicate.length, 1);
  const changed = [...row]; changed[9] = 'Corrected original narrative';
  assert.equal(planMerge(first, (await preview([changed])).entries).conflicts.length, 1);
});
test('same time but different organization or narrative is never silently deduplicated', async () => {
  const a = [...row], b = [...row]; b[0] = 'original-2'; b[7] = 'Other Organization';
  const p = await preview([a, b]); assert.equal(planMerge([], p.entries).add.length, 2);
  b[7] = a[7]; b[9] = 'Different actual work'; assert.equal(planMerge([], (await preview([a, b])).entries).add.length, 2);
});
test('identical content with different source IDs is surfaced as possible duplicate, not discarded', async () => {
  const b = [...row]; b[0] = 'original-2'; const p = await preview([row, b]);
  const plan = planMerge([], p.entries); assert.equal(plan.add.length, 2); assert.equal(plan.possibleDuplicates.length, 1);
});
test('mixed buckets retain one original source reference without invented sub-session times', async () => {
  const hs = [...headers, 'Restricted hours', 'Unrestricted hours']; const r = [...row, '.75', '1']; r[5] = '';
  // decimal format must be explicit; add leading zero as a real export would.
  r[17] = '0.75'; const p = await preview([r], hs); assert.equal(p.errors, 0); assert.equal(p.entries.length, 2);
  assert.equal(p.entries.reduce((s, e) => s + e.duration, 0), 1.75);
  assert.ok(p.entries.every(e => e.startTime === '' && e.migration.sourceStart === '8:30 AM'));
  assert.ok(p.entries.every(e => e.observationMinutes === undefined));
});
test('mixed bucket discrepancy is blocked, not silently adjusted', async () => {
  const hs = [...headers, 'Restricted hours', 'Unrestricted hours']; const r = [...row, '1', '1']; r[5] = '';
  assert.equal((await preview([r], hs)).errors, 1);
});
test('supervision and independent conflicts, overlong observations, are explicit', async () => {
  const r = [...row]; r[13] = '30'; assert.equal((await preview([r])).errors, 1);
  r[11] = 'Supervised'; r[14] = '200'; assert.equal((await preview([r])).errors, 1);
});
test('monthly aggregate overlap is recognized before tracking detailed rows', async () => {
  const incoming = (await preview()).entries;
  const summary = { ...incoming[0], id: 'legacy', migration: undefined, duration: 70, aiRationale: 'Monthly aggregate' };
  assert.equal(isMonthlySummary(summary), true); assert.equal(planMerge([summary], incoming).overlappingSummaries.length, 1);
});
test('CSV exports all fields with formula escaping; exact notes stay in entry/source JSON', async () => {
  const r = [...row]; r[9] = '=HYPERLINK("https://invalid.example","test")';
  const e = (await preview([r])).entries; const csv = auditCsv(e);
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('All original fields')); assert.equal(e[0].migration.original['Description of activity'], r[9]);
});
test('large detailed export retains every one of 1500 rows', async () => {
  const input = Array.from({ length: 1500 }, (_, i) => { const r = [...row]; r[0] = 'entry-' + i; r[9] += ' ' + i; return r; });
  const p = await preview(input); assert.equal(p.rows.length, 1500); assert.equal(p.entries.length, 1500); assert.equal(p.errors, 0);
});

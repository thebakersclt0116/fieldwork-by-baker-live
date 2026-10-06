import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, guessMapping, parseSource, planMerge, selectionProblem, isMonthlySummary } from '../src/lib/detailedMigration.ts';
const sample = { 'Entry ID': 'synthetic-1', Date: '2026-09-12', 'Start time': '08:30', 'End time': '10:15', 'Total hours': '1.75', 'Activity category': 'Unrestricted', 'Fieldwork type': 'Supervised Fieldwork', Organization: 'Synthetic Organization', Supervisor: 'Synthetic Supervisor', 'Description of activity': 'Synthetic original narrative', 'Hour type': 'Independent' };
const options = { sourceSystem: 'Ripley', dateOrder: 'MDY' };
async function inspect(entries, origins) {
  const table = parseSource(JSON.stringify({ entries }), 'detailed.json'); if (origins) table.origins = origins;
  return buildPreview(table, guessMapping(table.headers), options, { name: 'actual-upload.json', hash: 'actual-file-hash' }, 'qa@example.com');
}
test('complete-file import cannot hide invalid source rows', async () => {
  const p = await inspect([sample, { ...sample, 'Entry ID': 'bad-date', Date: '2026-02-30' }]);
  assert.equal(p.errors, 1); const ids = p.entries.map(e => e.id);
  assert.match(selectionProblem(p, ids), /Complete-file mode/);
  assert.equal(selectionProblem(p, ids, true), '');
});
test('omitted valid sessions require explicit partial-file mode', async () => {
  const p = await inspect([sample, { ...sample, 'Entry ID': 'synthetic-2', Date: '2026-09-13' }]);
  assert.match(selectionProblem(p, [p.entries[0].id]), /Complete-file mode/);
  assert.equal(selectionProblem(p, [p.entries[0].id], true), '');
  assert.equal(selectionProblem(p, p.entries.map(e => e.id)), '');
});
test('mixed restricted/unrestricted allocations stay attached to one complete original session', async () => {
  const p = await inspect([{ ...sample, 'Activity category': '', 'Restricted hours': '0.75', 'Unrestricted hours': '1' }]);
  assert.equal(p.entries.length, 2);
  assert.match(selectionProblem(p, [p.entries[0].id], true), /session cannot be partially/);
  assert.equal(selectionProblem(p, p.entries.map(e => e.id)), '');
  assert.deepEqual(p.entries[0].migration.original, p.entries[1].migration.original);
});
test('a work narrative about monthly forms does not turn a genuine session into a summary', async () => {
  const entry = (await inspect([sample])).entries[0];
  const legacySession = { ...entry, recordKind: undefined, migration: undefined, notes: 'Reviewed monthly verification documentation with the supervisor.', aiRationale: undefined };
  assert.equal(isMonthlySummary(legacySession), false);
  assert.equal(isMonthlySummary({ ...legacySession, aiRationale: 'Extracted as monthly aggregate' }), true);
});
test('explicit monthly-summary objects under 24 hours are rejected as sessions', async () => {
  const p = await inspect([{ ...sample, summaryDerived: true }]);
  assert.equal(p.errors, 1); assert.equal(p.entries.length, 0);
  const q = await inspect([{ ...sample, recordKind: 'MONTHLY_SUMMARY' }]); assert.equal(q.errors, 1);
});
test('untrusted JSON cannot forge the filename, row or integrity hash of its original source', async () => {
  const forged = { ...sample, __bakerSource: { filename: 'forged-signed-source.pdf', sha256: 'forged-hash', sourceRow: 99, original: { Description: 'forged' } } };
  const e = (await inspect([forged])).entries[0];
  assert.equal(e.migration.sourceFile, 'actual-upload.json'); assert.equal(e.migration.sourceHash, 'actual-file-hash'); assert.equal(e.migration.sourceRow, 2);
  assert.deepEqual(e.migration.original, forged);
});
test('internally combined files retain each real original identity, including absent source IDs', async () => {
  const record = { ...sample }; delete record['Entry ID'];
  const table = parseSource(JSON.stringify([record]), 'one.json');
  const direct = await buildPreview(table, guessMapping(table.headers), options, { name: 'one.json', hash: 'one-hash' }, 'qa@example.com');
  const combined = await inspect([{ ...record, __bakerSource: { note: 'untrusted field is preserved but not used' } }], [{ filename: 'one.json', sha256: 'one-hash', sourceRow: 2, original: record }]);
  assert.equal(direct.entries[0].id, combined.entries[0].id);
  assert.equal(planMerge(direct.entries, combined.entries).duplicate.length, 1);
  assert.equal(combined.entries[0].migration.sourceFile, 'one.json');
});
test('source system capitalization does not create new source identities', async () => {
  const table = parseSource(JSON.stringify([sample]), 'one.json');
  const a = await buildPreview(table, guessMapping(table.headers), options, { name: 'one.json', hash: 'hash' }, 'qa@example.com');
  const b = await buildPreview(table, guessMapping(table.headers), { ...options, sourceSystem: ' ripley ' }, { name: 'one.json', hash: 'hash' }, 'qa@example.com');
  assert.equal(a.entries[0].id, b.entries[0].id);
});
test('stale or unknown selection IDs fail closed', async () => {
  const p = await inspect([sample]); assert.match(selectionProblem(p, ['stale-id'], true), /stale/);
});

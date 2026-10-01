import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, guessMapping, parseSource, planMerge } from '../src/lib/detailedMigration.ts';
const base = { 'Entry ID': 'qa-original', Date: '2026-09-12', 'Start time': '08:30', 'End time': '09:30', 'Total hours': '1', 'Fieldwork type': 'Supervised Fieldwork', 'Activity category': 'Unrestricted', Organization: 'Sample Organization', Supervisor: 'Sample Supervisor', 'Hour type': 'Independent', 'Description of activity': 'De-identified source record', 'Supervision minutes': '0', 'Observation minutes': '30', 'Contact type': 'Observation without feedback' };
async function parse(entry = base) {
  const table = parseSource(JSON.stringify({ entries: [entry] }), 'source.json');
  return buildPreview(table, guessMapping(table.headers), { sourceSystem: 'Ripley', dateOrder: 'MDY' }, { name: 'source.json', hash: 'original-hash' }, 'qa@example.com');
}
test('independent observation is retained and never reclassified as supervision contact', async () => {
  const p = await parse(); assert.equal(p.errors, 0); assert.equal(p.entries[0].workPresence, 'INDEPENDENT');
  assert.equal(p.entries[0].observationMinutes, 30); assert.equal(p.entries[0].supervisionMinutes, 0);
  assert.equal(p.entries[0].contactType, 'Observation without feedback');
});
test('changes to unmapped source data are conflicts rather than silently ignored source-ID duplicates', async () => {
  const a = (await parse({ ...base, 'Custom note': 'Original' })).entries;
  const b = (await parse({ ...base, 'Custom note': 'Correction' })).entries;
  assert.equal(planMerge(a, b).conflicts.length, 1); assert.equal(planMerge(a, b).duplicate.length, 0);
});
test('numeric edit-form placeholder provenance stays explicit for human verification', async () => {
  const p = await parse({ ...base, __originalControls: [{ label: 'Unrestricted', value: '', placeholder: '1.00', shown: '1.00', usedPlaceholder: true }] });
  assert.equal(p.errors, 0); assert.ok(p.rows[0].warnings.some(w => w.includes('placeholders')));
  assert.equal(p.entries[0].migration.original.__originalControls[0].value, '');
});
test('a missing activity narrative remains a missing-data flag, never a generated replacement', async () => {
  const p = await parse({ ...base, 'Description of activity': '' });
  assert.equal(p.entries[0].notes, ''); assert.ok(p.rows[0].warnings.some(w => /narrative missing/i.test(w)));
});
test('unknown source fieldwork label cannot silently fall back to supervised', async () => {
  const p = await parse({ ...base, 'Fieldwork type': 'Unrecognized plan' }); assert.equal(p.errors, 1); assert.equal(p.entries.length, 0);
});

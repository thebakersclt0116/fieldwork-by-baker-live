import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, guessMapping, parseSource, planMerge } from '../src/lib/detailedMigration.ts';
import { canonicalJson } from '../shared/cloudTypes.ts';
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
test('reimport after canonical cloud JSON ordering preserves duplicates and still detects changed source evidence', async () => {
  const evidence = { supervisor: { name: 'Sample Supervisor', email: 'supervisor@example.com' }, session: { narrative: 'Exact original source text', pages: [2, 3] } };
  const source = { ...base, 'Original PDF evidence': evidence };
  const first = (await parse(source)).entries;
  const downloaded = JSON.parse(canonicalJson({ entries: first, supervisors: [] })).entries;
  const incoming = (await parse(source)).entries;
  assert.equal(downloaded[0].id, incoming[0].id);
  assert.notEqual(JSON.stringify(downloaded[0].migration.original), JSON.stringify(incoming[0].migration.original), 'the cloud round-trip must exercise reordered evidence keys');
  const originalCloudCopy = JSON.stringify(downloaded);
  const duplicate = planMerge(downloaded, incoming);
  assert.equal(duplicate.duplicate.length, 1);
  assert.equal(duplicate.conflicts.length, 0);
  assert.equal(duplicate.add.length, 0);

  for (const session of [
    { ...evidence.session, narrative: 'Corrected original source text' },
    { ...evidence.session, pages: [3, 2] },
  ]) {
    const changed = (await parse({ ...source, 'Original PDF evidence': { ...evidence, session } })).entries;
    assert.equal(changed[0].id, downloaded[0].id);
    assert.equal(changed[0].notes, downloaded[0].notes, 'the change is in original evidence, not the tracked narrative');
    const conflict = planMerge(downloaded, changed);
    assert.equal(conflict.conflicts.length, 1);
    assert.equal(conflict.duplicate.length, 0);
    assert.equal(conflict.add.length, 0);
  }
  assert.equal(JSON.stringify(downloaded), originalCloudCopy, 'duplicate review must not mutate the downloaded evidence');
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateEntry, allottedDecimal } from '../src/lib/hourEntryFlow.ts';
import { summarizeMonth } from '../src/lib/monthlyProgress.ts';
import { evaluateCompliance } from '../src/lib/compliance2027-safe.ts';
import { appendEntries } from '../src/lib/fieldworkStore.ts';
import { auditCsv, parseCsv } from '../src/lib/detailedMigration.ts';

const source = (overrides = {}) => ({
  id: 'synthetic-entry', userId: 'candidate@example.invalid', date: '2026-10-28',
  startTime: '09:00', endTime: '10:00', duration: 1, fieldworkType: 'SUPERVISED',
  activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN',
  supervisorId: '', supervisorName: '', organizationName: '', setting: '',
  notes: '', status: 'DRAFT', createdAt: '2026-10-28T13:00:00.000Z',
  updatedAt: '2026-10-28T14:00:00.000Z', ...overrides,
});
const bucket = (key, hours, observation = '', observationMinutes = '') => ({ key, hours, observation, observationMinutes });
const details = (overrides = {}) => ({
  presence: 'INDEPENDENT', format: '', notes: 'Reviewed de-identified assessment data.',
  organization: 'Fictional practice organization', supervisor: 'Fictional supervisor',
  setting: 'Clinic', fieldworkType: 'SUPERVISED',
  allocations: [bucket('unrestricted', '1.00')], ...overrides,
});
const total = (entries, field) => entries.reduce((sum, entry) => sum + (entry[field] || 0), 0);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);

test('allotted decimals are familiar while sub-hundredth timer sessions remain allocatable', () => {
  assert.equal(allottedDecimal(25 / 60), '0.42');
  assert.equal(allottedDecimal(217 / 60), '3.62');
  assert.equal(allottedDecimal(1), '1.00');
  assert.equal(allottedDecimal(1 / 3600), '0.000278');
});

test('one independent bucket preserves the original entry and exact clock-derived duration', () => {
  const original = source({ endTime: '09:25', duration: 25 / 60 });
  const before = structuredClone(original);
  const [entry] = allocateEntry(original, details({ allocations: [bucket('restricted', '0.42')] }));
  assert.equal(entry.id, original.id);
  assert.equal(entry.startTime, '09:00');
  assert.equal(entry.endTime, '09:25');
  assert.equal(entry.duration, 25 / 60);
  assert.equal(entry.activityCategory, 'RESTRICTED');
  assert.equal(entry.workPresence, 'INDEPENDENT');
  assert.equal(entry.status, 'PENDING');
  assert.equal(entry.notes, details().notes);
  assert.equal(entry.organizationName, details().organization);
  assert.equal(entry.supervisorName, details().supervisor);
  assert.equal(entry.supervisionMinutes, 0);
  assert.equal(entry.individualSupervisionMinutes, 0);
  assert.equal(entry.observationMinutes, 0);
  assert.deepEqual(original, before, 'allocation must not mutate its source record');
});

test('mixed independent allocations share one original session without invented sub-session clocks', () => {
  const original = source({ endTime: '09:25', duration: 25 / 60 });
  const entries = allocateEntry(original, details({ allocations: [bucket('restricted', '0.12'), bucket('unrestricted', '0.30')] }));
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 2);
  near(total(entries, 'duration'), original.duration);
  near(entries.find(entry => entry.activityCategory === 'RESTRICTED').duration, original.duration * 0.12 / 0.42);
  for (const entry of entries) {
    assert.equal(entry.startTime, '');
    assert.equal(entry.endTime, '');
    assert.equal(entry.allocationSession.sourceEntryId, original.id);
    assert.equal(entry.allocationSession.date, original.date);
    assert.equal(entry.allocationSession.startTime, original.startTime);
    assert.equal(entry.allocationSession.endTime, original.endTime);
    assert.equal(entry.allocationSession.duration, original.duration);
    assert.ok(entry.allocationSession.id);
    assert.equal(entry.supervisionMinutes, 0);
  }
  assert.equal(new Set(entries.map(entry => entry.allocationSession.id)).size, 1);
});

test('supervised individual and group buckets retain distinct categories and observation minutes', () => {
  const entries = allocateEntry(source(), details({
    presence: 'SUPERVISED', format: 'ONLINE', fieldworkType: 'CONCENTRATED',
    allocations: [bucket('individualRestricted', '0.25', 'YES', '10'), bucket('individualUnrestricted', '0.50', 'NO'), bucket('groupUnrestricted', '0.25')],
  }));
  assert.equal(entries.length, 3);
  const restricted = entries.find(entry => entry.activityCategory === 'RESTRICTED');
  const individualUnrestricted = entries.find(entry => entry.activityCategory === 'UNRESTRICTED' && entry.supervisionFormat === 'INDIVIDUAL');
  const group = entries.find(entry => entry.supervisionFormat === 'GROUP');
  assert.equal(restricted.duration, 0.25);
  assert.equal(restricted.observationMinutes, 10);
  assert.equal(individualUnrestricted.duration, 0.50);
  assert.equal(individualUnrestricted.observationMinutes, 0);
  assert.equal(group.duration, 0.25);
  assert.equal(group.observationMinutes, 0);
  assert.equal(group.individualSupervisionMinutes, 0);
  near(total(entries, 'duration'), 1);
  near(total(entries, 'supervisionMinutes'), 60);
  near(total(entries, 'individualSupervisionMinutes'), 45);
  assert.equal(total(entries, 'observationMinutes'), 10);
  assert.ok(entries.every(entry => entry.fieldworkType === 'CONCENTRATED' && entry.workPresence === 'SUPERVISED'));
});

test('independent and group entries discard hidden observation values rather than creating observed time', () => {
  const [independent] = allocateEntry(source(), details({ allocations: [bucket('unrestricted', '1.00', 'YES', '15')] }));
  const [group] = allocateEntry(source(), details({ presence: 'SUPERVISED', format: 'IN_PERSON', allocations: [bucket('groupUnrestricted', '1.00', 'YES', '15')] }));
  for (const entry of [independent, group]) {
    assert.equal(entry.observationMinutes, 0);
    assert.equal(entry.individualSupervisionMinutes, 0);
  }
});

test('only positive individual allocations require an explicit observation answer', () => {
  assert.throws(() => allocateEntry(source(), details({ presence: 'SUPERVISED', format: 'PHONE', allocations: [bucket('individualUnrestricted', '1.00')] })));
  const entries = allocateEntry(source(), details({ presence: 'SUPERVISED', format: 'PHONE', allocations: [bucket('individualRestricted', ''), bucket('individualUnrestricted', '0'), bucket('groupUnrestricted', '1.00')] }));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].supervisionFormat, 'GROUP');
});

for (const value of ['', '0', '-1', 'NaN', 'Infinity', '61']) {
  test(`observation Yes rejects invalid or excessive minutes ${JSON.stringify(value)}`, () => {
    assert.throws(() => allocateEntry(source(), details({ presence: 'SUPERVISED', format: 'IN_PERSON', allocations: [bucket('individualUnrestricted', '1.00', 'YES', value)] })));
  });
}

test('observation is bounded by its own individual allocation, not the entire session', () => {
  assert.throws(() => allocateEntry(source(), details({ presence: 'SUPERVISED', format: 'ONLINE', allocations: [bucket('individualRestricted', '0.25', 'YES', '16'), bucket('groupUnrestricted', '0.75')] })));
});

for (const [field, value] of [['organization', ' '], ['supervisor', ''], ['notes', ' '], ['presence', ''], ['fieldworkType', '']]) {
  test(`entry details require ${field}`, () => assert.throws(() => allocateEntry(source(), details({ [field]: value }))));
}

test('supervised entries require a communication format', () => {
  assert.throws(() => allocateEntry(source(), details({ presence: 'SUPERVISED', format: '', allocations: [bucket('individualUnrestricted', '1.00', 'NO')] })));
});

for (const value of ['-1', 'NaN', 'Infinity', '0.99', '1.01', '2']) {
  test(`allocations reject invalid, excessive or incomplete decimal total ${JSON.stringify(value)}`, () => {
    assert.throws(() => allocateEntry(source(), details({ allocations: [bucket('unrestricted', value)] })));
  });
}

test('blank and zero-only allocations cannot save an empty entry', () => {
  assert.throws(() => allocateEntry(source(), details({ allocations: [bucket('restricted', ''), bucket('unrestricted', '0')] })));
});

test('one-second timer sessions keep exact elapsed duration behind their six-decimal allotment', () => {
  const original = source({ endTime: '09:00', duration: 1 / 3600, timerSession: { id: 'one-second', startedAt: '2026-10-28T13:00:00Z', stoppedAt: '2026-10-28T13:00:01Z', detailsComplete: false } });
  const [entry] = allocateEntry(original, details({ allocations: [bucket('unrestricted', allottedDecimal(original.duration))] }));
  assert.equal(entry.duration, original.duration);
  assert.equal(entry.timerSession.id, 'one-second');
  assert.equal(entry.timerSession.detailsComplete, true);
});

test('monthly progress and compliance count completed allocations once and exclude unfinished drafts', () => {
  const original = source({ timerSession: { id: 'timer-session', startedAt: '2026-10-28T13:00:00Z', stoppedAt: '2026-10-28T14:00:00Z', detailsComplete: false } });
  const entries = allocateEntry(original, details({ presence: 'SUPERVISED', format: 'IN_PERSON', allocations: [bucket('individualRestricted', '0.25', 'YES', '10'), bucket('individualUnrestricted', '0.50', 'NO'), bucket('groupUnrestricted', '0.25')] }));
  assert.ok(entries.every(entry => entry.timerSession.detailsComplete === true));
  const incomplete = source({ id: 'unfinished', status: 'PENDING', duration: 10, notes: 'Unfinished timer description', timerSession: { ...original.timerSession, id: 'unfinished', detailsComplete: false } });
  const draft = source({ id: 'draft', duration: 20, notes: 'Draft description' });
  const monthly = summarizeMonth([...entries, incomplete, draft], '2026-10');
  near(monthly.totalHours, 1);
  near(monthly.restrictedHours, 0.25);
  near(monthly.unrestrictedHours, 0.75);
  near(monthly.supervisedHours, 1);
  near(monthly.individualHours, 0.75);
  near(monthly.independentHours, 0);
  const compliance = evaluateCompliance([...entries, incomplete, draft]);
  near(compliance.actualHours, 1);
  assert.equal(compliance.months[0].supervisionMinutes, 60);
  assert.equal(compliance.months[0].individualSupervisionMinutes, 45);
  assert.equal(compliance.months[0].observationMinutes, 10);
});

test('different same-day manual sessions with matching descriptions and allocations both survive saving and retries', () => {
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    const email = 'candidate@example.invalid';
    localStorage.setItem('authUser', JSON.stringify({ email }));
    const allocationDetails = details({ allocations: [bucket('restricted', '0.25'), bucket('unrestricted', '0.75')] });
    const first = allocateEntry(source({ id: 'manual-morning', startTime: '09:00', endTime: '10:00' }), allocationDetails);
    const second = allocateEntry(source({ id: 'manual-late-morning', startTime: '11:00', endTime: '12:00' }), allocationDetails);
    assert.equal(appendEntries(first, email).length, 2);
    const saved = appendEntries(second, email);
    assert.equal(saved.length, 4, 'matching category portions from a different session must not be discarded');
    near(total(saved, 'duration'), 2);
    const retried = appendEntries([...first, ...second], email);
    assert.equal(retried.length, 4, 'retrying the same stable allocation IDs must not duplicate hours');
    near(total(retried, 'duration'), 2);
    assert.equal(new Set(retried.map(entry => entry.allocationSession.sourceEntryId)).size, 2);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('allocation CSV preserves original session clocks, identity and exact duration without inventing child clocks', () => {
  const original = source({ id: 'manual-csv-session', endTime: '09:25', duration: 25 / 60 });
  const entries = allocateEntry(original, details({ allocations: [bucket('restricted', '0.12'), bucket('unrestricted', '0.30')] }));
  const [headers, ...rows] = parseCsv(auditCsv(entries), ',');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const cell = name => row[headers.indexOf(name)];
    assert.equal(cell('Start time'), '');
    assert.equal(cell('End time'), '');
    assert.equal(cell('Source entry ID'), original.id);
    assert.equal(cell('Original entry start'), original.startTime);
    assert.equal(cell('Original entry end'), original.endTime);
    assert.ok(cell('Allocation'));
    const evidence = JSON.parse(cell('All original fields'));
    assert.equal(evidence.sourceEntryId, original.id);
    assert.equal(evidence.date, original.date);
    assert.equal(evidence.duration, original.duration);
  }
  near(rows.reduce((sum, row) => sum + Number(row[headers.indexOf('Hours')]), 0), original.duration);
});

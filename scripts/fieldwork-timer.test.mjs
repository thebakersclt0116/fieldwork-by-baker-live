import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeTimerDetails, completeTimerDetails, elapsedTimerSeconds, entriesForTimer, readTimerJournal, restoreTimerEntries, startTimerSession, stopTimerSession, timerNeedsDetails } from '../src/lib/fieldworkTimer.ts';
import { loadEntries } from '../src/lib/fieldworkStore.ts';
import { initializeCloud, waitForCloudSave } from '../src/lib/cloudWorkspace.ts';
const originalFetch = globalThis.fetch;

const email = 'timer-candidate@example.invalid';
const details = { notes: 'Reviewed behavior assessment data.', category: 'UNRESTRICTED', fieldworkType: 'SUPERVISED', organization: 'Practice organization', supervisor: 'Responsible supervisor', setting: 'Clinic', presence: 'INDEPENDENT', supervisionMinutes: 0, observationMinutes: 0, supervisionFormat: 'INDIVIDUAL', observationMode: 'IN_PERSON' };
let values;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  localStorage.setItem('authUser', JSON.stringify({ email }));
});
afterEach(() => { delete globalThis.localStorage; globalThis.fetch = originalFetch; });

test('start is durable, repeat start reuses the same session, and elapsed time uses the clock', () => {
  const startedAt = new Date(2026, 9, 25, 10, 0).getTime();
  const running = startTimerSession(email, startedAt);
  assert.equal(readTimerJournal(email).running.id, running.id);
  assert.equal(startTimerSession(email, startedAt + 10_000).id, running.id);
  assert.equal(elapsedTimerSeconds(running, startedAt + 3_661_000), 3661);
});
test('stop retains exact elapsed hours before entry storage and repeat stop cannot duplicate them', () => {
  const startedAt = new Date(2026, 9, 25, 10, 0).getTime();
  startTimerSession(email, startedAt);
  const stopped = stopTimerSession(email, startedAt + 3_661_000);
  assert.equal(readTimerJournal(email).running, null);
  assert.equal(stopped.entries[0].duration, 3661 / 3600);
  assert.equal(loadEntries(email).length, 0);
  assert.equal(timerNeedsDetails(stopped.entries[0]), true);
  assert.equal(stopped.entries[0].activityCategory, 'UNKNOWN');
  assert.equal(stopped.entries[0].status, 'DRAFT');
  restoreTimerEntries(email); restoreTimerEntries(email);
  assert.equal(loadEntries(email).length, 1);
  assert.equal(stopTimerSession(email, startedAt + 4_000_000), null);
  assert.equal(loadEntries(email).length, 1);
});
test('a zero-length stop never invents hours', () => {
  startTimerSession(email, 1000);
  assert.equal(stopTimerSession(email, 1000), null);
  assert.equal(readTimerJournal(email).running, null);
  assert.equal(restoreTimerEntries(email).length, 0);
});
test('a backward device clock preserves the running session for review', () => {
  const running = startTimerSession(email, 10_000);
  assert.throws(() => stopTimerSession(email, 9999), /clock changed/);
  assert.equal(readTimerJournal(email).running.id, running.id);
});
test('overnight sessions split by local calendar day without losing duration', () => {
  const start = new Date(2026, 9, 25, 23, 30).getTime();
  const end = new Date(2026, 9, 26, 0, 45).getTime();
  const entries = entriesForTimer(email, { id: 'overnight', startedAt: start }, end);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => entry.date), ['2026-10-25', '2026-10-26']);
  assert.deepEqual(entries.map(entry => entry.duration), [0.5, 0.75]);
  assert.equal(entries.reduce((sum, entry) => sum + entry.duration, 0), (end - start) / 3_600_000);
  assert.notEqual(entries[0].id, entries[1].id);
});
test('entry-storage failure retains a stopped recovery copy and cannot restart the timer', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 61_000);
  const save = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.endsWith(':entries')) throw new Error('Storage full'); save(key, value); };
  assert.throws(() => restoreTimerEntries(email), /Storage full/);
  assert.equal(readTimerJournal(email).running, null);
  assert.equal(readTimerJournal(email).stopped[0].id, session.id);
  localStorage.setItem = save;
  assert.equal(restoreTimerEntries(email).length, 1);
});
test('finishing details updates original IDs and clears reminder only after acknowledgment', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 3_601_000);
  restoreTimerEntries(email);
  const beforeId = loadEntries(email)[0].id;
  completeTimerDetails(email, session.id, details);
  const entry = loadEntries(email)[0];
  assert.equal(entry.id, beforeId);
  assert.equal(entry.duration, 1);
  assert.equal(entry.status, 'PENDING');
  assert.equal(entry.notes, details.notes);
  assert.equal(timerNeedsDetails(entry), false);
  assert.equal(readTimerJournal(email).stopped.length, 1);
  acknowledgeTimerDetails(email, session.id);
  assert.equal(readTimerJournal(email).stopped.length, 0);
  restoreTimerEntries(email);
  assert.equal(loadEntries(email).length, 1);
});
test('saved detail snapshots can recover after a failed write without replacing reviewed records', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 3_601_000);
  restoreTimerEntries(email);
  const save = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.endsWith(':entries')) throw new Error('Storage full'); save(key, value); };
  assert.throws(() => completeTimerDetails(email, session.id, details), /Storage full/);
  assert.equal(readTimerJournal(email).stopped[0].entries[0].notes, details.notes);
  localStorage.setItem = save;
  restoreTimerEntries(email);
  assert.equal(loadEntries(email)[0].notes, details.notes);
  assert.equal(loadEntries(email).length, 1);
});
test('incomplete details cannot clear the durable reminder', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 61_000);
  restoreTimerEntries(email);
  assert.throws(() => completeTimerDetails(email, session.id, { ...details, notes: ' ' }), /activity description/);
  acknowledgeTimerDetails(email, session.id);
  assert.equal(readTimerJournal(email).stopped.length, 1);
});
test('timers and stopped journals stay scoped to their account', () => {
  const one = startTimerSession(email, 1000);
  localStorage.setItem('authUser', JSON.stringify({ email: 'second@example.invalid' }));
  assert.throws(() => readTimerJournal(email), /account changed/);
  assert.equal(readTimerJournal('second@example.invalid').running, null);
  localStorage.setItem('authUser', JSON.stringify({ email }));
  assert.equal(readTimerJournal(email).running.id, one.id);
});
test('malformed saved timer is preserved instead of silently overwritten', () => {
  const key = 'fieldworkByBaker:timer:v1:' + encodeURIComponent(email);
  localStorage.setItem(key, JSON.stringify({ version: 9, stopped: [] }));
  assert.throws(() => startTimerSession(email, 1000), /needs review/);
  assert.equal(JSON.parse(localStorage.getItem(key)).version, 9);
});

test('independent work records explicit zero supervision and observation minutes', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 3_601_000);
  restoreTimerEntries(email);
  completeTimerDetails(email, session.id, details);
  const entry = loadEntries(email)[0];
  assert.equal(entry.supervisionMinutes, 0);
  assert.equal(entry.observationMinutes, 0);
  assert.equal(entry.individualSupervisionMinutes, 0);
});
test('supervised minutes are bounded by recorded time and observation minutes', () => {
  startTimerSession(email, 1000);
  const session = stopTimerSession(email, 3_601_000);
  restoreTimerEntries(email);
  assert.throws(() => completeTimerDetails(email, session.id, { ...details, presence: 'SUPERVISED', supervisionMinutes: 61 }), /within its recorded time/);
  assert.throws(() => completeTimerDetails(email, session.id, { ...details, presence: 'SUPERVISED', supervisionMinutes: 30, observationMinutes: 31 }), /within its recorded time/);
  completeTimerDetails(email, session.id, { ...details, presence: 'SUPERVISED', supervisionMinutes: 30, observationMinutes: 10 });
  const entry = loadEntries(email)[0];
  assert.equal(entry.supervisionMinutes, 30);
  assert.equal(entry.observationMinutes, 10);
  assert.equal(entry.individualSupervisionMinutes, 30);
});
test('overnight supervision requires explicit minutes for each day instead of an inferred allocation', () => {
  const start = new Date(2026, 9, 25, 23, 30).getTime();
  startTimerSession(email, start);
  const session = stopTimerSession(email, new Date(2026, 9, 26, 0, 45).getTime());
  restoreTimerEntries(email);
  const supervised = { ...details, presence: 'SUPERVISED', supervisionMinutes: 30, observationMinutes: 10 };
  assert.throws(() => completeTimerDetails(email, session.id, supervised), /separately/);
  completeTimerDetails(email, session.id, { ...supervised, supervisionByEntry: Object.fromEntries(session.entries.map(entry => [entry.id, { supervisionMinutes: 10, observationMinutes: 5 }])) });
  assert.equal(loadEntries(email).length, 2);
  assert.deepEqual(loadEntries(email).map(entry => entry.supervisionMinutes), [10, 10]);
});
test('a 25-hour daylight-saving day retains all hours in workspace-compatible records', () => {
  const prior = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const start = new Date(2026, 10, 1, 0, 0).getTime();
    const end = new Date(2026, 10, 2, 0, 0).getTime();
    assert.equal((end - start) / 3_600_000, 25);
    const entries = entriesForTimer(email, { id: 'fall-back', startedAt: start }, end);
    assert.equal(entries.reduce((sum, entry) => sum + entry.duration, 0), 25);
    assert.ok(entries.every(entry => entry.duration > 0 && entry.duration <= 24));
  } finally { if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior; }
});

test('managed timers use the existing cloud queue and preserve the same entry on completion', async () => {
  localStorage.setItem('authUser', JSON.stringify({ email, authProvider: 'supabase' }));
  localStorage.setItem('bakerSessionToken', 'synthetic-timer-token');
  let serverEntries = []; let version = 0; const writes = [];
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.action, 'save-entries');
      assert.equal(body.expectedVersion, version);
      writes.push(body.entries); serverEntries = body.entries; version++;
      return new Response(JSON.stringify({ version }), { status: 200 });
    }
    return new Response(JSON.stringify({ ownerId: 'synthetic-timer-owner', version, entries: serverEntries.map(payload => ({ id: payload.id, revision: 0, payload })), learning: [], nextCursor: null }), { status: 200 });
  };
  await initializeCloud(email);
  startTimerSession(email, 1000); const session = stopTimerSession(email, 3_601_000);
  restoreTimerEntries(email); await waitForCloudSave();
  assert.equal(serverEntries[0].status, 'DRAFT');
  assert.equal(timerNeedsDetails(serverEntries[0]), true);
  completeTimerDetails(email, session.id, details); await waitForCloudSave();
  acknowledgeTimerDetails(email, session.id); restoreTimerEntries(email);
  assert.equal(writes.length, 2); assert.equal(serverEntries.length, 1);
  assert.equal(writes[0][0].id, writes[1][0].id);
  assert.equal(serverEntries[0].supervisionMinutes, 0);
  assert.equal(serverEntries[0].status, 'PENDING');
  assert.equal(timerNeedsDetails(serverEntries[0]), false);
  assert.equal(readTimerJournal(email).stopped.length, 0);
});

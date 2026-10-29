import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeTimerDetails, completeAllocatedTimerDetails, readTimerJournal, restoreTimerEntries, startTimerSession, stopTimerSession } from '../src/lib/fieldworkTimer.ts';
import { loadEntries, saveEntries } from '../src/lib/fieldworkStore.ts';
import { initializeCloud, waitForCloudSave } from '../src/lib/cloudWorkspace.ts';

const email = 'allocated-timer@example.invalid';
const context = { supervisor: 'Responsible Supervisor', organization: 'Practice Organization' };
const allocation = (key, hours, observation = '', observationMinutes = '') => ({ key, hours, observation, observationMinutes });
const independent = allocations => ({ ...context, notes: 'Reviewed assessment data and planned teaching procedures.', presence: 'INDEPENDENT', format: '', fieldworkType: 'SUPERVISED', allocations });
const supervised = allocations => ({ ...independent(allocations), presence: 'SUPERVISED', format: 'ONLINE' });
let values;
const originalFetch = globalThis.fetch;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  localStorage.setItem('authUser', JSON.stringify({ email }));
});
afterEach(() => { delete globalThis.localStorage; globalThis.fetch = originalFetch; });

function stopOne(duration = 3_600_000) {
  const startedAt = new Date(2026, 9, 25, 10, 0).getTime();
  startTimerSession(email, startedAt, context);
  const session = stopTimerSession(email, startedAt + duration);
  restoreTimerEntries(email);
  return session;
}

test('timer captures the chosen supervisor and organization without changing a running timer', () => {
  const startedAt = new Date(2026, 9, 25, 10, 0).getTime();
  const running = startTimerSession(email, startedAt, { supervisor: ' Responsible Supervisor ', organization: ' Practice Organization ' });
  assert.deepEqual(running.context, context);
  assert.deepEqual(readTimerJournal(email).running.context, context);
  assert.equal(startTimerSession(email, startedAt + 1000, { supervisor: 'Another Supervisor', organization: 'Another Organization' }).id, running.id);
  const stopped = stopTimerSession(email, startedAt + 3_600_000);
  assert.deepEqual(stopped.context, context);
  assert.equal(stopped.entries[0].supervisorName, context.supervisor);
  assert.equal(stopped.entries[0].organizationName, context.organization);
  assert.equal(stopped.entries[0].startTime, '10:00');
  assert.equal(stopped.entries[0].endTime, '11:00');
});

test('a new contextual timer requires both selections before its journal is started', () => {
  assert.throws(() => startTimerSession(email, 1000, { ...context, organization: ' ' }), /supervisor and organization/);
  assert.equal(readTimerJournal(email).running, null);
});

test('timer allocations retain exact elapsed seconds while replacing the original source draft', () => {
  const session = stopOne(3_661_000);
  const original = session.entries[0];
  const entries = completeAllocatedTimerDetails(email, session.id, {
    [original.id]: independent([allocation('restricted', '0.50'), allocation('unrestricted', '0.52')]),
  });
  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => entry.id !== original.id && entry.status === 'PENDING' && entry.timerSession.detailsComplete));
  assert.equal(entries.reduce((sum, entry) => sum + entry.duration, 0), 3661 / 3600);
  assert.deepEqual(entries.map(entry => entry.activityCategory), ['RESTRICTED', 'UNRESTRICTED']);
  for (const entry of entries) {
    assert.equal(entry.allocationSession.sourceEntryId, original.id);
    assert.equal(entry.allocationSession.startTime, '10:00');
    assert.equal(entry.allocationSession.endTime, '11:01');
    assert.deepEqual(entry.timerSession, { ...original.timerSession, detailsComplete: true });
    assert.equal(entry.supervisionMinutes, 0);
  }
  assert.deepEqual(readTimerJournal(email).stopped[0].entries, entries);
});

test('allocation completion retains a saved edit to an unfinished draft instead of restoring the old journal range', () => {
  const session = stopOne();
  const original = session.entries[0];
  const edited = { ...original, date: '2026-10-27', startTime: '13:15', endTime: '15:45', duration: 2.5, revision: 1 };
  saveEntries([edited], email);
  assert.equal(readTimerJournal(email).stopped[0].entries[0].duration, 1);
  const entries = completeAllocatedTimerDetails(email, session.id, {
    [original.id]: independent([allocation('restricted', '1'), allocation('unrestricted', '1.5')]),
  });
  assert.equal(entries.length, 2);
  assert.equal(entries.reduce((sum, entry) => sum + entry.duration, 0), 2.5);
  for (const entry of entries) {
    assert.equal(entry.date, edited.date);
    assert.equal(entry.revision, edited.revision);
    assert.equal(entry.allocationSession.date, edited.date);
    assert.equal(entry.allocationSession.startTime, edited.startTime);
    assert.equal(entry.allocationSession.endTime, edited.endTime);
    assert.equal(entry.allocationSession.duration, edited.duration);
    assert.equal(entry.timerSession.startedAt, original.timerSession.startedAt);
    assert.equal(entry.timerSession.stoppedAt, original.timerSession.stoppedAt);
  }
  assert.deepEqual(readTimerJournal(email).stopped[0].entries, entries);
  assert.deepEqual(restoreTimerEntries(email), entries);
});

test('a failed allocation write recovers journal snapshots without duplicating the original draft', () => {
  const session = stopOne();
  const original = session.entries[0];
  const save = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.endsWith(':entries')) throw new Error('Storage full'); save(key, value); };
  const detailsByEntry = { [original.id]: independent([allocation('restricted', '0.25'), allocation('unrestricted', '0.75')]) };
  assert.throws(() => completeAllocatedTimerDetails(email, session.id, detailsByEntry), /Storage full/);
  assert.equal(loadEntries(email).length, 1);
  assert.equal(loadEntries(email)[0].id, original.id);
  assert.equal(readTimerJournal(email).stopped[0].entries.length, 2);
  localStorage.setItem = save;
  completeAllocatedTimerDetails(email, session.id, detailsByEntry);
  restoreTimerEntries(email); restoreTimerEntries(email);
  const recovered = loadEntries(email);
  assert.equal(recovered.length, 2);
  assert.ok(recovered.every(entry => entry.id !== original.id));
  assert.equal(recovered.reduce((sum, entry) => sum + entry.duration, 0), 1);
  acknowledgeTimerDetails(email, session.id);
  assert.equal(readTimerJournal(email).stopped.length, 0);
  assert.equal(restoreTimerEntries(email).length, 2);
});

test('an older source journal cannot restore a draft beside completed allocations', () => {
  const session = stopOne();
  const originalJournal = JSON.stringify(readTimerJournal(email));
  completeAllocatedTimerDetails(email, session.id, { [session.entries[0].id]: independent([allocation('restricted', '0.5'), allocation('unrestricted', '0.5')]) });
  localStorage.setItem('fieldworkByBaker:timer:v1:' + encodeURIComponent(email), originalJournal);
  assert.equal(restoreTimerEntries(email).length, 2);
  assert.ok(loadEntries(email).every(entry => entry.id !== session.entries[0].id));
});

test('repeated completion and completion after acknowledgment keep the same saved allocations', () => {
  const session = stopOne();
  const original = session.entries[0];
  const saved = completeAllocatedTimerDetails(email, session.id, { [original.id]: independent([allocation('restricted', '0.5'), allocation('unrestricted', '0.5')]) });
  const changedDetails = { [original.id]: independent([allocation('unrestricted', '1')]) };
  assert.deepEqual(completeAllocatedTimerDetails(email, session.id, changedDetails), saved);
  acknowledgeTimerDetails(email, session.id);
  assert.deepEqual(completeAllocatedTimerDetails(email, session.id, changedDetails), saved);
});

test('each overnight date has its own allocation and retains its exact timer range', () => {
  const start = new Date(2026, 9, 25, 23, 30).getTime();
  const end = new Date(2026, 9, 26, 0, 45).getTime();
  startTimerSession(email, start, context);
  const session = stopTimerSession(email, end);
  restoreTimerEntries(email);
  const [first, second] = session.entries;
  const entries = completeAllocatedTimerDetails(email, session.id, {
    [first.id]: independent([allocation('restricted', '0.25'), allocation('unrestricted', '0.25')]),
    [second.id]: supervised([allocation('individualUnrestricted', '0.25', 'YES', '5'), allocation('groupUnrestricted', '0.5')]),
  });
  assert.equal(entries.length, 4);
  assert.equal(entries.reduce((sum, entry) => sum + entry.duration, 0), 1.25);
  for (const source of session.entries) {
    const portions = entries.filter(entry => entry.allocationSession.sourceEntryId === source.id);
    assert.equal(portions.reduce((sum, entry) => sum + entry.duration, 0), source.duration);
    assert.ok(portions.every(entry => entry.date === source.date && entry.allocationSession.startTime === source.startTime && entry.allocationSession.endTime === source.endTime));
    assert.ok(portions.every(entry => entry.timerSession.startedAt === source.timerSession.startedAt && entry.timerSession.stoppedAt === source.timerSession.stoppedAt));
  }
  const individual = entries.find(entry => entry.supervisionFormat === 'INDIVIDUAL');
  assert.equal(individual.observationMinutes, 5);
  assert.equal(individual.observationMode, 'ONLINE');
});

test('an invalid allocation on one date changes neither journal nor existing entries', () => {
  const start = new Date(2026, 9, 25, 23, 30).getTime();
  startTimerSession(email, start, context);
  const session = stopTimerSession(email, new Date(2026, 9, 26, 0, 45).getTime());
  restoreTimerEntries(email);
  const beforeJournal = readTimerJournal(email);
  const beforeEntries = loadEntries(email);
  const [first, second] = session.entries;
  assert.throws(() => completeAllocatedTimerDetails(email, session.id, { [first.id]: independent([allocation('unrestricted', '0.5')]) }), /separately for each recorded date/);
  assert.throws(() => completeAllocatedTimerDetails(email, session.id, {
    [first.id]: independent([allocation('unrestricted', '0.5')]),
    [second.id]: supervised([allocation('individualRestricted', '0.75', 'YES', '46')]),
  }), /Observation minutes/);
  assert.deepEqual(readTimerJournal(email), beforeJournal);
  assert.deepEqual(loadEntries(email), beforeEntries);
});

test('recovery preserves an approved original and does not add its alternate allocation snapshots', () => {
  const session = stopOne();
  const original = session.entries[0];
  const save = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.endsWith(':entries')) throw new Error('Storage full'); save(key, value); };
  assert.throws(() => completeAllocatedTimerDetails(email, session.id, { [original.id]: independent([allocation('restricted', '0.5'), allocation('unrestricted', '0.5')]) }), /Storage full/);
  localStorage.setItem = save;
  const approved = { ...original, status: 'VERIFIED', notes: 'Supervisor approved this original.', lastApprovedAt: '2026-10-26T12:00:00.000Z' };
  saveEntries([approved], email);
  assert.deepEqual(restoreTimerEntries(email), [approved]);
});

test('approved and previously approved timer records require the tracked-hours editor', () => {
  const session = stopOne();
  const original = session.entries[0];
  const reviewed = { ...original, status: 'DRAFT', lastApprovedAt: '2026-10-26T12:00:00.000Z' };
  saveEntries([reviewed], email);
  assert.throws(() => completeAllocatedTimerDetails(email, session.id, { [original.id]: independent([allocation('unrestricted', '1')]) }), /approved entry/);
  assert.deepEqual(loadEntries(email), [reviewed]);
  assert.deepEqual(readTimerJournal(email).stopped[0].entries, [original]);
});

test('cloud completion removes the source draft and commits only its allocated portions', async () => {
  localStorage.setItem('authUser', JSON.stringify({ email, authProvider: 'supabase' }));
  localStorage.setItem('bakerSessionToken', 'synthetic-allocated-timer-token');
  let serverEntries = []; let version = 0; const writes = [];
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.action, 'save-entries');
      assert.equal(body.expectedVersion, version);
      writes.push(body);
      const replacements = new Map(body.entries.map(entry => [entry.id, entry]));
      serverEntries = serverEntries.filter(entry => !body.deleteIds.includes(entry.id) && !replacements.has(entry.id)).concat(body.entries);
      version++;
      return new Response(JSON.stringify({ version }), { status: 200 });
    }
    return new Response(JSON.stringify({ ownerId: 'synthetic-allocated-timer-owner', version, entries: serverEntries.map(payload => ({ id: payload.id, revision: 0, payload })), learning: [], nextCursor: null }), { status: 200 });
  };
  await initializeCloud(email);
  const session = stopOne();
  await waitForCloudSave();
  const original = session.entries[0];
  completeAllocatedTimerDetails(email, session.id, { [original.id]: independent([allocation('restricted', '0.25'), allocation('unrestricted', '0.75')]) });
  await waitForCloudSave();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].deleteIds, [original.id]);
  assert.equal(serverEntries.length, 2);
  assert.ok(serverEntries.every(entry => entry.id !== original.id && entry.status === 'PENDING' && entry.timerSession.detailsComplete));
  assert.equal(serverEntries.reduce((sum, entry) => sum + entry.duration, 0), 1);
  acknowledgeTimerDetails(email, session.id);
  assert.equal(readTimerJournal(email).stopped.length, 0);
  assert.equal(restoreTimerEntries(email).length, 2);
  assert.equal(writes.length, 2);
});

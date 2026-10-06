import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudSyncEngine, CorruptDeviceRecordsError, readStrictDeviceRecords, type ApplyMarker, type CloudSyncDependencies, type SyncCheckpoint } from '../src/lib/cloudSync';
import { CloudRequestError, recordJson, type RecordData, type RecordSnapshot, type MigrationSource } from '../src/lib/cloudRecords';
import type { HourEntry } from '../src/types';

const entry = (id: string, duration: number, notes = '') => ({ id, duration, notes, date: '2026-10-01', startTime: '09:00', endTime: '10:00' } as HourEntry);
const data = (...entries: HourEntry[]): RecordData => ({ entries, supervisors: [] });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const snapshot = (records: RecordData, revision: number): RecordSnapshot => ({ ...copy(records), revision, updatedAt: '2026-10-06T00:00:00.000Z' });
const owner = { email: 'ayalaemily52@gmail.com', workspaceId: 'emily-workspace' };

function fixture(localRecords = data(), remoteRecords = data(), baseline?: RecordData) {
  let local = copy(localRecords);
  let remote = snapshot(remoteRecords, baseline ? 1 : 0);
  let checkpoint: SyncCheckpoint | null = baseline ? { version: 1, ...owner, base: snapshot(baseline, 1) } : null;
  let marker: ApplyMarker | null = null;
  let active = true;
  let counts = { documents: 0, batches: 0 };
  let archiveSyncs = 0;
  let localWrites = 0;
  const backups: Array<{ records: RecordData; reason: string }> = [];
  const writes: Array<{ records: RecordData; revision: number; source?: MigrationSource }> = [];
  const operations: string[] = [];
  const deps: CloudSyncDependencies = {
    assertOwner: () => { if (!active) throw new Error('Signed-in account changed'); },
    loadRecords: () => copy(local),
    saveRecords: (_owner, records) => { assert(active); localWrites++; local = copy(records); operations.push('local-write'); },
    readCloud: async () => { operations.push('read'); return copy(remote); },
    writeCloud: async (_owner, records, revision, source) => {
      writes.push({ records: copy(records), revision, source }); operations.push('cloud-write');
      assert.equal(revision, remote.revision);
      remote = snapshot(records, revision + 1);
      return { snapshot: copy(remote), alreadyApplied: false };
    },
    preserve: async (_owner, records, reason) => { backups.push({ records: copy(records), reason }); operations.push('backup'); },
    archiveCounts: async () => ({ ...counts }),
    archiveFingerprint: async () => JSON.stringify(counts),
    syncArchive: async () => { archiveSyncs++; operations.push('archive-verified'); return { ...counts }; },
    readCheckpoint: async () => copy(checkpoint),
    saveCheckpoint: async (_owner, value) => { checkpoint = copy(value); operations.push(value.pending ? 'journal' : 'checkpoint'); },
    readApplyMarker: () => copy(marker),
    saveApplyMarker: (_owner, value) => { marker = copy(value); },
    clearApplyMarker: () => { marker = null; },
    hash: async (records) => `sha256:${recordJson(records)}`,
    origin: 'https://www.fieldworkbybaker.com',
  };
  const engine = new CloudSyncEngine(owner, deps);
  return {
    engine, deps, backups, writes, operations,
    local: () => copy(local), remote: () => copy(remote), checkpoint: () => copy(checkpoint),
    setLocal: (value: RecordData) => { local = copy(value); },
    setRemote: (value: RecordSnapshot) => { remote = copy(value); },
    setCounts: (value: typeof counts) => { counts = { ...value }; },
    switchAccount: () => { active = false; },
    archiveSyncs: () => archiveSyncs, localWrites: () => localWrites,
  };
}

test('existing device records and original files require review before any write or archive upload', async () => {
  const f = fixture(data(entry('emily-original', 7.25)), data(entry('cloud-existing', 2)));
  f.setCounts({ documents: 2, batches: 1 });
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'migration-required');
  assert.deepEqual(f.engine.getSnapshot().localCounts, { entries: 1, supervisors: 0, hours: 7.25 });
  assert.equal(f.engine.getSnapshot().cloudCounts?.hours, 2);
  assert.equal(f.engine.getSnapshot().archiveCounts?.documents, 2);
  assert.equal(f.writes.length, 0);
  assert.equal(f.archiveSyncs(), 0);
  assert.equal(f.localWrites(), 0);
  f.engine.stop();
});

test('original files alone also require confirmation on the first device connection', async () => {
  const f = fixture();
  f.setCounts({ documents: 1, batches: 0 });
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'migration-required');
  assert.equal(f.writes.length, 0);
  assert.equal(f.archiveSyncs(), 0);
  f.engine.stop();
});

test('confirmation rechecks local totals and cannot silently import records changed since review', async () => {
  const f = fixture(data(entry('before-review', 1)));
  await f.engine.sync();
  const reviewId = f.engine.getSnapshot().reviewId;
  f.setLocal(data(entry('before-review', 1), entry('new-during-review', 2)));
  await f.engine.confirmMigration(f.engine.getSnapshot().reviewId!);
  assert.equal(f.engine.getSnapshot().phase, 'migration-required');
  assert.notEqual(f.engine.getSnapshot().reviewId, reviewId);
  assert.equal(f.engine.getSnapshot().localCounts?.hours, 3);
  assert.equal(f.writes.length, 0);
  f.engine.stop();
});

test('confirmed migration preserves a device backup, verifies a read-back, and waits for archives before green status', async () => {
  const f = fixture(data(entry('source-one', 4.5)), data(entry('remote-one', 1.5)));
  await f.engine.sync();
  await f.engine.confirmMigration(f.engine.getSnapshot().reviewId!);
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].source?.kind, 'legacy-browser-migration');
  assert.equal(f.writes[0].source?.snapshotHash, `sha256:${recordJson(data(entry('source-one', 4.5)))}`);
  assert(f.operations.indexOf('backup') < f.operations.indexOf('cloud-write'));
  assert(f.operations.lastIndexOf('read') > f.operations.indexOf('cloud-write'));
  assert(f.operations.indexOf('archive-verified') > f.operations.indexOf('checkpoint'));
  assert.deepEqual(new Set(f.local().entries.map((value) => value.id)), new Set(['source-one', 'remote-one']));
  assert.equal(f.engine.getSnapshot().localCounts?.hours, 6);
  assert(f.backups.some((value) => value.records.entries.length === 1 && value.records.entries[0].id === 'source-one'));
  f.engine.stop();
});

test('repeating an already-applied browser migration adopts verified cloud deletions without resurrection', async () => {
  const original = data(entry('deleted-after-original-migration', 3));
  const f = fixture(original, data());
  f.setRemote(snapshot(data(), 7));
  f.deps.writeCloud = async (_owner, records, revision, source) => {
    f.writes.push({ records: copy(records), revision, source });
    return { snapshot: f.remote(), alreadyApplied: true };
  };
  await f.engine.sync();
  await f.engine.confirmMigration(f.engine.getSnapshot().reviewId!);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.local().entries, []);
  assert.deepEqual(f.remote().entries, []);
  assert.equal(f.checkpoint()?.base.revision, 7);
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  assert(f.backups.some((value) => recordJson(value.records) === recordJson(original)));
  f.engine.stop();
});

test('edits made during upload survive and are sent by the next cycle against the acknowledged base', async () => {
  const before = data(entry('existing', 1));
  const f = fixture(data(entry('existing', 1), entry('pending', 2)), data(entry('existing', 3)), before);
  const originalWrite = f.deps.writeCloud;
  let lateEdit = true;
  f.deps.writeCloud = async (...args) => {
    const result = await originalWrite(...args);
    if (lateEdit) {
      lateEdit = false;
      f.setLocal({ ...f.local(), entries: [...f.local().entries, entry('edited-during-upload', 4)] });
      f.engine.markLocalChange();
    }
    return result;
  };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'waiting');
  assert.equal(f.local().entries.find((value) => value.id === 'existing')?.duration, 3);
  assert(f.local().entries.some((value) => value.id === 'edited-during-upload'));
  assert(!f.remote().entries.some((value) => value.id === 'edited-during-upload'));
  await f.engine.sync();
  assert(f.remote().entries.some((value) => value.id === 'edited-during-upload'));
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  f.engine.stop();
});

test('an edit during backup creation is re-read before any local replacement', async () => {
  const before = data(entry('existing', 1));
  const f = fixture(before, data(entry('existing', 2)), before);
  const originalPreserve = f.deps.preserve;
  let first = true;
  f.deps.preserve = async (...args) => {
    await originalPreserve(...args);
    if (first) { first = false; f.setLocal({ ...f.local(), entries: [...f.local().entries, entry('added-while-saving-backup', 3)] }); }
  };
  await f.engine.sync();
  assert(f.local().entries.some((value) => value.id === 'added-while-saving-backup'));
  assert.equal(f.local().entries.find((value) => value.id === 'existing')?.duration, 2);
  assert.equal(f.engine.getSnapshot().phase, 'waiting');
  f.engine.stop();
});

test('one stale revision is retried with a fresh merge that retains another device additions', async () => {
  const before = data(entry('entry-a', 1));
  const f = fixture(data(entry('entry-a', 2)), before, before);
  const originalWrite = f.deps.writeCloud;
  let attempts = 0;
  f.deps.writeCloud = async (...args) => {
    attempts++;
    if (attempts === 1) {
      f.setRemote(snapshot(data(entry('entry-a', 1), entry('other-device', 5)), 2));
      throw new CloudRequestError('Revision changed', 409);
    }
    return originalWrite(...args);
  };
  await f.engine.sync();
  assert.equal(attempts, 2);
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  assert.equal(f.remote().entries.find((value) => value.id === 'entry-a')?.duration, 2);
  assert(f.local().entries.some((value) => value.id === 'other-device'));
  f.engine.stop();
});

test('conflicting changes preserve both copies and never replace the local records', async () => {
  const before = data(entry('same-record', 1));
  const local = data(entry('same-record', 2));
  const cloud = data(entry('same-record', 3));
  const f = fixture(local, cloud, before);
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'conflict');
  assert.equal(f.writes.length, 0);
  assert.equal(f.localWrites(), 0);
  assert.equal(recordJson(f.local()), recordJson(local));
  assert(f.backups.some((value) => recordJson(value.records) === recordJson(local)));
  assert(f.backups.some((value) => recordJson(value.records) === recordJson(cloud)));
  f.engine.stop();
});

test('a mismatching read-back cannot be called synced or advance the device checkpoint', async () => {
  const before = data(entry('same-record', 1));
  const local = data(entry('same-record', 2));
  const f = fixture(local, before, before);
  const originalWrite = f.deps.writeCloud;
  f.deps.writeCloud = async (...args) => {
    const acknowledgement = await originalWrite(...args);
    f.setRemote(snapshot(data(entry('same-record', 99)), acknowledgement.snapshot.revision));
    return acknowledgement;
  };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'waiting');
  assert.equal(f.engine.getSnapshot().lastVerifiedAt, null);
  assert.equal(f.checkpoint()?.base.revision, 1);
  assert.equal(recordJson(f.local()), recordJson(local));
  assert.equal(f.localWrites(), 0);
  f.engine.stop();
});

test('an account switch during a request stops all subsequent writes and local application', async () => {
  const before = data(entry('record', 1));
  const f = fixture(before, data(entry('record', 2)), before);
  f.deps.readCloud = async () => { f.switchAccount(); return f.remote(); };
  await f.engine.sync();
  assert.equal(f.writes.length, 0);
  assert.equal(f.localWrites(), 0);
  assert.equal(f.archiveSyncs(), 0);
  assert.equal(recordJson(f.local()), recordJson(before));
  f.engine.stop();
});

test('failed archive verification cannot produce a cloud-verified status after records are saved', async () => {
  const f = fixture(data(), data(entry('cloud-record', 2)));
  f.deps.syncArchive = async () => { throw new Error('An original file could not be verified'); };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'error');
  assert.equal(f.engine.getSnapshot().lastVerifiedAt, null);
  assert.equal(f.local().entries[0].id, 'cloud-record');
  assert(f.checkpoint());
  f.engine.stop();
});

test('malformed device JSON is preserved verbatim and can never become cloud deletions', async () => {
  const before = data(entry('must-survive', 6));
  const f = fixture(before, before, before);
  const rawEntries = '[{"id":"broken-truncated-record"';
  const values = new Map<string, string>([
    [`fieldworkByBaker:v1:${owner.email}:entries`, rawEntries],
    [`fieldworkByBaker:v1:${owner.email}:supervisors`, '[]'],
  ]);
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => values.get(key) ?? null } });
  const preserved: unknown[] = [];
  f.deps.loadRecords = () => readStrictDeviceRecords(owner.email);
  f.deps.preserveRaw = async (_owner, raw) => { preserved.push(copy(raw)); };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'error');
  assert.equal(f.engine.getSnapshot().rawRecoveryAvailable, true);
  assert.equal(f.writes.length, 0);
  assert.equal(f.localWrites(), 0);
  assert.deepEqual(preserved, [{ entries: rawEntries, supervisors: '[]' }]);
  assert.equal(values.get(`fieldworkByBaker:v1:${owner.email}:entries`), rawEntries);
  assert.equal(recordJson(f.remote()), recordJson(before));
  f.engine.stop();
});

test('strict device reads distinguish missing collections from malformed, non-array, and inaccessible data', () => {
  Object.assign(globalThis, { localStorage: { getItem: () => null } });
  assert.deepEqual(readStrictDeviceRecords(owner.email), data());
  for (const invalid of ['{}', 'null', '"text"', '[null]', '[{"id":"bad-hours","duration":"7"}]', '']) {
    Object.assign(globalThis, { localStorage: { getItem: (key: string) => key.endsWith(':entries') ? invalid : '[]' } });
    assert.throws(() => readStrictDeviceRecords(owner.email), CorruptDeviceRecordsError);
  }
  Object.assign(globalThis, { localStorage: { getItem: () => { throw new Error('Storage disabled'); } } });
  assert.throws(() => readStrictDeviceRecords(owner.email), /could not read saved device records/);
});

test('the pending application journal recovers a failed final checkpoint without resurrecting remote deletions', async () => {
  const originalLocal = data(entry('original-local', 1));
  const originalRemote = data(entry('remote-later-deleted', 2));
  const f = fixture(originalLocal, originalRemote);
  const originalCheckpoint = f.deps.saveCheckpoint;
  let failFinal = true;
  f.deps.saveCheckpoint = async (...args) => {
    if (!args[1].pending && failFinal) { failFinal = false; throw new Error('Checkpoint commit failed'); }
    await originalCheckpoint(...args);
  };
  await f.engine.sync();
  await f.engine.confirmMigration(f.engine.getSnapshot().reviewId!);
  assert.equal(f.engine.getSnapshot().phase, 'error');
  assert(f.checkpoint()?.pending);
  assert.equal(f.deps.readApplyMarker(owner)?.stage, 'applied');
  assert(f.local().entries.some((value) => value.id === 'remote-later-deleted'));
  f.setRemote(snapshot(originalLocal, 2));
  f.setLocal({ ...f.local(), entries: [...f.local().entries, entry('legitimate-later-edit', 3)] });
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  assert(!f.local().entries.some((value) => value.id === 'remote-later-deleted'));
  assert(!f.remote().entries.some((value) => value.id === 'remote-later-deleted'));
  assert(f.remote().entries.some((value) => value.id === 'legitimate-later-edit'));
  assert.equal(f.checkpoint()?.pending, undefined);
  assert.equal(f.deps.readApplyMarker(owner), null);
  f.engine.stop();
});

test('a partial two-collection cache write is completed from its durable journal without another migration upload', async () => {
  const local = { ...data(entry('local-entry', 1)), supervisors: [{ id: 'local-supervisor', name: 'Local Supervisor' }] };
  const remote = { ...data(entry('remote-entry', 2)), supervisors: [{ id: 'remote-supervisor', name: 'Remote Supervisor' }] };
  const f = fixture(local, remote);
  const saveRecords = f.deps.saveRecords;
  let failPartial = true;
  f.deps.saveRecords = (account, records) => {
    if (failPartial) {
      failPartial = false;
      f.setLocal({ entries: copy(records.entries), supervisors: f.local().supervisors });
      throw new Error('Supervisor cache write failed');
    }
    saveRecords(account, records);
  };
  await f.engine.sync();
  await f.engine.confirmMigration(f.engine.getSnapshot().reviewId!);
  assert.equal(f.engine.getSnapshot().phase, 'error');
  assert.equal(f.deps.readApplyMarker(owner)?.stage, 'applying');
  assert(f.checkpoint()?.pending);
  assert.equal(f.local().entries.length, 2);
  assert.equal(f.local().supervisors.length, 1);
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  assert.equal(f.local().entries.length, 2);
  assert.equal(f.local().supervisors.length, 2);
  assert.equal(f.writes.length, 1);
  assert.equal(f.deps.readApplyMarker(owner), null);
  f.engine.stop();
});

test('an original added during archive verification prevents green status even without a change event', async () => {
  const f = fixture(data(), data(), data());
  let first = true;
  f.deps.syncArchive = async () => {
    if (first) { first = false; f.setCounts({ documents: 1, batches: 0 }); return { documents: 0, batches: 0 }; }
    return { documents: 1, batches: 0 };
  };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'waiting');
  assert.equal(f.engine.getSnapshot().lastVerifiedAt, null);
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  f.engine.stop();
});

test('changed audit content with unchanged archive counts also requires another verification cycle', async () => {
  const f = fixture(data(), data(), data());
  f.setCounts({ documents: 0, batches: 1 });
  let batchState = 'prepared';
  f.deps.archiveFingerprint = async () => batchState;
  f.deps.syncArchive = async () => { batchState = 'committed'; return { documents: 0, batches: 1 }; };
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'waiting');
  assert.equal(f.engine.getSnapshot().lastVerifiedAt, null);
  await f.engine.sync();
  assert.equal(f.engine.getSnapshot().phase, 'synced');
  f.engine.stop();
});

test('a migration checkbox from an older engine cannot authorize a new account review', async () => {
  const old = fixture(data(entry('old-reviewed-record', 1)));
  await old.engine.sync();
  const oldReviewId = old.engine.getSnapshot().reviewId!;
  old.engine.stop();
  const fresh = fixture(data(entry('different-record', 10)));
  await fresh.engine.sync();
  assert.notEqual(fresh.engine.getSnapshot().reviewId, oldReviewId);
  await fresh.engine.confirmMigration(oldReviewId);
  assert.equal(fresh.engine.getSnapshot().phase, 'migration-required');
  assert.equal(fresh.writes.length, 0);
  fresh.engine.stop();
});

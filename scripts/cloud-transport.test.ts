import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { refreshSession } from '../src/hooks/useAuth.ts';
import { cloudRequest, recordMutationId, writeCloudRecords, type CloudOwner, type RecordData } from '../src/lib/cloudRecords.ts';
import { listDeviceBackups, preserveDeviceCopy, type DeviceBackup } from '../src/lib/cloudBackups.ts';
import { CLOUD_RECORDS_CHUNK_BYTES, canonicalJson } from '../shared/cloudTypes.ts';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const alice: CloudOwner = { email: 'alice@example.test', workspaceId: 'workspace-alice' };
const bob: CloudOwner = { email: 'bob@example.test', workspaceId: 'workspace-bob' };
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

async function signIn(owner: CloudOwner) {
  globalThis.fetch = async () => json({ user: { ...owner, userId: owner.workspaceId, name: 'Test Member', role: 'professional', authMethod: 'cookie' }, cloud: true, hasCloudAccount: true });
  await refreshSession();
}

async function setup(owner = alice) {
  Object.assign(globalThis, {
    localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage(), indexedDB: new IDBFactory(),
    window: { location: { origin: 'https://www.fieldworkbybaker.com', assign() {} }, addEventListener() {} },
  });
  await signIn(owner);
}

function records(notes = 'An unchanged original narrative'): RecordData {
  return {
    entries: [{
      id: 'original', userId: alice.email, date: '2026-09-01', startTime: '08:00', endTime: '09:00', duration: 1,
      fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNRESTRICTED',
      supervisorId: 'legacy-supervisor', supervisorName: 'Supervisor', setting: 'Clinic', notes,
      status: 'VERIFIED', createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-01T09:00:00Z', revision: 3,
    }],
    supervisors: [{ id: 'legacy-supervisor', name: 'Supervisor' }],
  };
}

async function editBackup(record: DeviceBackup): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fieldwork-cloud-device-backups-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('backups', 'readwrite');
      transaction.objectStore('backups').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

test('the pending mutation ID is stable across retries and changes with account, revision, content, or migration source', async () => {
  const source = { kind: 'legacy-browser-migration' as const, origin: 'https://www.fieldworkbybaker.com', snapshotHash: 'a'.repeat(64) };
  const first = await recordMutationId(alice, 4, 'b'.repeat(64), source);
  assert.equal(await recordMutationId(alice, 4, 'b'.repeat(64), { snapshotHash: source.snapshotHash, origin: source.origin, kind: source.kind }), first);
  for (const changed of [
    recordMutationId(bob, 4, 'b'.repeat(64), source),
    recordMutationId(alice, 5, 'b'.repeat(64), source),
    recordMutationId(alice, 4, 'c'.repeat(64), source),
    recordMutationId(alice, 4, 'b'.repeat(64), { ...source, origin: 'https://fieldworkbybaker.com' }),
    recordMutationId(alice, 4, 'b'.repeat(64)),
  ]) assert.notEqual(await changed, first);
});

test('interrupted large uploads resume their original chunks and completed retries do not attempt replacement uploads', async () => {
  await setup();
  const original = records('✓'.repeat(900_000));
  const mutationIds: string[] = [];
  const received = new Set<number>();
  const requestsByChunk = new Map<number, number>();
  let failSecondChunk = true;
  let committed = false;
  let completeCalls = 0;
  let chunkCount = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(new Headers(init?.headers).get('X-Fieldwork-Workspace'), alice.workspaceId);
    const path = String(input);
    if (path === '/api/cloud/records/uploads') {
      const manifest = JSON.parse(String(init?.body));
      mutationIds.push(manifest.mutationId);
      chunkCount = manifest.chunkCount;
      assert.equal(chunkCount, Math.ceil(new TextEncoder().encode(canonicalJson(original)).length / CLOUD_RECORDS_CHUNK_BYTES));
      return json({ uploadId: 'same-upload', chunkSize: CLOUD_RECORDS_CHUNK_BYTES, chunkCount, uploadedChunks: committed ? [] : [...received], completed: committed });
    }
    const matched = path.match(/\/chunks\/(\d+)$/);
    if (matched) {
      const index = Number(matched[1]);
      requestsByChunk.set(index, (requestsByChunk.get(index) || 0) + 1);
      if (index === 1 && failSecondChunk) { failSecondChunk = false; throw new TypeError('Simulated network disconnect'); }
      received.add(index);
      return json({ index });
    }
    assert.equal(path, '/api/cloud/records/uploads/same-upload/complete');
    assert.equal(received.size, chunkCount);
    committed = true; completeCalls++;
    return json({ ...original, revision: 1, updatedAt: '2026-10-06T00:00:00Z' });
  };
  await assert.rejects(writeCloudRecords(alice, original, 0), /network disconnect/);
  const resumed = await writeCloudRecords(alice, original, 0);
  assert.equal(canonicalJson(resumed.snapshot.entries), canonicalJson(original.entries));
  assert.equal(requestsByChunk.get(0), 1);
  const uploadedRequests = [...requestsByChunk.values()].reduce((sum, count) => sum + count, 0);
  await writeCloudRecords(alice, original, 0);
  assert.equal([...requestsByChunk.values()].reduce((sum, count) => sum + count, 0), uploadedRequests);
  assert.equal(new Set(mutationIds).size, 1);
  assert.equal(completeCalls, 2);
});

test('a response is rejected if the active account switches while its JSON body is being parsed', async () => {
  await setup();
  globalThis.fetch = async () => {
    const response = json({ entries: records().entries });
    Object.defineProperty(response, 'json', { value: async () => {
      await signIn(bob);
      return { entries: records().entries };
    } });
    return response;
  };
  await assert.rejects(cloudRequest(alice, '/records'), /signed-in account changed/);
});

test('a protected backup is verified on readback and a corrupt existing hash ID is never silently trusted or replaced', async () => {
  await setup();
  const original = records();
  await preserveDeviceCopy(alice.email, original, 'Before migration');
  await preserveDeviceCopy(alice.email, original, 'Same data on retry');
  const saved = await listDeviceBackups(alice.email);
  assert.equal(saved.length, 1);
  assert.equal(canonicalJson({ entries: saved[0].entries, supervisors: saved[0].supervisors }), canonicalJson(original));
  await editBackup({ ...saved[0], entries: [] });
  await assert.rejects(preserveDeviceCopy(alice.email, original, 'Must not trust damaged copy'), /different data/);
  await assert.rejects(listDeviceBackups(alice.email), /checksum verification/);
});

test('an account change during backup hashing stops persistence before any IndexedDB record is written', async () => {
  await setup();
  const originalDigest = crypto.subtle.digest;
  let switched = false;
  crypto.subtle.digest = async (...args) => {
    const result = await originalDigest.apply(crypto.subtle, args);
    if (!switched) { switched = true; await signIn(bob); }
    return result;
  };
  try { await assert.rejects(preserveDeviceCopy(alice.email, records(), 'Interrupted backup'), /signed-in account changed/); }
  finally { crypto.subtle.digest = originalDigest; }
  await signIn(alice);
  assert.deepEqual(await listDeviceBackups(alice.email), []);
});

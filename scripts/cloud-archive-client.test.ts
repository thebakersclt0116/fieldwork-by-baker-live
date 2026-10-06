import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, beforeEach, test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { canonicalJson } from '../shared/cloudTypes.ts';
import type { AuditBatch, SourceDocument } from '../src/lib/migrationArchive';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
}

type SessionIdentity = {
  email: string; name: string; role: 'free';
  userId: string; workspaceId: string; authMethod: 'cookie';
};

const local = new MemoryStorage();
const session = new MemoryStorage();
const browser = Object.assign(new EventTarget(), {
  location: {
    origin: 'https://www.fieldworkbybaker.com',
    assign() { throw new Error('Archive tests must not navigate.'); },
  },
});
const originalGlobals = Object.fromEntries(
  ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);
let sessionIdentity: SessionIdentity | null = null;
let archiveService: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

Object.assign(globalThis, {
  window: browser,
  localStorage: local,
  sessionStorage: session,
  indexedDB: new IDBFactory(),
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    // Exercise the real auth store's server verification. No network is used,
    // and a browser-local profile cannot authenticate this fixture.
    if (String(input) !== '/api/cloud/session' && archiveService) return archiveService(input, init);
    assert.equal(String(input), '/api/cloud/session');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.credentials, 'include');
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return Response.json({ user: sessionIdentity, cloud: true });
  },
});

// Use the canonical module instance also imported by fieldworkStore. A query-
// suffixed auth import would authenticate a different singleton from the archive.
const auth = await import('../src/hooks/useAuth.ts');
const store = await import('../src/lib/fieldworkStore.ts');
const archive = await import('../src/lib/migrationArchive.ts');
const cloudArchive = await import('../src/lib/cloudArchiveSync.ts');

beforeEach(async () => {
  const previousOwner = auth.getStoredAuthUser()?.email;
  if (previousOwner) store.setDeviceEditorAccess(previousOwner, false);
  local.clear();
  session.clear();
  // Each test owns a new in-memory database, including actual IDB transactions,
  // indexes and structured cloning. No browser database or user data is opened.
  Object.assign(globalThis, { indexedDB: new IDBFactory(), localStorage: local, sessionStorage: session });
  archiveService = undefined;
  sessionIdentity = null;
  await auth.refreshSession();
  assert.equal(store.getCurrentUserEmail(), null);
});

after(() => {
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function signIn(owner: string, editor = true): Promise<void> {
  sessionIdentity = {
    email: owner, name: 'Archive Test Member', role: 'free',
    userId: `test-user:${owner}`, workspaceId: `test-workspace:${owner}`, authMethod: 'cookie',
  };
  await auth.refreshSession();
  assert.equal(auth.getStoredAuthUser()?.email, owner);
  assert.equal(store.getCurrentUserEmail(), owner);
  store.setDeviceEditorAccess(owner, editor);
}

function document(owner: string, id = 'legacy-global-document-id'): SourceDocument {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0, 0xff, 0x80, 0x61, 0x0d, 0x0a, 0]);
  return {
    id, owner, bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
    filename: 'original evidence.csv', mime: 'text/csv', size: bytes.byteLength,
    savedAt: '2026-10-01T12:00:00.000Z', kind: 'detailed-source',
  };
}

function batch(owner: string, id = 'legacy-global-batch-id'): AuditBatch {
  return {
    id, owner, createdAt: '2026-10-01T12:01:00.000Z',
    sourceHash: document(owner).hash, filename: 'original evidence.csv',
    mapping: { sourceId: 0, date: 1 },
    options: { sourceSystem: 'Test export', dateOrder: 'MDY' },
    sourceRows: 1,
    results: [{ row: 1, entries: [], errors: [], warnings: ['Source evidence retained.'] }],
    before: [], addedIds: ['imported-entry-1'], archivedSummaryIds: [],
    state: 'prepared', note: 'Original preserved before mutation.',
  };
}

function sourceFile(): File {
  return new File([new Uint8Array([0, 255, 128, 13, 10, 97])], 'new-evidence.bin', { type: 'application/octet-stream' });
}

const CHUNK_BYTES = 1024 * 1024;
type DocumentMetadata = Omit<SourceDocument, 'bytes'>;
function metadataOf(source: SourceDocument): DocumentMetadata {
  const metadata = { ...source } as Partial<SourceDocument>;
  delete metadata.bytes;
  return metadata as DocumentMetadata;
}
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const cloudOwner = (email: string) => ({ email, workspaceId: `test-workspace:${email}` });
const receiptsKey = (email: string) => `fieldworkByBaker:cloudArchive:v1:${email}:test-workspace:${email}`;

function createDevice() {
  const database = new IDBFactory(), storage = new MemoryStorage();
  return {
    storage,
    activate() { Object.assign(globalThis, { indexedDB: database, localStorage: storage }); },
  };
}

/** Wire-level fixture: actual client hashing, IDB writes, upload and readback run. */
function createArchiveService(owner: string) {
  type Saved = { document: DocumentMetadata; verified: boolean; chunks: Map<number, Uint8Array> };
  const documents = new Map<string, Saved>();
  const metrics = { uploads: 0, downloads: 0, initializations: 0, conflicts: 0 };
  const envelope = (saved: Saved) => ({
    document: structuredClone(saved.document), verified: saved.verified,
    chunkSize: CHUNK_BYTES, chunkCount: Math.ceil(saved.document.size / CHUNK_BYTES),
    uploadedChunks: [...saved.chunks.keys()],
  });
  const seed = (source: SourceDocument, verified = true) => {
    const chunks = new Map<number, Uint8Array>();
    if (verified) for (let offset = 0; offset < source.bytes.length; offset += CHUNK_BYTES) {
      chunks.set(offset / CHUNK_BYTES, source.bytes.slice(offset, offset + CHUNK_BYTES));
    }
    documents.set(source.id, { document: structuredClone(metadataOf(source)), verified, chunks });
  };
  const snapshot = (id: string): SourceDocument => {
    const saved = documents.get(id);
    assert.ok(saved, `Missing cloud document ${id}`);
    const bytes = new Uint8Array(saved.document.size);
    for (const [index, chunk] of saved.chunks) bytes.set(chunk, index * CHUNK_BYTES);
    return { ...structuredClone(saved.document), bytes };
  };
  const handle = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers), method = init.method || 'GET';
    assert.equal(headers.get('X-Fieldwork-Workspace'), cloudOwner(owner).workspaceId);
    assert.equal(headers.get('Authorization'), null);
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    const url = new URL(String(input), browser.location.origin);
    const path = url.pathname.replace(/^\/api\/cloud/, '');
    if (path === '/archive/documents' && method === 'GET') {
      return Response.json({ documents: [...documents.values()].filter((saved) => saved.verified).map(envelope), nextCursor: null });
    }
    if (path === '/archive/batches' && method === 'GET') return Response.json({ batches: [], nextCursor: null });
    if (path === '/archive/documents/init' && method === 'POST') {
      const metadata = (JSON.parse(String(init.body)) as { document: DocumentMetadata }).document;
      assert.equal(metadata.owner, owner);
      let saved = documents.get(metadata.id);
      if (saved && canonicalJson(saved.document) !== canonicalJson(metadata)) {
        metrics.conflicts++;
        return Response.json({ error: 'Original metadata is immutable.' }, { status: 409 });
      }
      if (!saved) {
        saved = { document: structuredClone(metadata), verified: false, chunks: new Map() };
        documents.set(metadata.id, saved);
        metrics.initializations++;
      }
      return Response.json(envelope(saved));
    }
    const match = /^\/archive\/documents\/([^/]+)(?:\/(finalize|chunks\/\d+))?$/.exec(path);
    assert.ok(match, `Unexpected archive request: ${method} ${path}`);
    const saved = documents.get(decodeURIComponent(match[1]));
    assert.ok(saved, `Requested document does not exist: ${path}`);
    if (!match[2] && method === 'GET') return Response.json(envelope(saved));
    if (match[2] === 'finalize' && method === 'POST') {
      assert.equal(saved.chunks.size, Math.ceil(saved.document.size / CHUNK_BYTES));
      assert.equal(digest(snapshot(saved.document.id).bytes), saved.document.hash);
      saved.verified = true;
      return Response.json(envelope(saved));
    }
    assert.match(match[2], /^chunks\/\d+$/);
    const index = Number(match[2].split('/')[1]);
    if (method === 'PUT') {
      assert.ok(!saved.verified, 'Verified cloud originals cannot be rewritten.');
      assert.ok(init.body instanceof Uint8Array);
      const bytes = new Uint8Array(init.body);
      assert.equal(bytes.length, Math.min(CHUNK_BYTES, saved.document.size - index * CHUNK_BYTES));
      assert.equal(headers.get('X-Content-SHA256'), digest(bytes));
      saved.chunks.set(index, bytes);
      metrics.uploads++;
      return Response.json({ hash: digest(bytes), size: bytes.length });
    }
    assert.equal(method, 'GET');
    assert.ok(saved.verified);
    const bytes = saved.chunks.get(index);
    assert.ok(bytes);
    metrics.downloads++;
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Content-SHA256': digest(bytes) },
    });
  };
  return { documents, metrics, seed, snapshot, handle };
}

function readStoredZip(bytes: Uint8Array): Array<{ name: string; data: Uint8Array }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files: Array<{ name: string; data: Uint8Array }> = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 6, true), 0, 'Expected inline ZIP sizes.');
    assert.equal(view.getUint16(offset + 8, true), 0, 'Expected uncompressed original bytes.');
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
    files.push({ name: new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)), data: bytes.slice(start, start + size) });
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50, 'ZIP must have a central directory.');
  return files;
}

test('a local profile cannot authorize an archive read or write without a verified session', async () => {
  const owner = 'unverified-archive@example.test';
  local.setItem('authUser', JSON.stringify({ email: owner, role: 'owner' }));
  store.setDeviceEditorAccess(owner, true);
  assert.equal(store.getCurrentUserEmail(), null);
  await assert.rejects(archive.restoreArchivedDocument(owner, document(owner)), /signed-in account changed/);
  await assert.rejects(archive.restoreAuditBatch(owner, batch(owner)), /signed-in account changed/);
  await assert.rejects(archive.listDocuments(owner), /signed-in account changed/);
});

test('a verified source restore preserves every byte and metadata field through fresh and repeated readback', async () => {
  const owner = 'source-readback@example.test';
  await signIn(owner);
  const source = document(owner);
  const before = structuredClone(source);
  await archive.restoreArchivedDocument(owner, source);
  assert.deepEqual(await archive.listDocuments(owner), [before]);
  await archive.restoreArchivedDocument(owner, structuredClone(before));
  assert.deepEqual(await archive.listDocuments(owner), [before]);

  // IndexedDB must retain its own byte copy, independent of the caller's buffer.
  source.bytes.fill(0);
  const saved = (await archive.listDocuments(owner))[0];
  assert.deepEqual(saved, before);
  assert.equal(createHash('sha256').update(saved.bytes).digest('hex'), before.hash);
});

test('global archive primary keys cannot overwrite documents or audit batches owned by another local account', async () => {
  const firstOwner = 'first-owner@example.test';
  const secondOwner = 'second-owner@example.test';
  const original = document(firstOwner);
  const originalBatch = batch(firstOwner);
  await signIn(firstOwner);
  await archive.restoreArchivedDocument(firstOwner, original);
  await archive.restoreAuditBatch(firstOwner, originalBatch);

  await signIn(secondOwner);
  await assert.rejects(
    archive.restoreArchivedDocument(secondOwner, { ...original, owner: secondOwner }),
    /already owned by another local account/,
  );
  await assert.rejects(
    archive.restoreAuditBatch(secondOwner, { ...originalBatch, owner: secondOwner }),
    /already owned by another local account/,
  );
  assert.deepEqual(await archive.listDocuments(secondOwner), []);
  assert.deepEqual(await archive.listBatches(secondOwner), []);
  await assert.rejects(archive.listDocuments(firstOwner), /signed-in account changed/);
  await assert.rejects(archive.listBatches(firstOwner), /signed-in account changed/);

  await signIn(firstOwner);
  assert.deepEqual(await archive.listDocuments(firstOwner), [original]);
  assert.deepEqual(await archive.listBatches(firstOwner), [originalBatch]);
});

test('the same valid byte hash cannot overwrite an original with different source metadata', async () => {
  const owner = 'immutable-metadata@example.test';
  await signIn(owner);
  const original = document(owner);
  await archive.restoreArchivedDocument(owner, original);
  const changes: Partial<SourceDocument>[] = [
    { filename: 'renamed-evidence.csv' },
    { mime: 'application/octet-stream' },
    { savedAt: '2026-10-06T00:00:00.000Z' },
    { kind: 'supporting-document' },
  ];
  for (const change of changes) {
    await assert.rejects(
      archive.restoreArchivedDocument(owner, { ...original, ...change }),
      /original document or its metadata differs/,
    );
    assert.deepEqual(await archive.listDocuments(owner), [original]);
  }
});

test('concurrent first restores with identical bytes but different metadata preserve one complete original', async () => {
  const owner = 'concurrent-original@example.test';
  await signIn(owner);
  const candidates = [document(owner), { ...document(owner), filename: 'different-name.csv' }];
  const outcomes = await Promise.allSettled(candidates.map((source) => archive.restoreArchivedDocument(owner, source)));
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.match(String(rejected.reason), /original document or its metadata differs/);
  const winner = outcomes.findIndex((result) => result.status === 'fulfilled');
  assert.deepEqual(await archive.listDocuments(owner), [candidates[winner]]);
});

test('concurrent prepared and final restores cannot regress either committed or failed audit decisions', async () => {
  const owner = 'terminal-audit@example.test';
  await signIn(owner);
  for (const state of ['committed', 'failed'] as const) {
    for (const finalFirst of [true, false]) {
      const prepared = batch(owner, `${state}:${finalFirst}`);
      const final: AuditBatch = { ...prepared, state, note: `Final ${state} decision.` };
      await archive.restoreAuditBatch(owner, prepared);
      const attempts = finalFirst ? [final, prepared] : [prepared, final];
      const outcomes = await Promise.allSettled(attempts.map((value) => archive.restoreAuditBatch(owner, value)));
      assert.equal(outcomes[finalFirst ? 0 : 1].status, 'fulfilled');
      assert.deepEqual((await archive.listBatches(owner)).find((value) => value.id === prepared.id), final);
      await assert.rejects(archive.restoreAuditBatch(owner, prepared), /audit decision differs/);
      await archive.restoreAuditBatch(owner, structuredClone(final));
      assert.deepEqual((await archive.listBatches(owner)).find((value) => value.id === prepared.id), final);
    }
  }
});

test('competing terminal decisions cannot replace one another or alter the preserved audit evidence', async () => {
  const owner = 'competing-audit@example.test';
  await signIn(owner);
  const prepared = batch(owner);
  await archive.restoreAuditBatch(owner, prepared);
  const candidates: AuditBatch[] = [
    { ...prepared, state: 'committed', note: 'Tracked allocations verified.' },
    { ...prepared, state: 'failed', note: 'Manual recovery required.' },
  ];
  const outcomes = await Promise.allSettled(candidates.map((value) => archive.restoreAuditBatch(owner, value)));
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.match(String(rejected.reason), /audit decision differs/);
  const winner = candidates[outcomes.findIndex((result) => result.status === 'fulfilled')];
  await assert.rejects(
    archive.restoreAuditBatch(owner, { ...winner, addedIds: ['replacement-entry'] }),
    /audit decision differs/,
  );
  assert.deepEqual(await archive.listBatches(owner), [winner]);
});

test('a verified non-editor tab cannot write either restored archives or new imported originals', async () => {
  const owner = 'non-editor@example.test';
  await signIn(owner, false);
  await assert.rejects(archive.restoreArchivedDocument(owner, document(owner)), /Editing is paused in this tab/);
  await assert.rejects(archive.restoreAuditBatch(owner, batch(owner)), /Editing is paused in this tab/);
  await assert.rejects(archive.archiveFile(sourceFile(), owner, 'supporting-document'), /Editing is paused in this tab/);
  assert.deepEqual(await archive.listDocuments(owner), []);
  assert.deepEqual(await archive.listBatches(owner), []);
});

test('malformed or incomplete applying markers block ordinary archive and record writes without changing originals', async () => {
  const owner = 'applying-marker@example.test';
  await signIn(owner);
  const original = document(owner);
  await archive.restoreArchivedDocument(owner, original);
  const entriesKey = `fieldworkByBaker:v1:${owner}:entries`;
  const oldEntries = '[{"id":"retained-device-entry"}]';
  local.setItem(entriesKey, oldEntries);
  const markerKey = `fieldworkByBaker:cloud-apply:v1:${owner}`;
  for (const raw of ['{truncated', 'null', '{}', '{"stage":"applying"}']) {
    local.setItem(markerKey, raw);
    await assert.rejects(
      archive.archiveFile(sourceFile(), owner, 'supporting-document'),
      /recovery is incomplete|records are being restored/,
    );
    assert.throws(() => store.saveEntries([], owner), /recovery is incomplete|records are being restored/);
    assert.equal(local.getItem(entriesKey), oldEntries);
    assert.deepEqual(await archive.listDocuments(owner), [original]);
  }
  local.setItem(markerKey, '{"stage":"applied"}');
  const saved = await archive.archiveFile(sourceFile(), owner, 'supporting-document');
  assert.equal((await archive.listDocuments(owner)).length, 2);
  assert.deepEqual((await archive.listDocuments(owner)).find((value) => value.id === saved.id), saved);
  assert.deepEqual((await archive.listDocuments(owner)).find((value) => value.id === original.id), original);
});

test('hash, size and owner mismatches cannot create a partially verified original', async () => {
  const owner = 'invalid-source@example.test';
  await signIn(owner);
  const source = document(owner);
  for (const changed of [
    { ...source, hash: '0'.repeat(64) },
    { ...source, size: source.size + 1 },
    { ...source, owner: 'different-owner@example.test' },
  ]) {
    await assert.rejects(archive.restoreArchivedDocument(owner, changed), /account and integrity verification/);
    assert.deepEqual(await archive.listDocuments(owner), []);
  }
  await archive.restoreArchivedDocument(owner, source);
  assert.deepEqual(await archive.listDocuments(owner), [source]);
});

test('independent same-byte captures have distinct identities and preserve both complete originals on both devices', async () => {
  const owner = 'independent-captures@example.test';
  await signIn(owner);
  const firstDevice = createDevice(), secondDevice = createDevice();
  const service = createArchiveService(owner);
  archiveService = service.handle;
  firstDevice.activate();
  const first = await archive.archiveFile(sourceFile(), owner, 'supporting-document');
  assert.match(first.id, /:capture:/);
  await cloudArchive.syncCloudArchive(cloudOwner(owner));

  secondDevice.activate();
  const second = await archive.archiveFile(
    new File([sourceFile()], 'same-bytes-new-source.csv', { type: 'text/csv' }), owner, 'detailed-source',
  );
  assert.match(second.id, /:capture:/);
  assert.notEqual(first.id, second.id);
  assert.equal(first.hash, second.hash);
  assert.deepEqual(first.bytes, second.bytes);
  assert.notEqual(first.filename, second.filename);
  assert.notEqual(first.mime, second.mime);
  assert.notEqual(first.kind, second.kind);
  assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 2, batches: 0 });
  const expected = [first, second].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual((await archive.listDocuments(owner)).sort((a, b) => a.id.localeCompare(b.id)), expected);

  firstDevice.activate();
  assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 2, batches: 0 });
  assert.deepEqual((await archive.listDocuments(owner)).sort((a, b) => a.id.localeCompare(b.id)), expected);
  assert.deepEqual(service.snapshot(first.id), first);
  assert.deepEqual(service.snapshot(second.id), second);
  const settled = { ...service.metrics };
  for (const device of [secondDevice, firstDevice]) {
    device.activate();
    await cloudArchive.syncCloudArchive(cloudOwner(owner));
  }
  assert.deepEqual(service.metrics, settled, 'Settled receipts must avoid another upload or download.');
});

const collisionChanges: Array<[string, Partial<SourceDocument>]> = [
  ['filename', { filename: 'a differently named original.csv' }],
  ['capture time', { savedAt: '2026-10-06T12:34:56.789Z' }],
  ['MIME type', { mime: 'application/octet-stream' }],
];
for (const [field, change] of collisionChanges) {
  test(`legacy same-ID ${field} collisions retain both primaries and two stable metadata variants across devices`, async () => {
    const owner = `legacy-${field.replaceAll(' ', '-').toLowerCase()}@example.test`;
    await signIn(owner);
    const firstDevice = createDevice(), secondDevice = createDevice();
    const first = document(owner), second = { ...document(owner), ...change };
    const service = createArchiveService(owner);
    archiveService = service.handle;
    firstDevice.activate();
    await archive.restoreArchivedDocument(owner, first);
    await cloudArchive.syncCloudArchive(cloudOwner(owner));
    secondDevice.activate();
    await archive.restoreArchivedDocument(owner, second);
    // A receipt from the old byte-hash-only format must not hide metadata loss.
    secondDevice.storage.setItem(receiptsKey(owner), JSON.stringify({ documents: { [second.id]: second.hash }, batches: {} }));
    assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 3, batches: 0 });
    assert.deepEqual(service.snapshot(first.id), first, 'The original cloud record must remain immutable.');
    const onSecond = await archive.listDocuments(owner);
    assert.deepEqual(onSecond.find((value) => value.id === second.id), second, 'The original local record must remain immutable.');
    const variants = onSecond.filter((value) => value.originalDocumentId === first.id);
    assert.equal(variants.length, 2);
    assert.equal(new Set(variants.map((value) => value.id)).size, 2);
    for (const original of [first, second]) {
      const matching = variants.find((variant) => {
        const { originalDocumentId, ...evidence } = variant;
        return originalDocumentId === original.id && canonicalJson({ ...evidence, id: original.id, bytes: undefined }) === canonicalJson({ ...original, bytes: undefined });
      });
      assert.ok(matching, `Missing complete preserved metadata for ${field}.`);
      assert.match(matching.id, /^archive-copy:[a-f0-9]{64}$/);
      assert.deepEqual(matching.bytes, original.bytes);
      assert.deepEqual(service.snapshot(matching.id), matching);
    }
    const receipts = JSON.parse(secondDevice.storage.getItem(receiptsKey(owner)) || '{}') as { documents: Record<string, string> };
    assert.equal(receipts.documents[second.id], undefined, 'A conflicting primary cannot receive a shared receipt.');
    for (const variant of variants) assert.match(receipts.documents[variant.id], /^metadata-v2:[a-f0-9]{64}$/);

    firstDevice.activate();
    assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 3, batches: 0 });
    const onFirst = await archive.listDocuments(owner);
    assert.deepEqual(onFirst.find((value) => value.id === first.id), first);
    assert.deepEqual(onFirst.filter((value) => value.originalDocumentId === first.id).sort((a, b) => a.id.localeCompare(b.id)), variants.sort((a, b) => a.id.localeCompare(b.id)));
    const settled = { ...service.metrics }, settledIds = [...service.documents.keys()].sort();
    for (const device of [secondDevice, firstDevice, secondDevice]) {
      device.activate();
      assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 3, batches: 0 });
    }
    assert.deepEqual(service.metrics, settled, 'Collision replay must not add variants or redownload originals.');
    assert.deepEqual([...service.documents.keys()].sort(), settledIds);
  });
}

test('an unlisted pending legacy upload with equal bytes is completed without replacing its metadata', async () => {
  const owner = 'pending-legacy-collision@example.test';
  await signIn(owner);
  const original = document(owner), remote = { ...document(owner), filename: 'pending-device-name.csv', savedAt: '2026-10-02T00:00:00.000Z' };
  await archive.restoreArchivedDocument(owner, original);
  const service = createArchiveService(owner);
  service.seed(remote, false);
  archiveService = service.handle;
  assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 3, batches: 0 });
  assert.equal(service.metrics.conflicts, 1, 'The stale listing must be reconciled through the immutable-ID 409 response.');
  assert.ok(service.documents.get(remote.id)?.verified);
  assert.deepEqual(service.snapshot(remote.id), remote);
  assert.deepEqual((await archive.listDocuments(owner)).find((value) => value.id === original.id), original);
  const settled = { ...service.metrics };
  await cloudArchive.syncCloudArchive(cloudOwner(owner));
  assert.deepEqual(service.metrics, settled);
});

test('a previously verified receipt cannot conceal a later same-byte metadata conflict', async () => {
  const owner = 'metadata-receipt@example.test';
  await signIn(owner);
  const original = document(owner), remote = { ...document(owner), filename: 'different-device-evidence.csv' };
  await archive.restoreArchivedDocument(owner, original);
  const service = createArchiveService(owner);
  archiveService = service.handle;
  await cloudArchive.syncCloudArchive(cloudOwner(owner));
  const oldReceipt = JSON.parse(local.getItem(receiptsKey(owner)) || '{}').documents[original.id];
  assert.match(oldReceipt, /^metadata-v2:/);
  // Emulate the next response identifying another preserved legacy capture.
  service.seed(remote);
  assert.deepEqual(await cloudArchive.syncCloudArchive(cloudOwner(owner)), { documents: 3, batches: 0 });
  assert.deepEqual((await archive.listDocuments(owner)).find((value) => value.id === original.id), original);
  assert.deepEqual(service.snapshot(remote.id), remote);
  assert.equal((await archive.listDocuments(owner)).filter((value) => value.originalDocumentId === original.id).length, 2);
  assert.equal(JSON.parse(local.getItem(receiptsKey(owner)) || '{}').documents[original.id], undefined);
});

test('different bytes, hashes, sizes, or owners fail closed without replacing either primary', async () => {
  const owner = 'reject-invalid-collisions@example.test';
  await signIn(owner);
  const original = document(owner), differentBytes = original.bytes.slice();
  differentBytes[0] ^= 0xff;
  const badSources: SourceDocument[] = [
    { ...document(owner), bytes: differentBytes, hash: digest(differentBytes) },
    { ...document(owner), hash: '0'.repeat(64) },
    { ...document(owner), size: original.size + 1 },
    { ...document(owner), owner: 'another-account@example.test' },
  ];
  await archive.restoreArchivedDocument(owner, original);
  for (const remote of badSources) {
    const service = createArchiveService(owner);
    service.seed(remote);
    archiveService = service.handle;
    await assert.rejects(cloudArchive.syncCloudArchive(cloudOwner(owner)), /differs between this device|account and size verification/);
    assert.deepEqual(await archive.listDocuments(owner), [original]);
    assert.deepEqual(service.documents.get(remote.id)?.document, metadataOf(remote));
    assert.equal(service.documents.size, 1);
    assert.deepEqual(service.metrics, { uploads: 0, downloads: 0, initializations: 0, conflicts: 0 });
    assert.equal(local.getItem(receiptsKey(owner)), null);
  }
});

test('valid chunk checksums cannot hide corrupted complete original bytes during collision recovery', async () => {
  const owner = 'corrupted-remote-original@example.test';
  await signIn(owner);
  const original = document(owner), changedBytes = original.bytes.slice();
  changedBytes[0] ^= 0xff;
  const remote = { ...document(owner), filename: 'cloud-original.csv', bytes: changedBytes };
  await archive.restoreArchivedDocument(owner, original);
  const service = createArchiveService(owner);
  service.seed(remote);
  archiveService = service.handle;
  await assert.rejects(cloudArchive.syncCloudArchive(cloudOwner(owner)), /restored original file checksum did not match/);
  assert.deepEqual((await archive.listDocuments(owner)).find((value) => value.id === original.id), original);
  assert.equal(service.documents.size, 1, 'Unverified remote data must not produce uploaded variants.');
  assert.equal(service.metrics.uploads, 0);
  assert.equal(local.getItem(receiptsKey(owner)), null);
});

test('full audit ZIP retains same-hash duplicate filenames under distinct paths with exact metadata and bytes', async () => {
  const owner = 'duplicate-zip-paths@example.test';
  await signIn(owner);
  const originals = [
    { ...document(owner, 'first-capture'), filename: '../same evidence.csv' },
    { ...document(owner, 'second-capture'), filename: '../same evidence.csv', savedAt: '2026-10-02T00:00:00.000Z', mime: 'application/octet-stream' },
  ];
  for (const original of originals) await archive.restoreArchivedDocument(owner, original);
  const files = readStoredZip(await archive.buildAuditArchive(owner));
  assert.equal(new Set(files.map((file) => file.name)).size, files.length, 'No ZIP member can shadow another original.');
  const manifestFile = files.find((file) => file.name === 'manifest.json');
  assert.ok(manifestFile);
  const manifest = JSON.parse(new TextDecoder().decode(manifestFile.data)) as {
    originalDocuments: Array<DocumentMetadata & { archivePath: string }>;
    files: Array<{ path: string; bytes: number; sha256: string }>;
  };
  assert.equal(manifest.originalDocuments.length, originals.length);
  for (const original of originals) {
    const saved = manifest.originalDocuments.find((value) => value.id === original.id);
    assert.ok(saved);
    const { archivePath, ...metadata } = saved;
    assert.deepEqual(metadata, metadataOf(original));
    assert.ok(archivePath.startsWith(`originals/${original.hash}/`));
    assert.ok(!archivePath.split('/').includes('..'));
    const file = files.find((value) => value.name === archivePath);
    assert.ok(file);
    assert.deepEqual(file.data, original.bytes);
    assert.deepEqual(manifest.files.find((value) => value.path === archivePath), { path: archivePath, bytes: original.size, sha256: original.hash });
  }
});

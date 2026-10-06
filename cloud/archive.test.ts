import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import type { Pool } from 'pg';
import type { CloudIdentity } from '../shared/cloudTypes.ts';
import { ARCHIVE_CHUNK_BYTES, ARCHIVE_JSON_BYTES, ARCHIVE_MAX_BYTES, canonicalArchiveJson, createArchiveRouter } from './archive.ts';

type DbResult = { rows: Array<Record<string, unknown>>; affectedRows?: number };
type EmbeddedPostgres = { query: (sql: string, params?: unknown[]) => Promise<DbResult>; exec: (sql: string) => Promise<unknown>; close: () => Promise<void> };
type PGliteConstructor = new () => EmbeddedPostgres;
let PGlite: PGliteConstructor | undefined;
try {
  const moduleName = process.env.PGLITE_MODULE || '@electric-sql/pglite';
  PGlite = (await import(moduleName) as { PGlite: PGliteConstructor }).PGlite;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const alice: CloudIdentity = { userId: 'archive-test-alice', workspaceId: 'archive-workspace-alice', email: 'alice@example.test', name: 'Archive test A', role: 'PROFESSIONAL', authMethod: 'test' };
const bob: CloudIdentity = { userId: 'archive-test-bob', workspaceId: 'archive-workspace-bob', email: 'bob@example.test', name: 'Archive test B', role: 'PROFESSIONAL', authMethod: 'test' };
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const encoded = (id: string) => encodeURIComponent(id);
const base = '/api/cloud/archive';

/** PGlite executes actual PostgreSQL, constraints and triggers. Serialize its single connection. */
function postgresPool(database: EmbeddedPostgres): Pool {
  let tail: Promise<void> = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let release = () => {};
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql: string, params?: unknown[]) {
    const result = await database.query(sql, params);
    const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? Buffer.from(value) : value])));
    return { rows, rowCount: result.affectedRows ?? rows.length };
  }
  return {
    async query(sql: string, params?: unknown[]) { const release = await acquire(); try { return await query(sql, params); } finally { release(); } },
    async connect() { const release = await acquire(); return { query, release }; },
  } as unknown as Pool;
}
async function start() {
  assert.ok(PGlite);
  const database = new PGlite();
  await database.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const app = express();
  app.use((request, _response, next) => {
    const selected = request.get('X-Archive-Test-User');
    if (selected === 'alice' || selected === 'bob' || selected === 'wrong-workspace') (request as typeof request & { fieldworkUser?: CloudIdentity }).fieldworkUser = selected === 'alice' ? alice : selected === 'bob' ? bob : { ...bob, workspaceId: alice.workspaceId };
    next();
  });
  app.use('/api/cloud', createArchiveRouter(postgresPool(database)));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(method: string, path: string, body?: unknown, who: 'alice' | 'bob' | 'wrong-workspace' | null = 'alice', binary = false, additionalHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...additionalHeaders };
    if (who) headers['X-Archive-Test-User'] = who;
    if (body !== undefined) headers['Content-Type'] = binary ? 'application/octet-stream' : 'application/json';
    return fetch(origin + base + path, { method, headers, body: body === undefined ? undefined : binary ? Uint8Array.from(body as Uint8Array) : JSON.stringify(body) });
  }
  return { database, server, request };
}
async function status(response: globalThis.Response, expected: number) {
  if (response.status !== expected) assert.fail(`Expected ${expected}, received ${response.status}: ${(await response.text()).slice(0,1200)}`);
  return response;
}
async function stop(server: Server, database: EmbeddedPostgres) {
  await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  await database.close();
}
function metadata(id: string, bytes: Uint8Array, override: Record<string, unknown> = {}) {
  return { id, owner: 'legacy-owner@example.test', hash: sha(bytes), filename: 'untouched source.csv', mime: 'text/csv', size: bytes.length, savedAt: '2026-01-02T03:04:05.000Z', kind: 'detailed-source', extraEvidence: { empty: '', unknown: ['retained', null] }, ...override };
}
function batch(id: string, override: Record<string, unknown> = {}) {
  return {
    id, owner: 'legacy-owner@example.test', createdAt: '2026-01-02T03:04:05.000Z', sourceHash: sha('source'), filename: 'original.csv', mapping: { date: 'Original Date' }, options: { timezone: 'unchanged', missing: null }, sourceRows: 1,
    results: [{ sourceRow: 7, original: { everyColumn: 'verbatim' }, exceptions: ['unclassified'] }],
    before: [{ id: 'legacy-entry', status: 'VERIFIED', duration: 2.25, revision: 8, lastApprovalRevision: 8, revisionHistory: [{ snapshot: { notes: 'original history' } }], migration: { hash: 'original evidence', untouched: true } }],
    addedIds: ['legacy-entry'], archivedSummaryIds: [], state: 'prepared', note: 'Original note', unrecognizedField: { keep: true }, ...override,
  };
}

test('archive API preserves originals and enforces workspace isolation using PostgreSQL', { skip: !PGlite && 'Install @electric-sql/pglite or set PGLITE_MODULE to its installed module; these tests require real PostgreSQL semantics.', timeout: 120_000 }, async t => {
  const { request, database, server } = await start();
  try {
    await t.test('requires authenticated identity and never uses legacy owner metadata for authorization', async () => {
      await status(await request('GET', '/documents', undefined, null), 401);
      await status(await request('POST', '/documents/init', { document: metadata('private-doc', Buffer.from('private')) }), 200);
      await status(await request('GET', '/documents/private-doc', undefined, 'bob'), 404);
      await status(await request('POST', '/documents/private-doc/finalize', undefined, 'bob'), 404);
      await status(await request('PUT', '/documents/private-doc/chunks/0', Buffer.from('private'), 'bob', true), 404);
      await status(await request('GET', '/documents/private-doc', undefined, 'wrong-workspace'), 403);
      await status(await request('POST', '/documents/init', { document: metadata('forbidden-doc', Buffer.from('private')) }, 'wrong-workspace'), 403);
      const list = await (await status(await request('GET', '/documents?includePending=1&owner=legacy-owner%40example.test', undefined, 'bob'), 200)).json() as { documents: unknown[] };
      assert.deepEqual(list.documents, []);
    });

    await t.test('supports out-of-order bounded uploads, identical retries, full hash verification and exact readback', async () => {
      const bytes = Buffer.alloc(ARCHIVE_CHUNK_BYTES * 2 + 19);
      for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
      const document = metadata('preserved-binary', bytes);
      const init = await (await status(await request('POST', '/documents/init', { document }), 200)).json() as { document: unknown; uploadedChunks: number[]; chunkCount: number };
      assert.deepEqual(init.document, document); assert.equal(init.chunkCount, 3); assert.deepEqual(init.uploadedChunks, []);
      await status(await request('GET', '/documents/preserved-binary/chunks/0'), 409);
      const last = bytes.subarray(2 * ARCHIVE_CHUNK_BYTES);
      await status(await request('PUT', '/documents/preserved-binary/chunks/2', last, 'alice', true), 200);
      await status(await request('POST', '/documents/preserved-binary/finalize'), 409);
      for (let index = 0; index < 2; index++) {
        const chunk = bytes.subarray(index * ARCHIVE_CHUNK_BYTES, (index + 1) * ARCHIVE_CHUNK_BYTES);
        await status(await request('PUT', `/documents/preserved-binary/chunks/${index}`, chunk, 'alice', true, { 'X-Content-SHA256': sha(chunk) }), 200);
      }
      const retry = await (await status(await request('PUT', '/documents/preserved-binary/chunks/2', last, 'alice', true), 200)).json() as { idempotent: boolean };
      assert.equal(retry.idempotent, true);
      const resume = await (await status(await request('POST', '/documents/init', { document }), 200)).json() as { uploadedChunks: number[] };
      assert.deepEqual(resume.uploadedChunks, [0, 1, 2]);
      const finalized = await (await status(await request('POST', '/documents/preserved-binary/finalize'), 200)).json() as { verified: boolean; document: unknown; verifiedAt: string };
      assert.equal(finalized.verified, true); assert.deepEqual(finalized.document, document);
      const repeated = await (await status(await request('POST', '/documents/preserved-binary/finalize'), 200)).json() as { verifiedAt: string };
      assert.equal(repeated.verifiedAt, finalized.verifiedAt);
      const readback: Buffer[] = [];
      for (let index = 0; index < 3; index++) {
        const response = await status(await request('GET', `/documents/preserved-binary/chunks/${index}`), 200);
        const chunk = Buffer.from(await response.arrayBuffer());
        assert.equal(response.headers.get('x-content-sha256'), sha(chunk));
        assert.equal(response.headers.get('x-document-sha256'), sha(bytes));
        readback.push(chunk);
      }
      assert.deepEqual(Buffer.concat(readback), bytes);
      await status(await request('GET', '/documents/preserved-binary/chunks/0', undefined, 'bob'), 404);
      await status(await request('POST', '/documents/init', { document: { ...document, filename: 'overwrite.csv' } }), 409);
      await status(await request('PUT', '/documents/preserved-binary/chunks/2', Buffer.alloc(last.length), 'alice', true), 409);
      await assert.rejects(database.query('UPDATE fieldwork_document_chunks SET bytes = $1 WHERE workspace_id = $2 AND document_id = $3', [Buffer.from('changed'), alice.workspaceId, 'preserved-binary']), /immutable/i);
      await assert.rejects(database.query('UPDATE fieldwork_documents SET metadata = $1::jsonb WHERE workspace_id = $2 AND document_id = $3', ['{}', alice.workspaceId, 'preserved-binary']), /immutable/i);
    });

    await t.test('rejects malicious chunk hashes, sizes, indices and full-file hash mismatch without verification', async () => {
      const bytes = Buffer.from('unaltered original');
      await status(await request('POST', '/documents/init', { document: metadata('hash-failure', bytes, { hash: '0'.repeat(64) }) }), 200);
      await status(await request('PUT', '/documents/hash-failure/chunks/0', bytes, 'alice', true, { 'X-Content-SHA256': '0'.repeat(64) }), 422);
      await status(await request('PUT', '/documents/hash-failure/chunks/1', bytes, 'alice', true), 400);
      await status(await request('PUT', '/documents/hash-failure/chunks/0', bytes.subarray(1), 'alice', true), 400);
      await status(await request('PUT', '/documents/hash-failure/chunks/0', Buffer.alloc(ARCHIVE_CHUNK_BYTES + 1), 'alice', true), 413);
      await status(await request('PUT', '/documents/hash-failure/chunks/0', bytes, 'alice', true), 200);
      await status(await request('POST', '/documents/hash-failure/finalize'), 422);
      const state = await (await status(await request('GET', '/documents/hash-failure'), 200)).json() as { verified: boolean };
      assert.equal(state.verified, false);
      await status(await request('GET', '/documents/hash-failure/chunks/0'), 409);
      await status(await request('POST', '/documents/init', { document: metadata('too-large', bytes, { size: ARCHIVE_MAX_BYTES + 1 }) }), 413);
      await status(await request('GET', '/documents/too-large'), 404);
    });

    await t.test('retains separate legacy IDs with identical content and supports empty originals', async () => {
      const empty = Buffer.alloc(0);
      for (const id of ['empty-original-a', 'empty-original-b']) {
        await status(await request('POST', '/documents/init', { document: metadata(id, empty) }), 200);
        await status(await request('POST', `/documents/${id}/finalize`), 200);
      }
      const response = await (await status(await request('GET', '/documents?limit=1'), 200)).json() as { documents: unknown[]; nextCursor: string | null };
      assert.equal(response.documents.length, 1); assert.equal(typeof response.nextCursor, 'string');
    });

    await t.test('preserves complete batch JSON and immutable revisions with idempotent historical retries', async () => {
      const prepared = batch('legacy-batch');
      const first = await (await status(await request('POST', '/batches', { batch: prepared }), 200)).json() as { batch: unknown; version: number; contentHash: string };
      assert.deepEqual(first.batch, prepared); assert.equal(first.version, 1); assert.equal(first.contentHash, sha(canonicalArchiveJson(prepared)));
      const committed = { ...prepared, state: 'committed', note: 'Selected import completed' };
      await status(await request('POST', '/batches', { batch: committed }), 428);
      await status(await request('POST', '/batches', { batch: committed, expectedVersion: 3 }), 409);
      const updated = await (await status(await request('POST', '/batches', { batch: committed, expectedVersion: 1 }), 200)).json() as { version: number };
      assert.equal(updated.version, 2);
      const retry = await (await status(await request('POST', '/batches', { batch: prepared }), 200)).json() as { version: number; currentVersion: number; idempotent: boolean };
      assert.equal(retry.version, 1); assert.equal(retry.currentVersion, 2); assert.equal(retry.idempotent, true);
      const current = await (await status(await request('GET', '/batches/legacy-batch'), 200)).json() as { batch: unknown; version: number };
      assert.deepEqual(current.batch, committed); assert.equal(current.version, 2);
      await status(await request('POST', '/batches', { batch: { ...committed, before: [] }, expectedVersion: 2 }), 409);
      await status(await request('GET', '/batches/legacy-batch', undefined, 'bob'), 404);
      await status(await request('GET', '/batches/legacy-batch/revisions/1/chunks/0', undefined, 'bob'), 404);
      const prior = await status(await request('GET', '/batches/legacy-batch/revisions/1/chunks/0'), 200);
      assert.deepEqual(JSON.parse(await prior.text()), prepared);
      await assert.rejects(database.query('DELETE FROM fieldwork_archive_batch_history WHERE workspace_id = $1 AND batch_id = $2', [alice.workspaceId, 'legacy-batch']), /immutable/i);
    });

    await t.test('transports batches larger than the JSON proxy cap and verifies versioned chunk readback', async () => {
      const large = batch('large-batch', { before: [{ id: 'retained-history', notes: 'λ'.repeat(Math.floor(ARCHIVE_JSON_BYTES / 2) + 5000), provenance: { original: ['all fields retained'] } }] });
      const bytes = Buffer.from(JSON.stringify(large));
      assert.ok(bytes.length > ARCHIVE_JSON_BYTES);
      await status(await request('POST', '/batches', { batch: large }), 413);
      const manifest = { batchId: large.id, sha256: sha(bytes), byteLength: bytes.length, chunkCount: Math.ceil(bytes.length / ARCHIVE_CHUNK_BYTES) };
      const started = await (await status(await request('POST', '/batches/uploads', manifest), 200)).json() as { uploadId: string; chunkCount: number; uploadedChunks: number[] };
      assert.deepEqual(started.uploadedChunks, []);
      await status(await request('POST', `/batches/uploads/${started.uploadId}/complete`, undefined, 'bob'), 404);
      await status(await request('POST', `/batches/uploads/${started.uploadId}/complete`), 409);
      for (let index = started.chunkCount - 1; index >= 0; index--) {
        const chunk = bytes.subarray(index * ARCHIVE_CHUNK_BYTES, (index + 1) * ARCHIVE_CHUNK_BYTES);
        await status(await request('PUT', `/batches/uploads/${started.uploadId}/chunks/${index}`, chunk, 'alice', true), 200);
      }
      const resume = await (await status(await request('POST', '/batches/uploads', manifest), 200)).json() as { uploadId: string; uploadedChunks: number[] };
      assert.equal(resume.uploadId, started.uploadId); assert.equal(resume.uploadedChunks.length, started.chunkCount);
      const receiptResponse = await status(await request('POST', `/batches/uploads/${started.uploadId}/complete`), 200);
      const receiptText = await receiptResponse.text(); assert.ok(Buffer.byteLength(receiptText) < 1024);
      const receipt = JSON.parse(receiptText) as { version: number; contentHash: string; byteLength: number; batch?: unknown };
      assert.equal(receipt.batch, undefined); assert.equal(receipt.version, 1);
      const staging = await database.query('SELECT count(*)::text AS count FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2', [alice.workspaceId, started.uploadId]);
      assert.equal(staging.rows[0].count, '0');
      await database.query("UPDATE fieldwork_archive_uploads SET created_at = now() - interval '2 hours' WHERE workspace_id = $1 AND upload_id = $2", [alice.workspaceId, started.uploadId]);
      const completedResume = await (await status(await request('POST', '/batches/uploads', manifest), 200)).json() as { completedVersion: number; uploadedChunks: number[] };
      assert.equal(completedResume.completedVersion, 1); assert.deepEqual(completedResume.uploadedChunks, []);
      const repeated = await (await status(await request('POST', `/batches/uploads/${started.uploadId}/complete`), 200)).json() as { version: number; idempotent: boolean };
      assert.equal(repeated.version, 1); assert.equal(repeated.idempotent, true);
      const metadataOnly = await (await status(await request('GET', '/batches/large-batch'), 200)).json() as { requiresChunks: boolean };
      assert.equal(metadataOnly.requiresChunks, true);
      const readManifest = await (await status(await request('GET', '/batches/large-batch/manifest'), 200)).json() as { chunkCount: number; contentHash: string; byteLength: number; version: number };
      const parts: Buffer[] = [];
      for (let index = 0; index < readManifest.chunkCount; index++) {
        const response = await status(await request('GET', `/batches/large-batch/revisions/${readManifest.version}/chunks/${index}`), 200);
        const part = Buffer.from(await response.arrayBuffer()); assert.ok(part.length <= ARCHIVE_CHUNK_BYTES); parts.push(part);
      }
      const restored = Buffer.concat(parts);
      assert.equal(restored.length, readManifest.byteLength); assert.equal(sha(restored), receipt.contentHash); assert.equal(readManifest.contentHash, receipt.contentHash);
      assert.deepEqual(JSON.parse(restored.toString('utf8')), large);
      const listResponse = await status(await request('GET', '/batches'), 200);
      const listText = await listResponse.text(); assert.ok(Buffer.byteLength(listText) < 5000);
      assert.ok(!listText.includes('all fields retained'));
    });

    await t.test('does not commit staged batches with mismatched hashes or manifest IDs', async () => {
      const payload = batch('manifest-source');
      const bytes = Buffer.from(JSON.stringify(payload));
      for (const [batchId, expectedHash, expectedStatus] of [['hash-rejected', '0'.repeat(64), 422], ['id-rejected', sha(bytes), 409]] as const) {
        const started = await (await status(await request('POST', '/batches/uploads', { batchId, sha256: expectedHash, byteLength: bytes.length, chunkCount: 1 }), 200)).json() as { uploadId: string };
        await status(await request('PUT', `/batches/uploads/${started.uploadId}/chunks/0`, bytes, 'alice', true), 200);
        await status(await request('POST', `/batches/uploads/${started.uploadId}/complete`), expectedStatus);
        await status(await request('GET', `/batches/${batchId}`), 404);
        const state = await database.query('SELECT completed_version FROM fieldwork_archive_uploads WHERE workspace_id = $1 AND upload_id = $2', [alice.workspaceId, started.uploadId]);
        assert.equal(state.rows[0].completed_version, null);
      }
      const foreign = batch('other-owner-batch');
      await status(await request('POST', '/batches', { batch: foreign }, 'bob'), 200);
      await status(await request('GET', `/batches/${encoded(foreign.id)}`), 404);
    });

    await t.test('bounds pending uploads, expires transport bytes, and admits safe resumptions at the quota', async () => {
      const uploads: Array<{ uploadId: string; body: Record<string, unknown>; bytes: Buffer }> = [];
      for (let index = 0; index < 3; index++) {
        const payload = batch(`quota-batch-${index}`), bytes = Buffer.from(JSON.stringify(payload));
        const body = { batchId: payload.id, sha256: sha(bytes), byteLength: bytes.length, chunkCount: 1 };
        const created = await (await status(await request('POST', '/batches/uploads', body, 'bob'), 200)).json() as { uploadId: string };
        uploads.push({ uploadId: created.uploadId, body, bytes });
      }
      const fourth = batch('quota-batch-fourth'), fourthBytes = Buffer.from(JSON.stringify(fourth));
      const fourthManifest = { batchId: fourth.id, sha256: sha(fourthBytes), byteLength: fourthBytes.length, chunkCount: 1 };
      await status(await request('POST', '/batches/uploads', fourthManifest, 'bob'), 429);
      const replay = await (await status(await request('POST', '/batches/uploads', uploads[0].body, 'bob'), 200)).json() as { uploadId: string };
      assert.equal(replay.uploadId, uploads[0].uploadId);
      await status(await request('PUT', `/batches/uploads/${uploads[0].uploadId}/chunks/0`, uploads[0].bytes, 'bob', true), 200);
      await database.query("UPDATE fieldwork_archive_uploads SET created_at = now() - interval '2 hours' WHERE workspace_id = $1 AND upload_id = $2", [bob.workspaceId, uploads[0].uploadId]);
      await status(await request('POST', `/batches/uploads/${uploads[0].uploadId}/complete`, undefined, 'bob'), 410);
      await status(await request('PUT', `/batches/uploads/${uploads[0].uploadId}/chunks/0`, uploads[0].bytes, 'bob', true), 410);
      await status(await request('POST', '/batches/uploads', fourthManifest, 'bob'), 200);
      const removed = await database.query('SELECT count(*)::text AS count FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2', [bob.workspaceId, uploads[0].uploadId]);
      assert.equal(removed.rows[0].count, '0');
      await status(await request('POST', `/batches/uploads/${uploads[0].uploadId}/complete`, undefined, 'bob'), 404);
      await status(await request('GET', '/batches/quota-batch-0', undefined, 'bob'), 404);
    });
  } finally { await stop(server, database); }
});

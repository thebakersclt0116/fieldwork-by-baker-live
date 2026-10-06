import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import type { Pool } from 'pg';
import {
  CloudStorageError, completeRecordsUpload, createRecordsUpload, getRecords,
  putRecords, putRecordsChunk, recordsResponse, validateRecordsContent,
} from './records.ts';
import { canonicalJson, CLOUD_RECORDS_CHUNK_BYTES, type CloudIdentity } from '../shared/cloudTypes.ts';

type EmbeddedDatabase = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; affectedRows?: number }>;
  exec: (sql: string) => Promise<unknown>;
  close: () => Promise<void>;
};
let db: EmbeddedDatabase;
let pool: Pool;
let unavailable = '';

// The engine executes the actual schema, constraints, transactions, and JSONB
// behavior. A mutex adapts its single connection to pg.Pool's transaction API.
before(async () => {
  const moduleName = process.env.PGLITE_MODULE || '@electric-sql/pglite';
  let module: { PGlite: new () => EmbeddedDatabase };
  try { module = await import(moduleName); }
  catch { unavailable = 'Install @electric-sql/pglite or set PGLITE_MODULE to run the PostgreSQL storage integration tests.'; return; }
  db = new module.PGlite();
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  let tail: Promise<void> = Promise.resolve();
  async function lock(): Promise<() => void> {
    const previous = tail;
    let release = () => {};
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql: string, values?: unknown[]) {
    const result = await db.query(sql, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  pool = {
    query: async (sql: string, values?: unknown[]) => {
      const release = await lock();
      try { return await query(sql, values); } finally { release(); }
    },
    connect: async () => {
      const release = await lock();
      return { query, release };
    },
  } as unknown as Pool;
});
after(async () => { await db?.close(); });

function user(suffix: string): CloudIdentity {
  return { userId: `test-${suffix}`, workspaceId: `workspace-test-${suffix}`, email: `${suffix}@example.test`, name: suffix, role: 'professional', authMethod: 'test' };
}
function entry(id = 'original-entry', duration = 1.375) {
  return {
    id, userId: 'legacy-email@example.test', date: '2026-09-20', startTime: '08:00', endTime: '09:22', duration,
    fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNRESTRICTED',
    supervisorId: 'legacy-name-derived-id', supervisorName: 'Test supervisor', setting: 'Clinic',
    status: 'VERIFIED', createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-21T12:00:00Z',
    revision: 3, lastApprovalRevision: 3, lastApprovedAt: '2026-09-21T12:00:00Z', requiresReapproval: false,
    revisionHistory: [{ revision: 2, changedAt: '2026-09-20T13:00:00Z', snapshot: { notes: 'original wording', duration: 1.25 } }],
    migration: { version: 'entry-audit-v1', sourceFile: 'unchanged.json', sourceHash: 'c'.repeat(64), raw: [{ column: 'Custom', value: 'Unmapped original field' }], original: { nested: ['a', { z: 1, a: 2 }] } },
    futureField: { preserve: true, ordered: [3, 1, 2], nullable: null },
  };
}
function content(id = 'original-entry') {
  return { entries: [entry(id)], supervisors: [{ id: 'legacy-supervisor', name: 'Test supervisor', futureField: 'keep this too' }] };
}
function digest(bytes: Uint8Array | string): string { return createHash('sha256').update(bytes).digest('hex'); }
function hasCode(code: string) { return (error: unknown) => error instanceof CloudStorageError && error.code === code; }

test('canonical JSON retains array order and unknown values while normalizing only object key order', () => {
  assert.equal(canonicalJson({ z: [3, 1, 2], a: { z: 'last', a: 'first' }, absent: undefined }), '{"a":{"a":"first","z":"last"},"z":[3,1,2]}');
  assert.throws(() => canonicalJson({ n: Infinity }), TypeError);
  assert.throws(() => canonicalJson({ n: BigInt(1) }), TypeError);
});

test('invalid IDs, duplicate records, and invalid durations are rejected without normalizing saved values', () => {
  assert.throws(() => validateRecordsContent({ entries: [entry('same'), entry('same')], supervisors: [] }), hasCode('DUPLICATE_ENTRY_ID'));
  assert.throws(() => validateRecordsContent({ entries: [entry('', 1)], supervisors: [] }), hasCode('INVALID_RECORDS'));
  for (const duration of [-1, Infinity, NaN, '1']) {
    assert.throws(() => validateRecordsContent({ entries: [{ ...entry(), duration }], supervisors: [] }), hasCode('INVALID_DURATION'));
  }
  assert.throws(() => validateRecordsContent({ entries: [{ ...entry(), notes: '\u0000' }], supervisors: [] }), hasCode('INVALID_RECORDS'));
  const aggregate = validateRecordsContent({ entries: [{ ...entry(), duration: 156.375, recordKind: 'MONTHLY_SUMMARY' }], supervisors: [] });
  assert.equal(aggregate.content.entries[0].duration, 156.375);
});

test('complete provenance, approval history, supervisors, and legacy IDs survive actual PostgreSQL JSONB readback', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('preserve');
  const original = content();
  const saved = await putRecords(pool, account, { ...original, expectedRevision: 0, mutationId: 'preserve-first' });
  assert.equal(saved.revision, 1);
  const readback = await getRecords(pool, account);
  assert.equal(canonicalJson({ entries: readback.entries, supervisors: readback.supervisors }), canonicalJson(original));
  const history = await pool.query('SELECT entries, supervisors FROM fieldwork_record_history WHERE workspace_id = $1 AND revision = 1', [account.workspaceId]);
  assert.equal(canonicalJson(history.rows[0]), canonicalJson(original));
});

test('another account cannot target existing records through email, payload userId, or workspace substitution', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const alice = user('isolation-alice');
  const bob = user('isolation-bob');
  await putRecords(pool, alice, { ...content('alice-record'), expectedRevision: 0, mutationId: 'alice-write' });
  await putRecords(pool, bob, { ...content('bob-record'), userId: alice.userId, workspaceId: alice.workspaceId, email: alice.email, expectedRevision: 0, mutationId: 'bob-write' });
  assert.equal((await getRecords(pool, alice)).entries[0].id, 'alice-record');
  assert.equal((await getRecords(pool, bob)).entries[0].id, 'bob-record');
  await assert.rejects(getRecords(pool, { ...bob, workspaceId: alice.workspaceId }), hasCode('WORKSPACE_ACCESS_DENIED'));
});

test('competing snapshots cannot both commit and a conflict preserves both the winner and immutable history', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('competing');
  const results = await Promise.allSettled([
    putRecords(pool, account, { ...content('device-one'), expectedRevision: 0, mutationId: 'device-one' }),
    putRecords(pool, account, { ...content('device-two'), expectedRevision: 0, mutationId: 'device-two' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected?.status === 'rejected' && rejected.reason.code, 'REVISION_CONFLICT');
  const saved = await getRecords(pool, account);
  assert.equal(saved.revision, 1);
  assert.equal(saved.entries.length, 1);
  const history = await pool.query('SELECT count(*)::int AS count FROM fieldwork_record_history WHERE workspace_id = $1', [account.workspaceId]);
  assert.equal(history.rows[0].count, 1);
  await assert.rejects(pool.query('UPDATE fieldwork_record_history SET entries = \'[]\'::jsonb WHERE workspace_id = $1', [account.workspaceId]), /immutable/);
  await assert.rejects(pool.query('DELETE FROM fieldwork_record_history WHERE workspace_id = $1', [account.workspaceId]), /immutable/);
});

test('mutation retries are idempotent and a migration receipt prevents old local backups resurrecting deleted records', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('migration');
  const original = content();
  const source = { kind: 'legacy-browser-migration', origin: 'https://www.fieldworkbybaker.com', snapshotHash: digest(canonicalJson(original)) };
  const request = { ...original, expectedRevision: 0, mutationId: 'initial-migration', source };
  const first = await putRecords(pool, account, request);
  const retry = await putRecords(pool, account, request);
  assert.equal(first.revision, 1);
  assert.equal(retry.revision, 1);
  assert.equal(retry.replayed, true);
  await assert.rejects(putRecords(pool, account, { ...request, entries: [entry('different')] }), hasCode('MUTATION_ID_REUSED'));
  await putRecords(pool, account, { entries: [], supervisors: original.supervisors, expectedRevision: 1, mutationId: 'explicit-delete' });
  const repeatedMigration = await putRecords(pool, account, { ...request, mutationId: 'new-tab-old-backup', expectedRevision: 2 });
  assert.equal(repeatedMigration.migrationAlreadyApplied, true);
  assert.equal(repeatedMigration.revision, 2);
  assert.deepEqual(repeatedMigration.entries, []);
  const audit = await pool.query('SELECT entries FROM fieldwork_record_history WHERE workspace_id = $1 AND revision = 1', [account.workspaceId]);
  assert.equal(audit.rows[0].entries[0].id, 'original-entry');
});

test('a failed immutable-history insert rolls back the ledger update in the same database transaction', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('atomic-history');
  await putRecords(pool, account, { ...content('original'), expectedRevision: 0, mutationId: 'atomic-original' });
  await pool.query("ALTER TABLE fieldwork_record_history ADD CONSTRAINT test_history_failure CHECK (mutation_id <> 'reject-history-insert')");
  try {
    await assert.rejects(putRecords(pool, account, { ...content('must-not-commit'), expectedRevision: 1, mutationId: 'reject-history-insert' }), /test_history_failure/);
  } finally {
    await pool.query('ALTER TABLE fieldwork_record_history DROP CONSTRAINT test_history_failure');
  }
  const current = await getRecords(pool, account);
  assert.equal(current.revision, 1);
  assert.equal(current.entries[0].id, 'original');
  const history = await pool.query('SELECT count(*)::int AS count FROM fieldwork_record_history WHERE workspace_id = $1', [account.workspaceId]);
  assert.equal(history.rows[0].count, 1);
});

test('large records use hash-verified chunks, resume idempotently, and retain every byte through readback', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('large');
  const original = { entries: [{ ...entry(), futureField: { source: 'é'.repeat(1_700_000) } }], supervisors: [] };
  const bytes = Buffer.from(canonicalJson(original));
  const manifest = { expectedRevision: 0, sha256: digest(bytes), byteLength: bytes.length, chunkCount: Math.ceil(bytes.length / CLOUD_RECORDS_CHUNK_BYTES), mutationId: 'large-save' };
  const upload = await createRecordsUpload(pool, account, manifest);
  assert.equal((await createRecordsUpload(pool, account, manifest)).uploadId, upload.uploadId);
  await assert.rejects(completeRecordsUpload(pool, account, upload.uploadId), hasCode('UPLOAD_INCOMPLETE'));
  for (let index = 0; index < upload.chunkCount; index++) {
    const chunk = { data: bytes.subarray(index * CLOUD_RECORDS_CHUNK_BYTES, (index + 1) * CLOUD_RECORDS_CHUNK_BYTES).toString('base64') };
    await putRecordsChunk(pool, account, upload.uploadId, index, chunk);
    await putRecordsChunk(pool, account, upload.uploadId, index, chunk);
  }
  const saved = await completeRecordsUpload(pool, account, upload.uploadId);
  const response = recordsResponse(saved);
  assert.equal('chunked' in response && response.chunked, true);
  if ('chunked' in response) { assert.equal(response.byteLength, bytes.length); assert.equal(response.sha256, digest(bytes)); }
  const readback = await getRecords(pool, account);
  assert.equal(canonicalJson({ entries: readback.entries, supervisors: readback.supervisors }), bytes.toString('utf8'));
  assert.equal((await completeRecordsUpload(pool, account, upload.uploadId)).replayed, true);
});

test('staged uploads reject cross-account access, conflicting chunks, wrong hashes, and writes racing their original revision', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('upload-boundaries');
  const attacker = user('upload-other');
  const bytes = Buffer.from(canonicalJson(content()));
  const manifest = { expectedRevision: 0, sha256: digest(bytes), byteLength: bytes.length, chunkCount: 1, mutationId: 'staged-first' };
  const upload = await createRecordsUpload(pool, account, manifest);
  await assert.rejects(putRecordsChunk(pool, attacker, upload.uploadId, 0, { data: bytes.toString('base64') }), hasCode('UPLOAD_NOT_FOUND'));
  await assert.rejects(completeRecordsUpload(pool, attacker, upload.uploadId), hasCode('UPLOAD_NOT_FOUND'));
  await putRecordsChunk(pool, account, upload.uploadId, 0, { data: bytes.toString('base64') });
  const changed = Buffer.from(bytes); changed[10] = changed[10] === 65 ? 66 : 65;
  await assert.rejects(putRecordsChunk(pool, account, upload.uploadId, 0, { data: changed.toString('base64') }), hasCode('CHUNK_CONFLICT'));
  await putRecords(pool, account, { ...content('other-device'), expectedRevision: 0, mutationId: 'other-device' });
  await assert.rejects(completeRecordsUpload(pool, account, upload.uploadId), hasCode('REVISION_CONFLICT'));
  assert.equal((await getRecords(pool, account)).entries[0].id, 'other-device');
  const corrupt = await createRecordsUpload(pool, account, { ...manifest, expectedRevision: 1, sha256: '0'.repeat(64), mutationId: 'corrupt-upload' });
  await putRecordsChunk(pool, account, corrupt.uploadId, 0, { data: bytes.toString('base64') });
  await assert.rejects(completeRecordsUpload(pool, account, corrupt.uploadId), hasCode('UPLOAD_INTEGRITY_FAILED'));
  assert.equal((await getRecords(pool, account)).revision, 1);
});

test('upload count, size, chunk-size, and expiry limits do not truncate or overwrite existing records', async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const account = user('limits');
  const bytes = Buffer.from(canonicalJson(content()));
  const manifest = { expectedRevision: 0, sha256: digest(bytes), byteLength: bytes.length, chunkCount: 1, mutationId: 'limit-0' };
  await assert.rejects(createRecordsUpload(pool, account, { ...manifest, byteLength: 25 * 1024 * 1024 + 1 }), hasCode('RECORDS_SIZE_LIMIT'));
  const upload = await createRecordsUpload(pool, account, manifest);
  await assert.rejects(putRecordsChunk(pool, account, upload.uploadId, 0, { data: Buffer.from('too short').toString('base64') }), hasCode('INVALID_CHUNK_SIZE'));
  await createRecordsUpload(pool, account, { ...manifest, mutationId: 'limit-1' });
  await createRecordsUpload(pool, account, { ...manifest, mutationId: 'limit-2' });
  await assert.rejects(createRecordsUpload(pool, account, { ...manifest, mutationId: 'limit-3' }), hasCode('TOO_MANY_UPLOADS'));
  await pool.query('UPDATE fieldwork_record_uploads SET expires_at = now() - interval \'1 second\' WHERE workspace_id = $1', [account.workspaceId]);
  await assert.rejects(completeRecordsUpload(pool, account, upload.uploadId), hasCode('UPLOAD_EXPIRED'));
  await createRecordsUpload(pool, account, { ...manifest, mutationId: 'limit-after-expiry' });
  assert.equal((await getRecords(pool, account)).revision, 0);
});

import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { canonicalJson, type CloudIdentity } from '../shared/cloudTypes.ts';
import { CloudStorageError, ensureWorkspace } from './records.ts';

export const ARCHIVE_CHUNK_BYTES = 1024 * 1024;
export const ARCHIVE_MAX_BYTES = 25 * 1024 * 1024;
export const ARCHIVE_JSON_BYTES = 3 * 1024 * 1024;
const DOCUMENT_METADATA_BYTES = 64 * 1024;
const UPLOAD_TTL_MS = 60 * 60 * 1000;
const MAX_PENDING_UPLOADS = 3;
type JsonObject = Record<string, unknown>;
type DocumentRow = { workspace_id: string; document_id: string; hash: string; size: number; metadata: JsonObject; verified_at: Date | string | null };
type ChunkRow = { chunk_index: number; bytes: Buffer; hash: string };
type BatchRow = { batch_id: string; payload: JsonObject; content_hash: string; byte_length: number; version: string | number };
type UploadRow = { upload_id: string; batch_id: string; sha256: string; byte_length: number; expected_version: string | number | null; completed_version: string | number | null; created_at: Date | string };
type Database = Pick<PoolClient, 'query'>;

class ArchiveError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
function fail(status: number, code: string, message: string): never { throw new ArchiveError(status, code, message); }
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value); }
function identifier(value: unknown, name = 'ID'): string {
  if (typeof value !== 'string' || !value.length || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) fail(400, 'INVALID_ID', `A valid ${name} is required.`);
  return value;
}
function hashValue(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{64}$/iu.test(value)) fail(400, 'INVALID_HASH', 'A SHA-256 hex digest is required.');
  return value.toLowerCase();
}
function digest(bytes: Uint8Array | string): string { return createHash('sha256').update(bytes).digest('hex'); }

/** Stable semantic JSON hashing preserves every field while ignoring object key order. */
export function canonicalArchiveJson(value: unknown): string {
  try { return canonicalJson(value); } catch { return fail(400, 'INVALID_JSON', 'Archive metadata must contain finite, bounded JSON values only.'); }
}
function identity(request: Request): CloudIdentity {
  const user = (request as Request & { fieldworkUser?: CloudIdentity }).fieldworkUser;
  if (!user || typeof user.userId !== 'string' || !user.userId || typeof user.workspaceId !== 'string' || !user.workspaceId || typeof user.email !== 'string' || !user.email) {
    fail(401, 'AUTH_REQUIRED', 'Sign in before accessing the archive.');
  }
  return user;
}
function requestObject(request: Request): JsonObject {
  if (!object(request.body)) fail(400, 'INVALID_BODY', 'A JSON object is required.');
  if (Buffer.byteLength(canonicalArchiveJson(request.body)) > ARCHIVE_JSON_BYTES) fail(413, 'USE_CHUNK_UPLOAD', 'This JSON exceeds 3 MiB. Use the verified chunk upload endpoint.');
  return request.body;
}
function versionValue(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(400, 'INVALID_VERSION', 'expectedVersion must be a non-negative integer.');
  return value;
}
function byteLengthValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > ARCHIVE_MAX_BYTES) fail(413, 'ARCHIVE_SIZE_LIMIT', 'Archive uploads must be at most 25 MiB; no content was truncated.');
  return value;
}
function chunkCount(size: number): number { return Math.ceil(size / ARCHIVE_CHUNK_BYTES); }
function chunkIndex(value: unknown, size: number): number {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) fail(400, 'INVALID_CHUNK', 'A valid chunk index is required.');
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index >= chunkCount(size)) fail(400, 'INVALID_CHUNK', 'The chunk index is outside this upload.');
  return index;
}
function expectedChunkLength(size: number, index: number): number { return Math.min(ARCHIVE_CHUNK_BYTES, size - index * ARCHIVE_CHUNK_BYTES); }
function uploadBytes(request: Request, size: number, index: number): Buffer {
  if (!request.is('application/octet-stream') || !Buffer.isBuffer(request.body)) fail(415, 'BINARY_REQUIRED', 'Upload chunks as application/octet-stream.');
  const bytes = request.body as Buffer;
  if (bytes.length > ARCHIVE_CHUNK_BYTES) fail(413, 'CHUNK_SIZE_LIMIT', 'Each chunk must be at most 1 MiB.');
  if (bytes.length !== expectedChunkLength(size, index)) fail(400, 'CHUNK_LENGTH_MISMATCH', 'The chunk length does not match the declared upload size.');
  const suppliedHash = request.get('X-Content-SHA256');
  if (suppliedHash && hashValue(suppliedHash) !== digest(bytes)) fail(422, 'CHUNK_HASH_MISMATCH', 'Chunk SHA-256 verification failed.');
  return bytes;
}
async function transaction<T>(pool: Pool, user: CloudIdentity, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureWorkspace(client, user);
    const value = await run(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally { client.release(); }
}
const route = (handler: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void handler(request, response).catch(next); };

function documentMetadata(value: unknown): JsonObject {
  if (!object(value) || Object.hasOwn(value, 'bytes')) fail(400, 'METADATA_REQUIRED', 'Send document metadata without bytes; upload original bytes in chunks.');
  identifier(value.id, 'document ID');
  identifier(value.owner, 'legacy document owner');
  hashValue(value.hash);
  byteLengthValue(value.size);
  if (typeof value.filename !== 'string' || value.filename.length > 4096 || typeof value.mime !== 'string' || value.mime.length > 1024 || typeof value.savedAt !== 'string' || value.savedAt.length > 128 || !['detailed-source', 'supporting-document'].includes(String(value.kind))) fail(400, 'INVALID_DOCUMENT', 'The original document metadata is incomplete.');
  if (Buffer.byteLength(canonicalArchiveJson(value)) > DOCUMENT_METADATA_BYTES) fail(413, 'METADATA_SIZE_LIMIT', 'Document metadata exceeds 64 KiB; original bytes must use chunk uploads.');
  return value;
}
function documentEnvelope(row: DocumentRow) {
  return { document: row.metadata, verified: Boolean(row.verified_at), verifiedAt: row.verified_at, chunkSize: ARCHIVE_CHUNK_BYTES, chunkCount: chunkCount(row.size) };
}
async function getDocument(db: Database, workspaceId: string, id: string, lock = false): Promise<DocumentRow> {
  const result = await db.query<DocumentRow>(`SELECT workspace_id, document_id, hash, size, metadata, verified_at FROM fieldwork_documents WHERE workspace_id = $1 AND document_id = $2${lock ? ' FOR UPDATE' : ''}`, [workspaceId, id]);
  if (!result.rows[0]) fail(404, 'DOCUMENT_NOT_FOUND', 'Document not found in this account.');
  return result.rows[0];
}
function validateChunks(chunks: ChunkRow[], size: number, expectedHash: string): Buffer {
  if (chunks.length !== chunkCount(size)) fail(409, 'UPLOAD_INCOMPLETE', 'Not all original-file chunks have been uploaded.');
  const hasher = createHash('sha256');
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    if (chunk.chunk_index !== index || chunk.bytes.length !== expectedChunkLength(size, index) || digest(chunk.bytes) !== chunk.hash) fail(422, 'CHUNK_INTEGRITY_FAILED', 'Stored chunk integrity verification failed.');
    hasher.update(chunk.bytes);
  }
  if (hasher.digest('hex') !== expectedHash) fail(422, 'DOCUMENT_HASH_MISMATCH', 'The complete upload does not match the original SHA-256 digest.');
  return Buffer.concat(chunks.map(chunk => chunk.bytes), size);
}
async function writeDocumentChunk(db: Database, workspaceId: string, id: string, index: number, bytes: Buffer, verified: boolean): Promise<boolean> {
  const existing = await db.query<ChunkRow>('SELECT chunk_index, bytes, hash FROM fieldwork_document_chunks WHERE workspace_id = $1 AND document_id = $2 AND chunk_index = $3', [workspaceId, id, index]);
  if (existing.rows[0]) {
    if (existing.rows[0].hash !== digest(bytes) || !Buffer.from(existing.rows[0].bytes).equals(bytes)) fail(409, 'IMMUTABLE_CHUNK', 'A different chunk already exists at this position; originals cannot be overwritten.');
    return true;
  }
  if (verified) fail(409, 'IMMUTABLE_DOCUMENT', 'A verified original cannot be changed.');
  await db.query('INSERT INTO fieldwork_document_chunks (workspace_id, document_id, chunk_index, bytes, hash) VALUES ($1, $2, $3, $4, $5)', [workspaceId, id, index, bytes, digest(bytes)]);
  return false;
}
function sendBinary(response: Response, bytes: Buffer, fullHash: string): void {
  response.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), 'X-Content-SHA256': digest(bytes), 'X-Document-SHA256': fullHash, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
}
function page(request: Request, max = 100) {
  const rawLimit = request.query.limit;
  const limit = rawLimit === undefined ? Math.min(25, max) : typeof rawLimit === 'string' && /^\d+$/u.test(rawLimit) ? Number(rawLimit) : 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > max) fail(400, 'INVALID_PAGE', `limit must be between 1 and ${max}.`);
  const cursor = request.query.cursor === undefined ? '' : identifier(request.query.cursor, 'cursor');
  return { limit, cursor };
}

function batchPayload(value: unknown): JsonObject {
  if (!object(value)) fail(400, 'INVALID_BATCH', 'A complete batch object is required.');
  identifier(value.id, 'batch ID'); identifier(value.owner, 'legacy batch owner'); hashValue(value.sourceHash);
  if (typeof value.createdAt !== 'string' || value.createdAt.length > 128 || typeof value.filename !== 'string' || value.filename.length > 4096 || !object(value.mapping) || !object(value.options) || !Number.isSafeInteger(value.sourceRows) || Number(value.sourceRows) < 0 || !Array.isArray(value.before) || !Array.isArray(value.results) || !Array.isArray(value.addedIds) || !Array.isArray(value.archivedSummaryIds) || !value.addedIds.every(id => typeof id === 'string') || !value.archivedSummaryIds.every(id => typeof id === 'string') || !['prepared', 'committed', 'failed'].includes(String(value.state)) || typeof value.note !== 'string') fail(400, 'INVALID_BATCH', 'The complete migration batch, including before/results, must be preserved.');
  if (Buffer.byteLength(canonicalArchiveJson(value)) > ARCHIVE_MAX_BYTES) fail(413, 'ARCHIVE_SIZE_LIMIT', 'A batch exceeds the 25 MiB archive limit; no content was truncated.');
  return value;
}
function batchEnvelope(row: BatchRow, currentVersion?: number) {
  return { batch: row.payload, version: Number(row.version), contentHash: row.content_hash, byteLength: row.byte_length, ...(currentVersion === undefined ? {} : { currentVersion }) };
}
function batchManifest(row: BatchRow) {
  return { id: row.batch_id, owner: row.payload.owner, createdAt: row.payload.createdAt, sourceHash: row.payload.sourceHash, filename: row.payload.filename, state: row.payload.state, version: Number(row.version), contentHash: row.content_hash, byteLength: row.byte_length, chunkSize: ARCHIVE_CHUNK_BYTES, chunkCount: chunkCount(row.byte_length) };
}
function immutableBatchFields(payload: JsonObject): string {
  const { state: _state, note: _note, ...rest } = payload;
  return canonicalArchiveJson(rest);
}
async function writeBatch(db: Database, workspaceId: string, payload: JsonObject, expectedVersion?: number) {
  const serialized = canonicalArchiveJson(payload), contentHash = digest(serialized), size = Buffer.byteLength(serialized), batchId = String(payload.id);
  const inserted = await db.query<BatchRow>('INSERT INTO fieldwork_archive_batches (workspace_id, batch_id, payload, content_hash, byte_length, version) VALUES ($1, $2, $3::jsonb, $4, $5, 1) ON CONFLICT (workspace_id, batch_id) DO NOTHING RETURNING batch_id, payload, content_hash, byte_length, version', [workspaceId, batchId, serialized, contentHash, size]);
  if (inserted.rows[0]) {
    if (expectedVersion !== undefined && expectedVersion !== 0) fail(409, 'VERSION_CONFLICT', 'The requested batch version does not exist.');
    await db.query('INSERT INTO fieldwork_archive_batch_history (workspace_id, batch_id, version, payload, content_hash, byte_length) VALUES ($1, $2, 1, $3::jsonb, $4, $5)', [workspaceId, batchId, serialized, contentHash, size]);
    return { ...batchEnvelope(inserted.rows[0]), idempotent: false };
  }
  const selected = await db.query<BatchRow>('SELECT batch_id, payload, content_hash, byte_length, version FROM fieldwork_archive_batches WHERE workspace_id = $1 AND batch_id = $2 FOR UPDATE', [workspaceId, batchId]);
  const current = selected.rows[0];
  if (!current) fail(409, 'BATCH_CONFLICT', 'The batch changed during this request. Retry without discarding local records.');
  if (current.content_hash === contentHash && canonicalArchiveJson(current.payload) === serialized) return { ...batchEnvelope(current), idempotent: true };
  const historical = await db.query<BatchRow>('SELECT batch_id, payload, content_hash, byte_length, version FROM fieldwork_archive_batch_history WHERE workspace_id = $1 AND batch_id = $2 AND content_hash = $3 ORDER BY version DESC LIMIT 1', [workspaceId, batchId, contentHash]);
  if (historical.rows[0] && canonicalArchiveJson(historical.rows[0].payload) === serialized) return { ...batchEnvelope(historical.rows[0], Number(current.version)), idempotent: true };
  if (expectedVersion === undefined) fail(428, 'VERSION_REQUIRED', 'Changing batch state requires its expectedVersion.');
  if (Number(current.version) !== expectedVersion) fail(409, 'VERSION_CONFLICT', 'This batch changed in another session. Reload it before continuing.');
  if (current.payload.state !== 'prepared' || !['committed', 'failed'].includes(String(payload.state)) || immutableBatchFields(current.payload) !== immutableBatchFields(payload)) fail(409, 'IMMUTABLE_BATCH', 'Existing migration evidence cannot be overwritten. Only a prepared batch state and note may be finalized.');
  const nextVersion = Number(current.version) + 1;
  const updated = await db.query<BatchRow>('UPDATE fieldwork_archive_batches SET payload = $3::jsonb, content_hash = $4, byte_length = $5, version = $6, updated_at = now() WHERE workspace_id = $1 AND batch_id = $2 RETURNING batch_id, payload, content_hash, byte_length, version', [workspaceId, batchId, serialized, contentHash, size, nextVersion]);
  await db.query('INSERT INTO fieldwork_archive_batch_history (workspace_id, batch_id, version, payload, content_hash, byte_length) VALUES ($1, $2, $3, $4::jsonb, $5, $6)', [workspaceId, batchId, nextVersion, serialized, contentHash, size]);
  return { ...batchEnvelope(updated.rows[0]), idempotent: false };
}
async function getBatch(db: Database, workspaceId: string, id: string): Promise<BatchRow> {
  const result = await db.query<BatchRow>('SELECT batch_id, payload, content_hash, byte_length, version FROM fieldwork_archive_batches WHERE workspace_id = $1 AND batch_id = $2', [workspaceId, id]);
  if (!result.rows[0]) fail(404, 'BATCH_NOT_FOUND', 'Batch not found in this account.');
  return result.rows[0];
}
async function getUpload(db: Database, workspaceId: string, id: string, lock = false): Promise<UploadRow> {
  const result = await db.query<UploadRow>(`SELECT upload_id, batch_id, sha256, byte_length, expected_version, completed_version, created_at FROM fieldwork_archive_uploads WHERE workspace_id = $1 AND upload_id = $2${lock ? ' FOR UPDATE' : ''}`, [workspaceId, id]);
  if (!result.rows[0]) fail(404, 'UPLOAD_NOT_FOUND', 'Upload not found in this account.');
  const upload = result.rows[0];
  if (upload.completed_version === null && new Date(upload.created_at).getTime() + UPLOAD_TTL_MS <= Date.now()) fail(410, 'UPLOAD_EXPIRED', 'This temporary batch upload expired. Keep the browser archive and start a fresh upload.');
  return result.rows[0];
}

/** Mount behind authenticated middleware at /api/cloud. Client owner fields are evidence, never authorization. */
export function createArchiveRouter(pool: Pool) {
  const router = express.Router();
  const json = express.json({ limit: ARCHIVE_JSON_BYTES, strict: true });
  const binary = express.raw({ type: 'application/octet-stream', limit: ARCHIVE_CHUNK_BYTES });
  router.use((request, response, next) => {
    try { identity(request); response.set('Cache-Control', 'private, no-store'); next(); } catch (error) { next(error); }
  });

  router.get('/archive/documents', route(async (request, response) => {
    const user = identity(request), { limit, cursor } = page(request, 25);
    await ensureWorkspace(pool, user);
    const result = await pool.query<DocumentRow>('SELECT workspace_id, document_id, hash, size, metadata, verified_at FROM fieldwork_documents WHERE workspace_id = $1 AND document_id > $2 AND (verified_at IS NOT NULL OR $3::boolean) ORDER BY document_id LIMIT $4', [user.workspaceId, cursor, request.query.includePending === '1', limit + 1]);
    response.json({ documents: result.rows.slice(0, limit).map(documentEnvelope), nextCursor: result.rows.length > limit ? result.rows[limit - 1].document_id : null });
  }));
  router.post('/archive/documents/init', json, route(async (request, response) => {
    const user = identity(request), metadata = documentMetadata(requestObject(request).document), id = String(metadata.id);
    const result = await transaction(pool, user, async client => {
      await client.query('INSERT INTO fieldwork_documents (workspace_id, document_id, hash, size, metadata) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (workspace_id, document_id) DO NOTHING', [user.workspaceId, id, hashValue(metadata.hash), metadata.size, canonicalArchiveJson(metadata)]);
      const document = await getDocument(client, user.workspaceId, id, true);
      if (document.hash !== hashValue(metadata.hash) || document.size !== metadata.size || canonicalArchiveJson(document.metadata) !== canonicalArchiveJson(metadata)) fail(409, 'IMMUTABLE_DOCUMENT', 'This document ID already identifies different original metadata or bytes. Nothing was overwritten.');
      const chunks = await client.query<{ chunk_index: number; hash: string; size: number }>('SELECT chunk_index, hash, octet_length(bytes) AS size FROM fieldwork_document_chunks WHERE workspace_id = $1 AND document_id = $2 ORDER BY chunk_index', [user.workspaceId, id]);
      return { ...documentEnvelope(document), uploadedChunks: chunks.rows.map(chunk => chunk.chunk_index), uploadedChunkDetails: chunks.rows.map(chunk => ({ index: chunk.chunk_index, hash: chunk.hash, size: chunk.size })) };
    });
    response.json(result);
  }));
  router.get('/archive/documents/:documentId', route(async (request, response) => {
    const user = identity(request); await ensureWorkspace(pool, user);
    response.json(documentEnvelope(await getDocument(pool, user.workspaceId, identifier(request.params.documentId))));
  }));
  router.put('/archive/documents/:documentId/chunks/:index', binary, route(async (request, response) => {
    const user = identity(request), id = identifier(request.params.documentId);
    const result = await transaction(pool, user, async client => {
      const document = await getDocument(client, user.workspaceId, id, true), index = chunkIndex(request.params.index, document.size), bytes = uploadBytes(request, document.size, index);
      const idempotent = await writeDocumentChunk(client, user.workspaceId, id, index, bytes, Boolean(document.verified_at));
      return { index, hash: digest(bytes), size: bytes.length, idempotent };
    });
    response.json(result);
  }));
  router.post('/archive/documents/:documentId/finalize', route(async (request, response) => {
    const user = identity(request), id = identifier(request.params.documentId);
    const result = await transaction(pool, user, async client => {
      const document = await getDocument(client, user.workspaceId, id, true);
      const chunks = await client.query<ChunkRow>('SELECT chunk_index, bytes, hash FROM fieldwork_document_chunks WHERE workspace_id = $1 AND document_id = $2 ORDER BY chunk_index', [user.workspaceId, id]);
      validateChunks(chunks.rows, document.size, document.hash);
      const updated = await client.query<DocumentRow>('UPDATE fieldwork_documents SET verified_at = COALESCE(verified_at, now()) WHERE workspace_id = $1 AND document_id = $2 RETURNING workspace_id, document_id, hash, size, metadata, verified_at', [user.workspaceId, id]);
      return documentEnvelope(updated.rows[0]);
    });
    response.json(result);
  }));
  router.get('/archive/documents/:documentId/chunks/:index', route(async (request, response) => {
    const user = identity(request), id = identifier(request.params.documentId); await ensureWorkspace(pool, user);
    const document = await getDocument(pool, user.workspaceId, id);
    if (!document.verified_at) fail(409, 'DOCUMENT_UNVERIFIED', 'Finalize and verify the complete original before downloading it.');
    const index = chunkIndex(request.params.index, document.size);
    const chunks = await pool.query<ChunkRow>('SELECT chunk_index, bytes, hash FROM fieldwork_document_chunks WHERE workspace_id = $1 AND document_id = $2 AND chunk_index = $3', [user.workspaceId, id, index]);
    const chunk = chunks.rows[0];
    if (!chunk || chunk.bytes.length !== expectedChunkLength(document.size, index) || digest(chunk.bytes) !== chunk.hash) fail(422, 'CHUNK_INTEGRITY_FAILED', 'Original-file readback verification failed.');
    sendBinary(response, chunk.bytes, document.hash);
  }));

  router.get('/archive/batches', route(async (request, response) => {
    const user = identity(request), { limit, cursor } = page(request); await ensureWorkspace(pool, user);
    const rows = await pool.query<BatchRow>(`SELECT batch_id, jsonb_build_object('owner', payload->'owner', 'createdAt', payload->'createdAt', 'sourceHash', payload->'sourceHash', 'filename', payload->'filename', 'state', payload->'state') AS payload, content_hash, byte_length, version FROM fieldwork_archive_batches WHERE workspace_id = $1 AND batch_id > $2 ORDER BY batch_id LIMIT $3`, [user.workspaceId, cursor, limit + 1]);
    response.json({ batches: rows.rows.slice(0, limit).map(batchManifest), nextCursor: rows.rows.length > limit ? rows.rows[limit - 1].batch_id : null });
  }));
  router.post('/archive/batches', json, route(async (request, response) => {
    const user = identity(request), body = requestObject(request), payload = batchPayload(body.batch);
    const result = await transaction(pool, user, client => writeBatch(client, user.workspaceId, payload, versionValue(body.expectedVersion)));
    response.json(result);
  }));
  router.post('/archive/batches/uploads', json, route(async (request, response) => {
    const user = identity(request), body = requestObject(request), batchId = identifier(body.batchId, 'batch ID'), sha = hashValue(body.sha256), size = byteLengthValue(body.byteLength), expected = versionValue(body.expectedVersion);
    if (!size || body.chunkCount !== chunkCount(size)) fail(400, 'INVALID_MANIFEST', 'The batch chunk count must match its non-empty JSON byte length.');
    const uploadId = `batch_${digest(canonicalArchiveJson([user.workspaceId, batchId, sha, size, expected ?? null]))}`;
    const result = await transaction(pool, user, async client => {
      // Serialize admission without conflicting with workspace FK KEY SHARE locks
      // held by an upload completion during expiry cleanup.
      await client.query('SELECT id FROM fieldwork_workspaces WHERE id = $1 FOR NO KEY UPDATE', [user.workspaceId]);
      await client.query("DELETE FROM fieldwork_archive_uploads WHERE workspace_id = $1 AND completed_version IS NULL AND created_at <= now() - interval '1 hour'", [user.workspaceId]);
      const prior = await client.query('SELECT upload_id FROM fieldwork_archive_uploads WHERE workspace_id = $1 AND upload_id = $2', [user.workspaceId, uploadId]);
      if (!prior.rows[0]) {
        const pending = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM fieldwork_archive_uploads WHERE workspace_id = $1 AND completed_version IS NULL', [user.workspaceId]);
        if (Number(pending.rows[0].count) >= MAX_PENDING_UPLOADS) fail(429, 'TOO_MANY_UPLOADS', 'Finish a pending archive upload before starting another, or retry after temporary uploads expire.');
        await client.query('INSERT INTO fieldwork_archive_uploads (workspace_id, upload_id, batch_id, sha256, byte_length, expected_version) VALUES ($1, $2, $3, $4, $5, $6)', [user.workspaceId, uploadId, batchId, sha, size, expected ?? null]);
      }
      const upload = await getUpload(client, user.workspaceId, uploadId, true);
      if (upload.batch_id !== batchId || upload.sha256 !== sha || upload.byte_length !== size || (upload.expected_version === null ? undefined : Number(upload.expected_version)) !== expected) fail(409, 'UPLOAD_CONFLICT', 'This upload manifest differs from the existing immutable upload.');
      const chunks = await client.query<{ chunk_index: number; hash: string; size: number }>('SELECT chunk_index, hash, octet_length(bytes) AS size FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 ORDER BY chunk_index', [user.workspaceId, uploadId]);
      return { uploadId, chunkSize: ARCHIVE_CHUNK_BYTES, chunkCount: chunkCount(size), expiresAt: new Date(new Date(upload.created_at).getTime() + UPLOAD_TTL_MS).toISOString(), completedVersion: upload.completed_version === null ? null : Number(upload.completed_version), uploadedChunks: chunks.rows.map(chunk => chunk.chunk_index), uploadedChunkDetails: chunks.rows.map(chunk => ({ index: chunk.chunk_index, hash: chunk.hash, size: chunk.size })) };
    });
    response.json(result);
  }));
  router.put('/archive/batches/uploads/:uploadId/chunks/:index', binary, route(async (request, response) => {
    const user = identity(request), uploadId = identifier(request.params.uploadId);
    const result = await transaction(pool, user, async client => {
      const upload = await getUpload(client, user.workspaceId, uploadId, true), index = chunkIndex(request.params.index, upload.byte_length), bytes = uploadBytes(request, upload.byte_length, index);
      const existing = await client.query<ChunkRow>('SELECT chunk_index, bytes, hash FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 AND chunk_index = $3', [user.workspaceId, uploadId, index]);
      if (existing.rows[0]) {
        if (existing.rows[0].hash !== digest(bytes) || !Buffer.from(existing.rows[0].bytes).equals(bytes)) fail(409, 'IMMUTABLE_CHUNK', 'A different batch chunk already occupies this position.');
      } else {
        if (upload.completed_version !== null) fail(409, 'IMMUTABLE_UPLOAD', 'A completed batch upload cannot be changed.');
        await client.query('INSERT INTO fieldwork_archive_upload_chunks (workspace_id, upload_id, chunk_index, bytes, hash) VALUES ($1, $2, $3, $4, $5)', [user.workspaceId, uploadId, index, bytes, digest(bytes)]);
      }
      return { index, size: bytes.length, hash: digest(bytes), idempotent: Boolean(existing.rows[0]) };
    });
    response.json(result);
  }));
  router.post('/archive/batches/uploads/:uploadId/complete', route(async (request, response) => {
    const user = identity(request), uploadId = identifier(request.params.uploadId);
    const result = await transaction(pool, user, async client => {
      const upload = await getUpload(client, user.workspaceId, uploadId, true);
      if (upload.completed_version !== null) {
        const prior = await client.query<BatchRow>('SELECT batch_id, payload, content_hash, byte_length, version FROM fieldwork_archive_batch_history WHERE workspace_id = $1 AND batch_id = $2 AND version = $3', [user.workspaceId, upload.batch_id, upload.completed_version]);
        if (!prior.rows[0]) fail(409, 'MISSING_BATCH_REVISION', 'The completed upload revision is unavailable; retain the local archive.');
        const current = await getBatch(client, user.workspaceId, upload.batch_id);
        return { ...batchEnvelope(prior.rows[0], Number(current.version)), idempotent: true };
      }
      const chunks = await client.query<ChunkRow>('SELECT chunk_index, bytes, hash FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 ORDER BY chunk_index', [user.workspaceId, uploadId]);
      const bytes = validateChunks(chunks.rows, upload.byte_length, upload.sha256);
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(400, 'INVALID_BATCH_JSON', 'The verified upload must contain valid UTF-8 batch JSON.'); }
      const payload = batchPayload(parsed);
      if (payload.id !== upload.batch_id) fail(409, 'BATCH_ID_MISMATCH', 'The uploaded batch ID differs from its manifest.');
      const saved = await writeBatch(client, user.workspaceId, payload, upload.expected_version === null ? undefined : Number(upload.expected_version));
      await client.query('UPDATE fieldwork_archive_uploads SET completed_version = $3 WHERE workspace_id = $1 AND upload_id = $2', [user.workspaceId, uploadId, saved.version]);
      // The complete JSON is durable in immutable history. Remove only staging
      // bytes; retain the small completed receipt for identical manifest retries.
      await client.query('DELETE FROM fieldwork_archive_upload_chunks WHERE workspace_id = $1 AND upload_id = $2', [user.workspaceId, uploadId]);
      return saved;
    });
    // Large uploads return a receipt, never a response larger than the proxy can carry.
    const { batch: _batch, ...receipt } = result;
    response.json(receipt);
  }));
  router.get('/archive/batches/:batchId/manifest', route(async (request, response) => {
    const user = identity(request); await ensureWorkspace(pool, user);
    response.json(batchManifest(await getBatch(pool, user.workspaceId, identifier(request.params.batchId))));
  }));
  router.get('/archive/batches/:batchId/revisions/:version/chunks/:index', route(async (request, response) => {
    const user = identity(request), id = identifier(request.params.batchId); await ensureWorkspace(pool, user);
    if (typeof request.params.version !== 'string' || !/^[1-9]\d*$/u.test(request.params.version)) fail(400, 'INVALID_VERSION', 'A positive revision number is required.');
    const version = Number(request.params.version);
    if (!Number.isSafeInteger(version)) fail(400, 'INVALID_VERSION', 'A valid revision number is required.');
    const result = await pool.query<BatchRow>('SELECT batch_id, payload, content_hash, byte_length, version FROM fieldwork_archive_batch_history WHERE workspace_id = $1 AND batch_id = $2 AND version = $3', [user.workspaceId, id, version]);
    const batch = result.rows[0];
    if (!batch) fail(404, 'BATCH_NOT_FOUND', 'Batch revision not found in this account.');
    const bytes = Buffer.from(canonicalArchiveJson(batch.payload)), index = chunkIndex(request.params.index, batch.byte_length);
    if (bytes.length !== batch.byte_length || digest(bytes) !== batch.content_hash) fail(422, 'BATCH_INTEGRITY_FAILED', 'Batch readback integrity verification failed.');
    sendBinary(response, bytes.subarray(index * ARCHIVE_CHUNK_BYTES, (index + 1) * ARCHIVE_CHUNK_BYTES), batch.content_hash);
  }));
  router.get('/archive/batches/:batchId', route(async (request, response) => {
    const user = identity(request); await ensureWorkspace(pool, user);
    const batch = await getBatch(pool, user.workspaceId, identifier(request.params.batchId));
    if (batch.byte_length > ARCHIVE_JSON_BYTES - 1024) response.json({ manifest: batchManifest(batch), requiresChunks: true });
    else response.json(batchEnvelope(batch));
  }));
  router.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof ArchiveError || error instanceof CloudStorageError) { response.status(error.status).json({ error: error.message, code: error.code }); return; }
    const parserError = error as { type?: string; status?: number };
    if (parserError?.type === 'entity.too.large') { response.status(413).json({ error: 'Upload too large for this endpoint. Use bounded archive chunks; no data was truncated.', code: 'UPLOAD_SIZE_LIMIT' }); return; }
    if (parserError?.type === 'entity.parse.failed') { response.status(400).json({ error: 'Invalid JSON request.', code: 'INVALID_JSON' }); return; }
    response.status(500).json({ error: 'Archive persistence failed. Keep the existing local originals and retry.', code: 'ARCHIVE_FAILED' });
  });
  return router;
}

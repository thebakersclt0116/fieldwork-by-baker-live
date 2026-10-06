import { createHash, randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import {
  canonicalJson,
  CLOUD_RECORDS_CHUNK_BYTES,
  CLOUD_RECORDS_DIRECT_BYTES,
  CLOUD_RECORDS_MAX_BYTES,
  CLOUD_RECORDS_MAX_ENTRIES,
  CLOUD_RECORDS_MAX_SUPERVISORS,
  type CloudIdentity,
  type CloudMutationSource,
  type CloudRecordsContent,
  type CloudRecordsResponse,
  type CloudRecordsSnapshot,
  type CloudRecordsUpload,
} from '../shared/cloudTypes.ts';

type Queryable = Pick<Pool, 'query'>;
type CloudRequest = Request & { fieldworkUser?: CloudIdentity };
type JsonObject = Record<string, unknown>;
type StateRow = { revision: string; entries: CloudRecordsContent['entries']; supervisors: CloudRecordsContent['supervisors']; updated_at: Date | string };
type UploadRow = {
  upload_id: string; expected_revision: string; sha256: string; byte_length: number;
  chunk_count: number; mutation_id: string; source: CloudMutationSource | null;
  completed_revision: string | null; expires_at: Date | string;
};

const UPLOAD_TTL_MS = 60 * 60 * 1000;
const MAX_PENDING_UPLOADS = 3;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class CloudStorageError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CloudStorageError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function invalid(message: string, code = 'INVALID_RECORDS'): never {
  throw new CloudStorageError(400, code, message);
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) invalid(`${label} must be a JSON object.`);
  return value;
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid(`${label} must be a nonempty ID of at most 512 bytes.`);
  }
  return value;
}

function requireRevision(value: unknown, label = 'expectedRevision'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(`${label} must be a nonnegative safe integer.`);
  return value;
}

function revisionNumber(value: string | number): number {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new CloudStorageError(500, 'REVISION_OVERFLOW', 'The stored revision cannot be represented safely.');
  return revision;
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function requireHash(value: unknown, label = 'sha256'): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalid(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

/** PostgreSQL JSONB cannot store NUL or unpaired UTF-16 surrogates. Reject instead of altering data. */
function checkJsonStrings(value: unknown, depth = 0): void {
  if (depth > 64) invalid('The records exceed the supported JSON nesting depth.');
  if (typeof value === 'string') {
    let invalidUnicode = value.includes('\u0000');
    for (let index = 0; index < value.length && !invalidUnicode; index++) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++index);
        invalidUnicode = !(next >= 0xdc00 && next <= 0xdfff);
      } else if (code >= 0xdc00 && code <= 0xdfff) invalidUnicode = true;
    }
    if (invalidUnicode) invalid('A record contains text that PostgreSQL cannot preserve; the original must be retained for repair.');
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid('Record numbers must be finite.');
  } else if (Array.isArray(value)) {
    for (const child of value) checkJsonStrings(child, depth + 1);
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      checkJsonStrings(key, depth + 1);
      checkJsonStrings(child, depth + 1);
    }
  }
}

export function validateRecordsContent(value: unknown): { content: CloudRecordsContent; bytes: Buffer; contentHash: string } {
  const object = requireObject(value, 'Records');
  if (!Array.isArray(object.entries) || !Array.isArray(object.supervisors)) invalid('Both entries and supervisors must be arrays.');
  if (object.entries.length > CLOUD_RECORDS_MAX_ENTRIES || object.supervisors.length > CLOUD_RECORDS_MAX_SUPERVISORS) {
    throw new CloudStorageError(413, 'RECORD_COUNT_LIMIT', 'This records snapshot exceeds the supported item count. No records were changed.');
  }
  const entryIds = new Set<string>();
  for (const value of object.entries) {
    const entry = requireObject(value, 'Each entry');
    const id = requireId(entry.id, 'Entry ID');
    if (entryIds.has(id)) invalid(`The snapshot contains the entry ID more than once: ${id}`, 'DUPLICATE_ENTRY_ID');
    entryIds.add(id);
    // Historic monthly/aggregate entries legitimately exceed 24 hours. Storage
    // validates a finite nonnegative value without recategorizing or rounding it.
    if (typeof entry.duration !== 'number' || !Number.isFinite(entry.duration) || entry.duration < 0 || entry.duration > 1_000_000) {
      invalid(`Entry ${id} has an invalid duration. The original value was not changed.`, 'INVALID_DURATION');
    }
  }
  const supervisorIds = new Set<string>();
  for (const value of object.supervisors) {
    const supervisor = requireObject(value, 'Each supervisor');
    const id = requireId(supervisor.id, 'Supervisor ID');
    if (supervisorIds.has(id)) invalid(`The snapshot contains the supervisor ID more than once: ${id}`, 'DUPLICATE_SUPERVISOR_ID');
    supervisorIds.add(id);
    if (typeof supervisor.name !== 'string') invalid(`Supervisor ${id} must retain a name string.`);
  }
  const content = { entries: object.entries, supervisors: object.supervisors } as CloudRecordsContent;
  checkJsonStrings(content);
  let serialized: string;
  try { serialized = canonicalJson(content); }
  catch { invalid('The records contain a value that cannot be preserved as JSON.'); }
  const bytes = Buffer.from(serialized, 'utf8');
  if (bytes.length > CLOUD_RECORDS_MAX_BYTES) {
    throw new CloudStorageError(413, 'RECORDS_SIZE_LIMIT', 'This snapshot is larger than 25 MiB. No records were truncated or changed.');
  }
  return { content: JSON.parse(serialized) as CloudRecordsContent, bytes, contentHash: sha256(bytes) };
}

function validateSource(value: unknown): CloudMutationSource | undefined {
  if (value === undefined || value === null) return undefined;
  const source = requireObject(value, 'source');
  if (typeof source.kind !== 'string' || !source.kind || source.kind.length > 100) invalid('source.kind must be a short string.');
  checkJsonStrings(source);
  let serialized: string;
  try { serialized = canonicalJson(source); }
  catch { invalid('Source metadata must contain only JSON values.'); }
  if (Buffer.byteLength(serialized) > 8192) invalid('Source metadata exceeds 8 KiB.');
  if (source.kind === 'legacy-browser-migration') {
    if (typeof source.origin !== 'string' || source.origin.length > 512) invalid('A browser migration must include its original origin.');
    try {
      const url = new URL(source.origin);
      if (!['https:', 'http:'].includes(url.protocol) || url.origin !== source.origin) invalid('Migration origin must be an HTTP or HTTPS origin.');
    } catch { invalid('Migration origin must be an HTTP or HTTPS origin.'); }
    requireHash(source.snapshotHash, 'source.snapshotHash');
  }
  return JSON.parse(serialized) as CloudMutationSource;
}

function requireIdentity(req: Request): CloudIdentity {
  const identity = (req as CloudRequest).fieldworkUser;
  if (!identity?.userId || !identity.workspaceId || !identity.email) {
    throw new CloudStorageError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to access your cloud records.');
  }
  return identity;
}

/** Never take the database tenant from request parameters, email, or legacy payload userId. */
export async function ensureWorkspace(client: Queryable, identity: CloudIdentity): Promise<void> {
  if (!identity.userId || !identity.workspaceId || !identity.email) throw new CloudStorageError(401, 'AUTHENTICATION_REQUIRED', 'A verified account is required.');
  await client.query(
    'INSERT INTO fieldwork_workspaces (id, owner_user_id, owner_email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [identity.workspaceId, identity.userId, identity.email.toLowerCase()]
  );
  const result = await client.query<{ owner_user_id: string }>(
    'SELECT owner_user_id FROM fieldwork_workspaces WHERE id = $1', [identity.workspaceId]
  );
  if (result.rows[0]?.owner_user_id !== identity.userId) {
    throw new CloudStorageError(403, 'WORKSPACE_ACCESS_DENIED', 'This account does not own that workspace.');
  }
}

async function transaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Keep the original error. */ }
    throw error;
  } finally { client.release(); }
}

function snapshot(row: StateRow): CloudRecordsSnapshot {
  return {
    revision: revisionNumber(row.revision),
    entries: row.entries,
    supervisors: row.supervisors,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function readState(client: Queryable, identity: CloudIdentity, lock = false): Promise<CloudRecordsSnapshot> {
  await ensureWorkspace(client, identity);
  await client.query('INSERT INTO fieldwork_record_state (workspace_id) VALUES ($1) ON CONFLICT DO NOTHING', [identity.workspaceId]);
  const result = await client.query<StateRow>(
    `SELECT revision, entries, supervisors, updated_at FROM fieldwork_record_state WHERE workspace_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [identity.workspaceId]
  );
  return snapshot(result.rows[0]);
}

function contentBytes(state: CloudRecordsSnapshot): Buffer {
  return Buffer.from(canonicalJson({ entries: state.entries, supervisors: state.supervisors }), 'utf8');
}

export function recordsResponse(state: CloudRecordsSnapshot): CloudRecordsResponse {
  const bytes = contentBytes(state);
  if (bytes.length <= CLOUD_RECORDS_DIRECT_BYTES) return state;
  return {
    chunked: true, revision: state.revision, updatedAt: state.updatedAt,
    byteLength: bytes.length, sha256: sha256(bytes), chunkSize: CLOUD_RECORDS_CHUNK_BYTES,
    chunkCount: Math.ceil(bytes.length / CLOUD_RECORDS_CHUNK_BYTES),
    ...(state.replayed ? { replayed: true } : {}),
    ...(state.appliedRevision !== undefined ? { appliedRevision: state.appliedRevision } : {}),
    ...(state.migrationAlreadyApplied ? { migrationAlreadyApplied: true } : {}),
  };
}

export async function getRecords(pool: Pool, identity: CloudIdentity): Promise<CloudRecordsSnapshot> {
  return readState(pool, identity);
}

type WriteInput = {
  expectedRevision: number; mutationId: string; content: CloudRecordsContent;
  contentHash: string; source?: CloudMutationSource;
};

/** Caller holds the state-row lock until the current state and immutable history both commit. */
async function commitRecords(client: PoolClient, identity: CloudIdentity, input: WriteInput): Promise<CloudRecordsSnapshot> {
  const current = await readState(client, identity, true);
  const requestHash = sha256(canonicalJson({ expectedRevision: input.expectedRevision, contentHash: input.contentHash, source: input.source ?? null }));
  const prior = await client.query<{ revision: string; request_hash: string }>(
    'SELECT revision, request_hash FROM fieldwork_record_history WHERE workspace_id = $1 AND mutation_id = $2',
    [identity.workspaceId, input.mutationId]
  );
  if (prior.rows[0]) {
    if (prior.rows[0].request_hash !== requestHash) {
      throw new CloudStorageError(409, 'MUTATION_ID_REUSED', 'This save ID was already used for different data. Both copies remain available.', { current: recordsResponse(current) });
    }
    return { ...current, replayed: true, appliedRevision: revisionNumber(prior.rows[0].revision) };
  }
  if (input.source?.kind === 'legacy-browser-migration') {
    const receipt = await client.query<{ revision: string }>(
      'SELECT revision FROM fieldwork_migration_receipts WHERE workspace_id = $1 AND origin = $2 AND snapshot_hash = $3',
      [identity.workspaceId, input.source.origin, input.source.snapshotHash]
    );
    if (receipt.rows[0]) {
      return { ...current, migrationAlreadyApplied: true, appliedRevision: revisionNumber(receipt.rows[0].revision) };
    }
  }
  if (current.revision !== input.expectedRevision) {
    throw new CloudStorageError(409, 'REVISION_CONFLICT', 'The cloud records changed on another device. Your submitted copy was not applied; keep it while reviewing the current cloud version.', { current: recordsResponse(current) });
  }
  if (current.revision >= Number.MAX_SAFE_INTEGER) throw new CloudStorageError(500, 'REVISION_OVERFLOW', 'The stored revision cannot be incremented safely.');
  const nextRevision = current.revision + 1;
  const entriesJson = JSON.stringify(input.content.entries);
  const supervisorsJson = JSON.stringify(input.content.supervisors);
  const result = await client.query<StateRow>(
    `UPDATE fieldwork_record_state SET revision = $2, entries = $3::jsonb, supervisors = $4::jsonb, updated_at = clock_timestamp()
     WHERE workspace_id = $1 AND revision = $5 RETURNING revision, entries, supervisors, updated_at`,
    [identity.workspaceId, nextRevision, entriesJson, supervisorsJson, input.expectedRevision]
  );
  if (result.rowCount !== 1) throw new CloudStorageError(409, 'REVISION_CONFLICT', 'The cloud records changed. No submitted records were applied.');
  await client.query(
    `INSERT INTO fieldwork_record_history
     (workspace_id, revision, entries, supervisors, actor_user_id, mutation_id, content_hash, request_hash, source, created_at)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9::jsonb,$10)`,
    [identity.workspaceId, nextRevision, entriesJson, supervisorsJson, identity.userId, input.mutationId,
      input.contentHash, requestHash, input.source ? JSON.stringify(input.source) : null, result.rows[0].updated_at]
  );
  if (input.source?.kind === 'legacy-browser-migration') {
    await client.query(
      `INSERT INTO fieldwork_migration_receipts (workspace_id, origin, snapshot_hash, revision, content_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [identity.workspaceId, input.source.origin, input.source.snapshotHash, nextRevision, input.contentHash]
    );
  }
  return snapshot(result.rows[0]);
}

export async function putRecords(pool: Pool, identity: CloudIdentity, value: unknown): Promise<CloudRecordsSnapshot> {
  const body = requireObject(value, 'Request');
  const expectedRevision = requireRevision(body.expectedRevision);
  const mutationId = body.mutationId === undefined ? randomUUID() : requireId(body.mutationId, 'mutationId');
  const source = validateSource(body.source);
  const validated = validateRecordsContent(body);
  return transaction(pool, (client) => commitRecords(client, identity, { expectedRevision, mutationId, source, ...validated }));
}

function uploadDescriptor(row: UploadRow, uploadedChunks: number[]): CloudRecordsUpload {
  return {
    uploadId: row.upload_id, chunkSize: CLOUD_RECORDS_CHUNK_BYTES, chunkCount: row.chunk_count,
    uploadedChunks, expiresAt: new Date(row.expires_at).toISOString(),
    ...(row.completed_revision !== null ? { completed: true, appliedRevision: revisionNumber(row.completed_revision) } : {}),
  };
}

async function findUpload(client: Queryable, identity: CloudIdentity, uploadId: string, lock = false): Promise<UploadRow> {
  await ensureWorkspace(client, identity);
  const result = await client.query<UploadRow>(
    `SELECT upload_id, expected_revision, sha256, byte_length, chunk_count, mutation_id, source, completed_revision, expires_at
     FROM fieldwork_record_uploads WHERE workspace_id = $1 AND upload_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [identity.workspaceId, uploadId]
  );
  if (!result.rows[0]) throw new CloudStorageError(404, 'UPLOAD_NOT_FOUND', 'The upload was not found for this account.');
  const row = result.rows[0];
  if (row.completed_revision === null && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new CloudStorageError(410, 'UPLOAD_EXPIRED', 'This temporary upload expired. The browser originals remain available to start a new upload.');
  }
  return row;
}

export async function createRecordsUpload(pool: Pool, identity: CloudIdentity, value: unknown): Promise<CloudRecordsUpload> {
  const body = requireObject(value, 'Upload');
  const expectedRevision = requireRevision(body.expectedRevision);
  const hash = requireHash(body.sha256);
  const mutationId = requireId(body.mutationId, 'mutationId');
  const source = validateSource(body.source);
  if (typeof body.byteLength !== 'number' || !Number.isInteger(body.byteLength) || body.byteLength < 1 || body.byteLength > CLOUD_RECORDS_MAX_BYTES) {
    throw new CloudStorageError(413, 'RECORDS_SIZE_LIMIT', 'The upload must contain between 1 byte and 25 MiB.');
  }
  const byteLength = body.byteLength;
  const chunkCount = Math.ceil(byteLength / CLOUD_RECORDS_CHUNK_BYTES);
  if (body.chunkCount !== chunkCount) invalid(`The upload must contain exactly ${chunkCount} chunks.`, 'INVALID_CHUNK_COUNT');
  return transaction(pool, async (client) => {
    await ensureWorkspace(client, identity);
    // This account-level lock makes the pending-upload bound effective across requests.
    // Do not block the FK KEY SHARE lock taken when another upload commits its
    // history: that request can already hold an upload row needed by cleanup.
    await client.query('SELECT id FROM fieldwork_workspaces WHERE id = $1 FOR NO KEY UPDATE', [identity.workspaceId]);
    await client.query('DELETE FROM fieldwork_record_uploads WHERE workspace_id = $1 AND expires_at <= now()', [identity.workspaceId]);
    const prior = await client.query<UploadRow>(
      `SELECT upload_id, expected_revision, sha256, byte_length, chunk_count, mutation_id, source, completed_revision, expires_at
       FROM fieldwork_record_uploads WHERE workspace_id = $1 AND mutation_id = $2`, [identity.workspaceId, mutationId]
    );
    if (prior.rows[0]) {
      const row = prior.rows[0];
      if (revisionNumber(row.expected_revision) !== expectedRevision || row.sha256 !== hash || row.byte_length !== byteLength ||
          row.chunk_count !== chunkCount || canonicalJson(row.source) !== canonicalJson(source ?? null)) {
        throw new CloudStorageError(409, 'MUTATION_ID_REUSED', 'This upload ID was already used for different data.');
      }
      const chunks = await client.query<{ chunk_index: number }>(
        'SELECT chunk_index FROM fieldwork_record_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 ORDER BY chunk_index',
        [identity.workspaceId, row.upload_id]
      );
      return uploadDescriptor(row, chunks.rows.map((chunk) => chunk.chunk_index));
    }
    const pending = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM fieldwork_record_uploads WHERE workspace_id = $1 AND completed_revision IS NULL AND expires_at > now()',
      [identity.workspaceId]
    );
    if (Number(pending.rows[0].count) >= MAX_PENDING_UPLOADS) {
      throw new CloudStorageError(429, 'TOO_MANY_UPLOADS', 'Finish a pending upload before starting another, or retry after temporary uploads expire.');
    }
    const uploadId = randomUUID();
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
    const result = await client.query<UploadRow>(
      `INSERT INTO fieldwork_record_uploads
       (workspace_id, upload_id, expected_revision, sha256, byte_length, chunk_count, mutation_id, source, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING upload_id, expected_revision, sha256, byte_length, chunk_count, mutation_id, source, completed_revision, expires_at`,
      [identity.workspaceId, uploadId, expectedRevision, hash, byteLength, chunkCount, mutationId, source ? JSON.stringify(source) : null, expiresAt]
    );
    return uploadDescriptor(result.rows[0], []);
  });
}

function parseChunkIndex(value: unknown): number {
  if (typeof value === 'string' && /^\d{1,3}$/.test(value)) value = Number(value);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 36) invalid('Invalid chunk index.', 'INVALID_CHUNK_INDEX');
  return value;
}

export async function putRecordsChunk(pool: Pool, identity: CloudIdentity, uploadId: string, indexValue: unknown, value: unknown): Promise<{ index: number; sha256: string; byteLength: number }> {
  requireId(uploadId, 'uploadId');
  const index = parseChunkIndex(indexValue);
  const body = requireObject(value, 'Chunk');
  if (typeof body.data !== 'string' || !body.data.length || body.data.length > Math.ceil(CLOUD_RECORDS_CHUNK_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data)) {
    invalid('Chunk data must be canonical base64 within the chunk limit.', 'INVALID_CHUNK');
  }
  const bytes = Buffer.from(body.data, 'base64');
  if (bytes.toString('base64') !== body.data) invalid('Chunk data must be canonical base64.', 'INVALID_CHUNK');
  const hash = sha256(bytes);
  return transaction(pool, async (client) => {
    const upload = await findUpload(client, identity, uploadId, true);
    if (upload.completed_revision !== null) throw new CloudStorageError(409, 'UPLOAD_COMPLETED', 'This upload is already committed.');
    if (index >= upload.chunk_count) invalid('The chunk index exceeds this upload manifest.', 'INVALID_CHUNK_INDEX');
    const expectedLength = index === upload.chunk_count - 1 ? upload.byte_length - index * CLOUD_RECORDS_CHUNK_BYTES : CLOUD_RECORDS_CHUNK_BYTES;
    if (bytes.length !== expectedLength) invalid(`This chunk must contain exactly ${expectedLength} bytes.`, 'INVALID_CHUNK_SIZE');
    const prior = await client.query<{ hash: string; bytes: Buffer }>(
      'SELECT hash, bytes FROM fieldwork_record_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 AND chunk_index = $3',
      [identity.workspaceId, uploadId, index]
    );
    if (prior.rows[0]) {
      if (prior.rows[0].hash !== hash || !Buffer.from(prior.rows[0].bytes).equals(bytes)) {
        throw new CloudStorageError(409, 'CHUNK_CONFLICT', 'Different bytes already occupy this upload chunk. Start a new upload to preserve both versions.');
      }
      return { index, sha256: hash, byteLength: bytes.length };
    }
    await client.query(
      'INSERT INTO fieldwork_record_upload_chunks (workspace_id, upload_id, chunk_index, bytes, hash) VALUES ($1,$2,$3,$4,$5)',
      [identity.workspaceId, uploadId, index, bytes, hash]
    );
    return { index, sha256: hash, byteLength: bytes.length };
  });
}

export async function completeRecordsUpload(pool: Pool, identity: CloudIdentity, uploadId: string): Promise<CloudRecordsSnapshot> {
  requireId(uploadId, 'uploadId');
  return transaction(pool, async (client) => {
    const upload = await findUpload(client, identity, uploadId, true);
    if (upload.completed_revision !== null) {
      return { ...(await readState(client, identity)), replayed: true, appliedRevision: revisionNumber(upload.completed_revision) };
    }
    const chunks = await client.query<{ chunk_index: number; bytes: Buffer; hash: string }>(
      'SELECT chunk_index, bytes, hash FROM fieldwork_record_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 ORDER BY chunk_index',
      [identity.workspaceId, uploadId]
    );
    if (chunks.rows.length !== upload.chunk_count) throw new CloudStorageError(409, 'UPLOAD_INCOMPLETE', 'Every upload chunk must arrive before the records can be committed.');
    const buffers = chunks.rows.map((chunk, index) => {
      const bytes = Buffer.from(chunk.bytes);
      const length = index === upload.chunk_count - 1 ? upload.byte_length - index * CLOUD_RECORDS_CHUNK_BYTES : CLOUD_RECORDS_CHUNK_BYTES;
      if (chunk.chunk_index !== index || bytes.length !== length || sha256(bytes) !== chunk.hash) {
        throw new CloudStorageError(409, 'CHUNK_INTEGRITY_FAILED', 'An upload chunk failed integrity verification. No records were changed.');
      }
      return bytes;
    });
    const bytes = Buffer.concat(buffers);
    if (bytes.length !== upload.byte_length || sha256(bytes) !== upload.sha256) {
      throw new CloudStorageError(409, 'UPLOAD_INTEGRITY_FAILED', 'The complete upload does not match its declared SHA-256 hash. No records were changed.');
    }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { invalid('The upload is not valid UTF-8 JSON.', 'INVALID_UPLOAD_JSON'); }
    const validated = validateRecordsContent(parsed);
    const saved = await commitRecords(client, identity, {
      expectedRevision: revisionNumber(upload.expected_revision), mutationId: upload.mutation_id,
      source: upload.source ?? undefined, ...validated,
    });
    await client.query('UPDATE fieldwork_record_uploads SET completed_revision = $3 WHERE workspace_id = $1 AND upload_id = $2',
      [identity.workspaceId, uploadId, saved.appliedRevision ?? saved.revision]);
    // Only temporary transport copies are removed. Current records and immutable
    // history have already been written in this same transaction.
    await client.query('DELETE FROM fieldwork_record_upload_chunks WHERE workspace_id = $1 AND upload_id = $2', [identity.workspaceId, uploadId]);
    return saved;
  });
}

export function createRecordsRouter(pool: Pool): Router {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  const route = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch((error: unknown) => {
      if (error instanceof CloudStorageError) {
        res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ?? {}) });
      } else next(error);
    });
  };

  router.get('/records', route(async (req, res) => {
    res.json(recordsResponse(await getRecords(pool, requireIdentity(req))));
  }));
  router.put('/records', route(async (req, res) => {
    const body = requireObject(req.body, 'Request');
    if (Buffer.byteLength(JSON.stringify(body)) > CLOUD_RECORDS_DIRECT_BYTES) {
      throw new CloudStorageError(413, 'CHUNKED_UPLOAD_REQUIRED', 'Use the chunked records upload for this snapshot. No records were changed.', { chunkSize: CLOUD_RECORDS_CHUNK_BYTES });
    }
    res.json(recordsResponse(await putRecords(pool, requireIdentity(req), body)));
  }));
  router.get('/records/chunks/:index', route(async (req, res) => {
    const index = parseChunkIndex(req.params.index);
    const revision = typeof req.query.revision === 'string' && /^\d+$/.test(req.query.revision) ? Number(req.query.revision) : NaN;
    requireRevision(revision, 'revision');
    const current = await getRecords(pool, requireIdentity(req));
    if (current.revision !== revision) {
      throw new CloudStorageError(409, 'REVISION_CONFLICT', 'The records changed during download. Start again from the current manifest.', { current: recordsResponse(current) });
    }
    const bytes = contentBytes(current);
    const chunk = bytes.subarray(index * CLOUD_RECORDS_CHUNK_BYTES, (index + 1) * CLOUD_RECORDS_CHUNK_BYTES);
    if (!chunk.length) throw new CloudStorageError(404, 'CHUNK_NOT_FOUND', 'This chunk does not exist in the requested snapshot.');
    res.json({ revision, index, data: chunk.toString('base64'), sha256: sha256(chunk) });
  }));
  router.post('/records/uploads', route(async (req, res) => {
    res.status(201).json(await createRecordsUpload(pool, requireIdentity(req), req.body));
  }));
  router.get('/records/uploads/:uploadId', route(async (req, res) => {
    const identity = requireIdentity(req);
    const uploadId = requireId(req.params.uploadId, 'uploadId');
    const upload = await findUpload(pool, identity, uploadId);
    const chunks = await pool.query<{ chunk_index: number }>(
      'SELECT chunk_index FROM fieldwork_record_upload_chunks WHERE workspace_id = $1 AND upload_id = $2 ORDER BY chunk_index', [identity.workspaceId, uploadId]
    );
    res.json(uploadDescriptor(upload, chunks.rows.map((chunk) => chunk.chunk_index)));
  }));
  router.put('/records/uploads/:uploadId/chunks/:index', route(async (req, res) => {
    res.json(await putRecordsChunk(pool, requireIdentity(req), requireId(req.params.uploadId, 'uploadId'), req.params.index, req.body));
  }));
  router.post('/records/uploads/:uploadId/complete', route(async (req, res) => {
    res.json(recordsResponse(await completeRecordsUpload(pool, requireIdentity(req), requireId(req.params.uploadId, 'uploadId'))));
  }));
  return router;
}

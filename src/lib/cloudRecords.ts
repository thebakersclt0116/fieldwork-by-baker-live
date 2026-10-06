import type { HourEntry } from '../types';
import type { StoredSupervisor } from './fieldworkStore';
import { getCurrentUserEmail } from './fieldworkStore';
import { getAuthorizationHeaders, getStoredAuthUser } from '../hooks/useAuth';
import { canonicalJson, CLOUD_RECORDS_CHUNK_BYTES, CLOUD_RECORDS_MAX_BYTES } from '../../shared/cloudTypes';

export interface CloudOwner { email: string; workspaceId: string }
export interface RecordData { entries: HourEntry[]; supervisors: StoredSupervisor[] }
export interface RecordSnapshot extends RecordData { revision: number; updatedAt: string | null }
export interface MigrationSource { kind: 'legacy-browser-migration'; origin: string; snapshotHash: string }
interface ChunkManifest {
  chunked: true; revision: number; byteLength: number; sha256: string;
  chunkCount: number; chunkSize: number; updatedAt: string | null;
}

export class CloudRequestError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.name = 'CloudRequestError'; this.status = status; }
}

export class RecordConflictError extends Error {
  ids: string[];
  constructor(ids: string[]) {
    super('The same records changed on two devices. Both copies have been preserved. Review the differences before syncing.');
    this.name = 'RecordConflictError'; this.ids = ids;
  }
}

export function assertOwner(owner: CloudOwner): void {
  if (getCurrentUserEmail() !== owner.email.trim().toLowerCase() || getStoredAuthUser()?.workspaceId !== owner.workspaceId) {
    throw new CloudRequestError('Your signed-in account changed. Reopen this workspace before syncing.');
  }
}

export async function cloudRequest<T>(owner: CloudOwner, path: string, init: RequestInit = {}): Promise<T> {
  const requestOwner = { ...owner };
  assertOwner(requestOwner);
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(getAuthorizationHeaders())) headers.set(key, value);
  headers.set('X-Fieldwork-Workspace', requestOwner.workspaceId);
  headers.set('Accept', 'application/json');
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/cloud${path}`, {
    ...init, headers, credentials: 'same-origin', cache: 'no-store',
    signal: init.signal || AbortSignal.timeout(30000),
  });
  assertOwner(requestOwner);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new CloudRequestError('Cloud storage is not available on this deployment. Your device copy is unchanged.', response.status);
  }
  const payload = await response.json() as T & { error?: string; code?: string };
  assertOwner(requestOwner);
  if (!response.ok) throw new CloudRequestError(payload.error || 'Cloud storage could not complete this request. Your device copy is unchanged.', response.status);
  return payload;
}

export async function digestBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
}
export const recordJson = (data: RecordData): string => canonicalJson({ entries: data.entries, supervisors: data.supervisors });
export const sameRecords = (a: RecordData, b: RecordData): boolean => recordJson(a) === recordJson(b);

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
}
export function base64ToBytes(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

function validateSnapshot(value: unknown): RecordSnapshot {
  const snapshot = value as Partial<RecordSnapshot>;
  if (!snapshot || !Number.isSafeInteger(snapshot.revision) || (snapshot.revision as number) < 0 || !Array.isArray(snapshot.entries) || !Array.isArray(snapshot.supervisors)) {
    throw new CloudRequestError('Cloud storage returned an incomplete record snapshot. Your device copy is unchanged.');
  }
  return snapshot as RecordSnapshot;
}

async function readManifest(owner: CloudOwner, manifest: ChunkManifest): Promise<RecordSnapshot> {
  assertOwner(owner);
  if (!Number.isSafeInteger(manifest.revision) || manifest.revision < 0 ||
      !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 1 || manifest.byteLength > CLOUD_RECORDS_MAX_BYTES ||
      manifest.chunkSize !== CLOUD_RECORDS_CHUNK_BYTES || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
      manifest.chunkCount !== Math.ceil(manifest.byteLength / manifest.chunkSize)) {
    throw new CloudRequestError('The cloud snapshot size is invalid.');
  }
  const all = new Uint8Array(manifest.byteLength);
  let offset = 0;
  for (let index = 0; index < manifest.chunkCount; index++) {
    const part = await cloudRequest<{ revision: number; index: number; data: string; sha256: string }>(
      owner, `/records/chunks/${index}?revision=${manifest.revision}`
    );
    const bytes = base64ToBytes(part.data);
    const hash = await digestBytes(bytes);
    assertOwner(owner);
    const expectedBytes = Math.min(manifest.chunkSize, manifest.byteLength - index * manifest.chunkSize);
    if (part.revision !== manifest.revision || part.index !== index || bytes.length !== expectedBytes || hash !== part.sha256 || offset + bytes.length > all.length) {
      throw new CloudRequestError('A cloud snapshot chunk failed verification.');
    }
    all.set(bytes, offset); offset += bytes.length;
  }
  if (offset !== all.length || await digestBytes(all) !== manifest.sha256) throw new CloudRequestError('The cloud record checksum did not match.');
  assertOwner(owner);
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)) as RecordData;
  assertOwner(owner);
  return validateSnapshot({ ...data, revision: manifest.revision, updatedAt: manifest.updatedAt });
}

export async function readCloudRecords(owner: CloudOwner): Promise<RecordSnapshot> {
  const requestOwner = { ...owner };
  const data = await cloudRequest<RecordSnapshot | ChunkManifest>(requestOwner, '/records');
  assertOwner(requestOwner);
  return 'chunked' in data && data.chunked ? readManifest(requestOwner, data) : validateSnapshot(data);
}

/** The same pending save keeps its identity across timeouts and reloads. */
export async function recordMutationId(owner: CloudOwner, expectedRevision: number, contentHash: string, source?: MigrationSource): Promise<string> {
  const descriptor = canonicalJson({ workspaceId: owner.workspaceId, expectedRevision, contentHash, source: source ?? null });
  return `records_${await digestBytes(new TextEncoder().encode(descriptor))}`;
}

export async function writeCloudRecords(owner: CloudOwner, data: RecordData, expectedRevision: number, source?: MigrationSource): Promise<{ snapshot: RecordSnapshot; alreadyApplied: boolean }> {
  const requestOwner = { ...owner };
  assertOwner(requestOwner);
  const serialized = recordJson(data);
  const bytes = new TextEncoder().encode(serialized);
  // Freeze the content and migration source before an asynchronous hash, so the
  // ID always describes precisely the bytes and metadata submitted below.
  const stableData = JSON.parse(serialized) as RecordData;
  const stableSource = source ? JSON.parse(canonicalJson(source)) as MigrationSource : undefined;
  if (bytes.length > CLOUD_RECORDS_MAX_BYTES) throw new CloudRequestError('These records exceed the 25 MB account snapshot limit. Download your full backup; nothing has been truncated or removed.');
  const contentHash = await digestBytes(bytes);
  assertOwner(requestOwner);
  const mutationId = await recordMutationId(requestOwner, expectedRevision, contentHash, stableSource);
  assertOwner(requestOwner);
  let result: (RecordSnapshot | ChunkManifest) & { migrationAlreadyApplied?: boolean };
  if (bytes.length <= 2.5 * 1024 * 1024) {
    result = await cloudRequest(requestOwner, '/records', {
      method: 'PUT', body: JSON.stringify({ expectedRevision, entries: stableData.entries, supervisors: stableData.supervisors, mutationId, source: stableSource }),
    });
  } else {
    const chunkSize = CLOUD_RECORDS_CHUNK_BYTES;
    const upload = await cloudRequest<{ uploadId: string; chunkSize: number; chunkCount: number; uploadedChunks: number[]; completed?: boolean }>(requestOwner, '/records/uploads', {
      method: 'POST', body: JSON.stringify({ expectedRevision, sha256: contentHash, byteLength: bytes.length, chunkCount: Math.ceil(bytes.length / chunkSize), mutationId, source: stableSource }),
    });
    if (upload.chunkSize !== chunkSize || upload.chunkCount !== Math.ceil(bytes.length / chunkSize) ||
        !Array.isArray(upload.uploadedChunks) || upload.uploadedChunks.some(index => !Number.isInteger(index) || index < 0 || index >= upload.chunkCount)) {
      throw new CloudRequestError('Cloud upload size did not match the prepared snapshot.');
    }
    for (let index = 0; !upload.completed && index < upload.chunkCount; index++) {
      if (upload.uploadedChunks.includes(index)) continue;
      await cloudRequest(requestOwner, `/records/uploads/${encodeURIComponent(upload.uploadId)}/chunks/${index}`, {
        method: 'PUT', body: JSON.stringify({ data: bytesToBase64(bytes.subarray(index * chunkSize, (index + 1) * chunkSize)) }),
      });
    }
    result = await cloudRequest(requestOwner, `/records/uploads/${encodeURIComponent(upload.uploadId)}/complete`, { method: 'POST', body: '{}' });
  }
  const snapshot = 'chunked' in result && result.chunked ? await readManifest(requestOwner, result) : validateSnapshot(result);
  assertOwner(requestOwner);
  return { snapshot, alreadyApplied: result.migrationAlreadyApplied === true };
}

function mergeCollection<T extends { id: string }>(base: T[], local: T[], remote: T[], conflicts: string[]): T[] {
  const baseline = new Map(base.map((record) => [record.id, record]));
  const device = new Map(local.map((record) => [record.id, record]));
  const cloud = new Map(remote.map((record) => [record.id, record]));
  if (baseline.size !== base.length || device.size !== local.length || cloud.size !== remote.length) {
    throw new RecordConflictError(['duplicate-record-identifiers']);
  }
  const same = (a: T | undefined, b: T | undefined) => a === undefined || b === undefined ? a === b : canonicalJson(a) === canonicalJson(b);
  const merged: T[] = [];
  for (const id of new Set([...cloud.keys(), ...device.keys(), ...baseline.keys()])) {
    const before = baseline.get(id), here = device.get(id), there = cloud.get(id);
    const localChanged = !same(before, here), remoteChanged = !same(before, there);
    if (localChanged && remoteChanged && !same(here, there)) { conflicts.push(id); continue; }
    const selected = localChanged ? here : there;
    if (selected !== undefined) merged.push(selected);
  }
  return merged;
}

/** A deletion is a change; concurrent edits never resurrect or replace it silently. */
export function mergeRecordCopies(base: RecordData, local: RecordData, remote: RecordData): RecordData {
  const conflicts: string[] = [];
  const entries = mergeCollection(base.entries, local.entries, remote.entries, conflicts);
  const supervisors = mergeCollection(base.supervisors, local.supervisors, remote.supervisors, conflicts);
  if (conflicts.length) throw new RecordConflictError(conflicts);
  return { entries, supervisors };
}

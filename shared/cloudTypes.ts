import type { HourEntry } from '../src/types/index.ts';

/** The API attaches this identity only after verifying a server session or a reserved beta signature. */
export interface CloudIdentity {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  role: string;
  exportPass?: boolean;
  trialEndsAt?: number | null;
  subscription?: string;
  billingCycle?: string;
  authMethod: string;
}

export interface CloudSupervisor {
  id: string;
  name: string;
  email?: string;
  bacbNumber?: string;
}

/** Unknown JSON fields on these objects are retained by the storage API. */
export interface CloudRecordsContent {
  entries: HourEntry[];
  supervisors: CloudSupervisor[];
}

export interface CloudMutationSource {
  kind: string;
  origin?: string;
  snapshotHash?: string;
  [key: string]: unknown;
}

export interface CloudRecordsSnapshot extends CloudRecordsContent {
  revision: number;
  updatedAt: string;
  replayed?: boolean;
  appliedRevision?: number;
  migrationAlreadyApplied?: boolean;
}

export interface CloudRecordsManifest {
  chunked: true;
  revision: number;
  updatedAt: string;
  byteLength: number;
  sha256: string;
  chunkSize: number;
  chunkCount: number;
  replayed?: boolean;
  appliedRevision?: number;
  migrationAlreadyApplied?: boolean;
}

export type CloudRecordsResponse = CloudRecordsSnapshot | CloudRecordsManifest;

export interface CloudRecordsWrite extends CloudRecordsContent {
  expectedRevision: number;
  mutationId?: string;
  source?: CloudMutationSource;
}

export interface CloudRecordsUploadRequest {
  expectedRevision: number;
  sha256: string;
  byteLength: number;
  chunkCount: number;
  mutationId: string;
  source?: CloudMutationSource;
}

export interface CloudRecordsUpload {
  uploadId: string;
  chunkSize: number;
  chunkCount: number;
  uploadedChunks: number[];
  expiresAt: string;
  completed?: boolean;
  appliedRevision?: number;
}

export interface CloudRecordsChunk {
  revision: number;
  index: number;
  data: string;
  sha256: string;
}

export const CLOUD_RECORDS_CHUNK_BYTES = 700 * 1024;
export const CLOUD_RECORDS_DIRECT_BYTES = 3 * 1024 * 1024;
export const CLOUD_RECORDS_MAX_BYTES = 25 * 1024 * 1024;
export const CLOUD_RECORDS_MAX_ENTRIES = 100_000;
export const CLOUD_RECORDS_MAX_SUPERVISORS = 10_000;

/** Deterministic JSON for transport checksums: object keys sorted, array order retained. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown, depth: number): string | undefined {
    if (depth > 64) throw new TypeError('JSON exceeds the supported nesting depth.');
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('JSON numbers must be finite.');
      return JSON.stringify(item);
    }
    if (typeof item === 'undefined') return undefined;
    if (typeof item !== 'object') throw new TypeError('Only JSON values can be synchronized.');
    if (ancestors.has(item)) throw new TypeError('Circular values cannot be synchronized.');
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) {
      result = `[${Array.from(item, (child) => encode(child, depth + 1) ?? 'null').join(',')}]`;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Only plain JSON objects can be synchronized.');
      }
      const object = item as Record<string, unknown>;
      const fields: string[] = [];
      for (const key of Object.keys(object).sort()) {
        const encoded = encode(object[key], depth + 1);
        if (encoded !== undefined) fields.push(`${JSON.stringify(key)}:${encoded}`);
      }
      result = `{${fields.join(',')}}`;
    }
    ancestors.delete(item);
    return result;
  }
  const result = encode(value, 0);
  if (result === undefined) throw new TypeError('A JSON value is required.');
  return result;
}

export interface CloudSourceDocumentMetadata {
  id: string;
  /** A preserved metadata variant retains the original capture ID here. */
  originalDocumentId?: string;
  owner: string;
  hash: string;
  filename: string;
  mime: string;
  size: number;
  savedAt: string;
  kind: 'detailed-source' | 'supporting-document';
}

export interface CloudArchiveDocument {
  document: CloudSourceDocumentMetadata;
  verified: boolean;
  verifiedAt: string | null;
  chunkSize: number;
  chunkCount: number;
  uploadedChunks?: number[];
}

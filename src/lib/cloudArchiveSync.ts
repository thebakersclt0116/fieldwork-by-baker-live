import { getAuthorizationHeaders } from '../hooks/useAuth';
import { canonicalJson } from '../../shared/cloudTypes';
import { assertOwner, cloudRequest, CloudRequestError, digestBytes, type CloudOwner } from './cloudRecords';
import { listDocuments, listBatches, restoreArchivedDocument, restoreAuditBatch, type SourceDocument, type AuditBatch } from './migrationArchive';

const CHUNK_BYTES = 1024 * 1024;
type DocumentMetadata = Omit<SourceDocument, 'bytes'>;
type DocumentEnvelope = { document: DocumentMetadata; verified: boolean; chunkCount: number; chunkSize: number; uploadedChunks?: number[] };
type BatchManifest = { id: string; version: number; contentHash: string; byteLength: number; chunkSize: number; chunkCount: number };
type BatchEnvelope = { batch: AuditBatch; version: number; contentHash: string; byteLength?: number };
type Receipts = { documents: Record<string, string>; batches: Record<string, string> };
const receiptKey = (owner: CloudOwner) => `fieldworkByBaker:cloudArchive:v1:${owner.email}:${owner.workspaceId}`;

function metadataOf(document: SourceDocument): DocumentMetadata {
  const metadata = { ...document } as Partial<SourceDocument>;
  delete metadata.bytes;
  return metadata as DocumentMetadata;
}

async function documentReceipt(metadata: DocumentMetadata): Promise<string> {
  return `metadata-v2:${await digestBytes(new TextEncoder().encode(canonicalJson(metadata)))}`;
}

function assertDocumentMetadata(owner: CloudOwner, metadata: DocumentMetadata): void {
  if (!metadata || metadata.owner !== owner.email || typeof metadata.id !== 'string' || !metadata.id
      || !Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size > 25 * CHUNK_BYTES
      || !/^[a-f0-9]{64}$/.test(metadata.hash)) {
    throw new CloudRequestError('This original document has not passed account and size verification.');
  }
}

async function assertLocalDocument(owner: CloudOwner, document: SourceDocument): Promise<void> {
  assertDocumentMetadata(owner, document);
  const bytes = new Uint8Array(document.bytes);
  if (bytes.length !== document.size || await digestBytes(bytes) !== document.hash) {
    throw new CloudRequestError('A local original document failed its integrity check. No source was discarded.');
  }
  assertOwner(owner);
}

async function preservedVariant(metadata: DocumentMetadata): Promise<DocumentMetadata> {
  // Never replace an existing evidence field or recursively copy a conflicting
  // deterministic variant. Every field of the original participates in its ID.
  if (Object.hasOwn(metadata, 'originalDocumentId')) throw new CloudRequestError('A preserved original variant differs. Keep both copies for review.');
  const fingerprint = await digestBytes(new TextEncoder().encode(canonicalJson(metadata)));
  return { ...metadata, id: `archive-copy:${fingerprint}`, originalDocumentId: metadata.id };
}

export async function localArchiveCounts(email: string): Promise<{ documents: number; batches: number }> {
  const [documents, batches] = await Promise.all([listDocuments(email), listBatches(email)]);
  return { documents: documents.length, batches: batches.length };
}

async function binaryRequest(owner: CloudOwner, path: string, bytes?: Uint8Array): Promise<Uint8Array | void> {
  assertOwner(owner);
  const headers: Record<string, string> = { ...getAuthorizationHeaders(), 'X-Fieldwork-Workspace': owner.workspaceId };
  if (bytes) {
    headers['Content-Type'] = 'application/octet-stream';
    headers['X-Content-SHA256'] = await digestBytes(bytes);
  }
  assertOwner(owner);
  const response = await fetch(`/api/cloud${path}`, {
    method: bytes ? 'PUT' : 'GET', headers, credentials: 'same-origin', cache: 'no-store',
    ...(bytes ? { body: new Uint8Array(bytes) } : {}), signal: AbortSignal.timeout(30000),
  });
  assertOwner(owner);
  if (!response.ok) throw new CloudRequestError('An audit file could not be synchronized. Keep the original device copy and retry.', response.status);
  if (bytes) {
    const receipt = await response.json() as { hash?: string; size?: number };
    assertOwner(owner);
    if (receipt.hash !== headers['X-Content-SHA256'] || receipt.size !== bytes.length) throw new CloudRequestError('The uploaded file chunk did not pass verification.');
    return;
  }
  if (!response.headers.get('content-type')?.includes('application/octet-stream')) throw new CloudRequestError('The cloud returned an invalid audit file.');
  const result = new Uint8Array(await response.arrayBuffer());
  if (result.length > CHUNK_BYTES || await digestBytes(result) !== response.headers.get('X-Content-SHA256')) throw new CloudRequestError('The downloaded audit chunk did not pass verification.');
  assertOwner(owner);
  return result;
}

async function allPages<T>(owner: CloudOwner, path: string, key: 'documents' | 'batches'): Promise<T[]> {
  const result: T[] = [], visited = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: { documents?: T[]; batches?: T[]; nextCursor: string | null } = await cloudRequest(owner, `${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (!Array.isArray(page[key])) throw new CloudRequestError('The cloud archive listing is incomplete.');
    result.push(...page[key]!);
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor)) throw new CloudRequestError('The cloud archive listing could not be completed.');
    if (cursor) visited.add(cursor);
  } while (cursor);
  return result;
}

async function downloadDocument(owner: CloudOwner, envelope: DocumentEnvelope): Promise<SourceDocument> {
  const metadata = envelope.document;
  assertDocumentMetadata(owner, metadata);
  if (!envelope.verified || envelope.chunkSize !== CHUNK_BYTES || envelope.chunkCount !== Math.ceil(metadata.size / CHUNK_BYTES)) {
    throw new CloudRequestError('This original document has not passed account and size verification.');
  }
  const bytes = new Uint8Array(metadata.size);
  let offset = 0;
  for (let index = 0; index < envelope.chunkCount; index++) {
    const part = await binaryRequest(owner, `/archive/documents/${encodeURIComponent(metadata.id)}/chunks/${index}`) as Uint8Array;
    if (part.length !== Math.min(CHUNK_BYTES, metadata.size - offset)) throw new CloudRequestError('An original document chunk is incomplete.');
    bytes.set(part, offset); offset += part.length;
  }
  if (await digestBytes(bytes) !== metadata.hash) throw new CloudRequestError('The restored original file checksum did not match.');
  assertOwner(owner);
  return { ...metadata, bytes };
}

async function uploadDocument(owner: CloudOwner, document: SourceDocument): Promise<DocumentEnvelope> {
  const { bytes: sourceBytes, ...metadata } = document;
  const bytes = new Uint8Array(sourceBytes);
  await assertLocalDocument(owner, document);
  const upload = await cloudRequest<DocumentEnvelope>(owner, '/archive/documents/init', { method: 'POST', body: JSON.stringify({ document: metadata }) });
  if (canonicalJson(upload.document) !== canonicalJson(metadata) || upload.chunkSize !== CHUNK_BYTES || upload.chunkCount !== Math.ceil(bytes.length / CHUNK_BYTES)) throw new CloudRequestError('The original document upload manifest did not match.');
  if (!upload.verified) {
    for (let index = 0; index < upload.chunkCount; index++) {
      if (upload.uploadedChunks?.includes(index)) continue;
      await binaryRequest(owner, `/archive/documents/${encodeURIComponent(document.id)}/chunks/${index}`, bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES));
    }
    const finalized = await cloudRequest<DocumentEnvelope>(owner, `/archive/documents/${encodeURIComponent(document.id)}/finalize`, { method: 'POST', body: '{}' });
    if (!finalized.verified || canonicalJson(finalized.document) !== canonicalJson(metadata)) throw new CloudRequestError('The verified original document metadata did not match.');
    return finalized;
  }
  return upload;
}

async function downloadBatch(owner: CloudOwner, manifest: BatchManifest): Promise<BatchEnvelope> {
  if (!Number.isInteger(manifest.byteLength) || manifest.byteLength < 1 || manifest.byteLength > 25 * CHUNK_BYTES) throw new CloudRequestError('An audit batch has an invalid size.');
  let envelope: BatchEnvelope;
  if (manifest.byteLength < 2.5 * CHUNK_BYTES) {
    envelope = await cloudRequest(owner, `/archive/batches/${encodeURIComponent(manifest.id)}`);
    if (!envelope.batch || envelope.version !== manifest.version) throw new CloudRequestError('The audit batch changed during synchronization. Retry to reconcile it.', 409);
  } else {
    if (manifest.chunkSize !== CHUNK_BYTES || manifest.chunkCount !== Math.ceil(manifest.byteLength / CHUNK_BYTES)) throw new CloudRequestError('An audit batch manifest is incomplete.');
    const bytes = new Uint8Array(manifest.byteLength);
    let offset = 0;
    for (let index = 0; index < manifest.chunkCount; index++) {
      const part = await binaryRequest(owner, `/archive/batches/${encodeURIComponent(manifest.id)}/revisions/${manifest.version}/chunks/${index}`) as Uint8Array;
      if (part.length !== Math.min(CHUNK_BYTES, manifest.byteLength - offset)) throw new CloudRequestError('An audit batch chunk is incomplete.');
      bytes.set(part, offset); offset += part.length;
    }
    if (await digestBytes(bytes) !== manifest.contentHash) throw new CloudRequestError('The audit batch checksum did not match.');
    envelope = { batch: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as AuditBatch, version: manifest.version, contentHash: manifest.contentHash };
  }
  if (envelope.batch.owner.toLowerCase() !== owner.email || envelope.batch.id !== manifest.id || await digestBytes(new TextEncoder().encode(canonicalJson(envelope.batch))) !== manifest.contentHash) throw new CloudRequestError('The audit batch did not pass account and content verification.');
  assertOwner(owner);
  return envelope;
}

async function uploadBatch(owner: CloudOwner, batch: AuditBatch, expectedVersion = 0): Promise<void> {
  const bytes = new TextEncoder().encode(canonicalJson(batch));
  if (bytes.length <= 2.5 * CHUNK_BYTES) {
    await cloudRequest(owner, '/archive/batches', { method: 'POST', body: JSON.stringify({ batch, expectedVersion }) });
    return;
  }
  if (bytes.length > 25 * CHUNK_BYTES) throw new CloudRequestError('This audit batch exceeds the 25 MB cloud limit. Download the complete audit ZIP; no history has been truncated.');
  const upload = await cloudRequest<{ uploadId: string; chunkSize: number; chunkCount: number; uploadedChunks: number[]; completedVersion?: number | null }>(owner, '/archive/batches/uploads', {
    method: 'POST', body: JSON.stringify({ batchId: batch.id, expectedVersion, sha256: await digestBytes(bytes), byteLength: bytes.length, chunkCount: Math.ceil(bytes.length / CHUNK_BYTES) }),
  });
  if (upload.chunkSize !== CHUNK_BYTES || upload.chunkCount !== Math.ceil(bytes.length / CHUNK_BYTES)) throw new CloudRequestError('The audit upload manifest is incomplete.');
  if (!upload.completedVersion) {
    for (let index = 0; index < upload.chunkCount; index++) {
      if (upload.uploadedChunks.includes(index)) continue;
      await binaryRequest(owner, `/archive/batches/uploads/${encodeURIComponent(upload.uploadId)}/chunks/${index}`, bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES));
    }
  }
  await cloudRequest(owner, `/archive/batches/uploads/${encodeURIComponent(upload.uploadId)}/complete`, { method: 'POST', body: '{}' });
}

function sameBatchEvidence(a: AuditBatch, b: AuditBatch): boolean {
  return canonicalJson({ ...a, state: null, note: null }) === canonicalJson({ ...b, state: null, note: null });
}

/** Immutable originals are read back once per device; matching receipts avoid repeat file downloads. */
export async function syncCloudArchive(owner: CloudOwner, options: { onProgress?: (message: string) => void } = {}): Promise<{ documents: number; batches: number }> {
  assertOwner(owner);
  let receipts: Receipts;
  try {
    const parsed = JSON.parse(localStorage.getItem(receiptKey(owner)) || '{}') as Partial<Receipts>;
    receipts = { documents: { ...(parsed.documents || {}) }, batches: { ...(parsed.batches || {}) } };
  } catch { receipts = { documents: {}, batches: {} }; }
  const saveReceipt = () => { assertOwner(owner); localStorage.setItem(receiptKey(owner), JSON.stringify(receipts)); };
  const localDocuments = new Map((await listDocuments(owner.email)).map((document) => [document.id, document]));
  const remoteDocuments = new Map((await allPages<DocumentEnvelope>(owner, '/archive/documents', 'documents')).map((envelope) => [envelope.document.id, envelope]));
  const verifiedDocuments = new Set<string>();

  async function preserveCollision(local: SourceDocument, remote: DocumentEnvelope): Promise<void> {
    const metadata = metadataOf(local);
    assertDocumentMetadata(owner, remote.document);
    if (metadata.owner !== remote.document.owner || metadata.hash !== remote.document.hash || metadata.size !== remote.document.size) {
      throw new CloudRequestError('An original document differs between this device and your account. Both copies were preserved.');
    }
    const localVariant = await preservedVariant(metadata);
    const remoteVariant = await preservedVariant(remote.document);
    assertOwner(owner);
    // Pending uploads are absent from the normal listing. Equal verified local
    // bytes may complete that upload under its unchanged original metadata.
    if (!remote.verified) {
      remote = await uploadDocument(owner, { ...remote.document, bytes: new Uint8Array(local.bytes) });
      remoteDocuments.set(remote.document.id, remote);
    }
    const localCopy: SourceDocument = { ...localVariant, bytes: new Uint8Array(local.bytes) };
    await restoreArchivedDocument(owner.email, localCopy);
    localDocuments.set(localCopy.id, localCopy);

    const existingRemoteCopy = localDocuments.get(remoteVariant.id);
    const remoteCopyReceipt = await documentReceipt(remoteVariant);
    if (existingRemoteCopy && canonicalJson(metadataOf(existingRemoteCopy)) !== canonicalJson(remoteVariant)) {
      throw new CloudRequestError('A preserved original variant differs. Keep both copies for review.');
    }
    if (!existingRemoteCopy || receipts.documents[remoteVariant.id] !== remoteCopyReceipt) {
      const verifiedOriginal = await downloadDocument(owner, remote);
      const copy: SourceDocument = { ...remoteVariant, bytes: verifiedOriginal.bytes };
      await restoreArchivedDocument(owner.email, copy);
      localDocuments.set(copy.id, copy);
    }
    // Each complete metadata variant must survive cloud upload, full byte
    // readback, and the immutable local restore before this collision is covered.
    await syncDocument(localVariant.id);
    await syncDocument(remoteVariant.id);
    delete receipts.documents[local.id];
    saveReceipt();
    verifiedDocuments.add(local.id);
  }

  async function syncDocument(id: string): Promise<void> {
    if (verifiedDocuments.has(id)) return;
    const local = localDocuments.get(id);
    let remote = remoteDocuments.get(id);
    options.onProgress?.('Verifying original audit documents…');
    if (local) {
      await assertLocalDocument(owner, local);
      const metadata = metadataOf(local);
      if (remote && canonicalJson(remote.document) !== canonicalJson(metadata)) return preserveCollision(local, remote);
      if (!remote || !remote.verified) {
        try { remote = await uploadDocument(owner, local); }
        catch (error) {
          if (!(error instanceof CloudRequestError) || error.status !== 409) throw error;
          // Another device may have initialized the legacy ID after our listing,
          // or its interrupted upload may not yet appear among verified files.
          const found = await cloudRequest<DocumentEnvelope>(owner, `/archive/documents/${encodeURIComponent(id)}`);
          if (found.document.id !== id) throw new CloudRequestError('The original document lookup did not match.');
          remoteDocuments.set(id, found);
          if (canonicalJson(found.document) !== canonicalJson(metadata)) return preserveCollision(local, found);
          throw error;
        }
        remoteDocuments.set(id, remote);
      }
    }
    if (!remote) throw new CloudRequestError('An original document could not be found.');
    assertDocumentMetadata(owner, remote.document);
    if (remote.document.id !== id) throw new CloudRequestError('The original document lookup did not match.');
    if (!remote.verified) throw new CloudRequestError('The original document is still awaiting cloud verification. Your device copy was preserved.');
    const receipt = await documentReceipt(remote.document);
    if (!local || receipts.documents[id] !== receipt) {
      const verified = await downloadDocument(owner, remote);
      await restoreArchivedDocument(owner.email, verified);
      localDocuments.set(id, verified);
      receipts.documents[id] = receipt; saveReceipt();
    }
    verifiedDocuments.add(id);
  }

  for (const id of new Set([...localDocuments.keys(), ...remoteDocuments.keys()])) {
    await syncDocument(id);
  }

  const localBatches = new Map((await listBatches(owner.email)).map((batch) => [batch.id, batch]));
  const remoteBatches = new Map((await allPages<BatchManifest>(owner, '/archive/batches', 'batches')).map((manifest) => [manifest.id, manifest]));
  for (const id of new Set([...localBatches.keys(), ...remoteBatches.keys()])) {
    const local = localBatches.get(id);
    let manifest = remoteBatches.get(id);
    options.onProgress?.('Verifying migration decisions and audit history…');
    const localHash = local ? await digestBytes(new TextEncoder().encode(canonicalJson(local))) : null;
    if (local && !manifest) {
      await uploadBatch(owner, local);
      manifest = await cloudRequest<BatchManifest>(owner, `/archive/batches/${encodeURIComponent(id)}/manifest`);
    }
    if (!manifest) throw new CloudRequestError('An audit batch could not be found.');
    if (local && localHash === manifest.contentHash && receipts.batches[id] === `${manifest.version}:${manifest.contentHash}`) continue;
    let verified = await downloadBatch(owner, manifest);
    if (local && canonicalJson(local) !== canonicalJson(verified.batch)) {
      if (!sameBatchEvidence(local, verified.batch)) throw new CloudRequestError('Audit history differs on two devices. Both copies were preserved.');
      if (verified.batch.state === 'prepared' && ['committed', 'failed'].includes(local.state)) {
        await uploadBatch(owner, local, verified.version);
        manifest = await cloudRequest<BatchManifest>(owner, `/archive/batches/${encodeURIComponent(id)}/manifest`);
        verified = await downloadBatch(owner, manifest);
        if (canonicalJson(verified.batch) !== canonicalJson(local)) throw new CloudRequestError('The finalized audit batch did not match its device copy.');
      } else if (!(local.state === 'prepared' && ['committed', 'failed'].includes(verified.batch.state))) {
        throw new CloudRequestError('Finalized audit decisions differ. Both copies were preserved for review.');
      }
    }
    await restoreAuditBatch(owner.email, verified.batch);
    receipts.batches[id] = `${verified.version}:${verified.contentHash}`; saveReceipt();
  }
  assertOwner(owner);
  return { documents: new Set([...localDocuments.keys(), ...remoteDocuments.keys()]).size, batches: new Set([...localBatches.keys(), ...remoteBatches.keys()]).size };
}

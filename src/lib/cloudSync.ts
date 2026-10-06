import { useEffect, useSyncExternalStore } from 'react';
import { getStoredAuthUser, useAuth } from '../hooks/useAuth';
import { setDeviceEditorAccess, writeLocalRecordCache } from './fieldworkStore';
import { preserveDeviceCopy } from './cloudBackups';
import { localArchiveCounts, syncCloudArchive } from './cloudArchiveSync';
import { listBatches, listDocuments } from './migrationArchive';
import { canonicalJson } from '../../shared/cloudTypes';
import {
  assertOwner, CloudRequestError, digestBytes, mergeRecordCopies, readCloudRecords, RecordConflictError,
  recordJson, sameRecords, writeCloudRecords,
  type CloudOwner, type MigrationSource, type RecordData, type RecordSnapshot,
} from './cloudRecords';

export type SyncPhase = 'local' | 'readonly' | 'checking' | 'migration-required' | 'syncing' | 'synced' | 'waiting' | 'conflict' | 'error';
export interface ArchiveCounts { documents: number; batches: number }
export interface RecordCounts { entries: number; supervisors: number; hours: number }
export interface CloudSyncSnapshot {
  phase: SyncPhase;
  ownerEmail: string | null;
  message: string;
  lastVerifiedAt: string | null;
  localCounts: RecordCounts | null;
  cloudCounts: RecordCounts | null;
  archiveCounts: ArchiveCounts | null;
  reviewId: string | null;
  conflictCount: number;
  rawRecoveryAvailable: boolean;
}
export interface ApplyMarker { workspaceId: string; operationId: string; stage: 'applying' | 'applied' }
interface PendingApplication { operationId: string; before: RecordData; after: RecordData }
export interface SyncCheckpoint { version: 1; email: string; workspaceId: string; base: RecordSnapshot; pending?: PendingApplication }
interface MigrationReview { records: RecordData; archive: ArchiveCounts }
export interface RawDeviceValues { entries: string | null; supervisors: string | null }
export interface RawDeviceRecovery extends RawDeviceValues { id: string; owner: string; createdAt: string; reason: string }

export class CorruptDeviceRecordsError extends Error {
  readonly raw: RawDeviceValues;
  constructor(raw: RawDeviceValues) {
    super('Some saved device records could not be read. Cloud saving is paused so they cannot be mistaken for deleted records. Download a recovery copy before making changes.');
    this.name = 'CorruptDeviceRecordsError';
    this.raw = raw;
  }
}

/** Dependencies make concurrency and recovery behavior testable without production accounts. */
export interface CloudSyncDependencies {
  assertOwner(owner: CloudOwner): void;
  loadRecords(owner: CloudOwner): RecordData;
  saveRecords(owner: CloudOwner, records: RecordData): void;
  readCloud(owner: CloudOwner): Promise<RecordSnapshot>;
  writeCloud(owner: CloudOwner, records: RecordData, revision: number, source?: MigrationSource): Promise<{ snapshot: RecordSnapshot; alreadyApplied: boolean }>;
  preserve(owner: CloudOwner, records: RecordData, reason: string): Promise<void>;
  archiveCounts(owner: CloudOwner): Promise<ArchiveCounts>;
  archiveFingerprint(owner: CloudOwner): Promise<string>;
  syncArchive(owner: CloudOwner, onProgress: (message: string) => void): Promise<ArchiveCounts>;
  readCheckpoint(owner: CloudOwner): Promise<SyncCheckpoint | null>;
  saveCheckpoint(owner: CloudOwner, checkpoint: SyncCheckpoint): Promise<void>;
  readApplyMarker(owner: CloudOwner): ApplyMarker | null;
  saveApplyMarker(owner: CloudOwner, marker: ApplyMarker): void;
  clearApplyMarker(owner: CloudOwner): void;
  preserveRaw?(owner: CloudOwner, raw: RawDeviceValues): Promise<void>;
  hash(records: RecordData): Promise<string>;
  withLock?(owner: CloudOwner, operation: () => Promise<void>): Promise<void>;
  origin: string;
}

const blankRecords = (): RecordData => ({ entries: [], supervisors: [] });
const copyRecords = (data: RecordData): RecordData => JSON.parse(recordJson(data)) as RecordData;
const emptyState: CloudSyncSnapshot = {
  phase: 'local', ownerEmail: null, message: 'Your records are saved on this device.', lastVerifiedAt: null,
  localCounts: null, cloudCounts: null, archiveCounts: null, reviewId: null, conflictCount: 0, rawRecoveryAvailable: false,
};

function countRecords(data: RecordData): RecordCounts {
  let hours = 0;
  for (const entry of data.entries) {
    if (typeof entry.duration !== 'number' || !Number.isFinite(entry.duration) || entry.duration < 0) {
      throw new Error('A saved record has an invalid duration. Download your backup and review that record before connecting this device.');
    }
    hours += entry.duration;
  }
  return { entries: data.entries.length, supervisors: data.supervisors.length, hours: Math.round(hours * 1_000_000) / 1_000_000 };
}

/** A stopped or switched account must not publish data after an asynchronous operation. */
export class CloudSyncEngine {
  readonly owner: CloudOwner;
  private readonly deps: CloudSyncDependencies;
  private state: CloudSyncSnapshot;
  private listeners = new Set<() => void>();
  private active = true;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private changes = 0;
  private queueNext = false;
  private review: MigrationReview | null = null;
  private reviewVersion = 0;
  private readonly reviewNonce = crypto.randomUUID();
  private confirmation: { records: RecordData; source: MigrationSource } | null = null;
  private latestRemote: RecordSnapshot | null = null;

  constructor(owner: CloudOwner, deps: CloudSyncDependencies) {
    this.owner = owner;
    this.deps = deps;
    this.state = { ...emptyState, ownerEmail: owner.email, phase: 'checking', message: 'Checking your saved records…' };
  }

  getSnapshot = (): CloudSyncSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private ensureActive(): void {
    if (!this.active) throw new Error('This workspace is no longer active.');
    this.deps.assertOwner(this.owner);
  }

  private async checked<T>(operation: () => Promise<T>): Promise<T> {
    this.ensureActive();
    const result = await operation();
    this.ensureActive();
    return result;
  }

  private update(values: Partial<CloudSyncSnapshot>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...values };
    this.listeners.forEach((listener) => listener());
  }

  private readLocal(): RecordData {
    this.ensureActive();
    return copyRecords(this.deps.loadRecords(this.owner));
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  markLocalChange(): void {
    if (!this.active) return;
    this.changes++;
    if (this.state.phase === 'conflict' || this.state.phase === 'error') return;
    if (this.state.phase !== 'migration-required') this.update({ phase: 'waiting', message: 'Your latest changes are saved on this device and waiting to sync.' });
    this.schedule();
  }

  private schedule(delay = 750): void {
    if (!this.active) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.sync(); }, delay);
  }

  sync = (): Promise<void> => {
    if (!this.active) return Promise.resolve();
    if (this.running) { this.queueNext = true; return this.running; }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const operation = this.deps.withLock ? this.deps.withLock(this.owner, () => this.cycle()) : this.cycle();
    const task = operation.catch((error: unknown) => this.handleFailure(error));
    this.running = task;
    void task.finally(() => {
      if (this.running === task) this.running = null;
      if (this.active && this.queueNext && !['conflict', 'error', 'migration-required'].includes(this.state.phase)) {
        this.queueNext = false;
        this.schedule();
      }
    });
    return task;
  };

  private showReview(records: RecordData, archive: ArchiveCounts, remote: RecordSnapshot, message = 'Review the records saved on this device before adding them to your account.'): void {
    this.review = { records: copyRecords(records), archive: { ...archive } };
    this.confirmation = null;
    this.update({
      phase: 'migration-required', message, localCounts: countRecords(records), cloudCounts: countRecords(remote), archiveCounts: archive,
      reviewId: `${this.owner.workspaceId}:${this.reviewNonce}:${++this.reviewVersion}`, conflictCount: 0,
    });
  }

  confirmMigration = async (reviewedId: string): Promise<void> => {
    if (!this.active || !this.review || this.state.phase !== 'migration-required' || reviewedId !== this.state.reviewId) return;
    const review = this.review;
    try {
      const archive = await this.checked(() => this.deps.archiveCounts(this.owner));
      if (reviewedId !== this.state.reviewId) return;
      const current = this.readLocal();
      if (!sameRecords(review.records, current) || review.archive.documents !== archive.documents || review.archive.batches !== archive.batches) {
        if (this.latestRemote) this.showReview(current, archive, this.latestRemote, 'Your device records changed. Review the updated totals before connecting.');
        return;
      }
      this.update({ phase: 'syncing', message: 'Preserving your device copy before connecting…', reviewId: null });
      const hash = await this.checked(() => this.deps.hash(review.records));
      await this.checked(() => this.deps.preserve(this.owner, review.records, 'Before this device was connected to cloud storage'));
      this.confirmation = { records: review.records, source: { kind: 'legacy-browser-migration', origin: this.deps.origin, snapshotHash: hash } };
      await this.sync();
    } catch (error) { await this.handleFailure(error); }
  };

  private async readRemote(): Promise<RecordSnapshot> {
    const remote = await this.checked(() => this.deps.readCloud(this.owner));
    // Validate totals before showing them or considering a record copy verified.
    countRecords(remote);
    this.latestRemote = remote;
    return remote;
  }

  private async writeAndVerify(local: RecordData, base: RecordData, remote: RecordSnapshot, source?: MigrationSource): Promise<{ verified: RecordSnapshot; localUsed: RecordData }> {
    let localUsed = local;
    let destination = remote;
    let prepared = mergeRecordCopies(base, localUsed, destination);
    if (!source && sameRecords(prepared, destination)) return { verified: destination, localUsed };
    let result: { snapshot: RecordSnapshot; alreadyApplied: boolean };
    try {
      result = await this.checked(() => this.deps.writeCloud(this.owner, prepared, destination.revision, source));
    } catch (error) {
      if (!(error instanceof CloudRequestError) || error.status !== 409) throw error;
      // Retry compare-and-set once against the newest remote. Further contention is left intact.
      destination = await this.readRemote();
      if (!source) localUsed = this.readLocal();
      prepared = mergeRecordCopies(base, localUsed, destination);
      if (!source && sameRecords(prepared, destination)) return { verified: destination, localUsed };
      result = await this.checked(() => this.deps.writeCloud(this.owner, prepared, destination.revision, source));
    }
    if (!result.alreadyApplied && !sameRecords(result.snapshot, prepared)) {
      throw new CloudRequestError('The cloud acknowledgement did not match your records. Your device copy is unchanged.');
    }
    const verified = await this.readRemote();
    if (verified.revision !== result.snapshot.revision || !sameRecords(verified, result.snapshot)) {
      throw new CloudRequestError('The cloud copy changed during verification. Your device copy is unchanged; sync again to check both copies.', 409);
    }
    // A previously imported browser snapshot must not resurrect later cloud deletions.
    return { verified, localUsed };
  }

  private async applyVerified(localUsed: RecordData, verified: RecordSnapshot, target: RecordData = verified): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = this.readLocal();
      const merged = mergeRecordCopies(localUsed, current, target);
      const checkpoint: SyncCheckpoint = { version: 1, email: this.owner.email, workspaceId: this.owner.workspaceId, base: verified };
      if (!sameRecords(current, merged)) {
        await this.checked(() => this.deps.preserve(this.owner, current, 'Device copy before verified cloud records were applied'));
        if (!sameRecords(current, this.readLocal())) continue;
        const operationId = crypto.randomUUID();
        // Persist the acknowledged base and exact transition before touching either legacy key.
        // If the final checkpoint fails, the applied marker prevents replaying downloaded rows as new edits.
        await this.checked(() => this.deps.saveCheckpoint(this.owner, { ...checkpoint, pending: { operationId, before: current, after: merged } }));
        if (!sameRecords(current, this.readLocal())) continue;
        this.deps.saveApplyMarker(this.owner, { workspaceId: this.owner.workspaceId, operationId, stage: 'applying' });
        // No await between the last read and local write: edits during requests are rebased above.
        this.deps.saveRecords(this.owner, merged);
        this.deps.saveApplyMarker(this.owner, { workspaceId: this.owner.workspaceId, operationId, stage: 'applied' });
      }
      this.ensureActive();
      await this.checked(() => this.deps.saveCheckpoint(this.owner, checkpoint));
      this.deps.clearApplyMarker(this.owner);
      this.confirmation = null;
      this.review = null;
      return sameRecords(merged, verified);
    }
    throw new CloudRequestError('Your records are still being edited. They remain on this device; sync again when you finish.');
  }

  private async recoverApplication(checkpoint: SyncCheckpoint): Promise<SyncCheckpoint> {
    const pending = checkpoint.pending;
    if (!pending) return checkpoint;
    const marker = this.deps.readApplyMarker(this.owner);
    const complete: SyncCheckpoint = { version: 1, email: this.owner.email, workspaceId: this.owner.workspaceId, base: checkpoint.base };
    if (marker?.operationId === pending.operationId && marker.workspaceId === this.owner.workspaceId && marker.stage === 'applied') {
      // The device has already received these rows; later edits are compared with their acknowledged base.
      await this.checked(() => this.deps.saveCheckpoint(this.owner, complete));
      this.deps.clearApplyMarker(this.owner);
    } else {
      // A missing/applying marker means no application or a partial two-key write. Rebase the exact
      // journaled transition, preserving edits made before the guarded write began.
      await this.applyVerified(pending.before, checkpoint.base, pending.after);
    }
    this.confirmation = null;
    return complete;
  }

  private async cycle(): Promise<void> {
    this.ensureActive();
    this.readLocal(); // Unreadable local collections must fail before any cloud writes.
    const startChanges = this.changes;
    this.queueNext = false;
    this.update({ phase: this.state.lastVerifiedAt || this.confirmation ? 'syncing' : 'checking', message: 'Checking your account and device records…', conflictCount: 0, rawRecoveryAvailable: false });
    let checkpoint = await this.checked(() => this.deps.readCheckpoint(this.owner));
    if (checkpoint?.pending) checkpoint = await this.recoverApplication(checkpoint);
    else if (this.deps.readApplyMarker(this.owner)?.stage === 'applying') throw new Error('This device has an unfinished recovery operation. Download a backup before reconnecting.');
    const archive = await this.checked(() => this.deps.archiveCounts(this.owner));
    const remote = await this.readRemote();
    const current = this.readLocal();
    this.update({ localCounts: countRecords(current), cloudCounts: countRecords(remote), archiveCounts: archive });
    if (!checkpoint && !this.confirmation && (current.entries.length > 0 || current.supervisors.length > 0 || archive.documents > 0 || archive.batches > 0)) {
      this.showReview(current, archive, remote);
      return;
    }
    const localUsed = this.confirmation?.records || current;
    const base = checkpoint?.base || blankRecords();
    const { verified, localUsed: submittedLocal } = await this.writeAndVerify(localUsed, base, remote, this.confirmation?.source);
    const recordsSettled = await this.applyVerified(submittedLocal, verified);
    this.update({ phase: 'syncing', message: 'Verifying original files and import history…' });
    const archiveBefore = await this.checked(() => this.deps.archiveFingerprint(this.owner));
    const archiveVerified = await this.checked(() => this.deps.syncArchive(this.owner, (message) => this.update({ message })));
    const archiveCurrent = await this.checked(() => this.deps.archiveCounts(this.owner));
    const archiveAfter = await this.checked(() => this.deps.archiveFingerprint(this.owner));
    const finalRecords = this.readLocal();
    const archivesSettled = archiveBefore === archiveAfter && archiveCurrent.documents === archiveVerified.documents && archiveCurrent.batches === archiveVerified.batches;
    const settled = recordsSettled && sameRecords(finalRecords, verified) && archivesSettled && this.changes === startChanges;
    this.update({
      phase: settled ? 'synced' : 'waiting',
      message: settled ? 'Your records, original files, and import history have a verified cloud copy.' : 'Your latest changes are safe on this device. Finishing cloud sync…',
      lastVerifiedAt: settled ? new Date().toISOString() : this.state.lastVerifiedAt,
      localCounts: countRecords(finalRecords), cloudCounts: countRecords(verified), archiveCounts: archiveVerified, reviewId: null,
    });
    if (!settled) this.queueNext = true;
  }

  private async handleFailure(error: unknown): Promise<void> {
    if (!this.active) return;
    try { this.ensureActive(); } catch { this.stop(); return; }
    if (error instanceof CorruptDeviceRecordsError) {
      try { if (this.deps.preserveRaw) await this.checked(() => this.deps.preserveRaw!(this.owner, error.raw)); }
      catch { /* The exact original storage strings are still left untouched on this device. */ }
      this.update({ phase: 'error', message: error.message, rawRecoveryAvailable: true });
      return;
    }
    if (error instanceof RecordConflictError) {
      let copiesPreserved = false;
      try {
        await this.checked(() => this.deps.preserve(this.owner, this.readLocal(), 'Device records at a cloud sync conflict'));
        if (this.latestRemote) await this.checked(() => this.deps.preserve(this.owner, this.latestRemote!, 'Cloud records at a sync conflict'));
        copiesPreserved = Boolean(this.latestRemote);
      } catch { /* The original local records are never replaced on a conflict. */ }
      this.update({
        phase: 'conflict', conflictCount: error.ids.length,
        message: copiesPreserved ? 'The same records changed in two places. Both copies are preserved in your backup. Review them before syncing again.' : 'The same records changed in two places. Your device records were not replaced. Download a backup before reviewing the cloud copy.',
      });
      return;
    }
    this.update({
      phase: error instanceof CloudRequestError ? 'waiting' : 'error',
      message: error instanceof Error ? error.message : 'Cloud saving is unavailable. Your device records are unchanged.',
    });
  }
}

function rawDeviceValues(email: string): RawDeviceValues {
  const prefix = `fieldworkByBaker:v1:${email.trim().toLowerCase()}`;
  try { return { entries: localStorage.getItem(`${prefix}:entries`), supervisors: localStorage.getItem(`${prefix}:supervisors`) }; }
  catch { throw new Error('This browser could not read saved device records. Cloud saving is paused; enable browser storage and try again.'); }
}

/** Missing keys mean a fresh device; malformed or inaccessible values never mean deletion. */
export function readStrictDeviceRecords(email: string): RecordData {
  const raw = rawDeviceValues(email);
  try {
    const entries: unknown = raw.entries === null ? [] : JSON.parse(raw.entries);
    const supervisors: unknown = raw.supervisors === null ? [] : JSON.parse(raw.supervisors);
    const validRecord = (item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string' && (item as Record<string, unknown>).id);
    if (!Array.isArray(entries) || !Array.isArray(supervisors) || !entries.every(validRecord) || !supervisors.every(validRecord) ||
        !entries.every((entry) => typeof entry.duration === 'number' && Number.isFinite(entry.duration) && entry.duration >= 0)) throw new Error('Invalid saved collection');
    return { entries, supervisors } as unknown as RecordData;
  } catch { throw new CorruptDeviceRecordsError(raw); }
}

function syncDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fieldwork-cloud-sync-v1', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('checkpoints')) request.result.createObjectStore('checkpoints', { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains('recoveries')) request.result.createObjectStore('recoveries', { keyPath: 'id' }).createIndex('owner', 'owner');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('The device sync history could not be opened. Your records are unchanged; download a backup before reconnecting.'));
    request.onblocked = () => reject(new Error('Close other Fieldwork tabs, then retry saving the device sync history.'));
  });
}

const checkpointKey = (owner: CloudOwner) => `${owner.email}:${owner.workspaceId}`;
async function readCheckpoint(owner: CloudOwner): Promise<SyncCheckpoint | null> {
  const db = await syncDatabase();
  let checkpoint: SyncCheckpoint | undefined;
  try {
    checkpoint = await new Promise<SyncCheckpoint | undefined>((resolve, reject) => {
      const request = db.transaction('checkpoints').objectStore('checkpoints').get(checkpointKey(owner));
      request.onsuccess = () => resolve(request.result as SyncCheckpoint | undefined);
      request.onerror = () => reject(new Error('The device sync history could not be read. Your records are unchanged.'));
    });
  } finally { db.close(); }
  if (!checkpoint) return null;
  if (checkpoint.version !== 1 || checkpoint.email !== owner.email || checkpoint.workspaceId !== owner.workspaceId ||
      !Number.isSafeInteger(checkpoint.base?.revision) || checkpoint.base.revision < 0 || !Array.isArray(checkpoint.base.entries) || !Array.isArray(checkpoint.base.supervisors)) {
    throw new Error('This device has incomplete sync history. Your records are unchanged. Download a backup before reconnecting.');
  }
  if (checkpoint.pending && (typeof checkpoint.pending.operationId !== 'string' || !Array.isArray(checkpoint.pending.before?.entries) ||
      !Array.isArray(checkpoint.pending.before?.supervisors) || !Array.isArray(checkpoint.pending.after?.entries) || !Array.isArray(checkpoint.pending.after?.supervisors))) {
    throw new Error('This device has incomplete recovery history. Your records are unchanged. Download a backup before reconnecting.');
  }
  return checkpoint;
}

const applyMarkerKey = (owner: CloudOwner) => `fieldworkByBaker:cloud-apply:v1:${owner.email}`;
function readApplyMarker(owner: CloudOwner): ApplyMarker | null {
  const raw = localStorage.getItem(applyMarkerKey(owner));
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as ApplyMarker;
    if (typeof marker.workspaceId !== 'string' || typeof marker.operationId !== 'string' || !['applying', 'applied'].includes(marker.stage)) throw new Error('Invalid recovery marker');
    return marker;
  } catch { throw new Error('This device has incomplete recovery history. Download a backup before reconnecting.'); }
}

async function putSyncValue(store: 'checkpoints' | 'recoveries', value: unknown): Promise<void> {
  const db = await syncDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('The device recovery copy could not be saved. Download a backup and free browser storage before retrying.'));
      transaction.onabort = () => reject(new Error('The device recovery copy could not be committed. Your saved records are unchanged.'));
    });
  } finally { db.close(); }
}

async function preserveRawDeviceValues(owner: CloudOwner, raw: RawDeviceValues): Promise<void> {
  assertActiveOwner(owner);
  const hash = await digestBytes(new TextEncoder().encode(canonicalJson(raw)));
  assertActiveOwner(owner);
  await putSyncValue('recoveries', { ...raw, id: `${owner.email}:${hash}`, owner: owner.email, createdAt: new Date().toISOString(), reason: 'Unreadable device records retained exactly as stored' } satisfies RawDeviceRecovery);
}

export async function listRawDeviceRecoveryCopies(email: string): Promise<RawDeviceRecovery[]> {
  if (getStoredAuthUser()?.email !== email.trim().toLowerCase()) throw new Error('Your signed-in account changed.');
  const db = await syncDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('recoveries').objectStore('recoveries').index('owner').getAll(email.trim().toLowerCase());
      request.onsuccess = () => resolve(request.result as RawDeviceRecovery[]);
      request.onerror = () => reject(new Error('Device recovery copies could not be read.'));
    });
  } finally { db.close(); }
}

export async function downloadRawDeviceRecords(email: string): Promise<void> {
  if (getStoredAuthUser()?.email !== email.trim().toLowerCase()) throw new Error('Your signed-in account changed.');
  const current = rawDeviceValues(email);
  let recoveryCopies: RawDeviceRecovery[] = [];
  try { recoveryCopies = await listRawDeviceRecoveryCopies(email); } catch { /* Current raw values can still be downloaded if IndexedDB is full. */ }
  if (getStoredAuthUser()?.email !== email.trim().toLowerCase()) throw new Error('Your signed-in account changed.');
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({ format: 'fieldwork-device-record-recovery-v1', owner: email, createdAt, current, recoveryCopies }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `Fieldwork_Device_Recovery_${createdAt.slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function archiveFingerprint(owner: CloudOwner): Promise<string> {
  const [documents, batches] = await Promise.all([listDocuments(owner.email), listBatches(owner.email)]);
  assertActiveOwner(owner);
  return digestBytes(new TextEncoder().encode(canonicalJson({
    documents: documents.map(({ bytes, ...metadata }) => ({ ...metadata, byteLength: bytes.byteLength })).sort((a, b) => a.id.localeCompare(b.id)),
    batches: batches.sort((a, b) => a.id.localeCompare(b.id)),
  })));
}

function assertActiveOwner(owner: CloudOwner): void {
  assertOwner(owner);
  const identity = getStoredAuthUser();
  if (!identity || identity.email !== owner.email || identity.workspaceId !== owner.workspaceId) throw new CloudRequestError('Your signed-in account changed. Reopen this workspace before syncing.');
}

const dependencies = (): CloudSyncDependencies => ({
  assertOwner: assertActiveOwner,
  loadRecords: (owner) => readStrictDeviceRecords(owner.email),
  saveRecords: (owner, records) => { assertActiveOwner(owner); writeLocalRecordCache(records, owner.email); },
  readCloud: readCloudRecords,
  writeCloud: writeCloudRecords,
  preserve: (owner, records, reason) => preserveDeviceCopy(owner.email, records, reason),
  archiveCounts: (owner) => localArchiveCounts(owner.email),
  archiveFingerprint,
  syncArchive: (owner, onProgress) => syncCloudArchive(owner, { onProgress }),
  readCheckpoint,
  saveCheckpoint: async (owner, checkpoint) => { assertActiveOwner(owner); await putSyncValue('checkpoints', { ...checkpoint, id: checkpointKey(owner) }); },
  readApplyMarker,
  saveApplyMarker: (owner, marker) => { assertActiveOwner(owner); localStorage.setItem(applyMarkerKey(owner), JSON.stringify(marker)); },
  clearApplyMarker: (owner) => { assertActiveOwner(owner); localStorage.removeItem(applyMarkerKey(owner)); },
  preserveRaw: preserveRawDeviceValues,
  hash: (records) => digestBytes(new TextEncoder().encode(recordJson(records))),
  withLock: async (owner, operation) => {
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(`fieldwork-cloud-sync:${owner.workspaceId}:${owner.email}`, operation);
    else await operation();
  },
  origin: window.location.origin,
});

let engine: CloudSyncEngine | null = null;
let engineUnsubscribe: (() => void) | null = null;
let state: CloudSyncSnapshot = emptyState;
let consumers = 0;
let editorRelease: (() => void) | null = null;
let editorAbort: AbortController | null = null;
let editorEmail: string | null = null;
let configureVersion = 0;
let configuredKey: string | null = null;
let desiredAccount: { owner: CloudOwner | null; email: string | null } = { owner: null, email: null };
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((listener) => listener());

function releaseEditor(): void {
  configuredKey = null;
  engineUnsubscribe?.(); engineUnsubscribe = null;
  engine?.stop(); engine = null;
  editorAbort?.abort(); editorAbort = null;
  editorRelease?.(); editorRelease = null;
  if (editorEmail) setDeviceEditorAccess(editorEmail, false);
  editorEmail = null;
}

function startEngine(owner: CloudOwner): void {
  engine = new CloudSyncEngine(owner, dependencies());
  state = engine.getSnapshot();
  engineUnsubscribe = engine.subscribe(() => {
    if (engine) {
      state = engine.getSnapshot();
      if (state.rawRecoveryAvailable) setDeviceEditorAccess(engine.owner.email, false);
      notify();
    }
  });
  notify();
  void engine.sync();
}

/** Only the tab holding this lifetime lock can mutate the email's local record/archive namespace. */
function configure(owner: CloudOwner | null, localEmail: string | null, force = false): void {
  desiredAccount = { owner, email: localEmail };
  const key = `${localEmail || ''}:${owner?.workspaceId || ''}:${Boolean(owner)}`;
  if (!force && key === configuredKey) return;
  const version = ++configureVersion;
  releaseEditor();
  configuredKey = key;
  if (!localEmail) { state = { ...emptyState }; notify(); return; }
  editorEmail = localEmail;
  setDeviceEditorAccess(localEmail, false);
  if (typeof navigator === 'undefined' || !navigator.locks) {
    state = { ...emptyState, ownerEmail: localEmail, phase: 'readonly', message: 'This browser cannot safely coordinate saved records across tabs. Your existing records are available to view and back up. Update your browser to edit or connect this device.' };
    notify(); return;
  }
  state = { ...emptyState, ownerEmail: localEmail, phase: 'checking', message: 'Checking access to this device’s saved records…' };
  notify();
  const abort = new AbortController();
  editorAbort = abort;
  let granted = false;
  const hold = async (lock: Lock | null) => {
    if (version !== configureVersion) return;
    if (!lock) {
      state = { ...emptyState, ownerEmail: localEmail, phase: 'readonly', message: 'Another Fieldwork tab is editing this account. You can view and back up records here. Close the other tab; this one will become editable automatically.' };
      notify(); return;
    }
    granted = true;
    setDeviceEditorAccess(localEmail, true);
    if (owner) startEngine(owner);
    else {
      state = { ...emptyState, ownerEmail: localEmail, message: 'Your records are saved on this device. Cloud saving is not connected for this session.' };
      notify();
    }
    await new Promise<void>((resolve) => { editorRelease = resolve; });
  };
  const failed = (error: unknown) => {
    if (version !== configureVersion || (error instanceof DOMException && error.name === 'AbortError')) return;
    setDeviceEditorAccess(localEmail, false);
    state = { ...emptyState, ownerEmail: localEmail, phase: 'readonly', message: 'This tab could not reserve access to your saved records. Close other Fieldwork tabs and try again. Your existing records are unchanged.' };
    notify();
  };
  void navigator.locks.request(`fieldwork-device-editor:${localEmail}`, { mode: 'exclusive', ifAvailable: true }, hold).then(async () => {
    if (!granted && version === configureVersion && !abort.signal.aborted) {
      await navigator.locks.request(`fieldwork-device-editor:${localEmail}`, { mode: 'exclusive', signal: abort.signal }, hold);
    }
  }).catch(failed);
}

if (typeof window !== 'undefined') {
  const changed = (event: Event) => {
    const email = (event as CustomEvent<{ email?: string }>).detail?.email;
    if (engine && (!email || email.toLowerCase() === engine.owner.email)) engine.markLocalChange();
  };
  window.addEventListener('fieldwork:local-records-changed', changed);
  window.addEventListener('fieldwork:archive-changed', changed);
  window.addEventListener('storage', (event) => {
    if (engine && event.key?.startsWith(`fieldworkByBaker:v1:${engine.owner.email}:`)) engine.markLocalChange();
  });
  window.addEventListener('online', () => { if (engine && engine.getSnapshot().phase !== 'conflict') void engine.sync(); });
  window.addEventListener('focus', () => { if (engine && !['conflict', 'migration-required'].includes(engine.getSnapshot().phase)) void engine.sync(); });
}

export function useCloudSync() {
  const { user, isLoading, hasCloudAccount } = useAuth();
  const email = user?.email || null;
  const workspaceId = user?.workspaceId || null;
  useEffect(() => {
    consumers++;
    configure(!isLoading && hasCloudAccount && email && workspaceId ? { email, workspaceId } : null, email);
    return () => {
      consumers--;
      if (consumers === 0) { ++configureVersion; releaseEditor(); }
    };
  }, [email, workspaceId, hasCloudAccount, isLoading]);
  const snapshot = useSyncExternalStore((listener) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; }, () => state, () => emptyState);
  return {
    ...snapshot,
    syncNow: () => {
      if (engine) { if (editorEmail === engine.owner.email) setDeviceEditorAccess(editorEmail, true); return engine.sync(); }
      configure(desiredAccount.owner, desiredAccount.email, true);
      return Promise.resolve();
    },
    connectThisDevice: (reviewedId: string) => engine?.confirmMigration(reviewedId) || Promise.resolve(),
  };
}

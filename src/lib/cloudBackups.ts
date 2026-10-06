import type { HourEntry } from '../types';
import type { StoredSupervisor } from './fieldworkStore';
import { getCurrentUserEmail } from './fieldworkStore';
import { canonicalJson } from '../../shared/cloudTypes';

export interface DeviceBackup {
  id: string; owner: string; createdAt: string; reason: string;
  entries: HourEntry[]; supervisors: StoredSupervisor[];
}

function normalizedOwner(owner: string): string { return owner.trim().toLowerCase(); }
function assertBackupOwner(owner: string): void {
  if (!owner || getCurrentUserEmail() !== owner) throw new Error('Your signed-in account changed.');
}

function backupContent(record: unknown, owner: string, id?: string): string {
  const saved = record as Partial<DeviceBackup> | null;
  if (!saved || saved.owner !== owner || typeof saved.id !== 'string' || (id !== undefined && saved.id !== id) ||
      !Array.isArray(saved.entries) || !Array.isArray(saved.supervisors)) {
    throw new Error('The protected device backup could not be verified. Keep the current device copy.');
  }
  return canonicalJson({ entries: saved.entries, supervisors: saved.supervisors });
}

async function contentHash(serialized: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fieldwork-cloud-device-backups-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('backups', { keyPath: 'id' }).createIndex('owner', 'owner');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('A protected device backup could not be created. Download your audit ZIP before connecting this device.'));
  });
}

export async function preserveDeviceCopy(owner: string, data: Pick<DeviceBackup, 'entries' | 'supervisors'>, reason: string): Promise<void> {
  owner = normalizedOwner(owner);
  assertBackupOwner(owner);
  const serialized = canonicalJson({ entries: data.entries, supervisors: data.supervisors });
  const hash = await contentHash(serialized);
  assertBackupOwner(owner);
  const record: DeviceBackup = { ...JSON.parse(serialized) as typeof data, id: `${owner}:${hash}`, owner, createdAt: new Date().toISOString(), reason };
  const db = await database();
  try {
    assertBackupOwner(owner);
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('backups', 'readwrite');
      const store = transaction.objectStore('backups');
      const existing = store.get(record.id);
      let failure: unknown;
      existing.onsuccess = () => {
        try {
          assertBackupOwner(owner);
          if (existing.result) {
            if (backupContent(existing.result, owner, record.id) !== serialized) {
              throw new Error('An existing protected backup contains different data. Nothing was overwritten; keep the current device copy.');
            }
          } else store.add(record);
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = () => {
        try { assertBackupOwner(owner); resolve(); } catch (error) { reject(error); }
      };
      transaction.onerror = () => reject(failure || new Error('The protected device backup failed. The existing record copy is unchanged.'));
      transaction.onabort = () => reject(failure || new Error('The protected device backup could not be committed.'));
    });
    assertBackupOwner(owner);
    // Verify a fresh read after commit, including an idempotent existing backup.
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction('backups').objectStore('backups').get(record.id);
      request.onsuccess = () => {
        try {
          assertBackupOwner(owner);
          if (backupContent(request.result, owner, record.id) !== serialized) {
            throw new Error('The protected device backup readback did not match. Keep the current device copy.');
          }
          resolve();
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(new Error('The protected device backup could not be read back. Keep the current device copy.'));
    });
    assertBackupOwner(owner);
  } finally { db.close(); }
}

export async function listDeviceBackups(owner: string): Promise<DeviceBackup[]> {
  owner = normalizedOwner(owner);
  assertBackupOwner(owner);
  const db = await database();
  try {
    assertBackupOwner(owner);
    const records = await new Promise<DeviceBackup[]>((resolve, reject) => {
      const request = db.transaction('backups').objectStore('backups').index('owner').getAll(owner);
      request.onsuccess = () => {
        try { assertBackupOwner(owner); resolve(request.result as DeviceBackup[]); } catch (error) { reject(error); }
      };
      request.onerror = () => reject(new Error('Device recovery copies could not be read.'));
    });
    for (const record of records) {
      const hash = await contentHash(backupContent(record, owner));
      assertBackupOwner(owner);
      if (record.id !== `${owner}:${hash}`) throw new Error('A protected recovery copy failed checksum verification. Keep the original device records.');
    }
    assertBackupOwner(owner);
    return records;
  } finally { db.close(); }
}

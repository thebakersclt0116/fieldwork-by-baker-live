// Intentionally local-only: never claims to delete data from a device that has not run this code.
export const RESET_ACCOUNT = 'ayalaemily52@gmail.com';
export const RESET_CAMPAIGN = 'ripley-reimport-clean-start-v1';
export const RESET_MARKER = `fieldworkByBaker:reset:${RESET_ACCOUNT}:${RESET_CAMPAIGN}`;
export const RESET_ENTRIES = `fieldworkByBaker:v1:${RESET_ACCOUNT}:entries`;
export interface ResetStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface ResetSnapshot { id: string; format: 'baker-fieldwork-reset-v1'; email: string; createdAt: string; raw: string | null; entryCount: number; campaign: string }
function checkAccount(storage: ResetStorage) {
  let email = '';
  try { email = String(JSON.parse(storage.getItem('authUser') || '{}').email || '').trim().toLowerCase(); } catch { /* fail closed */ }
  if (email !== RESET_ACCOUNT) throw new Error('This reset is only for Emily on her own signed-in browser. No records were changed.');
}
export function captureResetSnapshot(storage: ResetStorage): ResetSnapshot {
  checkAccount(storage);
  if (storage.getItem(RESET_MARKER)) throw new Error('This clean-start reset has already run on this browser. Newly imported hours will not be deleted again.');
  const raw = storage.getItem(RESET_ENTRIES);
  let entries: unknown;
  try { entries = JSON.parse(raw || '[]'); } catch { throw new Error('The saved entry list could not be read. Export the raw browser data before attempting any cleanup.'); }
  if (!Array.isArray(entries)) throw new Error('The saved entry list is not an array. Reset stopped without deleting it.');
  return { id: crypto.randomUUID(), format: 'baker-fieldwork-reset-v1', email: RESET_ACCOUNT, createdAt: new Date().toISOString(), raw, entryCount: entries.length, campaign: RESET_CAMPAIGN };
}
export function commitResetSnapshot(storage: ResetStorage, snapshot: ResetSnapshot, backupVerified: boolean): void {
  checkAccount(storage);
  if (!backupVerified || snapshot.email !== RESET_ACCOUNT || snapshot.campaign !== RESET_CAMPAIGN) throw new Error('A verified backup of Emily’s original entries is required. Nothing was deleted.');
  if (storage.getItem(RESET_MARKER)) throw new Error('Reset already completed. Newly imported records were left alone.');
  if (storage.getItem(RESET_ENTRIES) !== snapshot.raw) throw new Error('Entries changed while the reset was open. Refresh and review the current count before clearing.');
  const marker = JSON.stringify({ snapshotId: snapshot.id, entryCount: snapshot.entryCount, resetAt: new Date().toISOString(), campaign: RESET_CAMPAIGN });
  // Synchronous writes prevent an intervening same-tab entry update; retain the original if a write fails.
  try {
    storage.setItem(RESET_MARKER, marker);
    storage.setItem(RESET_ENTRIES, '[]');
    if (storage.getItem(RESET_ENTRIES) !== '[]') throw new Error('Reset readback failed.');
  } catch {
    try { if (snapshot.raw === null) storage.removeItem(RESET_ENTRIES); else storage.setItem(RESET_ENTRIES, snapshot.raw); storage.removeItem(RESET_MARKER); } catch { /* the verified IndexedDB backup remains available */ }
    throw new Error('The browser could not finish the reset. A recovery backup was preserved. Check records before retrying.');
  }
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('baker-fieldwork-reset-backups-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Backup storage unavailable. Reset stopped; no records deleted.'));
    req.onblocked = () => reject(new Error('Close other Baker tabs and retry; backup storage is locked.'));
  });
}
export async function preserveResetSnapshot(snapshot: ResetSnapshot): Promise<boolean> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(snapshot);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('Backup write failed. No entries were deleted.'));
    });
    const found = await new Promise<ResetSnapshot>((resolve, reject) => {
      const req = db.transaction('snapshots').objectStore('snapshots').get(snapshot.id);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    return JSON.stringify(found) === JSON.stringify(snapshot);
  } finally { db.close(); }
}
export async function loadResetSnapshot(id: string): Promise<ResetSnapshot | null> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const req = db.transaction('snapshots').objectStore('snapshots').get(id); req.onsuccess = () => resolve(req.result?.email === RESET_ACCOUNT ? req.result : null); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}

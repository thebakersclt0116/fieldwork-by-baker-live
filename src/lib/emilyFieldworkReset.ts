// This resets only the active fieldwork ledger on the device running it.
// It never deletes auth, supervisors, source documents, audit journals, or another account.
export const RESET_ACCOUNT = 'ayalaemily52@gmail.com';
const key = `fieldworkByBaker:v1:${RESET_ACCOUNT}:entries`;
export type ResetSnapshot = { owner: string; raw: string | null; count: number; hours: number; capturedAt: string };
type Store = Pick<Storage, 'getItem' | 'removeItem'>;
function verifyAccount(store: Store): void {
  let email = '';
  try { email = String(JSON.parse(store.getItem('authUser') || '{}').email || '').trim().toLowerCase(); } catch { /* fail closed */ }
  if (email !== RESET_ACCOUNT) throw new Error('Sign in to Emily’s account on the computer where her existing hours are stored. No records were changed.');
}
export function readResetSnapshot(store: Store = localStorage): ResetSnapshot {
  verifyAccount(store);
  const raw = store.getItem(key);
  let entries: Array<{ duration?: number }> = [];
  if (raw !== null) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object')) throw new Error('The existing record format needs review. Reset stopped rather than assuming the data is empty.');
    entries = parsed;
  }
  return { owner: RESET_ACCOUNT, raw, count: entries.length, hours: entries.reduce((n, e) => n + (typeof e.duration === 'number' && Number.isFinite(e.duration) ? e.duration : 0), 0), capturedAt: new Date().toISOString() };
}
export function createResetBackup(snapshot: ResetSnapshot): string {
  if (snapshot.owner !== RESET_ACCOUNT) throw new Error('This reset is scoped to Emily’s account only.');
  return JSON.stringify({ format: 'baker-tracked-hours-reset-backup-v1', owner: snapshot.owner, exportedAt: snapshot.capturedAt, note: 'Complete pre-reset tracked records, including original-source metadata, notes and revisions. Store privately. Supporting files and supervisors were not deleted.', entries: snapshot.raw === null ? [] : JSON.parse(snapshot.raw), originalStorageValue: snapshot.raw }, null, 2);
}
export function resetEmilyTrackedHours(snapshot: ResetSnapshot, confirmation: string, backupSaved: boolean, store: Store = localStorage): { removed: number } {
  verifyAccount(store);
  if (snapshot.owner !== RESET_ACCOUNT || confirmation !== 'RESET' || !backupSaved) throw new Error('Save the backup and type RESET before removing tracked hours.');
  if (store.getItem(key) !== snapshot.raw) throw new Error('The hours changed after the backup was made, possibly in another tab. Download a new backup and review again. Nothing was deleted.');
  // No asynchronous gap between final snapshot check and this targeted mutation.
  store.removeItem(key);
  if (store.getItem(key) !== null) throw new Error('The browser did not confirm removal. No successful reset is being reported.');
  return { removed: snapshot.count };
}

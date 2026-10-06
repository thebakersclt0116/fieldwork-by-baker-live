export const EMILY_RESET_EMAIL = 'ayalaemily52@gmail.com';
export const EMILY_RESET_ID = 'ripley-clean-import-v1';
export interface ResetStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface ResetReceipt { id: string; owner: string; state: 'prepared' | 'completed'; createdAt: string; count: number; backupName: string }
const normalize = (email: string) => email.trim().toLowerCase();
export function resetReceiptKey(email: string): string { return `fieldworkByBaker:reset:${EMILY_RESET_ID}:${normalize(email)}`; }
export function readEmilyReset(storage: ResetStorage, email: string): ResetReceipt | null {
  const raw = storage.getItem(resetReceiptKey(email));
  if (!raw) return null;
  let receipt: ResetReceipt;
  try { receipt = JSON.parse(raw); } catch { throw new Error('The prior reset receipt cannot be read. No records will be removed.'); }
  if (receipt.id !== EMILY_RESET_ID || receipt.owner !== normalize(email) || !['prepared', 'completed'].includes(receipt.state)) throw new Error('The prior reset receipt is invalid. No records will be removed.');
  return receipt;
}
/** Called only after Emily confirms on her own device. Never runs on page load. */
export async function resetEmilyTrackedHours(args: {
  storage: ResetStorage;
  email: string;
  currentEmail: () => string | null;
  backup: (data: { format: string; owner: string; createdAt: string; entries: unknown[] }, name: string) => Promise<void>;
  now?: string;
}): Promise<ResetReceipt> {
  const { storage } = args, email = normalize(args.email);
  const checkAccount = () => { if (email !== EMILY_RESET_EMAIL || normalize(args.currentEmail() || '') !== email) throw new Error('This reset is only available while signed into Emily’s account on this device.'); };
  checkAccount();
  const prior = readEmilyReset(storage, email);
  if (prior?.state === 'completed') return prior; // New imports survive every subsequent visit/retry.
  if (prior) throw new Error('A reset was already started. Do not retry automatically: check the preserved backup and current records first.');
  const entryKey = `fieldworkByBaker:v1:${email}:entries`;
  const original = storage.getItem(entryKey);
  let entries: unknown[];
  try { entries = original ? JSON.parse(original) : []; } catch { throw new Error('Existing hours are unreadable. No records were removed.'); }
  if (!Array.isArray(entries)) throw new Error('Existing hours are not a valid entry list. No records were removed.');
  const now = args.now || new Date().toISOString(), backupName = `emily-before-ripley-reset-${now.replace(/[:.]/g, '-')}.json`;
  // The archive function must complete its write and readback before any tracked-hour mutation.
  await args.backup({ format: 'baker-reset-backup-v1', owner: email, createdAt: now, entries }, backupName);
  checkAccount();
  if (storage.getItem(entryKey) !== original) throw new Error('Hours changed while the backup was being created. Nothing was cleared; review and retry.');
  const receipt: ResetReceipt = { id: EMILY_RESET_ID, owner: email, state: 'prepared', createdAt: now, count: entries.length, backupName };
  storage.setItem(resetReceiptKey(email), JSON.stringify(receipt));
  if (storage.getItem(resetReceiptKey(email)) !== JSON.stringify(receipt)) throw new Error('Reset receipt could not be verified. No tracked hours were removed.');
  storage.removeItem(entryKey); // Deliberately never localStorage.clear(), supervisors, account, documents, or another user.
  if (storage.getItem(entryKey) !== null) throw new Error('Hours could not be cleared. Original backup is preserved.');
  const completed: ResetReceipt = { ...receipt, state: 'completed' };
  storage.setItem(resetReceiptKey(email), JSON.stringify(completed));
  if (storage.getItem(resetReceiptKey(email)) !== JSON.stringify(completed)) throw new Error('Hours cleared, but final receipt could not be confirmed. Do not repeat; use the backup and review the empty tracker.');
  return completed;
}

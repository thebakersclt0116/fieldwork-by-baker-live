/** Legacy unscoped data remains untouched for explicit owner-confirmed recovery. */
export function accountStorageKey(key: string, storage: Pick<Storage, 'getItem'> = localStorage): string {
  let email = '';
  try { email = String(JSON.parse(storage.getItem('authUser') || '{}').email || '').trim().toLowerCase(); } catch { /* fail closed */ }
  if (!email) throw new Error('Sign in before accessing saved learning data.');
  return `${key}:account:${encodeURIComponent(email)}`;
}
export const accountStorage = {
  getItem(key: string): string | null { return localStorage.getItem(accountStorageKey(key)); },
  setItem(key: string, value: string): void { localStorage.setItem(accountStorageKey(key), value); },
  removeItem(key: string): void { localStorage.removeItem(accountStorageKey(key)); },
};

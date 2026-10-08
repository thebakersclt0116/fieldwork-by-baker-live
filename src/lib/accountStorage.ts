import { managedEmail, cloudKey, learningKinds, queueLearning } from './cloudWorkspace.ts';
/** Legacy unscoped data remains untouched for explicit owner-confirmed recovery. */
export function accountStorageKey(key: string, storage: Pick<Storage, 'getItem'> = localStorage): string {
  let email = '';
  try { email = String(JSON.parse(storage.getItem('authUser') || '{}').email || '').trim().toLowerCase(); } catch { /* fail closed */ }
  if (!email) throw new Error('Sign in before accessing saved learning data.');
  if (typeof localStorage !== 'undefined' && storage === localStorage && managedEmail() === email) return cloudKey(key,email);
  return `${key}:account:${encodeURIComponent(email)}`;
}
export const accountStorage = {
  getItem(key: string): string | null { return localStorage.getItem(accountStorageKey(key)); },
  setItem(key: string, value: string): void {
    if (managedEmail() && learningKinds[key]) queueLearning(learningKinds[key],JSON.parse(value));
    localStorage.setItem(accountStorageKey(key), value);
  },
  removeItem(key: string): void {
    if (managedEmail() && learningKinds[key]) queueLearning(learningKinds[key],null);
    localStorage.removeItem(accountStorageKey(key));
  },
};

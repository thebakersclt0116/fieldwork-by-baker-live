import { accountStorage } from './accountStorage.ts';
import { cloudState, managedEmail, waitForCloudSave } from './cloudWorkspace.ts';
import { completeSetup, setupError, type FieldworkSetup } from '../../shared/fieldwork-profile.ts';
export { completeSetup, TRANSITION_SOURCE, ruleFor, yearsFor, trackLabel } from '../../shared/fieldwork-profile.ts';
export type { FieldworkSetup, ApplicationTiming, SavedOrganization, SavedSupervisor } from '../../shared/fieldwork-profile.ts';
export const FIELDWORK_PROFILE_KEY = 'fieldworkByBaker:pathProfile:v1';
export function profileDocument(): Record<string, unknown> {
  const raw = accountStorage.getItem(FIELDWORK_PROFILE_KEY);
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The saved profile needs review. Its original data has been retained.');
  return value;
}
export function loadFieldworkSetup(): FieldworkSetup | null {
  const value = profileDocument().fieldworkSetup;
  return completeSetup(value) ? value : null;
}
export async function saveFieldworkSetup(setup: FieldworkSetup, expected: string, email: string): Promise<void> {
  const error = setupError(setup); if (error) throw new Error(error);
  const currentEmail = () => { try { return String(JSON.parse(localStorage.getItem('authUser') || '{}').email || '').trim().toLowerCase(); } catch { return ''; } };
  if (!email || currentEmail() !== email.trim().toLowerCase()) throw new Error('Your account changed. Reopen your profile before saving.');
  if (managedEmail() && cloudState() !== 'saved') throw new Error('Wait for your account to finish loading/saving before updating the profile.');
  const document = profileDocument();
  if (JSON.stringify(document) !== expected) throw new Error('Your profile changed in another tab. Reload this page before saving so those edits are not overwritten.');
  // Preserve the existing study profile; do not rewrite entries, originals, approvals, organizations in past records, or billing.
  accountStorage.setItem(FIELDWORK_PROFILE_KEY, JSON.stringify({ ...document, fieldworkSetup: setup }));
  if (managedEmail()) await waitForCloudSave();
  if (currentEmail() !== email.trim().toLowerCase()) throw new Error('Your account changed before confirmation. Reopen the profile to check its status.');
  if (!completeSetup(loadFieldworkSetup())) throw new Error('Profile readback failed. Do not start tracking until saving is confirmed.');
  window.dispatchEvent(new Event('fieldwork:profile-changed'));
}

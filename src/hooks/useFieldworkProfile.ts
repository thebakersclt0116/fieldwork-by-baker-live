import { useMemo, useSyncExternalStore } from 'react';
import { accountStorage } from '@/lib/accountStorage';
import { subscribeCloud } from '@/lib/cloudWorkspace';
import { FIELDWORK_PROFILE_KEY, completeSetup, type FieldworkSetup } from '@/lib/fieldworkProfile';
function snapshot() { try { return accountStorage.getItem(FIELDWORK_PROFILE_KEY) || ''; } catch { return ''; } }
function subscribe(notify: () => void) {
  const off = subscribeCloud(notify);
  window.addEventListener('storage',notify); window.addEventListener('fieldwork:profile-changed',notify);
  return () => { off(); window.removeEventListener('storage',notify); window.removeEventListener('fieldwork:profile-changed',notify); };
}
export function useFieldworkProfile(): FieldworkSetup | null {
  const raw = useSyncExternalStore(subscribe,snapshot,() => '');
  return useMemo(() => { try { const value = JSON.parse(raw || '{}').fieldworkSetup; return completeSetup(value) ? value : null; } catch { return null; } },[raw]);
}

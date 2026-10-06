import { useEffect, useState } from 'react';
import type { HourEntry } from '../types';
import { loadEntries } from '../lib/fieldworkStore';

/** Refresh saved records without remounting forms or discarding unfinished input. */
export function useFieldworkEntries<T extends HourEntry = HourEntry>(email: string) {
  const [entries, setEntries] = useState<T[]>(() => loadEntries(email) as T[]);
  useEffect(() => {
    const refresh = () => setEntries(loadEntries(email) as T[]);
    refresh();
    window.addEventListener('fieldwork:entries-changed', refresh);
    window.addEventListener('fieldwork:local-records-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('fieldwork:entries-changed', refresh);
      window.removeEventListener('fieldwork:local-records-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [email]);
  return [entries, setEntries] as const;
}

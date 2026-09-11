import type { ActivityType, EntryStatus, FieldworkType, HourEntry } from '@/types';

export const EMILY_EMAIL = 'ayalaemily52@gmail.com';
const PREFIX = 'fieldworkByBaker:v1';

export interface StoredSupervisor {
  id: string;
  name: string;
  email?: string;
  bacbNumber?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function storageKey(email: string, kind: 'entries' | 'supervisors'): string {
  return `${PREFIX}:${normalizeEmail(email)}:${kind}`;
}

export function getCurrentUserEmail(): string | null {
  try {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed.email ? normalizeEmail(parsed.email) : null;
  } catch {
    return null;
  }
}

export function isEmilyAccount(): boolean {
  return getCurrentUserEmail() === EMILY_EMAIL;
}

export function loadEntries(email = getCurrentUserEmail() || ''): HourEntry[] {
  if (!email) return [];
  try {
    const raw = localStorage.getItem(storageKey(email, 'entries'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HourEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: HourEntry[], email = getCurrentUserEmail() || ''): void {
  if (!email) return;
  localStorage.setItem(storageKey(email, 'entries'), JSON.stringify(entries));
}

export function appendEntries(incoming: HourEntry[], email = getCurrentUserEmail() || ''): HourEntry[] {
  const existing = loadEntries(email);
  const seen = new Set(
    existing.map((entry) =>
      [entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|')
    )
  );
  const additions = incoming.filter((entry) => {
    const signature = [entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
  const merged = [...existing, ...additions].sort((a, b) =>
    `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)
  );
  saveEntries(merged, email);
  return merged;
}

export function addEntry(entry: HourEntry, email = getCurrentUserEmail() || ''): HourEntry[] {
  return appendEntries([entry], email);
}

export function clearEntries(email = getCurrentUserEmail() || ''): void {
  if (!email) return;
  localStorage.removeItem(storageKey(email, 'entries'));
}

export function loadSupervisors(email = getCurrentUserEmail() || ''): StoredSupervisor[] {
  if (!email) return [];
  try {
    const raw = localStorage.getItem(storageKey(email, 'supervisors'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSupervisor[]) : [];
  } catch {
    return [];
  }
}

export function saveSupervisors(supervisors: StoredSupervisor[], email = getCurrentUserEmail() || ''): void {
  if (!email) return;
  localStorage.setItem(storageKey(email, 'supervisors'), JSON.stringify(supervisors));
}

export function newId(prefix = 'entry'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeDate(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const usMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeTime(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFour && !/[ap]m/i.test(raw)) {
    return `${twentyFour[1].padStart(2, '0')}:${twentyFour[2]}`;
  }
  const twelve = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (!twelve) return raw;
  let hour = Number(twelve[1]) % 12;
  if (twelve[3].toLowerCase() === 'pm') hour += 12;
  return `${String(hour).padStart(2, '0')}:${twelve[2] || '00'}`;
}

export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  const result = eh + em / 60 - (sh + sm / 60);
  return result > 0 ? Math.round(result * 100) / 100 : 0;
}

export function inferFieldworkType(value: string): FieldworkType {
  return value.toLowerCase().includes('concentrated') ? 'CONCENTRATED' : 'SUPERVISED';
}

export function inferCategory(value: string, activity = ''): 'RESTRICTED' | 'UNRESTRICTED' {
  const combined = `${value} ${activity}`.toLowerCase();
  if (combined.includes('unrestricted')) return 'UNRESTRICTED';
  if (combined.includes('restricted')) return 'RESTRICTED';
  if (combined.includes('direct therapy') || combined.includes('implementation')) return 'RESTRICTED';
  return 'UNRESTRICTED';
}

export function inferActivityType(activity: string, category: 'RESTRICTED' | 'UNRESTRICTED'): ActivityType {
  const value = activity.toLowerCase();
  if (category === 'RESTRICTED') return 'RESTRICTED_DIRECT';
  if (value.includes('assessment')) return 'UNRESTRICTED_ASSESSMENT';
  if (value.includes('behavior') || value.includes('program')) return 'UNRESTRICTED_BEHAVIOR_PLAN';
  if (value.includes('supervision') || value.includes('meeting')) return 'UNRESTRICTED_SUPERVISION';
  if (value.includes('training')) return 'UNRESTRICTED_TRAINING';
  return 'UNRESTRICTED_OTHER';
}

export function inferStatus(value: string): EntryStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes('verified') || normalized.includes('approved')) return 'VERIFIED';
  if (normalized.includes('reject')) return 'REJECTED';
  if (normalized.includes('draft')) return 'DRAFT';
  return 'PENDING';
}

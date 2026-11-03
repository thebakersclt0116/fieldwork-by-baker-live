import type { HourEntry } from '@/types';
import { summarizeMonth } from './monthlyProgress.ts';

export function isTrackedMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function entriesForMonth(entries: HourEntry[], month: string): HourEntry[] {
  if (!isTrackedMonth(month)) return [];
  return entries.filter(entry => entry.date.slice(0, 7) === month).sort((a, b) =>
    `${b.date}T${b.startTime || ''}`.localeCompare(`${a.date}T${a.startTime || ''}`) || a.id.localeCompare(b.id));
}

export function loggedMonths(entries: HourEntry[]) {
  const keys = [...new Set(entries.map(entry => entry.date.slice(0, 7)).filter(isTrackedMonth))].sort().reverse();
  return keys.map(month => {
    const records = entriesForMonth(entries, month);
    const completed = summarizeMonth(records, month);
    return { month, entries: records, totalHours: completed.totalHours, incompleteCount: records.length - completed.sessions.length };
  });
}

// Retain exact stored durations; round only the final displayed total.
export function loggedHoursLabel(hours: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(hours);
}

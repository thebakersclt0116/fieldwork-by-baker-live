import type { HourEntry } from '@/types';

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function summarizeMonth(entries: HourEntry[], month: string) {
  const sessions = entries.filter(entry => entry.date.slice(0, 7) === month);
  const totalHours = sessions.reduce((sum, entry) => sum + entry.duration, 0);
  const supervisedHours = sessions.reduce((sum, entry) => sum + (entry.supervisionMinutes || 0) / 60, 0);
  const individualHours = sessions.reduce((sum, entry) => sum + (entry.individualSupervisionMinutes ?? (entry.supervisionFormat === 'INDIVIDUAL' ? entry.supervisionMinutes || 0 : 0)) / 60, 0);
  const unknownSupervisionHours = sessions.reduce((sum, entry) => sum + (typeof entry.individualSupervisionMinutes !== 'number' && !entry.supervisionFormat ? entry.supervisionMinutes || 0 : 0) / 60, 0);
  const categoryHours = (category: string) => sessions.filter(entry => entry.activityCategory === category).reduce((sum, entry) => sum + entry.duration, 0);
  return { month, sessions, totalHours, supervisedHours, individualHours, unknownSupervisionHours,
    independentHours: totalHours - supervisedHours,
    restrictedHours: categoryHours('RESTRICTED'), unrestrictedHours: categoryHours('UNRESTRICTED'),
    unknownHours: sessions.filter(entry => !['RESTRICTED', 'UNRESTRICTED'].includes(entry.activityCategory)).reduce((sum, entry) => sum + entry.duration, 0),
    organizations: [...new Set(sessions.map(entry => entry.organizationName || entry.setting || 'Organization not specified'))],
  };
}

export function trackedMonthKeys(entries: HourEntry[], now = new Date()): string[] {
  return [...new Set([currentMonthKey(now), ...entries.map(entry => entry.date.slice(0, 7)).filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))])].sort().reverse();
}

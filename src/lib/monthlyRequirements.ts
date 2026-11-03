import type { HourEntry } from '@/types';
import { summarizeMonth } from './monthlyProgress';

export type MonthlyRequirement = { label: string; met: boolean; detail: string };
export type MonthlyStatus = 'Meeting Monthly Requirements' | 'Not Meeting Monthly Requirements' | 'Not Started';
const hours = (value: number) => `${Math.max(0, value).toFixed(2)} hours`;
const minutes = (value: number) => `${Math.ceil(Math.max(0, value) - 1e-8)} minutes`;

/** Applies the 2027 BCBA monthly numeric thresholds, not final eligibility or sign-off. */
export function monthlyRequirements(entries: HourEntry[], month: string) {
  const summary = summarizeMonth(entries, month);
  const records = entries.filter(item => item.date.slice(0, 7) === month);
  const concentrated = summary.sessions.some(item => item.fieldworkType === 'CONCENTRATED');
  const mixed = summary.sessions.some(item => item.fieldworkType !== (concentrated ? 'CONCENTRATED' : 'SUPERVISED'));
  const supervisionRate = concentrated ? 0.075 : 0.05;
  const observationTarget = concentrated ? 90 : 60;
  const total = summary.totalHours;
  const supervisionMinutes = summary.sessions.reduce((sum, item) => sum + (item.supervisionMinutes || 0), 0);
  const individualMinutes = summary.sessions.reduce((sum, item) => sum + (item.individualSupervisionMinutes ?? (item.supervisionFormat === 'INDIVIDUAL' ? item.supervisionMinutes || 0 : 0)), 0);
  const unknownFormatMinutes = summary.sessions.reduce((sum, item) => sum + ((item.supervisionMinutes || 0) > 0 && item.individualSupervisionMinutes == null && !item.supervisionFormat ? item.supervisionMinutes || 0 : 0), 0);
  const observedMinutes = summary.sessions.reduce((sum, item) => sum + (item.observationMinutes || 0), 0);
  const minimumSupervisionMinutes = total * supervisionRate * 60;
  const items: MonthlyRequirement[] = [
    { label: 'Minimum 20 total hours', met: total >= 20, detail: total >= 20 ? `${hours(total)} logged` : `${hours(20 - total)} still needed` },
    { label: 'Maximum 160 total hours', met: total <= 160, detail: total <= 160 ? `${hours(160 - total)} available before the maximum` : `${hours(total - 160)} over the limit` },
    { label: `Minimum ${supervisionRate * 100}% supervision`, met: supervisionMinutes + 1e-7 >= minimumSupervisionMinutes, detail: supervisionMinutes + 1e-7 >= minimumSupervisionMinutes ? `${minutes(supervisionMinutes)} logged` : `${minutes(minimumSupervisionMinutes - supervisionMinutes)} additional supervision needed at current total` },
    { label: 'At least 50% individual supervision', met: supervisionMinutes > 0 && unknownFormatMinutes === 0 && individualMinutes * 2 + 1e-7 >= supervisionMinutes, detail: unknownFormatMinutes ? `${minutes(unknownFormatMinutes)} of supervision needs a format` : individualMinutes * 2 + 1e-7 >= supervisionMinutes && supervisionMinutes > 0 ? `${minutes(individualMinutes)} individual supervision recorded` : `${minutes(supervisionMinutes / 2 - individualMinutes)} more individual supervision needed at current total` },
    { label: `Minimum ${observationTarget} observation minutes`, met: observedMinutes >= observationTarget, detail: observedMinutes >= observationTarget ? `${minutes(observedMinutes)} recorded` : `${minutes(observationTarget - observedMinutes)} still needed` },
    { label: 'Complete entry details', met: records.length === summary.sessions.length, detail: records.length === summary.sessions.length ? 'All recorded entries have details' : `${records.length - summary.sessions.length} entries need details` },
    { label: 'Consistent fieldwork type', met: !mixed, detail: mixed ? 'Review mixed standard and concentrated records' : concentrated ? 'Concentrated supervised fieldwork' : 'Supervised fieldwork' },
  ];
  const status: MonthlyStatus = records.length === 0 ? 'Not Started' : items.every(item => item.met) ? 'Meeting Monthly Requirements' : 'Not Meeting Monthly Requirements';
  return { ...summary, items, concentrated, observationMinutes: observedMinutes, status };
}

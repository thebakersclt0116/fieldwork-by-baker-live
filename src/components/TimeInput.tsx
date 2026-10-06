import { useSyncExternalStore } from 'react';
import { getTimeFormat, subscribeTimeFormat } from '@/lib/timeDisplay';

export default function TimeInput({ value, onChange, className = '', label = 'Time' }: { value: string; onChange: (value: string) => void; className?: string; label?: string }) {
  const format = useSyncExternalStore(subscribeTimeFormat, getTimeFormat, () => '12');
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText || 0), minute = minuteText || '00';
  const change = (nextHour: number, nextMinute: string) => onChange(`${String(nextHour).padStart(2, '0')}:${nextMinute}`);
  return <span role="group" aria-label={label} className="mt-1 flex min-w-0 gap-1">
    <select aria-label={`${label} hour`} value={value ? format === '24' ? hour : hour % 12 || 12 : ''} onChange={event => { if (!event.target.value) return onChange(''); change(format === '24' ? Number(event.target.value) : Number(event.target.value) % 12 + (hour >= 12 ? 12 : 0), minute); }} className={`${className} min-w-0 flex-1 px-2`}>
      <option value="">Hour</option>{Array.from({ length: format === '24' ? 24 : 12 }, (_, index) => <option key={index} value={format === '24' ? index : index + 1}>{format === '24' ? String(index).padStart(2, '0') : index + 1}</option>)}
    </select>
    <select aria-label={`${label} minute`} value={minute} onChange={event => change(hour, event.target.value)} className={`${className} min-w-0 flex-1 px-2`}>
      {Array.from({ length: 60 }, (_, index) => <option key={index} value={String(index).padStart(2, '0')}>{String(index).padStart(2, '0')}</option>)}
    </select>
    {format === '12' && <select aria-label={`${label} AM or PM`} value={hour >= 12 ? 'PM' : 'AM'} onChange={event => change(hour % 12 + (event.target.value === 'PM' ? 12 : 0), minute)} className={`${className} min-w-0 flex-1 px-2`}><option>AM</option><option>PM</option></select>}
  </span>;
}

export type TimeFormat = '12' | '24';
function preferenceKey() {
  try {
    const email = JSON.parse(localStorage.getItem('authUser') || '{}').email;
    return typeof email === 'string' && email ? `fieldwork:time-format:${encodeURIComponent(email.trim().toLowerCase())}` : null;
  } catch { return null; }
}
export function getTimeFormat(): TimeFormat {
  try { const key = preferenceKey(); return key && localStorage.getItem(key) === '24' ? '24' : '12'; } catch { return '12'; }
}
export function setTimeFormat(value: TimeFormat) {
  const key = preferenceKey();
  if (!key) throw new Error('Sign in to save your display preferences.');
  localStorage.setItem(key, value);
  window.dispatchEvent(new Event('fieldwork:time-format-changed'));
}
export function subscribeTimeFormat(listener: () => void) {
  window.addEventListener('fieldwork:time-format-changed', listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener('fieldwork:time-format-changed', listener); window.removeEventListener('storage', listener); };
}
export function formatTime(value: string | undefined, format: TimeFormat = getTimeFormat()) {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i.exec(value.trim());
  if (!match) return value;
  let hour = Number(match[1]); const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return value;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  if (format === '24') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

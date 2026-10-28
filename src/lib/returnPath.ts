const RETURN_ORIGIN = 'https://fieldwork.invalid';
const ACCOUNT_ROUTES = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);

export function safeReturnPath(value: string | null, fallback = '/dashboard'): string {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return fallback;
  try {
    const destination = new URL(value, RETURN_ORIGIN);
    if (destination.origin !== RETURN_ORIGIN || destination.pathname.startsWith('//') || ACCOUNT_ROUTES.has(destination.pathname.replace(/\/+$/, ''))) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return fallback;
  }
}

export function accountEntryPath(route: '/login' | '/signup', destination: string): string {
  return route + '?return=' + encodeURIComponent(safeReturnPath(destination));
}

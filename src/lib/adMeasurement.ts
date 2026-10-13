const STORAGE_KEY = 'baker-ad-measurement-v1';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export type AdChoice = { allowed: boolean; decidedAt: number; version?: 'ads-v2'; visitorId?: string; fbc?: string };
function privacySignal(): boolean { return typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true; }
export function readAdChoice(): AdChoice | null {
  if (privacySignal()) return { allowed: false, decidedAt: Date.now(), version: 'ads-v2' };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value.allowed !== 'boolean' || !Number.isSafeInteger(value.decidedAt) || value.decidedAt > Date.now() || Date.now() - value.decidedAt > MAX_AGE) return null;
    // Never reverse an earlier refusal. An old permission covered first-payment measurement only;
    // the expanded signup funnel needs a new, explicit choice.
    if (value.allowed === false) return { allowed: false, decidedAt: value.decidedAt, version: 'ads-v2' };
    if (value.version !== 'ads-v2' || typeof value.visitorId !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.visitorId)) return null;
    return value;
  } catch { return null; }
}
export function saveAdChoice(allowed: boolean) {
  const choice: AdChoice = { allowed: allowed && !privacySignal(), decidedAt: Date.now(), version: 'ads-v2' };
  if (choice.allowed) {
    choice.visitorId = crypto.randomUUID();
    const click = new URLSearchParams(location.search).get('fbclid');
    if (click && /^[A-Za-z0-9_-]{8,200}$/.test(click)) choice.fbc = `fb.1.${Date.now()}.${click}`;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); } catch { /* Unavailable storage means no optional measurement. */ }
  window.dispatchEvent(new Event('baker-ad-choice'));
}
export function captureAdClick() {
  const choice = readAdChoice();
  const click = new URLSearchParams(location.search).get('fbclid');
  if (!choice?.allowed || !click || !/^[A-Za-z0-9_-]{8,200}$/.test(click)) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...choice, fbc: `fb.1.${Date.now()}.${click}` })); } catch { /* No persistence means no attribution. */ }
}
export function checkoutAdMeasurement() {
  const choice = readAdChoice();
  if (!choice?.allowed || !choice.visitorId || choice.version !== 'ads-v2') return undefined;
  return { consent: 'ads-v2', consentAt: choice.decidedAt, visitorId: choice.visitorId, ...(choice.fbc ? { fbc: choice.fbc } : {}) };
}

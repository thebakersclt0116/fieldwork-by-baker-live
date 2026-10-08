const STORAGE_KEY = 'baker-ad-measurement-v1';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export type AdChoice = { allowed: boolean; decidedAt: number; visitorId?: string; fbc?: string };
export function readAdChoice(): AdChoice | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value.allowed !== 'boolean' || !Number.isFinite(value.decidedAt) || Date.now() - value.decidedAt > MAX_AGE) return null;
    return value;
  } catch { return null; }
}
export function saveAdChoice(allowed: boolean) {
  const choice: AdChoice = { allowed, decidedAt: Date.now() };
  if (allowed) {
    choice.visitorId = crypto.randomUUID();
    const click = new URLSearchParams(location.search).get('fbclid');
    if (click && /^[A-Za-z0-9_-]{8,1024}$/.test(click)) choice.fbc = `fb.1.${Date.now()}.${click}`;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); } catch { /* Storage unavailable: no optional measurement. */ }
  window.dispatchEvent(new Event('baker-ad-choice'));
}
export function captureAdClick() {
  const choice = readAdChoice();
  const click = new URLSearchParams(location.search).get('fbclid');
  if (!choice?.allowed || !click || !/^[A-Za-z0-9_-]{8,1024}$/.test(click)) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...choice, fbc: `fb.1.${Date.now()}.${click}` })); } catch { /* No persistence means no attribution. */ }
}
export function checkoutAdMeasurement() {
  const choice = readAdChoice();
  if (!choice?.allowed || !choice.visitorId) return undefined;
  return { consent: 'ads-v1', consentAt: choice.decidedAt, visitorId: choice.visitorId, ...(choice.fbc ? { fbc: choice.fbc } : {}) };
}

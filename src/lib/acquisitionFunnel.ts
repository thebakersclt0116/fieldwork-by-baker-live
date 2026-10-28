import { checkoutAdMeasurement, readAdChoice } from './adMeasurement';
export const ACQUISITION_CAMPAIGN = '120251729153710531';
export type AcquisitionContext = { version: 'funnel-v1'; flowId: string; campaign: string; variant: 'home' | 'signup' | 'direct'; qa: boolean };
const CONTEXT_KEY = 'baker-acquisition-journey-v1';
const ASSIGNMENT_KEY = 'baker-signup-destination-test-v1';
const FORWARDED_QUERY_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'bf_campaign', 'bf_experiment', 'bf_variant', 'bf_qa'] as const;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function privacySignal() { return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true; }
// Keep inbound acquisition fields in local links. This does not read/write storage or send measurement.
export function withAcquisitionQuery(destination: string, sourceSearch: string): string {
  if (!destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\')) return destination;
  const target = new URL(destination, 'https://fieldwork.invalid');
  if (target.origin !== 'https://fieldwork.invalid' || target.pathname.startsWith('//')) return destination;
  const source = new URLSearchParams(sourceSearch);
  for (const key of FORWARDED_QUERY_KEYS) {
    const value = source.get(key);
    if (value && value.length <= 1024 && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  return target.pathname + target.search + target.hash;
}
export function acquisitionContext(allowAttribution = true): AcquisitionContext {
  const query = new URLSearchParams(window.location.search);
  const variant = query.get('bf_variant');
  const attributed = allowAttribution && query.get('bf_campaign') === ACQUISITION_CAMPAIGN && query.get('bf_experiment') === 'signup-v1' && (variant === 'home' || variant === 'signup');
  let qa = query.get('bf_qa') === '1';
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || 'null');
    qa = qa || stored?.qa === true;
    const knownJourney = stored?.campaign === 'direct' && stored.variant === 'direct' || stored?.campaign === ACQUISITION_CAMPAIGN && ['home', 'signup'].includes(stored.variant);
    if (stored?.version === 'funnel-v1' && validId(stored.flowId) && typeof stored.qa === 'boolean' && knownJourney) {
      // An explicitly tagged ad can replace an earlier organic journey. Internal navigation
      // reuses an attributed journey, retaining its arm and event IDs instead of recounting it.
      if (!attributed || stored.campaign === ACQUISITION_CAMPAIGN) {
        if (qa === stored.qa) return stored;
        const context = { ...stored, qa } as AcquisitionContext;
        sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
        return context;
      }
    }
  } catch { /* Functional routing also works without browser storage. */ }
  const context: AcquisitionContext = { version: 'funnel-v1', flowId: crypto.randomUUID(), campaign: attributed ? ACQUISITION_CAMPAIGN : 'direct', variant: attributed ? variant : 'direct', qa };
  try { sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context)); } catch { /* Never block navigation or signup. */ }
  return context;
}
export function acquisitionDestination(): string {
  let variant: 'home' | 'signup' = 'signup';
  try {
    const previous = sessionStorage.getItem(ASSIGNMENT_KEY);
    variant = previous === 'home' || previous === 'signup' ? previous : crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? 'home' : 'signup';
    sessionStorage.setItem(ASSIGNMENT_KEY, variant);
    // Acquisition context is resolved after consent or account creation. The tagged
    // destination can replace an organic journey without clearing its QA protection.
  } catch { /* The signup experience is the safe fallback. */ }
  const query = new URLSearchParams();
  const source = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid']) {
    const value = source.get(key); if (value && value.length <= 1024) query.set(key, value);
  }
  query.set('bf_campaign', ACQUISITION_CAMPAIGN); query.set('bf_experiment', 'signup-v1'); query.set('bf_variant', variant);
  if (source.get('bf_qa') === '1') query.set('bf_qa', '1');
  return (variant === 'home' ? '/' : '/signup') + '?' + query;
}
export function accountFunnelInput() {
  const allowed = !privacySignal() && readAdChoice()?.allowed === true;
  const context = acquisitionContext(allowed);
  // An optional advertising choice is not a condition of account creation.
  return { funnel: allowed ? context : { ...context, campaign: 'direct', variant: 'direct' as const }, adMeasurement: allowed ? checkoutAdMeasurement() : undefined };
}
const pending = new Set<string>();
export async function measurePublicLanding(path: '/' | '/signup'): Promise<void> {
  if (privacySignal() || readAdChoice()?.allowed !== true) return;
  const context = acquisitionContext(), key = 'baker-landing-received:' + context.flowId;
  try { if (sessionStorage.getItem(key) === 'yes') return; } catch { /* Server event IDs deduplicate retries. */ }
  if (pending.has(key)) return; pending.add(key);
  try {
    const response = await fetch('/api/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ stage: 'landing_page_loaded', context, path, adMeasurement: checkoutAdMeasurement() }) });
    const result = await response.json();
    if (response.ok && result.recorded === true) { try { sessionStorage.setItem(key, 'yes'); } catch { /* Nothing required for product use. */ } }
  } catch { /* Measurement failure must not interrupt the form. A later visibility/consent change retries. */ }
  finally { pending.delete(key); }
}

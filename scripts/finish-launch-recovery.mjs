import fs from 'node:fs';
function change(path, before, after) { const c = fs.readFileSync(path,'utf8'); if(c.includes(after))return; if(!c.includes(before))throw new Error('Reviewed source changed: '+path); fs.writeFileSync(path,c.replace(before,after)); }
const billing='src/pages/Upgrade.tsx';
change(billing,"  const [error, setError] = useState('');","  const [error, setError] = useState('');\n  const [billingEnabled, setBillingEnabled] = useState(false);");
change(billing,"stripeMode?: string }) => {","stripeMode?: string; liveBillingEnabled?: boolean }) => {");
change(billing,"        if (!active) return;","        if (!active) return;\n        setBillingEnabled(payload.liveBillingEnabled === true && payload.stripeMode === 'live');");
change(billing,"  const startCheckout = async (plan: PlanId) => {","  const startCheckout = async (plan: PlanId) => {\n    if (!billingEnabled) { setError('Paid checkout is paused while the account and billing backend is connected. No payment has been created.'); return; }");
change(billing,"Stripe is connected in TEST MODE. Checkout is safe to test, but it will not create real production charges until a live Stripe secret key is installed.","Stripe is connected in TEST MODE. Public checkout is disabled; test payments cannot unlock production access.");
change(billing,'        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">','        {!billingEnabled && <div role="status" className="mx-auto mb-6 max-w-3xl rounded-2xl border border-[#F1D8B9] bg-[#FFF9F2] p-4 text-center text-sm text-[#8A5D36] dark:border-amber-500/30 dark:bg-amber-900/15 dark:text-amber-100"><strong>Paid checkout is temporarily paused.</strong> The launch prices are reserved below. We are connecting durable accounts and subscription renewal/cancellation handling before accepting payments. No card is charged while checkout is paused. <a href="/audit-history" className="font-semibold underline">Your existing local audit records and downloads remain accessible.</a></div>}\n\n        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">');
change(billing,'disabled={Boolean(loadingPlan) || isOwner || (hasPaidFeatures && !activeTrial)}','disabled={!billingEnabled || Boolean(loadingPlan) || isOwner || (hasPaidFeatures && !activeTrial)}');
change(billing,": isOwner ? 'Owner unlocked' : activeTrial",": isOwner ? 'Owner unlocked' : !billingEnabled ? 'Checkout reopening soon' : activeTrial");
// Never trust origin headers for a payment redirect, even on the isolated preview path.
const checkout='api/create-checkout-session.ts';
let source=fs.readFileSync(checkout,'utf8');
const start=source.indexOf('function originFor(req: any): string {'), end=source.indexOf('\nexport default async function handler',start);
if(start<0||end<start)throw new Error('Payment redirect function changed.');
source=source.slice(0,start)+`function originFor(_req: any): string {
  const canonical = 'https://www.fieldworkbybaker.com';
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL && /^[a-zA-Z0-9.-]+\\.vercel\\.app$/.test(process.env.VERCEL_URL)) return 'https://' + process.env.VERCEL_URL;
  const configured = process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL;
  if (!configured) return canonical;
  try { const url = new URL(configured); return url.origin === canonical ? canonical : canonical; } catch { return canonical; }
}
`+source.slice(end);
fs.writeFileSync(checkout,source);
// No raw downstream errors should be printed from the remaining fieldwork-only path.
change('api/_gateway.ts',"    console.error('Unable to retrieve Vercel OIDC token', error);","    console.error('Unable to retrieve Vercel OIDC token', { code: 'OIDC_TOKEN_UNAVAILABLE' });");
change('api/_gateway.ts','  } catch (error) {','  } catch {');
// Prevent fake model responses from supplying undefined text/actions to the UI.
const brain='server/baker-brain-safe.ts';
change(brain,"parsed.actions.filter((action: any) => allowedRoutes.has(String(action?.href))).slice(0, 6)","parsed.actions.filter((action: any) => action && typeof action.label === 'string' && typeof action.reason === 'string' && allowedRoutes.has(String(action.href))).slice(0, 6)");
console.log('Recovery UX and billing guards finalized. No live payment or source record was changed.');

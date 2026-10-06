import fs from 'node:fs';
function change(path, before, after) { const source = fs.readFileSync(path, 'utf8'); if (source.includes(after)) return; if (!source.includes(before)) throw new Error('Source changed; review instead of overwriting: '+path); fs.writeFileSync(path, source.replace(before, after)); }
function update(path, transform) { fs.writeFileSync(path, transform(fs.readFileSync(path, 'utf8'))); }
const brain = 'server/baker-brain-safe.ts';
change(brain, "const MODEL = 'openai/gpt-5.6-sol';", "import { AiGatewayError, requestStructuredGateway } from './ai-gateway-client.js';\n\nconst MODEL = 'openai/gpt-5.6-sol';");
change(brain, "  { label: 'Import', href: '/import', purpose: 'Import Ripley and other supported fieldwork records.' },", "  { label: 'Import', href: '/import', purpose: 'Import complete original session rows from supported detailed CSV/TSV/JSON exports. Monthly PDFs are supporting evidence, not detailed histories.' },\n  { label: 'Audit History', href: '/audit-history', purpose: 'Read individual narratives and original source fields; download the portable audit archive.' },");
change(brain, 'Your saved progress is safe.', 'Your existing local records are separate from this AI request; keep independent backups.');
change(brain, 'citations: fieldwork ? [OFFICIAL_SOURCES[1]] : [],', 'citations: fieldwork ? [OFFICIAL_SOURCES[3]] : [],');
change(brain, '- You cannot claim to click or change data yourself; actions are links the UI can present.', '- You cannot claim to click, save, migrate or change data yourself; actions are links the UI can present.\n- Existing fieldwork records and audit documents are currently browser-local, not cloud-backed. Never claim that backups, synchronization or audit acceptance have been verified. Original detailed session narratives cannot be reconstructed from monthly totals.');
update(brain, source => {
  const start = source.indexOf('function extractOutputText('), end = source.indexOf('export async function runBakerBrain(', start);
  if (start >= 0 && end > start) source = source.slice(0,start)+source.slice(end);
  const first = source.indexOf("  const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {");
  const last = source.indexOf('  const allowedRoutes = new Set(', first);
  if (first < 0 || last < first) { if(source.includes('requestStructuredGateway({'))return source; throw new Error('Baker Brain gateway block changed.'); }
  return source.slice(0,first)+`  const result = await requestStructuredGateway({
    token: args.gatewayToken, model: MODEL, instructions,
    input: \`USER CONTEXT:\\n\${JSON.stringify(args.context ?? {}).slice(0,12000)}\\n\\nRECENT CONVERSATION:\\n\${history || 'No previous messages.'}\\n\\nCURRENT USER MESSAGE:\\n\${args.message}\`,
    schemaName: 'baker_brain_response_v1', schema, feature: 'product:baker-brain,feature:launch-recovery',
  });
  const parsed = result.data as any;
  if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim() || parsed.answer.length > 32000 || !['TEACH','NAVIGATE','PLAN','QUIZ','RESOURCE','FIELDWORK','EXAM_COACH'].includes(parsed.mode)) throw new AiGatewayError('AI_INVALID_RESPONSE');
  if (parsed.artifact !== null && parsed.artifact !== undefined) {
    const a = parsed.artifact;
    if (typeof a !== 'object' || !['Lesson','Study guide','Flashcards','Quiz','Checklist','Study plan','Comparison sheet'].includes(a.type) || !['title','topic','summary'].every(k => typeof a[k] === 'string') || !Array.isArray(a.sections) || !a.sections.every((s: unknown) => typeof s === 'string')) throw new AiGatewayError('AI_INVALID_RESPONSE');
  }
`+source.slice(last);
});
change(brain, '.slice(-10)\n    .map((item)', ".filter((item) => item && typeof item === 'object')\n    .slice(-10)\n    .map((item)");
change(brain, '  return { ...parsed, provider: MODEL };', "  return { ...parsed, provider: MODEL, liveModelResponded: true, transport: result.transport }; ");
const api = 'api/baker-ai.ts';
change(api, "import { createBakerBrainFallback, runBakerBrain } from '../server/baker-brain-safe.js';", "import { createBakerBrainFallback, runBakerBrain } from '../server/baker-brain-safe.js';\nimport { safeAiFailure } from '../server/ai-gateway-client.js';");
change(api, "      status: 'ready',", "      status: gatewayToken ? 'configured' : 'unavailable',\n      liveModelVerified: false,\n      verification: 'A successful authenticated POST with liveModelResponded=true is required; GET only checks configuration.',");
change(api, "      version: 'baker-brain-v1-2026-09-14',", "      version: 'baker-brain-recovery-v2',");
change(api, "  if (mode === 'bcba-brain') {", "  if (mode === 'bcba-brain') {\n    if (session.role === 'supervisor') return send(res, 403, { error: 'Use the signed supervisor co-pilot for this invitation.', code: 'SUPERVISOR_SCOPE_REQUIRED' });");
change(api, "    if (!gatewayToken) return send(res, 503, { error: 'Baker Brain AI is temporarily unavailable.' });", "    if (!gatewayToken) return send(res, 503, { error: 'Baker Brain cannot authenticate with its AI service.', code: 'AI_AUTH_REQUIRED', liveModelResponded: false });");
change(api, "      console.error('Baker Brain request failed', error);\n      return send(res, 200, {\n        ...createBakerBrainFallback(message),\n        warning: 'The live Baker Brain model was temporarily unavailable. No user data was lost.',\n      });", "      const failure = safeAiFailure(error);\n      console.error('Baker Brain request failed', { code: failure.code, upstreamStatus: failure.upstreamStatus });\n      return send(res, 503, { ...createBakerBrainFallback(message), ...failure, status: 'degraded', provider: 'unavailable' });");
// Set private/no-store on AI responses so intermediaries never cache a user's answer.
change(api, "  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));", "  res.setHeader('Cache-Control', 'private, no-store');\n  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));");
const ui = 'src/pages/BakerBrainHub.tsx';
change(ui, "  provider?: string;", "  provider?: string;\n  liveModelResponded?: boolean;\n  code?: string;");
change(ui, "  const [status, setStatus] = useState('ONLINE');", "  const [status, setStatus] = useState('READY TO ASK');\n  const [retryQuestion, setRetryQuestion] = useState('');");
change(ui, "    setSavedArtifact('');\n\n    try {", "    setSavedArtifact('');\n    setRetryQuestion('');\n\n    try {");
change(ui, "        method: 'POST',\n        headers:", "        method: 'POST',\n        signal: AbortSignal.timeout(55000),\n        headers:");
change(ui, "      if (!response.ok || !payload.answer) throw new Error(payload.error || 'Baker Brain could not answer that.');", "      if (!response.ok || !payload.answer || payload.liveModelResponded !== true || !payload.provider?.startsWith('openai/')) throw new Error(payload.error || 'Baker Brain did not return a live model response. Please retry.');");
change(ui, "      setStatus('ONLINE');", "      setStatus('LIVE MODEL RESPONDED');");
change(ui, "      setStatus('RETRY');", "      setStatus('LIVE AI UNAVAILABLE');\n      setRetryQuestion(message);\n      setInput(message);");
change(ui, "          <main className=\"flex min-h-[calc(100dvh-104px)]", "          <main className=\"flex min-h-[calc(100dvh-104px)]");
change(ui, "            <header className=\"border-b border-white/10 px-5 py-4 sm:px-7\">", "            {retryQuestion && <div role=\"alert\" className=\"m-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100\">The live model did not complete this answer. Your question remains below. <button type=\"button\" disabled={isThinking} className=\"ml-2 font-bold underline disabled:opacity-50\" onClick={() => void send(retryQuestion)}>Retry question</button></div>}\n            <header className=\"border-b border-white/10 px-5 py-4 sm:px-7\">");
const admin = 'src/pages/AdminLaunchCheck.tsx';
change(admin, "as { answer?: string; provider?: string; error?: string }", "as { answer?: string; provider?: string; error?: string; liveModelResponded?: boolean }");
update(admin, source => source.replaceAll('response.ok && Boolean(payload.answer)', "response.ok && Boolean(payload.answer) && payload.liveModelResponded === true && Boolean(payload.provider?.startsWith('openai/'))").replace('detail: response.ok && payload.answer', "detail: response.ok && payload.answer && payload.liveModelResponded === true && payload.provider?.startsWith('openai/')"));
change(admin, "      next.push({\n        key: 'gateway',", "      next.push({ key: 'storage', label: 'Durable cloud records', state: 'fail', detail: 'The current entry and original-document stores are browser-local. Cloud accounts, document storage and verified backups must be connected before public paid launch.' });\n      next.push({ key: 'billing-lifecycle', label: 'Recurring subscription lifecycle', state: 'fail', detail: 'A live key alone is not sufficient. Durable customer identity, renewal/cancellation webhooks, and entitlement reconciliation must be connected before accepting live subscriptions.' });\n      next.push({\n        key: 'gateway',");
change(admin, "        method: 'POST',\n        headers:", "        method: 'POST',\n        signal: AbortSignal.timeout(55000),\n        headers:");
const main = 'src/main.tsx';
update(main, source => {
  const start=source.indexOf('function redirectToCanonicalHost(): boolean {'), end=source.indexOf('\nfunction storedReservedBetaEmail()',start);
  if(start<0 || end<start)throw new Error('Canonical routing source changed.');
  source=source.slice(0,start)+`function redirectToCanonicalHost(): boolean {
  // Keep the existing Vercel origin usable during a registrar/DNS outage. No credentials or local records are copied between origins.
  if (window.location.hostname === VERCEL_HOST) console.info('Baker recovery origin: browser records are isolated from the usual custom domain.');
  return false;
}
`+source.slice(end);
  return source.replace("const CANONICAL_HOST = 'www.fieldworkbybaker.com'\n",'');
});
change('src/components/Layout.tsx', '        {children}</main>', '        {window.location.hostname === \'fieldwork-by-baker-testing.vercel.app\' && <aside role="note" className="m-3 rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-900/20 dark:text-amber-100"><strong>Temporary recovery address.</strong> Your usual domain’s locally saved hours are not visible on this separate address. Do not clear browser data or re-import real hours here to compensate. This address is useful for diagnostics; return to <a className="underline" href="https://www.fieldworkbybaker.com">your usual Fieldwork site</a> once its domain is restored.</aside>}\n        {children}</main>');
// Prevent accidental test payments and unsafe live subscription sales before persistent billing exists.
change('api/create-checkout-session.ts', "  const origin = originFor(req);", "  const previewTest = process.env.VERCEL_ENV === 'preview' && process.env.BAKER_ALLOW_TEST_CHECKOUT === 'true';\n  if (!secret.startsWith('sk_live_') && !previewTest) return send(res, 503, { error: 'Live billing is not connected yet. No payment was created.', code: 'LIVE_BILLING_NOT_CONFIGURED' });\n  if (!previewTest) return send(res, 503, { error: 'Subscription billing is paused until durable accounts and renewal/cancellation processing are connected. No payment was created.', code: 'BILLING_BACKEND_REQUIRED' });\n\n  const origin = originFor(req);");
change('api/checkout-complete.ts', "  try {\n    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/", "  const previewTest = process.env.VERCEL_ENV === 'preview' && process.env.BAKER_ALLOW_TEST_CHECKOUT === 'true';\n  if (!secret.startsWith('sk_live_') && !previewTest) return send(res, 503, { error: 'Test payments cannot unlock production access.', code: 'LIVE_BILLING_NOT_CONFIGURED' });\n  if (!previewTest) return send(res, 503, { error: 'Durable subscription verification must be connected before live access is granted.', code: 'BILLING_BACKEND_REQUIRED' });\n\n  try {\n    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/");
change('api/checkout-complete.ts', "  id?: string;", "  id?: string;\n  livemode?: boolean;");
change('api/checkout-complete.ts', "    const paid = stripeSession.status === 'complete'", "    if (stripeSession.mode !== 'subscription' || stripeSession.livemode !== !previewTest) return send(res, 400, { error: 'Checkout mode does not match this deployment.', code: 'CHECKOUT_MODE_MISMATCH' });\n    const paid = stripeSession.status === 'complete'");
change('api/health.ts', "    stripeMode,", "    stripeMode,\n    storageMode: 'browser-local',\n    cloudStorageConnected: false,\n    liveBillingEnabled: false,\n    publicLaunchReady: false,\n    liveAiVerificationRequired: true,\n    recoveryVersion: 'launch-recovery-v1',");
console.log('Launch recovery patch applied. No user records, credentials or account data were modified.');

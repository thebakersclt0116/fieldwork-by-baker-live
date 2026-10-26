import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'fieldwork-usage-')), original = globalThis.fetch;
after(async () => { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); });
await build({ entryPoints: ['api/feature-usage.ts', 'server/feature-usage.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' } });
const { default: handler, usageRateAllowed } = await import(pathToFileURL(join(dir, 'api/feature-usage.mjs')));
const { usageIdentity, usageEventId, summarizeUsage, readUsageSummary, recordUsageEvent } = await import(pathToFileURL(join(dir, 'server/feature-usage.mjs')));
process.env.SUPABASE_URL = 'https://fictional.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fictional'; process.env.SUPABASE_SECRET_KEY = 'sb_secret_fictional'; process.env.BAKER_SESSION_SECRET = 'synthetic-only-usage-signing-secret-at-least-32'; process.env.VERCEL_ENV = 'production';
const actor = '11111111-1111-4111-8111-111111111111';
const response = () => ({ code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
let rows, mutations, privileged;
function mock({ role = 'paid', auth = true, email = 'member@real.test', qa = false, failure = false } = {}) {
 rows = new Map(); mutations = []; privileged = 0;
 globalThis.fetch = async (raw, options = {}) => {
   const url = new URL(raw);
   if (url.pathname === '/auth/v1/user') return auth ? Response.json({ id: actor, email, email_confirmed_at: '2026-01-01', user_metadata: { baker_funnel: { qa } } }) : Response.json({}, { status: 401 });
   if (url.pathname === '/rest/v1/profiles') { assert.equal(options.headers.Authorization, 'Bearer synthetic'); return Response.json([{ role }]); }
   assert.equal(url.pathname, '/rest/v1/billing_events'); assert.equal(options.headers.apikey, 'sb_secret_fictional'); privileged++;
   if (failure) return Response.json({}, { status: 503 });
   const method = options.method || 'GET';
   const selected = [...rows.values()].filter(row => {
     const event = url.searchParams.get('event_id');
     if (event?.startsWith('eq.') && row.event_id !== event.slice(3)) return false;
     if (event?.startsWith('like.')) { const pattern = event.slice(5).split('*').map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'); if (!new RegExp('^' + pattern + '$').test(row.event_id)) return false; }
     const time = url.searchParams.get('processed_at');
     if (time?.startsWith('lt.') && Date.parse(row.processed_at) >= Date.parse(time.slice(3))) return false;
     if (time?.startsWith('gte.') && Date.parse(row.processed_at) < Date.parse(time.slice(4))) return false;
     return true;
   }).sort((a,b) => a.processed_at.localeCompare(b.processed_at) || a.event_id.localeCompare(b.event_id));
   if (method === 'GET') { const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 100); return Response.json(selected.slice(offset, offset + limit)); }
   mutations.push({ method, url: url.toString(), body: options.body ? JSON.parse(options.body) : undefined });
   if (method === 'DELETE') { selected.forEach(row => rows.delete(row.event_id)); return new Response(null, { status: 204 }); }
   assert.equal(method, 'POST'); const row = JSON.parse(options.body); const duplicate = rows.has(row.event_id);
   if (!duplicate || !options.headers.Prefer.includes('ignore-duplicates')) rows.set(row.event_id, row);
   return options.headers.Prefer.includes('return=representation') ? Response.json(duplicate ? [] : [row]) : new Response(null, { status: 204 });
 };
}
async function call(body, { token = 'synthetic', method = body ? 'POST' : 'GET', query = {}, headers = {} } = {}) {
 const res = response(); await handler({ method, query, body, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), origin: 'https://www.fieldworkbybaker.com', 'content-type': 'application/json', ...headers } }, res); return res;
}
const event = { type: 'event', feature: 'fieldwork', action: 'tab_open', consent: 'usage-v1' };
test('anonymous, invalid and legacy tokens cannot read or record usage', async () => {
 for (const token of [null, 'invalid', 'legacy-owner']) { mock({ auth: false }); const res = await call(event, { token }); assert.equal(res.code, 401); assert.equal(privileged, 0); assert.equal(res.headers['Cache-Control'], 'private, no-store'); }
});
test('nonowner and owner-email-with-member-role cannot read aggregates', async () => {
 mock({ email: 'justin@bakerholdings.co' }); const res = await call(undefined); assert.equal(res.code, 403); assert.equal(privileged, 0);
});
test('server consent starts off; event without opt-in does not write', async () => {
 mock(); const self = await call(undefined, { query: { view: 'self' } }); assert.equal(self.body.enabled, false);
 const result = await call(event); assert.equal(result.body.reason, 'CONSENT_REQUIRED'); assert.equal(mutations.length, 0);
});
test('opt-in stores only a protected consent marker and expires after thirty days', async () => {
 mock(); const res = await call({ type: 'consent', enabled: true }); assert.equal(res.code, 200); assert.equal(res.body.enabled, true);
 assert.ok(Math.abs(Date.parse(res.body.expiresAt) - Date.now() - 30 * 86400000) < 2000);
 const saved = [...rows.values()][0]; assert.match(saved.event_id, /^usage-v1-consent\/[a-f0-9]{64}$/); assert.deepEqual(Object.keys(saved).sort(), ['event_id', 'mode', 'processed_at']); assert.ok(!JSON.stringify(saved).includes(actor));
});
test('repeated events and concurrent duplicate posts count one account/feature/action/bucket', async () => {
 mock(); await call({ type: 'consent', enabled: true });
 const [first, duplicate] = await Promise.all([call(event), call(event)]);
 assert.equal([first.body.recorded, duplicate.body.recorded].filter(Boolean).length, 1);
 const events = [...rows.values()].filter(row => row.event_id.startsWith('usage-v1/')); assert.equal(events.length, 1);
 const parts = events[0].event_id.split('/'); assert.equal(parts[3], usageIdentity(actor)); assert.ok(!events[0].event_id.includes(actor));
 assert.equal(Date.parse(events[0].processed_at) % 1800000, 0);
});
test('extra content, arbitrary features, forged subject/time and wrong consent are rejected before storage', async () => {
 for (const body of [{ ...event, text: 'PRIVATE CONTENT' }, { ...event, userId: 'other' }, { ...event, timestamp: '2020' }, { ...event, feature: '/url?secret=1' }, { ...event, action: 'arbitrary' }, { ...event, consent: 'ads-v2' }]) {
   mock(); const res = await call(body); assert.equal(res.code, 400); assert.equal(mutations.length, 0);
 }
});
test('GPC, QA, owner and preview collection are excluded', async () => {
 for (const config of [{ role: 'owner' }, { qa: true }, { email: 'qa@example.com' }]) { mock(config); const res = await call(event); assert.equal(res.body.recorded, false); assert.equal(mutations.length, 0); }
 mock(); const gpc = await call(event, { headers: { 'sec-gpc': '1' } }); assert.equal(gpc.body.recorded, false); assert.equal(mutations.length, 0);
 mock(); process.env.VERCEL_ENV = 'preview'; const res = await call({ type: 'consent', enabled: true }); assert.equal(res.body.enabled, false); assert.equal(mutations.length, 0); process.env.VERCEL_ENV = 'production';
});
test('wrong origin and unsupported methods cannot reach identity or storage', async () => {
 mock(); assert.equal((await call(event, { headers: { origin: 'https://other.test' } })).code, 403); assert.equal(privileged, 0);
 assert.equal((await call(undefined, { method: 'DELETE' })).code, 405);
});
test('opt-out revokes account consent and removes only own usage; retention touches only expired usage namespaces', async () => {
 mock(); const hash = usageIdentity(actor), other = 'b'.repeat(64), old = new Date(Date.now() - 31 * 86400000).toISOString();
 rows.set('invoice_evt', { mode: 'live', event_id: 'invoice_evt', processed_at: old });
 rows.set('funnel-v1/live/a', { mode: 'live', event_id: 'funnel-v1/live/a', processed_at: old });
 const expired = usageEventId(hash, 'fieldwork', 'tab_open', Date.now() - 31 * 86400000); rows.set(expired, { mode: 'live', event_id: expired, processed_at: old });
 await call({ type: 'consent', enabled: true }); assert.ok(!rows.has(expired)); assert.ok(rows.has('invoice_evt')); assert.ok(rows.has('funnel-v1/live/a'));
 await call(event); const otherId = usageEventId(other, 'fieldwork', 'tab_open'); rows.set(otherId, { mode: 'live', event_id: otherId, processed_at: new Date().toISOString() });
 assert.equal((await call({ type: 'consent', enabled: false })).body.enabled, false);
 assert.ok(![...rows.values()].some(row => row.event_id.includes(hash))); assert.ok(rows.has(otherId)); assert.ok(rows.has('invoice_evt'));
 assert.equal((await call(event)).body.reason, 'CONSENT_REQUIRED');
});
test('expired consent cannot record; rate limiter rejects spam and resets its time window', async () => {
 mock(); rows.set('usage-v1-consent/' + usageIdentity(actor), { event_id: 'usage-v1-consent/' + usageIdentity(actor), processed_at: '2020-01-01' });
 assert.equal((await call(event)).body.reason, 'CONSENT_REQUIRED'); assert.equal(mutations.length, 0);
 for (let i = 0; i < 30; i++) usageRateAllowed('limiter-fixture', 1000);
 assert.throws(() => usageRateAllowed('limiter-fixture', 1001), /USAGE_RATE_LIMIT/); assert.doesNotThrow(() => usageRateAllowed('limiter-fixture', 61001));
});
test('owner report deduplicates people and events, excludes old/unknown rows and never returns pseudonyms', async () => {
 mock({ role: 'owner' }); const now = Date.now(), who = usageIdentity(actor); const one = { event_id: usageEventId(who, 'fieldwork', 'tab_open', now), processed_at: new Date(Math.floor(now / 1800000) * 1800000).toISOString() };
 const two = { ...one, event_id: usageEventId(who, 'exam_lab', 'simulation_start_request', now) };
 const result = summarizeUsage([one, one, two, { ...one, event_id: 'unknown' }], new Date(now - 86400000).toISOString(), now);
 assert.equal(result.uniqueActiveUsers, 1); assert.equal(result.groups.find(group => group.feature === 'fieldwork').visits, 1); assert.equal(result.groups.find(group => group.feature === 'exam_lab').actionWindows, 1); assert.ok(!JSON.stringify(result).includes(who));
 rows.set(one.event_id, one); const report = await call(undefined, { query: { days: 7 } }); assert.equal(report.code, 200); assert.equal(report.body.uniqueActiveUsers, 1); assert.equal(mutations.length, 0);
 assert.equal((await call(undefined, { query: { days: 90 } })).code, 400);
});
test('provider errors fail closed instead of reporting zero usage', async () => {
 mock({ role: 'owner', failure: true }); const result = await call(undefined); assert.equal(result.code, 502); assert.equal(result.body.groups, undefined);
});
test('complete report pagination reads more than one hundred rows', async () => {
 mock({ role: 'owner' }); const now = Date.now();
 for (let i=0;i<101;i++) { const who = i.toString(16).padStart(64,'0'); const row = { event_id: usageEventId(who,'fieldwork','tab_open',now), processed_at: new Date(Math.floor(now / 1800000) * 1800000).toISOString() }; rows.set(row.event_id,row); }
 const result = await readUsageSummary(7); assert.equal(result.uniqueActiveUsers,101); assert.equal(result.groups.find(g=>g.feature==='fieldwork').visits,101);
});
test('browser sends only fixed vocabulary and no persistent identifier, paths, query strings or content', async () => {
 const component = await readFile('src/components/FeatureUsage.tsx','utf8');
 assert.ok(component.includes("{ type: 'event', consent: USAGE_VERSION, feature, action }"));
 assert.ok(!/localStorage|sessionStorage|location\.search|textContent|innerText|\.value\b/.test(component));
 const schema = await readFile('src/lib/featureUsageSchema.ts','utf8'); assert.ok(!schema.includes('/supervisor/')); assert.ok(!schema.includes('/feedback/')); assert.ok(!schema.includes('/admin/'));
});

test('revocation racing an event write removes the in-flight optional event', async () => {
 mock(); await call({ type: 'consent', enabled: true }); const originalMock = globalThis.fetch;
 globalThis.fetch = async (url, options) => {
   const result = await originalMock(url, options);
   if (options?.method === 'POST' && JSON.parse(options.body).event_id.startsWith('usage-v1/')) rows.delete('usage-v1-consent/' + usageIdentity(actor));
   return result;
 };
 const result = await recordUsageEvent(usageIdentity(actor), 'fieldwork', 'tab_open');
 assert.equal(result.reason, 'CONSENT_REVOKED'); assert.equal([...rows.values()].filter(row => row.event_id.startsWith('usage-v1/')).length, 0);
});
test('rendered route markers guard measurement and opt-out still works after event rate limit', async () => {
 const component = await readFile('src/components/FeatureUsage.tsx', 'utf8'); assert.ok(component.includes('data-usage-tab')); assert.ok(component.includes('fieldwork:usage-tab-ready'));
 const app = await readFile('src/App.tsx', 'utf8'); assert.ok(app.includes('<PaidFeatureRoute><MeasuredTab feature="exam_lab">'));
 mock(); let limited = false;
 for (let i = 0; i < 31; i++) { const result = await call(event); if (result.code === 429) { limited = true; break; } }
 assert.equal(limited, true); const off = await call({ type: 'consent', enabled: false }); assert.equal(off.code, 200); assert.equal(off.body.enabled, false);
});

test('identity reuses existing server credentials and fails closed when none are configured', () => {
 const session = process.env.BAKER_SESSION_SECRET, supabase = process.env.SUPABASE_SECRET_KEY;
 delete process.env.BAKER_SESSION_SECRET; process.env.SUPABASE_SECRET_KEY = 'sb_secret_synthetic_existing_server_key_at_least_32';
 assert.match(usageIdentity(actor), /^[a-f0-9]{64}$/);
 delete process.env.SUPABASE_SECRET_KEY; assert.throws(() => usageIdentity(actor), /USAGE_NOT_CONFIGURED/);
 process.env.BAKER_SESSION_SECRET = session; process.env.SUPABASE_SECRET_KEY = supabase;
});

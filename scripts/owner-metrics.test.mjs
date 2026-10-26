import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'owner-metrics-'));
const original = globalThis.fetch;
after(async () => { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); });
await build({ entryPoints: ['server/owner-metrics.ts', 'api/owner-metrics.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' } });
const { summarizeOwnerMetrics, stripePages } = await import(pathToFileURL(join(dir, 'server/owner-metrics.mjs')));
const { default: handler } = await import(pathToFileURL(join(dir, 'api/owner-metrics.mjs')));
const actor = '11111111-1111-4111-8111-111111111111';
process.env.SUPABASE_URL = 'https://fictional.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fictional'; process.env.SUPABASE_SECRET_KEY = 'sb_secret_fictional'; process.env.STRIPE_SECRET_KEY = 'sk_live_fictional';
const price = { id: 'price_1UNMr5AbMYqDEncBkDbWXXRX', unit_amount: 1699, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } };
const sub = (key, status = 'active', extra = {}) => ({ id: key, customer: { id: 'cus_' + key, email: 'member@real.test' }, livemode: true, metadata: { baker_account_id: actor }, status, items: { data: [{ quantity: 1, price }] }, ...extra });
const invoice = (key, amount = 1699, extra = {}) => ({ subscription: key, customer: 'cus_' + key, currency: 'usd', livemode: true, status: 'paid', amount_paid: amount, lines: { data: [{ price }] }, ...extra });
const users = [{ id: actor, email: 'member@real.test' }];
const profiles = [{ id: actor, trial_ends_at: null }];
test('counts unique payers separately, credits preserve history, canceled $0 and QA/test excluded', () => {
 const subscriptions = [sub('one', 'active', { cancel_at_period_end: true }), sub('two'), sub('ended', 'canceled'), sub('zero', 'canceled'), sub('qa', 'active', { metadata: { baker_funnel_qa: 'true' } }), sub('test', 'active', { livemode: false })];
 const metrics = summarizeOwnerMetrics(users, profiles, subscriptions, [invoice('one'), invoice('one', 0), invoice('two'), invoice('ended'), invoice('zero', 0), invoice('qa'), invoice('test')]);
 assert.equal(metrics.activePaid, 1); assert.equal(metrics.activeSubscriptions, 2); assert.equal(metrics.uniquePayers, 1); assert.equal(metrics.canceled, 1); assert.equal(metrics.scheduledCancellation, 1); assert.equal(metrics.mrr.usd, 3398); assert.equal(metrics.collected.usd, 5097);
});
test('annual MRR, discount, currency separation, legacy trials and free verified users', () => {
 const annualPrice = { ...price, id: 'price_1UNMrOAbMYqDEncBM5o6q16S', unit_amount: 34900, recurring: { interval: 'year', interval_count: 1 } };
 const annual = sub('annual', 'active', { items: { data: [{ price: annualPrice, quantity: 1 }] }, discounts: [{ coupon: { percent_off: 10 } }] });
 const metrics = summarizeOwnerMetrics([...users, { id: 'free' }, { id: 'trial' }], [...profiles, { id: 'free' }, { id: 'trial', trial_ends_at: '2099-01-01' }], [annual], [invoice('annual', 34900, { lines: { data: [{ price: annualPrice }] } })]);
 assert.equal(metrics.mrr.usd, 34900 * .9 / 12); assert.equal(metrics.free, 1); assert.equal(metrics.legacyTrial, 1);
});
test('partial/mixed invoice pages fail closed', () => {
 assert.throws(() => summarizeOwnerMetrics(users, profiles, [sub('one')], [invoice('one', 100, { lines: { has_more: true, data: [] } })]));
});
test('complete Stripe pagination and provider failure never become zero', async () => {
 let calls = 0;
 globalThis.fetch = async url => { calls++; if (calls === 1) return Response.json({ data: [{ id: 'first' }], has_more: true }); assert.ok(url.includes('starting_after=first')); return Response.json({ data: [{ id: 'last' }], has_more: false }); };
 assert.equal((await stripePages('/v1/invoices')).length, 2);
 globalThis.fetch = async () => Response.json({ error: 'offline' }, { status: 503 });
 await assert.rejects(stripePages('/v1/invoices'));
});
const response = () => ({ code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('missing, invalid, local/legacy spoofed identities and nonowners cannot read provider data', async () => {
 for (const token of [null, 'invalid', 'legacy-owner', 'browser-owner', 'nonowner']) {
   let privileged = 0;
   globalThis.fetch = async (url, options) => {
     if (url.endsWith('/auth/v1/user')) return token === 'nonowner' ? Response.json({ id: actor, email: 'justin@bakerholdings.co', email_confirmed_at: '2026-01-01' }) : Response.json({}, { status: 401 });
     if (url.includes('profiles?select=role')) { assert.equal(options.headers.Authorization, 'Bearer nonowner'); return Response.json([{ role: 'free' }]); }
     privileged++; throw Error('Privileged read before authorization');
   };
   const res = response(); await handler({ method: 'GET', headers: token ? { authorization: 'Bearer ' + token, 'x-role': 'owner' } : {} }, res);
   assert.equal(res.code, token === 'nonowner' ? 403 : 401); assert.equal(privileged, 0); assert.equal(res.headers['Cache-Control'], 'private, no-store');
 }
});
test('verified owner can read aggregate and paginated least-data directory; reads never mutate', async () => {
 globalThis.fetch = async (url, options) => {
   assert.ok(!options.method || options.method === 'GET');
   if (url.endsWith('/auth/v1/user')) return Response.json({ id: actor, email: 'owner@real.test', email_confirmed_at: '2026-01-01' });
   if (url.includes('profiles?select=role')) return Response.json([{ role: 'owner' }]);
   if (url.includes('/auth/v1/admin/users')) return Response.json({ users: users.map(user => ({ ...user, created_at: '2026-01-01', private: 'never return' })) });
   if (url.includes('/rest/v1/profiles?select=id')) return Response.json(profiles);
   if (url.includes('/v1/subscriptions')) return Response.json({ data: [sub('one')], has_more: false });
   if (url.includes('/v1/invoices')) return Response.json({ data: [invoice('one')], has_more: false });
   throw Error(url);
 };
 const res = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer owner' } }, res);
 assert.equal(res.code, 200); assert.equal(res.body.metrics.activePaid, 1); assert.equal(res.body.directory.users.length, 1); assert.ok(!JSON.stringify(res.body).includes('never return')); assert.ok(res.body.checkedAt);
});
test('account pagination completes and directory bounds/filter are enforced', async () => {
 let adminCalls = 0;
 globalThis.fetch = async url => {
   if (url.endsWith('/auth/v1/user')) return Response.json({ id: actor, email: 'owner@real.test', email_confirmed_at: '2026-01-01' });
   if (url.includes('profiles?select=role')) return Response.json([{ role: 'owner' }]);
   if (url.includes('/auth/v1/admin/users')) { adminCalls++; const page = Number(new URL(url).searchParams.get('page')); return Response.json({ users: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({ id: 'user-' + ((page - 1) * 100 + i), email: `member${(page - 1) * 100 + i}@real.test`, created_at: '2026-01-01' })) }); }
   if (url.includes('/rest/v1/profiles?select=id')) return Response.json([]);
   return Response.json({ data: [], has_more: false });
 };
 const res = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer owner' }, query: { page: 2 } }, res);
 assert.equal(res.code, 200); assert.equal(adminCalls, 2); assert.equal(res.body.metrics.registered, 101); assert.equal(res.body.directory.users.length, 50); assert.equal(res.body.directory.page, 2);
 const invalid = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer owner' }, query: { page: -1 } }, invalid); assert.equal(invalid.code, 400);
});
test('account provider failure returns unavailable, never a fabricated empty report', async () => {
 globalThis.fetch = async url => {
   if (url.endsWith('/auth/v1/user')) return Response.json({ id: actor, email: 'owner@real.test', email_confirmed_at: '2026-01-01' });
   if (url.includes('profiles?select=role')) return Response.json([{ role: 'owner' }]);
   return Response.json({}, { status: 503 });
 };
 const res = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer owner' } }, res);
 assert.ok(res.code >= 500); assert.equal(res.body.metrics, undefined); assert.equal(res.body.directory, undefined);
});

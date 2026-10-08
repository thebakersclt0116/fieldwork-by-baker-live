import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const dir = await mkdtemp(join(tmpdir(), 'baker-ads-'));
const savedFetch = globalThis.fetch;
after(async () => { globalThis.fetch = savedFetch; await rm(dir, { recursive: true, force: true }); });
await build({ entryPoints: ['server/ad-measurement.ts', 'api/ad-measurement-test.ts', 'api/create-checkout-session.ts', 'api/stripe-webhook.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' } });
const { attributionMetadata, adUserData, firstPaymentEvent, sendAdEvent, reportFirstPayment } = await import(pathToFileURL(join(dir, 'server/ad-measurement.mjs')));
const { default: testRoute } = await import(pathToFileURL(join(dir, 'api/ad-measurement-test.mjs')));
const now = Date.now();
const input = { consent: 'ads-v1', consentAt: now, visitorId: '11111111-1111-4111-8111-111111111111', fbc: `fb.1.${now}.fictionalClick123` };
const metadata = attributionMetadata(input, ' Fictional@Example.com ', 'Fictional browser', now);
const invoice = { id: 'in_Fictional', livemode: true, customer: 'cus_Fictional', subscription: 'sub_Fictional', status: 'paid', paid: true, amount_paid: 1699, currency: 'usd', billing_reason: 'subscription_create', status_transitions: { paid_at: Math.floor(now / 1000) } };
const configure = (env = 'production') => { process.env.VERCEL_ENV = env; process.env.BAKER_META_ADS_ENABLED = 'true'; process.env.META_DATASET_ID = '123456789012345'; process.env.META_CAPI_ACCESS_TOKEN = 'fictional-only-test-token'; process.env.STRIPE_SECRET_KEY = 'sk_live_fictional'; };
const res = () => ({ code: 0, body: null, setHeader() {}, status(n) { this.code = n; return this; }, json(value) { this.body = value; return this; } });
test('consent is required, current and explicitly versioned', () => {
  for (const value of [null, {}, { ...input, consent: 'yes' }, { ...input, consentAt: now + 1 }, { ...input, consentAt: now - 31 * 86400000 }, { ...input, visitorId: 'invalid' }]) assert.deepEqual(attributionMetadata(value, 'fictional@example.com', '', now), {});
  assert.equal(adUserData({ ...metadata, baker_ads_consent: 'no' }, now), null);
  assert.equal(adUserData({ ...metadata, baker_ads_captured_at: String(now - 8 * 86400000) }, now), null);
});
test('only hashes and minimal browser/ad data survive; Stripe metadata remains under its limit', () => {
  assert.equal(metadata.baker_ads_email, createHash('sha256').update('fictional@example.com').digest('hex'));
  assert.equal(JSON.stringify(metadata).includes('Fictional@Example.com'), false);
  assert.equal(metadata.baker_ads_fbc, input.fbc);
  assert.equal(attributionMetadata({ ...input, fbc: `fb.1.${now}.` + 'x'.repeat(1000) }, 'a@example.com', '', now).baker_ads_fbc, undefined);
  assert.ok(Object.values(attributionMetadata(input, 'a@example.com', 'x'.repeat(2000), now)).every(value => value.length <= 500));
  assert.deepEqual(Object.keys(adUserData(metadata, now)).sort(), ['client_user_agent', 'em', 'external_id', 'fbc']);
});
test('first confirmed nonzero payment produces a stable deduplication ID and exact value', () => {
  const event = firstPaymentEvent(invoice, metadata, [invoice], now);
  assert.equal(event.event_name, 'Purchase'); assert.equal(event.custom_data.value, 16.99); assert.equal(event.custom_data.currency, 'USD');
  assert.equal(event.event_source_url, 'https://www.fieldworkbybaker.com/upgrade/success');
  assert.equal(event.event_id, firstPaymentEvent(invoice, metadata, [], now).event_id);
  assert.equal(JSON.stringify(event).includes(invoice.id), false);
});
test('zero tests, test-mode payments, renewals, unpaid invoices and returning members never count', () => {
  for (const changes of [{ amount_paid: 0 }, { livemode: false }, { billing_reason: 'subscription_cycle' }, { status: 'open' }, { paid: false }, { currency: 'eur' }, { amount_paid: -1 }]) assert.equal(firstPaymentEvent({ ...invoice, ...changes }, metadata, [], now), null);
  assert.equal(firstPaymentEvent(invoice, metadata, [{ ...invoice, id: 'in_Previous' }], now), null);
  assert.equal(firstPaymentEvent(invoice, {}, [], now), null);
});
test('Meta receives only server-side whitelisted purchase data and confirms acceptance', async () => {
  configure(); let sent;
  globalThis.fetch = async (url, options) => { assert.equal(url, 'https://graph.facebook.com/v25.0/123456789012345/events'); assert.equal(options.headers.Authorization, 'Bearer fictional-only-test-token'); sent = JSON.parse(options.body); return Response.json({ events_received: 1 }); };
  assert.equal(await sendAdEvent(firstPaymentEvent(invoice, metadata, [], now)), true);
  assert.equal(sent.test_event_code, undefined); assert.equal(sent.data.length, 1);
});
test('Preview cannot send live events and production cannot send synthetic test events', async () => {
  configure('preview'); delete process.env.BAKER_META_TESTING; let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({ events_received: 1 }); };
  assert.equal(await sendAdEvent({}), false); assert.equal(called, false);
  process.env.BAKER_META_TESTING = 'true';
  globalThis.fetch = async (_, options) => { assert.equal(JSON.parse(options.body).test_event_code, 'TEST12345'); return Response.json({ events_received: 1 }); };
  assert.equal(await sendAdEvent(firstPaymentEvent(invoice, metadata, [], now), 'TEST12345'), true);
  configure(); await assert.rejects(() => sendAdEvent({}, 'TEST12345'), { code: 'AD_TEST_NOT_ALLOWED' });
  const response = res(); await testRoute({ method: 'POST' }, response); assert.equal(response.code, 404);
});
test('authoritative Stripe invoice and subscription are checked before delivery', async () => {
  configure(); let deliveries = 0;
  process.env.SUPABASE_URL = 'https://synthetic-project.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fictional'; process.env.SUPABASE_SECRET_KEY = 'sb_secret_fictional';
  let marked = false;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/invoices/in_Fictional')) return Response.json(invoice);
    if (url.endsWith('/subscriptions/sub_Fictional')) return Response.json({ livemode: true, customer: invoice.customer, metadata: { ...metadata, baker_mode: 'live' } });
    if (url.includes('/invoices?')) return Response.json({ data: [invoice], has_more: false });
    if (url.startsWith('https://graph.facebook.com/')) { deliveries++; return Response.json({ events_received: 1 }); }
    if (url.includes('/billing_events?')) return Response.json(marked ? [{ event_id: 'fictional marker' }] : []);
    if (url.endsWith('/billing_events')) { marked = true; assert.equal(JSON.parse(options.body).mode, 'live'); return new Response(null, { status: 201 }); }
    throw Error('Unexpected request');
  };
  assert.equal(await reportFirstPayment(invoice.id, invoice.subscription), true); assert.equal(deliveries, 1);
  assert.equal(await reportFirstPayment(invoice.id, invoice.subscription), true); assert.equal(deliveries, 1);
});
test('Meta failure is retryable, and a disabled connection makes no external request', async () => {
  configure(); globalThis.fetch = async () => Response.json({ error: { message: 'fictional failure' } }, { status: 500 });
  await assert.rejects(() => sendAdEvent(firstPaymentEvent(invoice, metadata, [], now)), { code: 'AD_MEASUREMENT_DELIVERY_FAILED' });
  process.env.BAKER_META_ADS_ENABLED = 'false'; globalThis.fetch = async () => { throw Error('Must not transmit'); };
  assert.equal(await reportFirstPayment(invoice.id, invoice.subscription), false);
});
test('the Preview test endpoint denies ordinary members and anonymous callers', async () => {
  configure('preview'); process.env.BAKER_META_TESTING = 'true'; process.env.META_TEST_EVENT_CODE = 'TEST12345';
  process.env.SUPABASE_URL = 'https://synthetic-project.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fictional';
  let metaCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: input.visitorId, email: 'fictional@example.com', email_confirmed_at: '2026-01-01' });
    if (url.includes('/profiles?')) return Response.json([{ role: 'paid' }]);
    metaCalls++; throw Error('Must not transmit');
  };
  const member = res(); await testRoute({ method: 'POST', headers: { authorization: 'Bearer fictional' } }, member); assert.equal(member.code, 403);
  const anonymous = res(); await testRoute({ method: 'POST', headers: {} }, anonymous); assert.equal(anonymous.code, 401); assert.equal(metaCalls, 0);
});
test('owner testing sends only fictional data and always includes the Meta test code', async () => {
  configure('preview'); process.env.BAKER_META_TESTING = 'true'; process.env.META_TEST_EVENT_CODE = 'TEST12345';
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: input.visitorId, email: 'private-owner@example.com', email_confirmed_at: '2026-01-01' });
    if (url.includes('/profiles?')) return Response.json([{ role: 'owner' }]);
    assert.ok(url.startsWith('https://graph.facebook.com/')); const body = JSON.parse(options.body);
    assert.equal(body.test_event_code, 'TEST12345'); assert.equal(body.data[0].user_data.em[0], createHash('sha256').update('fictional-launch-test@example.com').digest('hex'));
    return Response.json({ events_received: 1 });
  };
  const response = res(); await testRoute({ method: 'POST', headers: { authorization: 'Bearer fictional' } }, response);
  assert.equal(response.code, 200); assert.equal(response.body.metaTestEventsOnly, true); assert.equal(response.body.zeroExcluded, true); assert.equal(response.body.renewalExcluded, true);
});

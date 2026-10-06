import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express, { type Express, type Request } from 'express';
import { Pool } from 'pg';
import Stripe from 'stripe';
import type { CloudIdentity } from '../../shared/cloudTypes.js';
import { ensureDefaultEntitlement } from '../auth.js';
import { migrateAuthSchema } from '../auth-schema.js';
import { billingConfiguration, createBillingRouter, createBillingWebhookRouter } from '../billing.js';

const fixtureSecret = ['rk', 'live', 'local_fixture_only'].join('_');
const fixtureWebhookSecret = `whsec_${randomBytes(24).toString('hex')}`;
function configuredBilling() {
  return billingConfiguration({
    STRIPE_SECRET_KEY: fixtureSecret,
    STRIPE_WEBHOOK_SECRET: fixtureWebhookSecret,
    FIELDWORK_APP_ORIGIN: 'https://www.fieldworkbybaker.com',
    FIELDWORK_LIVE_BILLING_ENABLED: 'true',
    FIELDWORK_STRIPE_WEBHOOK_VERIFIED: 'true',
  });
}

async function listen(app: Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
    }),
  };
}

test('production checkout stays closed until all live billing gates match', () => {
  assert.equal(billingConfiguration({}).checkoutEnabled, false);
  const config = configuredBilling();
  assert.equal(config.checkoutEnabled, true);
  for (const overrides of [
    { FIELDWORK_LIVE_BILLING_ENABLED: 'false' },
    { FIELDWORK_STRIPE_WEBHOOK_VERIFIED: 'false' },
    { STRIPE_WEBHOOK_SECRET: '' },
    { STRIPE_SECRET_KEY: ['sk', 'test', 'fixture'].join('_') },
    { FIELDWORK_APP_ORIGIN: 'https://www.fieldworkbybaker.com/unsafe' },
  ]) {
    const env = {
      STRIPE_SECRET_KEY: fixtureSecret, STRIPE_WEBHOOK_SECRET: fixtureWebhookSecret,
      FIELDWORK_APP_ORIGIN: 'https://www.fieldworkbybaker.com',
      FIELDWORK_LIVE_BILLING_ENABLED: 'true', FIELDWORK_STRIPE_WEBHOOK_VERIFIED: 'true', ...overrides,
    };
    assert.equal(billingConfiguration(env).checkoutEnabled, false);
  }
  assert.equal(billingConfiguration({
    STRIPE_SECRET_KEY: ['sk', 'test', 'fixture'].join('_'), STRIPE_WEBHOOK_SECRET: fixtureWebhookSecret,
    FIELDWORK_APP_ORIGIN: 'https://www.fieldworkbybaker.com', FIELDWORK_TEST_BILLING_ENABLED: 'true',
    FIELDWORK_STRIPE_WEBHOOK_VERIFIED: 'true',
  }).checkoutEnabled, false, 'Test mode cannot unlock the public production origin.');
});

test('tampered, stale, and absent webhook signatures cannot reach the database', async () => {
  const sdk = new Stripe('local-signature-fixture');
  const app = express();
  const pool = { connect: () => { throw new Error('Untrusted data reached the database.'); } } as unknown as Pool;
  app.use('/api/cloud', createBillingWebhookRouter(pool, { config: configuredBilling, stripe: sdk }));
  const http = await listen(app);
  const payload = JSON.stringify({ id: 'evt_fixture', type: 'invoice.paid', livemode: true });
  try {
    for (const signature of [
      '',
      sdk.webhooks.generateTestHeaderString({ payload: `${payload}tampered`, secret: fixtureWebhookSecret }),
      sdk.webhooks.generateTestHeaderString({ payload, secret: fixtureWebhookSecret, timestamp: 1 }),
    ]) {
      const response = await fetch(`${http.origin}/api/cloud/billing/webhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload,
      });
      assert.equal(response.status, 400);
    }
  } finally { await http.close(); }
});

test('durable checkout, signed lifecycle events, cancellation, and tenant boundaries', {
  skip: !process.env.FIELDWORK_TEST_DATABASE_URL && 'Set FIELDWORK_TEST_DATABASE_URL to an isolated loopback PostgreSQL database.',
  timeout: 120_000,
}, async (t) => {
  const testUrl = new URL(process.env.FIELDWORK_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(testUrl.hostname));
  const schema = `fieldwork_billing_test_${randomBytes(8).toString('hex')}`;
  const admin = new Pool({ connectionString: testUrl.toString(), ssl: false, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: testUrl.toString(), ssl: false, max: 5, options: `-c search_path=${schema}` });
  const config = configuredBilling();
  const sdk = new Stripe('local-signature-fixture');
  let customerCreates = 0;
  let checkoutCreates = 0;
  let subscriptionReads = 0;
  let failNextSubscriptionRead = false;
  let failAfterNextCheckoutCreate = false;
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const idempotency = new Map<string, Stripe.Checkout.Session>();
  const customerIdempotency = new Map<string, string>();
  const subscriptionState = new Map<string, Stripe.Subscription>();
  const capturedCheckouts: Stripe.Checkout.SessionCreateParams[] = [];
  let portalCustomer = '';
  const fakeStripe = {
    webhooks: sdk.webhooks,
    prices: { retrieve: async (id: string) => {
      const plan = Object.values(config.plans).find((item) => item.priceId === id)!;
      return { id, active: true, livemode: true, currency: 'usd', unit_amount: plan.amount, type: 'recurring',
        product: plan.productId, recurring: { interval: plan.interval, interval_count: 1 } };
    } },
    customers: { create: async (_params: unknown, options: { idempotencyKey: string }) => {
      if (!customerIdempotency.has(options.idempotencyKey)) customerIdempotency.set(options.idempotencyKey, `cus_fixture_${++customerCreates}`);
      return { id: customerIdempotency.get(options.idempotencyKey) };
    } },
    checkout: { sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) => {
        if (idempotency.has(options.idempotencyKey)) return idempotency.get(options.idempotencyKey);
        checkoutCreates += 1;
        capturedCheckouts.push(params);
        const id = `cs_live_fixture_${checkoutCreates}`;
        const session = { id, customer: params.customer, metadata: params.metadata, client_reference_id: params.client_reference_id,
          mode: 'subscription', livemode: true, status: 'open', payment_status: 'unpaid',
          expires_at: Math.floor(Date.now() / 1000) + 86_400, url: `https://checkout.stripe.com/c/pay/${id}` } as Stripe.Checkout.Session;
        sessions.set(id, session); idempotency.set(options.idempotencyKey, session);
        if (failAfterNextCheckoutCreate) { failAfterNextCheckoutCreate = false; throw new Error('Simulated response lost after Stripe created Checkout.'); }
        return session;
      },
      retrieve: async (id: string) => structuredClone(sessions.get(id)!),
      expire: async (id: string) => { const session = sessions.get(id)!; session.status = 'expired'; return session; },
    } },
    subscriptions: { retrieve: async (id: string) => {
      subscriptionReads += 1;
      if (failNextSubscriptionRead) { failNextSubscriptionRead = false; throw new Error('Simulated transport outage.'); }
      assert.ok(subscriptionState.has(id));
      return structuredClone(subscriptionState.get(id)!);
    } },
    billingPortal: { sessions: { create: async (params: { customer: string }) => {
      portalCustomer = params.customer; return { url: 'https://billing.stripe.com/p/session/local-fixture' };
    } } },
  } as unknown as Stripe;
  const app = express();
  app.use('/api/cloud', createBillingWebhookRouter(pool, { config: () => config, stripe: fakeStripe }));
  app.use(express.json());
  app.use(async (req, _res, next) => {
    const userId = String(req.headers['x-fixture-user'] || '');
    if (userId) {
      const row = (await pool.query(
        `SELECT u.id, u.email, u.name, e.role, e.subscription, e.export_pass, e.billing_access_ends_at
         FROM fieldwork_auth_user u JOIN fieldwork_entitlements e ON u.id = e.user_id WHERE u.id = $1`, [userId],
      )).rows[0];
      if (row) (req as Request & { fieldworkUser: CloudIdentity }).fieldworkUser = {
        userId: row.id, workspaceId: `workspace-${row.id}`, email: row.email, name: row.name,
        role: row.role, subscription: row.subscription, exportPass: row.export_pass, authMethod: 'cookie',
      };
    }
    next();
  });
  app.use('/api/cloud', createBillingRouter(pool, { config: () => config, stripe: fakeStripe }));
  const http = await listen(app);
  const post = async (path: string, userId: string, body: unknown = {}) => {
    const response = await fetch(`${http.origin}/api/cloud/billing/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fixture-user': userId }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const webhook = async (event: Record<string, unknown>) => {
    const payload = JSON.stringify(event);
    const response = await fetch(`${http.origin}/api/cloud/billing/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        'Stripe-Signature': sdk.webhooks.generateTestHeaderString({ payload, secret: fixtureWebhookSecret }) }, body: payload,
    });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const event = (type: string, object: unknown, id = `evt_${randomUUID()}`, created = Math.floor(Date.now() / 1000)) => ({
    id, type, created, livemode: true, data: { object },
  });
  const entitlement = async (userId = 'fixture-alice') => (await pool.query('SELECT * FROM fieldwork_entitlements WHERE user_id = $1', [userId])).rows[0];
  let checkoutId = '';
  let customerId = '';
  let trialStartedAt = '';
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;
  try {
    await migrateAuthSchema(pool);
    await pool.query(await readFile(new URL('../billing-schema.sql', import.meta.url), 'utf8'));
    for (const name of ['alice', 'bob', 'waiting', 'retry']) {
      const userId = `fixture-${name}`;
      await pool.query(`INSERT INTO fieldwork_auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,now(),now())`,
        [userId, name, `${name}@example.test`]);
      await ensureDefaultEntitlement(pool, userId);
    }
    trialStartedAt = (await entitlement()).trial_started_at.toISOString();
    await t.test('closed checkout and anonymous requests never create Stripe objects', async () => {
      config.checkoutEnabled = false;
      assert.equal((await post('checkout', 'fixture-alice', { plan: 'individual_monthly' })).status, 503);
      config.checkoutEnabled = true;
      assert.equal((await post('checkout', '', { plan: 'individual_monthly' })).status, 401);
      assert.equal(customerCreates, 0); assert.equal(checkoutCreates, 0);
    });
    await t.test('concurrent checkout retries share one durable attempt and immutable owner', async () => {
      const results = await Promise.all([post('checkout', 'fixture-alice', { plan: 'professional_monthly', userId: 'fixture-bob' }),
        post('checkout', 'fixture-alice', { plan: 'professional_monthly' })]);
      assert.deepEqual(results.map((result) => result.status), [200, 200]);
      assert.equal(results[0].body.id, results[1].body.id);
      checkoutId = results[0].body.id;
      customerId = String(sessions.get(checkoutId)!.customer);
      assert.equal(customerCreates, 1); assert.equal(checkoutCreates, 1);
      assert.equal(capturedCheckouts[0].client_reference_id, 'fixture-alice');
      assert.equal(capturedCheckouts[0].metadata?.fieldwork_user_id, 'fixture-alice');
      assert.equal(capturedCheckouts[0].subscription_data?.metadata?.fieldwork_user_id, 'fixture-alice');
      assert.equal(capturedCheckouts[0].subscription_data?.trial_period_days, undefined);
      assert.equal((await post('complete', 'fixture-bob', { sessionId: checkoutId })).status, 404);
      assert.equal((await post('checkout', 'beta-emily-ayala', { plan: 'professional_monthly' })).status, 409);
      await assert.rejects(pool.query('UPDATE fieldwork_billing_customers SET user_id = $1 WHERE stripe_customer_id = $2', ['fixture-bob', customerId]), /immutable/);
    });
    await t.test('a lost Stripe response retries the persisted attempt instead of creating another checkout', async () => {
      const before = checkoutCreates;
      failAfterNextCheckoutCreate = true;
      assert.equal((await post('checkout', 'fixture-retry', { plan: 'individual_monthly' })).status, 503);
      const pending = (await pool.query('SELECT id, stripe_checkout_session_id FROM fieldwork_billing_checkouts WHERE user_id = $1', ['fixture-retry'])).rows[0];
      assert.ok(pending.id); assert.equal(pending.stripe_checkout_session_id, null);
      assert.equal((await post('checkout', 'fixture-retry', { plan: 'individual_monthly' })).status, 200);
      assert.equal(checkoutCreates, before + 1);
      assert.equal((await pool.query('SELECT id FROM fieldwork_billing_checkouts WHERE user_id = $1', ['fixture-retry'])).rowCount, 1);
    });
    const subscription = {
      id: 'sub_alice', customer: customerId, livemode: true, status: 'incomplete',
      metadata: { fieldwork_user_id: 'fixture-alice' }, cancel_at_period_end: false, canceled_at: null,
      items: { data: [{ quantity: 1, current_period_end: periodEnd, price: { id: config.plans.professional_monthly.priceId } }] },
      latest_invoice: { id: 'in_alice', status: 'open' },
    } as unknown as Stripe.Subscription;
    subscriptionState.set(subscription.id, subscription);
    let completedEvent: Record<string, unknown>;
    await t.test('unpaid asynchronous checkout remains free; duplicate event is harmless', async () => {
      const session = sessions.get(checkoutId)!;
      session.status = 'complete'; session.subscription = subscription.id;
      completedEvent = event('checkout.session.completed', { id: checkoutId, customer: customerId });
      assert.equal((await webhook(completedEvent)).status, 200);
      assert.equal((await entitlement()).role, 'free');
      assert.equal((await post('complete', 'fixture-alice', { sessionId: checkoutId })).status, 202);
      const reads = subscriptionReads;
      assert.equal((await webhook(completedEvent)).body.outcome, 'duplicate');
      assert.equal(subscriptionReads, reads);
      assert.equal((await post('checkout', 'fixture-alice', { plan: 'professional_monthly' })).status, 409);
      await webhook(event('checkout.session.async_payment_failed', { id: checkoutId, customer: customerId }));
      const failed = await post('complete', 'fixture-alice', { sessionId: checkoutId });
      assert.equal(failed.status, 402); assert.equal(failed.body.code, 'PAYMENT_FAILED');
    });
    await t.test('invoice payment grants durable finite access without changing trial or issuing a token', async () => {
      subscription.status = 'active'; (subscription.latest_invoice as Stripe.Invoice).status = 'paid';
      const paid = event('invoice.paid', { id: 'in_alice', customer: customerId, parent: { subscription_details: { subscription: subscription.id } } });
      assert.equal((await webhook(paid)).status, 200);
      const entitlementRow = await entitlement();
      assert.equal(entitlementRow.role, 'professional');
      assert.equal(entitlementRow.billing_access_ends_at.getTime(), periodEnd * 1000);
      assert.equal(entitlementRow.trial_started_at.toISOString(), trialStartedAt);
      assert.equal(entitlementRow.trial_ends_at - entitlementRow.trial_started_at, 72 * 3600 * 1000);
      const complete = await post('complete', 'fixture-alice', { sessionId: checkoutId });
      assert.equal(complete.status, 200); assert.equal(complete.body.status, 'active');
      assert.equal('token' in complete.body, false);
    });
    await t.test('scheduled cancellation preserves paid time; failed renewal removes paid access', async () => {
      subscription.cancel_at_period_end = true;
      await webhook(event('customer.subscription.updated', { id: subscription.id, customer: customerId }));
      assert.equal((await entitlement()).role, 'professional');
      subscription.status = 'past_due'; (subscription.latest_invoice as Stripe.Invoice).status = 'open';
      await webhook(event('invoice.payment_failed', { id: 'in_alice', customer: customerId, parent: { subscription_details: { subscription: subscription.id } } }));
      const row = await entitlement();
      assert.equal(row.role, 'free'); assert.equal(row.export_pass, false); assert.equal(row.billing_access_ends_at, null);
    });
    await t.test('old events cannot overwrite latest subscription state; failures remain retryable', async () => {
      subscription.status = 'active'; (subscription.latest_invoice as Stripe.Invoice).status = 'paid';
      const old = event('customer.subscription.deleted', { id: subscription.id, customer: customerId, status: 'canceled' }, undefined, 100);
      failNextSubscriptionRead = true;
      assert.equal((await webhook(old)).status, 503);
      assert.equal((await pool.query('SELECT 1 FROM fieldwork_billing_events WHERE stripe_event_id = $1', [old.id])).rowCount, 0);
      assert.equal((await webhook(old)).status, 200);
      assert.equal((await entitlement()).role, 'professional', 'Latest active paid resource wins over an old canceled event payload.');
      subscription.status = 'canceled';
      await webhook(event('customer.subscription.updated', { id: subscription.id, customer: customerId, status: 'active' }));
      assert.equal((await entitlement()).role, 'free');
    });
    await t.test('metadata cannot steal ownership and canceled subscriptions cannot revoke reserved beta access', async () => {
      subscription.metadata.fieldwork_user_id = 'fixture-bob';
      assert.equal((await webhook(event('customer.subscription.updated', { id: subscription.id, customer: customerId }))).body.outcome, 'subscription_ownership_mismatch');
      assert.equal((await entitlement('fixture-bob')).role, 'free');
      await pool.query('INSERT INTO fieldwork_billing_customers (user_id,stripe_customer_id,livemode) VALUES ($1,$2,true)', ['beta-emily-ayala', 'cus_emily']);
      subscriptionState.set('sub_emily', { ...subscription, id: 'sub_emily', customer: 'cus_emily', metadata: { fieldwork_user_id: 'beta-emily-ayala' }, status: 'canceled' });
      await webhook(event('customer.subscription.deleted', { id: 'sub_emily', customer: 'cus_emily' }));
      const emily = await entitlement('beta-emily-ayala');
      assert.equal(emily.role, 'professional'); assert.equal(emily.export_pass, true); assert.equal(emily.trial_ends_at, null);
    });
    await t.test('completed checkout awaiting its subscription cannot create a duplicate charge', async () => {
      const checkout = await post('checkout', 'fixture-waiting', { plan: 'individual_monthly' });
      const session = sessions.get(checkout.body.id)!;
      session.status = 'complete';
      await webhook(event('checkout.session.completed', { id: session.id, customer: session.customer }));
      const count = checkoutCreates;
      const second = await post('checkout', 'fixture-waiting', { plan: 'individual_monthly' });
      assert.equal(second.status, 409); assert.equal(second.body.code, 'PAYMENT_CONFIRMATION_PENDING');
      assert.equal(checkoutCreates, count);
    });
    await t.test('signed reconciliation and cancellation portal stay available with new sales paused', async () => {
      config.checkoutEnabled = false;
      subscription.metadata.fieldwork_user_id = 'fixture-alice';
      subscription.status = 'active';
      assert.equal((await webhook(event('customer.subscription.updated', { id: subscription.id, customer: customerId }))).status, 200);
      assert.equal((await entitlement()).role, 'professional');
      assert.equal((await post('portal', 'fixture-alice', { customer: 'cus_emily' })).status, 200);
      assert.equal(portalCustomer, customerId);
      assert.equal((await post('checkout', 'fixture-alice', { plan: 'individual_monthly' })).status, 503);
      const wrongMode = { ...event('customer.subscription.updated', { id: subscription.id, customer: customerId }), livemode: false };
      assert.equal((await webhook(wrongMode)).status, 400);
    });
  } finally {
    await http.close(); await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});

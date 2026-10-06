import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express, { Router, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import Stripe from 'stripe';
import type { CloudIdentity } from '../shared/cloudTypes.js';

type PlanId = 'individual_monthly' | 'professional_monthly' | 'professional_annual';
interface BillingPlan {
  priceId: string;
  productId?: string;
  amount: number;
  interval: 'month' | 'year';
  subscription: 'individual' | 'professional';
}

// The existing catalog is reused. No Product or Price is created by this service.
const LIVE_PLANS: Record<PlanId, BillingPlan> = {
  individual_monthly: { priceId: 'price_1UNMr5AbMYqDEncBkDbWXXRX', productId: 'prod_VO99ZaeeK85Om0', amount: 1699, interval: 'month', subscription: 'individual' },
  professional_monthly: { priceId: 'price_1UNMrGAbMYqDEncBYyKrXnKw', productId: 'prod_VO993JpdQbBdjK', amount: 3499, interval: 'month', subscription: 'professional' },
  professional_annual: { priceId: 'price_1UNMrOAbMYqDEncBM5o6q16S', productId: 'prod_VO993JpdQbBdjK', amount: 34900, interval: 'year', subscription: 'professional' },
};
const RESERVED_IDS = ['beta-justin-baker', 'beta-emily-ayala'];
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired', 'customer.subscription.trial_will_end',
]);
const CHECKOUT_EVENTS = new Set([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'checkout.session.expired',
]);
const INVOICE_EVENTS = new Set([
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
  'invoice.finalization_failed', 'invoice.voided', 'invoice.marked_uncollectible',
]);

export interface BillingConfiguration {
  secretKey: string;
  webhookSecret: string;
  livemode: boolean;
  modeMatches: boolean;
  appOrigin: string;
  checkoutEnabled: boolean;
  plans: Record<PlanId, BillingPlan>;
}

function appOrigin(value: string | undefined): string {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    return url.origin;
  } catch { return ''; }
}

export function billingConfiguration(env: NodeJS.ProcessEnv = process.env): BillingConfiguration {
  const secretKey = env.STRIPE_SECRET_KEY || '';
  const origin = appOrigin(env.FIELDWORK_APP_ORIGIN);
  const liveKey = /^(?:sk|rk)_live_/.test(secretKey);
  const testKey = /^(?:sk|rk)_test_/.test(secretKey);
  // A separate sandbox can be exercised on a separate origin. Production never
  // interprets test payments as access, even if the test flag is accidentally set.
  const sandbox = env.FIELDWORK_TEST_BILLING_ENABLED === 'true'
    && Boolean(origin) && !/^https:\/\/(?:www\.)?fieldworkbybaker\.com$/.test(origin);
  const livemode = !sandbox;
  const modeMatches = livemode ? liveKey : testKey;
  const plans = Object.fromEntries(Object.entries(LIVE_PLANS).map(([id, plan]) => {
    const override = env[`STRIPE_PRICE_${id.toUpperCase()}`];
    return [id, { ...plan, priceId: override || (livemode ? plan.priceId : ''), ...(livemode ? {} : { productId: undefined }) }];
  })) as Record<PlanId, BillingPlan>;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
  const checkoutEnabled = (livemode ? env.FIELDWORK_LIVE_BILLING_ENABLED === 'true' : sandbox)
    && env.FIELDWORK_STRIPE_WEBHOOK_VERIFIED === 'true'
    && modeMatches && webhookSecret.startsWith('whsec_') && Boolean(origin)
    && Object.values(plans).every((plan) => /^price_[A-Za-z0-9]+$/.test(plan.priceId));
  return { secretKey, webhookSecret, livemode, modeMatches, appOrigin: origin, checkoutEnabled, plans };
}

export function billingReadiness(env: NodeJS.ProcessEnv = process.env) {
  const config = billingConfiguration(env);
  return {
    liveBillingEnabled: config.checkoutEnabled && config.livemode,
    stripeMode: config.modeMatches ? (config.livemode ? 'live' : 'test') : 'unavailable',
    webhookConfigured: config.webhookSecret.startsWith('whsec_'),
    webhookVerified: env.FIELDWORK_STRIPE_WEBHOOK_VERIFIED === 'true',
    testBillingEnabled: config.checkoutEnabled && !config.livemode,
  };
}

interface BillingDependencies {
  config?: () => BillingConfiguration;
  stripe?: Stripe;
}

function stripeClient(config: BillingConfiguration, supplied?: Stripe): Stripe {
  if (supplied) return supplied;
  if (!config.modeMatches) throw new BillingError(503, 'LIVE_BILLING_NOT_CONFIGURED', 'Live billing is not connected yet. No payment was created.');
  return new Stripe(config.secretKey, { apiVersion: '2026-09-30.endive', timeout: 10_000, maxNetworkRetries: 1 });
}

class BillingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function fail(res: Response, error: unknown): void {
  if (error instanceof BillingError) {
    res.status(error.status).json({ code: error.code, error: error.message });
    return;
  }
  // Never log a Stripe error object: it can contain email, request data, or keys.
  console.error('Fieldwork billing request could not complete.');
  res.status(503).json({ code: 'BILLING_TEMPORARILY_UNAVAILABLE', error: 'Billing is temporarily unavailable. Check your account before trying another payment.' });
}

function identity(req: Request): CloudIdentity {
  const user = (req as Request & { fieldworkUser?: CloudIdentity }).fieldworkUser;
  if (!user?.userId || !['cookie', 'beta'].includes(user.authMethod)) throw new BillingError(401, 'SIGN_IN_REQUIRED', 'Sign in with a verified account before opening billing.');
  return user;
}

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}

function timestamp(value: unknown): Date | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? new Date(value * 1000) : null;
}

/** Locks survive commits so a persisted Checkout attempt can safely be retried. */
async function withUserLock<T>(pool: Pool, userId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('fieldwork-billing:' || $1, 0))", [userId]);
    locked = true;
    return await operation(client);
  } finally {
    let discard = false;
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(hashtextextended('fieldwork-billing:' || $1, 0))", [userId]); }
      catch { discard = true; }
    }
    client.release(discard);
  }
}

async function validatePrice(stripe: Stripe, plan: BillingPlan, livemode: boolean): Promise<void> {
  const price = await stripe.prices.retrieve(plan.priceId);
  if (!price.active || price.livemode !== livemode || price.currency !== 'usd'
    || price.unit_amount !== plan.amount || price.type !== 'recurring'
    || price.recurring?.interval !== plan.interval || price.recurring.interval_count !== 1
    || (plan.productId && objectId(price.product) !== plan.productId)) {
    throw new BillingError(503, 'BILLING_CATALOG_MISMATCH', 'The selected price needs owner verification before checkout can open. No payment was created.');
  }
}

interface CheckoutRow {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  livemode: boolean;
  plan_id: PlanId;
  integration_identifier: string;
  stripe_checkout_session_id: string | null;
  status: string;
}

async function openCheckout(client: PoolClient, stripe: Stripe, config: BillingConfiguration, attempt: CheckoutRow): Promise<Stripe.Checkout.Session> {
  if (attempt.stripe_checkout_session_id) return stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id);
  const metadata = { fieldwork_user_id: attempt.user_id, fieldwork_checkout_id: attempt.id };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: attempt.stripe_customer_id,
    client_reference_id: attempt.user_id,
    metadata,
    subscription_data: { metadata },
    line_items: [{ price: config.plans[attempt.plan_id].priceId, quantity: 1 }],
    allow_promotion_codes: true,
    integration_identifier: attempt.integration_identifier,
    success_url: `${config.appOrigin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appOrigin}/upgrade?canceled=1`,
    // Trial dates live in the account database. Checkout is an explicit purchase;
    // it never restarts the 72-hour trial or automatically charges free users.
  }, { idempotencyKey: `fieldwork-checkout-${attempt.id}` });
  if (session.livemode !== config.livemode || objectId(session.customer) !== attempt.stripe_customer_id) {
    throw new BillingError(503, 'CHECKOUT_MODE_MISMATCH', 'Checkout does not match this account configuration.');
  }
  await client.query(
    `UPDATE fieldwork_billing_checkouts SET stripe_checkout_session_id = $2,
       status = $3, expires_at = $4, updated_at = now() WHERE id = $1`,
    [attempt.id, session.id, session.status || 'open', timestamp(session.expires_at)],
  );
  return session;
}

async function createCheckout(pool: Pool, stripe: Stripe, config: BillingConfiguration, user: CloudIdentity, planId: PlanId) {
  if (!config.checkoutEnabled) throw new BillingError(503, 'BILLING_BACKEND_REQUIRED', 'New subscriptions are paused until durable billing and signed renewal processing are verified. No payment was created.');
  if (!Object.hasOwn(config.plans, planId)) throw new BillingError(400, 'INVALID_PLAN', 'Choose a valid Fieldwork plan.');
  if (RESERVED_IDS.includes(user.userId) || user.role === 'owner') {
    throw new BillingError(409, 'BETA_ACCESS_INCLUDED', 'Your existing full access is already included. No purchase is needed.');
  }
  return withUserLock(pool, user.userId, async (client) => {
    const existing = await client.query(
      `SELECT 1 FROM fieldwork_billing_subscriptions WHERE user_id = $1 AND livemode = $2
       AND status NOT IN ('canceled', 'incomplete_expired') LIMIT 1`, [user.userId, config.livemode],
    );
    if (existing.rowCount) throw new BillingError(409, 'SUBSCRIPTION_EXISTS', 'Use Manage billing to update your existing subscription. No second subscription was created.');
    const awaitingConfirmation = await client.query(
      `SELECT 1 FROM fieldwork_billing_checkouts c
       LEFT JOIN fieldwork_billing_subscriptions s ON s.stripe_subscription_id = c.stripe_subscription_id
       WHERE c.user_id = $1 AND c.livemode = $2 AND c.status = 'complete'
         AND s.stripe_subscription_id IS NULL LIMIT 1`, [user.userId, config.livemode],
    );
    if (awaitingConfirmation.rowCount) throw new BillingError(409, 'PAYMENT_CONFIRMATION_PENDING', 'Your existing checkout is complete. Its signed payment confirmation is being processed; do not pay again.');
    await validatePrice(stripe, config.plans[planId], config.livemode);
    let customer = (await client.query<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM fieldwork_billing_customers WHERE user_id = $1 AND livemode = $2', [user.userId, config.livemode],
    )).rows[0]?.stripe_customer_id;
    if (!customer) {
      const key = createHash('sha256').update(`${config.livemode}:${user.userId}`).digest('hex');
      const created = await stripe.customers.create({
        email: user.email, name: user.name, metadata: { fieldwork_user_id: user.userId },
      }, { idempotencyKey: `fieldwork-customer-${key}` });
      customer = created.id;
      await client.query(
        `INSERT INTO fieldwork_billing_customers (user_id, stripe_customer_id, livemode) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, livemode) DO NOTHING`,
        [user.userId, customer, config.livemode],
      );
      customer = (await client.query<{ stripe_customer_id: string }>(
        'SELECT stripe_customer_id FROM fieldwork_billing_customers WHERE user_id = $1 AND livemode = $2', [user.userId, config.livemode],
      )).rows[0].stripe_customer_id;
    }
    await client.query(`UPDATE fieldwork_billing_checkouts SET status = 'expired', updated_at = now()
      WHERE user_id = $1 AND livemode = $2 AND status IN ('pending', 'open') AND expires_at <= now()`, [user.userId, config.livemode]);
    const pending = (await client.query<CheckoutRow>(
      `SELECT * FROM fieldwork_billing_checkouts WHERE user_id = $1 AND livemode = $2
       AND status IN ('pending', 'open') AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [user.userId, config.livemode],
    )).rows[0];
    if (pending) {
      const opened = await openCheckout(client, stripe, config, pending);
      if (opened.status === 'complete') throw new BillingError(409, 'PAYMENT_CONFIRMATION_PENDING', 'Your existing checkout is complete. Its signed payment confirmation is being processed; do not pay again.');
      if (opened.status === 'open' && pending.plan_id === planId && opened.url) return { id: opened.id, url: opened.url, plan: planId };
      if (opened.status === 'open') await stripe.checkout.sessions.expire(opened.id);
      await client.query("UPDATE fieldwork_billing_checkouts SET status = 'expired', updated_at = now() WHERE id = $1", [pending.id]);
    }
    const attemptId = randomUUID();
    const suffix = Array.from(randomBytes(8), (value) => String.fromCharCode(97 + value % 26)).join('');
    let attempt = (await client.query<CheckoutRow>(
      `INSERT INTO fieldwork_billing_checkouts
        (id, user_id, stripe_customer_id, livemode, plan_id, integration_identifier)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, livemode) WHERE status IN ('pending', 'open') DO NOTHING RETURNING *`,
      [attemptId, user.userId, customer, config.livemode, planId, `fieldwork-cloud-${suffix}`],
    )).rows[0];
    if (!attempt) {
      attempt = (await client.query<CheckoutRow>(
        `SELECT * FROM fieldwork_billing_checkouts WHERE user_id = $1 AND livemode = $2
         AND status IN ('pending', 'open') ORDER BY created_at DESC LIMIT 1`, [user.userId, config.livemode],
      )).rows[0];
      if (!attempt || attempt.plan_id !== planId) throw new BillingError(409, 'CHECKOUT_IN_PROGRESS', 'Another checkout is being opened for this account. Refresh your billing details before trying again.');
    }
    // The attempt is committed BEFORE Stripe is called. A crash/timeout retries
    // this same idempotency key instead of creating an untracked second checkout.
    const session = await openCheckout(client, stripe, config, attempt);
    if (!session.url || session.status !== 'open') throw new BillingError(503, 'CHECKOUT_UNAVAILABLE', 'Checkout could not be opened. Your account has not been upgraded.');
    return { id: session.id, url: session.url, plan: planId };
  });
}

/** Uses the latest Stripe resource under a per-user lock, never event arrival order. */
export async function processBillingEvent(pool: Pool, stripe: Stripe, config: BillingConfiguration, event: Stripe.Event): Promise<string> {
  if (event.livemode !== config.livemode || !config.modeMatches) throw new BillingError(400, 'CHECKOUT_MODE_MISMATCH', 'Stripe event mode does not match this service.');
  const object = event.data.object as unknown as Record<string, unknown>;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO fieldwork_billing_events (stripe_event_id, livemode, event_type, event_created_at, stripe_object_id)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING stripe_event_id`,
      [event.id, event.livemode, event.type, timestamp(event.created), objectId(object)],
    );
    if (!inserted.rowCount) { await client.query('COMMIT'); return 'duplicate'; }
    const finish = async (outcome: string) => {
      await client.query('UPDATE fieldwork_billing_events SET outcome = $2, processed_at = now() WHERE stripe_event_id = $1', [event.id, outcome]);
      await client.query('COMMIT');
      return outcome;
    };
    if (!SUBSCRIPTION_EVENTS.has(event.type) && !CHECKOUT_EVENTS.has(event.type) && !INVOICE_EVENTS.has(event.type)) return await finish('ignored_event_type');
    const customerId = objectId(object.customer);
    const customer = (await client.query<{ user_id: string }>(
      'SELECT user_id FROM fieldwork_billing_customers WHERE stripe_customer_id = $1 AND livemode = $2', [customerId, config.livemode],
    )).rows[0];
    // The first-class Stripe Customer -> database owner mapping is authoritative.
    // Email and request-supplied metadata can never claim another user's payment.
    if (!customer) return await finish('unmapped_customer');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('fieldwork-billing:' || $1, 0))", [customer.user_id]);
    let subscriptionId: string | null = null;
    if (SUBSCRIPTION_EVENTS.has(event.type)) subscriptionId = objectId(object);
    if (INVOICE_EVENTS.has(event.type)) {
      const invoice = object as unknown as Stripe.Invoice;
      subscriptionId = objectId(invoice.parent?.subscription_details?.subscription) || objectId(object.subscription);
    }
    if (CHECKOUT_EVENTS.has(event.type)) {
      const session = await stripe.checkout.sessions.retrieve(String(object.id));
      const attempt = (await client.query<CheckoutRow>(
        'SELECT * FROM fieldwork_billing_checkouts WHERE stripe_checkout_session_id = $1', [session.id],
      )).rows[0];
      if (!attempt || attempt.user_id !== customer.user_id || attempt.stripe_customer_id !== customerId
        || attempt.livemode !== config.livemode || session.livemode !== config.livemode
        || objectId(session.customer) !== customerId || session.mode !== 'subscription'
        || session.client_reference_id !== customer.user_id
        || session.metadata?.fieldwork_user_id !== customer.user_id || session.metadata?.fieldwork_checkout_id !== attempt.id) {
        return await finish('checkout_ownership_mismatch');
      }
      const paymentStatus = event.type === 'checkout.session.async_payment_failed' && session.payment_status === 'unpaid' ? 'failed' : session.payment_status;
      await client.query('UPDATE fieldwork_billing_checkouts SET status = $2, stripe_subscription_id = $3, payment_status = $4, updated_at = now() WHERE id = $1', [attempt.id, session.status || 'open', objectId(session.subscription), paymentStatus]);
      subscriptionId = objectId(session.subscription);
      // Asynchronous methods may complete checkout before their payment succeeds.
      // An unpaid Checkout event itself never grants access; a paid invoice and
      // active latest Subscription are required in the reconciliation below.
      if (!['paid', 'no_payment_required'].includes(session.payment_status)) return await finish(paymentStatus === 'failed' ? 'payment_failed' : 'payment_pending');
    }
    if (!subscriptionId) return await finish('no_subscription');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
    if (objectId(subscription.customer) !== customerId || subscription.livemode !== config.livemode
      || (subscription.metadata.fieldwork_user_id && subscription.metadata.fieldwork_user_id !== customer.user_id)) {
      return await finish('subscription_ownership_mismatch');
    }
    const items = subscription.items.data;
    const item = items.length === 1 && items[0].quantity === 1 ? items[0] : null;
    const planId = item ? (Object.entries(config.plans).find(([, plan]) => plan.priceId === item.price.id)?.[0] as PlanId | undefined) : undefined;
    const periodEnd = item ? timestamp(item.current_period_end) : null;
    const latestInvoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
    const invoicePaid = latestInvoice?.status === 'paid';
    const accessEnd = subscription.status === 'active' && invoicePaid && planId && periodEnd && periodEnd.getTime() > Date.now() ? periodEnd : null;
    await client.query(
      `INSERT INTO fieldwork_billing_subscriptions
        (stripe_subscription_id, user_id, stripe_customer_id, livemode, plan_id, status, current_period_end,
         paid_access_ends_at, cancel_at_period_end, canceled_at, latest_invoice_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end,
         paid_access_ends_at = EXCLUDED.paid_access_ends_at, cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         canceled_at = EXCLUDED.canceled_at, latest_invoice_paid = EXCLUDED.latest_invoice_paid, updated_at = now()
       WHERE fieldwork_billing_subscriptions.user_id = EXCLUDED.user_id
         AND fieldwork_billing_subscriptions.stripe_customer_id = EXCLUDED.stripe_customer_id
         AND fieldwork_billing_subscriptions.livemode = EXCLUDED.livemode`,
      [subscription.id, customer.user_id, customerId, config.livemode, planId || null, subscription.status,
        periodEnd, accessEnd, subscription.cancel_at_period_end, timestamp(subscription.canceled_at), invoicePaid],
    );
    const active = (await client.query<{ plan_id: PlanId; paid_access_ends_at: Date }>(
      `SELECT plan_id, paid_access_ends_at FROM fieldwork_billing_subscriptions
       WHERE user_id = $1 AND livemode = $2 AND status = 'active' AND latest_invoice_paid
         AND paid_access_ends_at > now() AND plan_id IS NOT NULL
       ORDER BY (plan_id <> 'individual_monthly') DESC, paid_access_ends_at DESC LIMIT 1`,
      [customer.user_id, config.livemode],
    )).rows[0];
    const tier = active ? config.plans[active.plan_id].subscription : null;
    await client.query(
      `UPDATE fieldwork_entitlements SET role = $2, subscription = $3, export_pass = $4,
         billing_access_ends_at = $5, updated_at = now()
       WHERE user_id = $1 AND user_id <> ALL($6::text[]) AND role <> 'owner'`,
      [customer.user_id, active ? (tier === 'professional' ? 'professional' : 'paid') : 'free', tier,
        Boolean(active), active?.paid_access_ends_at || null, RESERVED_IDS],
    );
    return await finish(planId ? 'reconciled' : 'unmapped_price');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

/** Mount under /api/cloud BEFORE express.json and before browser auth middleware. */
export function createBillingWebhookRouter(pool: Pool, dependencies: BillingDependencies = {}): Router {
  const router = Router();
  router.post('/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    const config = (dependencies.config || billingConfiguration)();
    if (!config.modeMatches || !config.webhookSecret.startsWith('whsec_')) {
      res.status(503).json({ code: 'WEBHOOK_NOT_CONFIGURED' }); return;
    }
    const signature = req.headers['stripe-signature'];
    if (!Buffer.isBuffer(req.body) || typeof signature !== 'string') {
      res.status(400).json({ code: 'INVALID_WEBHOOK_SIGNATURE' }); return;
    }
    const stripe = stripeClient(config, dependencies.stripe);
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(req.body, signature, config.webhookSecret); }
    catch { res.status(400).json({ code: 'INVALID_WEBHOOK_SIGNATURE' }); return; }
    try {
      const outcome = await processBillingEvent(pool, stripe, config, event);
      res.status(200).json({ received: true, outcome });
    } catch (error) { fail(res, error); }
  });
  return router;
}

/** Mount under /api/cloud AFTER JSON parsing and the verified identity middleware. */
export function createBillingRouter(pool: Pool, dependencies: BillingDependencies = {}): Router {
  const router = Router();
  router.use('/billing', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/billing/checkout', async (req, res) => {
    try {
      const user = identity(req);
      const config = (dependencies.config || billingConfiguration)();
      if (!config.checkoutEnabled) throw new BillingError(503, 'BILLING_BACKEND_REQUIRED', 'Live checkout is not open yet. Your account has not been charged.');
      const result = await createCheckout(pool, stripeClient(config, dependencies.stripe), config, user, String(req.body?.plan || '') as PlanId);
      res.json(result);
    } catch (error) { fail(res, error); }
  });
  router.get('/billing/status', async (req, res) => {
    try {
      const user = identity(req);
      const config = (dependencies.config || billingConfiguration)();
      const subscriptions = await pool.query(
        `SELECT plan_id AS plan, status, current_period_end AS "currentPeriodEnd",
          paid_access_ends_at AS "paidAccessEndsAt", cancel_at_period_end AS "cancelAtPeriodEnd"
         FROM fieldwork_billing_subscriptions WHERE user_id = $1 AND livemode = $2 ORDER BY updated_at DESC`,
        [user.userId, config.livemode],
      );
      const customer = await pool.query('SELECT 1 FROM fieldwork_billing_customers WHERE user_id = $1 AND livemode = $2', [user.userId, config.livemode]);
      res.json({ checkoutEnabled: config.checkoutEnabled, hasBillingAccount: Boolean(customer.rowCount), user, subscriptions: subscriptions.rows });
    } catch (error) { fail(res, error); }
  });
  router.post('/billing/complete', async (req, res) => {
    try {
      const user = identity(req);
      const sessionId = String(req.body?.sessionId || '');
      if (!/^cs_[A-Za-z0-9_]{8,}$/.test(sessionId)) throw new BillingError(400, 'INVALID_CHECKOUT', 'A valid checkout reference is required.');
      const config = (dependencies.config || billingConfiguration)();
      const checkout = (await pool.query<{ plan_id: PlanId; status: string; payment_status: string }>(
        `SELECT plan_id, status, payment_status FROM fieldwork_billing_checkouts
         WHERE stripe_checkout_session_id = $1 AND user_id = $2 AND livemode = $3`,
        [sessionId, user.userId, config.livemode],
      )).rows[0];
      if (!checkout) throw new BillingError(404, 'CHECKOUT_NOT_FOUND', 'This checkout is not linked to your account.');
      if (checkout.payment_status === 'failed' && !['paid', 'professional', 'owner'].includes(user.role)) {
        throw new BillingError(402, 'PAYMENT_FAILED', 'Your payment did not complete. Use Manage billing to review it before trying another payment.');
      }
      if (checkout.status === 'expired') throw new BillingError(410, 'CHECKOUT_EXPIRED', 'This checkout expired. Return to upgrade to choose a new checkout.');
      // This page can only observe the durable result. It cannot fulfill a
      // purchase, lengthen access, or mint a year-long paid bearer token.
      const active = checkout.status === 'complete' && ['paid', 'professional', 'owner'].includes(user.role);
      res.status(active ? 200 : 202).json({ status: active ? 'active' : 'pending', plan: checkout.plan_id, user,
        message: active ? 'Your paid access is active.' : 'Waiting for signed payment confirmation. Do not pay again.' });
    } catch (error) { fail(res, error); }
  });
  router.post('/billing/portal', async (req, res) => {
    try {
      const user = identity(req);
      const config = (dependencies.config || billingConfiguration)();
      if (!config.appOrigin) throw new BillingError(503, 'BILLING_NOT_CONFIGURED', 'Billing settings are not available yet.');
      const customer = (await pool.query<{ stripe_customer_id: string }>(
        'SELECT stripe_customer_id FROM fieldwork_billing_customers WHERE user_id = $1 AND livemode = $2', [user.userId, config.livemode],
      )).rows[0];
      if (!customer) throw new BillingError(404, 'NO_BILLING_ACCOUNT', 'You do not have a Fieldwork billing account yet.');
      // Cancellation and payment updates remain available even when NEW checkout
      // is paused. The portal never accepts a customer ID from the browser.
      const session = await stripeClient(config, dependencies.stripe).billingPortal.sessions.create({
        customer: customer.stripe_customer_id, return_url: `${config.appOrigin}/upgrade`,
      });
      res.json({ url: session.url });
    } catch (error) { fail(res, error); }
  });
  return router;
}

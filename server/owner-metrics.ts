import { CloudError, cloudConfiguration } from './cloud-client.js';
import { billingMode, stripeRequest, planForPrice } from './billing.js';
import { isFunnelQaEmail } from './funnel-ledger.js';

type Row = Record<string, any>;
const flagged = (row: Row) => ['qa', 'test', 'baker_funnel_qa'].some(key => (row?.metadata?.[key] === 'true' || row?.metadata?.[key] === true)) || row?.metadata?.baker_mode === 'test';
const id = (value: any): string => typeof value === 'string' ? value : value?.id;
export async function stripePages(path: string): Promise<Row[]> {
  const rows: Row[] = []; let cursor = '';
  for (let page = 0; page < 1000; page++) {
    const result = await stripeRequest(path + (path.includes('?') ? '&' : '?') + 'limit=100' + (cursor ? '&starting_after=' + encodeURIComponent(cursor) : ''));
    if (!Array.isArray(result.data) || typeof result.has_more !== 'boolean') throw new CloudError('BILLING_REPORT_INCOMPLETE');
    rows.push(...result.data);
    if (!result.has_more) return rows;
    const next = result.data.at(-1)?.id;
    if (!next || next === cursor) throw new CloudError('BILLING_REPORT_INCOMPLETE');
    cursor = next;
  }
  throw new CloudError('BILLING_REPORT_INCOMPLETE');
}
async function accountPages(path: string, users = false): Promise<Row[]> {
  const { url } = cloudConfiguration(); const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith('sb_secret_')) throw new CloudError('OWNER_REPORT_NOT_CONFIGURED');
  const rows: Row[] = []; const seen = new Set<string>();
  for (let page = 0; page < 1000; page++) {
    const response = await fetch(url + path + (users ? `?page=${page + 1}&per_page=100` : `&limit=100&offset=${page * 100}`), { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new CloudError('ACCOUNT_REPORT_UNAVAILABLE');
    const payload = await response.json(); const batch = users ? payload.users : payload;
    if (!Array.isArray(batch)) throw new CloudError('ACCOUNT_REPORT_INCOMPLETE');
    for (const row of batch) { if (!row.id || seen.has(row.id)) throw new CloudError('ACCOUNT_REPORT_INCOMPLETE'); seen.add(row.id); }
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new CloudError('ACCOUNT_REPORT_INCOMPLETE');
}
export function summarizeOwnerMetrics(users: Row[], profiles: Row[], subscriptions: Row[], invoices: Row[], now = Date.now()) {
  const excludedUsers = new Set(users.filter(user => isFunnelQaEmail(user.email) || user.user_metadata?.baker_funnel?.qa === true || flagged({ metadata: user.app_metadata })).map(user => user.id));
  const realUsers = users.filter(user => !excludedUsers.has(user.id));
  const excludedCustomers = new Set<string>();
  for (const sub of subscriptions) if (excludedUsers.has(sub.metadata?.baker_account_id) || flagged(sub) || flagged(sub.customer) || isFunnelQaEmail(sub.customer?.email)) excludedCustomers.add(id(sub.customer));
  const eligible = subscriptions.filter(sub => sub.livemode === true && !flagged(sub) && !excludedCustomers.has(id(sub.customer)) && !excludedUsers.has(sub.metadata?.baker_account_id));
  const fieldwork = eligible.filter(sub => {
    if (sub.items?.has_more) throw new CloudError('BILLING_REPORT_INCOMPLETE');
    return sub.items?.data?.some((item: Row) => planForPrice(item.price?.id, 'live') !== 'none' && item.price?.unit_amount > 0);
  });
  const bySubscription = new Map(fieldwork.map(sub => [sub.id, sub]));
  const paid = new Set<string>(); const collected: Record<string, number> = {};
  for (const invoice of invoices) {
    const subscriptionId = id(invoice.subscription) || id(invoice.parent?.subscription_details?.subscription);
    if (!bySubscription.has(subscriptionId) || invoice.livemode !== true || invoice.status !== 'paid' || invoice.paid_out_of_band || invoice.amount_paid <= 0 || flagged(invoice) || excludedCustomers.has(id(invoice.customer))) continue;
    // Fail closed for partial or mixed-product invoices; never attribute an entire mixed invoice to Fieldwork.
    if (invoice.lines?.has_more || !Array.isArray(invoice.lines?.data) || invoice.lines.data.some((line: Row) => planForPrice(line.price?.id || line.pricing?.price_details?.price, 'live') === 'none')) throw new CloudError('BILLING_INVOICE_SCOPE_UNAVAILABLE');
    paid.add(subscriptionId);
    collected[invoice.currency] = (collected[invoice.currency] || 0) + invoice.amount_paid;
  }
  const groups: Record<string, Set<string>> = { activePaid: new Set(), trial: new Set(), pastDue: new Set(), canceled: new Set(), otherBilling: new Set() };
  const account = (sub: Row) => sub.metadata?.baker_account_id || id(sub.customer);
  const active = fieldwork.filter(sub => sub.status === 'active' && paid.has(sub.id));
  const mrr: Record<string, number> = {};
  for (const sub of fieldwork) {
    const group = sub.status === 'active' && paid.has(sub.id) ? 'activePaid' : sub.status === 'trialing' ? 'trial' : ['past_due', 'unpaid'].includes(sub.status) ? 'pastDue' : sub.status === 'canceled' ? 'canceled' : 'otherBilling';
    // A genuinely free subscription is not a canceled/past-due paying account.
    if (group !== 'trial' && !paid.has(sub.id)) continue;
    groups[group].add(account(sub));
  }
  for (const sub of active) {
    let amount = 0; let currency = '';
    for (const item of sub.items.data) {
      if (planForPrice(item.price?.id, 'live') === 'none' || !Number.isFinite(item.price?.unit_amount)) throw new CloudError('BILLING_MRR_UNAVAILABLE');
      if (sub.discounts?.some((discount: Row) => (discount?.coupon || discount?.source?.coupon)?.amount_off) && sub.items.data.length !== 1) throw new CloudError('BILLING_MRR_UNAVAILABLE');
      const price = item.price; currency ||= price.currency;
      if (currency !== price.currency) throw new CloudError('BILLING_MRR_UNAVAILABLE');
      const recurring = price.recurring; const months = recurring?.interval === 'year' ? 12 * recurring.interval_count : recurring?.interval === 'month' ? recurring.interval_count : 0;
      if (!months || item.discounts?.length) throw new CloudError('BILLING_MRR_UNAVAILABLE');
      let value = price.unit_amount * item.quantity;
      for (const discount of sub.discounts || []) {
        const coupon = discount?.coupon || discount?.source?.coupon;
        if (!coupon || typeof coupon !== 'object' || coupon.applies_to || (coupon.amount_off && coupon.currency !== currency)) throw new CloudError('BILLING_MRR_UNAVAILABLE');
        if (discount.end && discount.end * 1000 <= now) continue;
        value = coupon.percent_off != null ? value * (1 - coupon.percent_off / 100) : Math.max(0, value - (coupon.amount_off || 0));
      }
      amount += value / months;
    }
    mrr[currency] = (mrr[currency] || 0) + amount;
  }
  const known = new Set(realUsers.map(user => user.id));
  const billingAccounts = new Set(fieldwork.filter(sub => sub.status === 'trialing' || paid.has(sub.id)).map(account));
  const legacyTrial = profiles.filter(profile => known.has(profile.id) && !billingAccounts.has(profile.id) && Date.parse(profile.trial_ends_at) > now);
  const verified = profiles.filter(profile => known.has(profile.id));
  return {
    registered: realUsers.length, verified: verified.length,
    free: verified.filter(profile => !billingAccounts.has(profile.id) && !legacyTrial.some(trial => trial.id === profile.id)).length,
    legacyTrial: legacyTrial.length, ...Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.size])),
    activeSubscriptions: active.length, uniquePayers: new Set(fieldwork.filter(sub => paid.has(sub.id)).map(account)).size,
    scheduledCancellation: new Set(active.filter(sub => sub.cancel_at_period_end || sub.cancel_at).map(account)).size,
    mrr, collected, qaAccountsExcluded: excludedUsers.size,
    unlinkedBillingAccounts: new Set(fieldwork.filter(sub => !known.has(sub.metadata?.baker_account_id) && paid.has(sub.id)).map(account)).size,
  };
}
export async function readOwnerMetrics(page = 1, status = 'all') {
  if (billingMode() !== 'live') throw new CloudError('LIVE_BILLING_REQUIRED');
  const startedAt = new Date().toISOString();
  const [users, profiles, subscriptions, invoices] = await Promise.all([
    accountPages('/auth/v1/admin/users', true), accountPages('/rest/v1/profiles?select=id,trial_ends_at&order=id'),
    stripePages('/v1/subscriptions?status=all&expand[]=data.customer&expand[]=data.discounts'),
    stripePages('/v1/invoices'),
  ]);
  const metrics = summarizeOwnerMetrics(users, profiles, subscriptions, invoices);
  const directory = users.filter(user => !isFunnelQaEmail(user.email) && user.user_metadata?.baker_funnel?.qa !== true && !flagged({ metadata: user.app_metadata })).map(user => {
    const own = subscriptions.filter(sub => sub.livemode === true && !flagged(sub) && !flagged(sub.customer) && !isFunnelQaEmail(sub.customer?.email) && sub.metadata?.baker_account_id === user.id && sub.items?.data?.some((item: Row) => planForPrice(item.price?.id, 'live') !== 'none' && item.price?.unit_amount > 0));
    return { name: String(user.user_metadata?.name || '').slice(0, 120), email: user.email, registeredAt: user.created_at, verified: Boolean(user.email_confirmed_at), lastSignInAt: user.last_sign_in_at || null,
      subscriptions: own.map(sub => ({ plan: sub.items.data.map((item: Row) => planForPrice(item.price?.id, 'live')).join(', '), status: sub.status, canceling: Boolean(sub.cancel_at_period_end || sub.cancel_at) })) };
  }).filter(user => status === 'all' || user.subscriptions.some(sub => sub.status === status)).sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)));
  return { version: 'owner-metrics-v1', startedAt, checkedAt: new Date().toISOString(), metrics, directory: { page, pageSize: 50, total: directory.length, users: directory.slice((page - 1) * 50, page * 50) } };
}

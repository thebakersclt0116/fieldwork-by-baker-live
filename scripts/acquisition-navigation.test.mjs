import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'fieldwork-acquisition-navigation-'));
await build({ entryPoints: ['src/lib/acquisitionFunnel.ts', 'src/lib/adMeasurement.ts'], outdir: dir, bundle: true, platform: 'browser', format: 'esm', outExtension: { '.js': '.mjs' } });
const funnel = await import(pathToFileURL(join(dir, 'acquisitionFunnel.mjs')));
const ads = await import(pathToFileURL(join(dir, 'adMeasurement.mjs')));
const original = new Map(['window', 'location', 'navigator', 'sessionStorage', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const journeyKey = 'baker-acquisition-journey-v1';
const campaign = '120251729153710531';
const tagged = variant => `?bf_campaign=${campaign}&bf_experiment=signup-v1&bf_variant=${variant}&fbclid=FictionalClick12345`;

function storage() {
  const values = new Map();
  return { writes: 0, getItem: key => values.get(key) ?? null, setItem(key, value) { this.writes++; values.set(key, value); }, removeItem(key) { this.writes++; values.delete(key); } };
}
function environment(search = '') {
  const session = storage(), local = storage(), requests = [];
  const location = { search };
  const values = {
    window: { location, dispatchEvent() {} }, location,
    navigator: { globalPrivacyControl: false }, sessionStorage: session, localStorage: local,
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json({ recorded: true }); },
  };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  return { session, local, requests, location };
}
function visit(path, location) { location.search = new URL(path, 'https://fieldwork.invalid').search; }
after(async () => {
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  await rm(dir, { recursive: true, force: true });
});

test('public links retain only bounded acquisition fields, preserve their own return path and never touch storage', () => {
  const state = environment();
  const query = tagged('home') + '&utm_source=facebook&utm_id=ad123&private=fieldwork&access_token=secret&email=private%40example.invalid&return=%2Fadmin&oversized=' + 'x'.repeat(1100);
  const link = new URL(funnel.withAcquisitionQuery('/signup?return=%2Fexam-lab#form', query), 'https://fieldwork.invalid');
  assert.equal(link.searchParams.get('return'), '/exam-lab');
  assert.equal(link.hash, '#form');
  assert.equal(link.searchParams.get('bf_variant'), 'home');
  assert.equal(link.searchParams.get('fbclid'), 'FictionalClick12345');
  assert.equal(link.searchParams.get('utm_id'), 'ad123');
  for (const key of ['private', 'access_token', 'email', 'oversized']) assert.equal(link.searchParams.has(key), false);
  assert.equal(funnel.withAcquisitionQuery('/signup', '?utm_source=' + 'x'.repeat(1025)), '/signup');
  for (const destination of ['https://external.invalid', '//external.invalid', '/a/..//external.invalid', '/\\external.invalid']) assert.equal(funnel.withAcquisitionQuery(destination, query), destination);
  assert.equal(state.session.writes, 0); assert.equal(state.local.writes, 0); assert.equal(state.requests.length, 0);
});

for (const variant of ['home', 'signup']) test(`${variant} arrival survives pricing/demo/login links before late consent without premature measurement`, async () => {
  const state = environment(tagged(variant));
  for (const destination of ['/pricing', '/demo', '/login?return=%2Fupgrade', '/signup?return=%2Fupgrade']) {
    visit(funnel.withAcquisitionQuery(destination, state.location.search), state.location);
    await funnel.measurePublicLanding('/signup');
  }
  assert.equal(state.session.writes, 0); assert.equal(state.local.writes, 0); assert.equal(state.requests.length, 0);
  ads.saveAdChoice(true);
  await funnel.measurePublicLanding('/signup');
  assert.equal(state.requests.length, 1);
  const received = state.requests[0].body;
  assert.equal(received.context.campaign, campaign); assert.equal(received.context.variant, variant);
  assert.match(received.adMeasurement.fbc, /\.FictionalClick12345$/);
  const firstFlow = received.context.flowId;
  visit(funnel.withAcquisitionQuery('/signup', state.location.search), state.location);
  await funnel.measurePublicLanding('/signup');
  assert.equal(state.requests.length, 1); assert.equal(funnel.acquisitionContext().flowId, firstFlow);
});

test('explicit direct-signup ad replaces an organic journey once and repeated navigation keeps its event identity', async () => {
  const state = environment();
  const organic = funnel.acquisitionContext();
  assert.equal(organic.campaign, 'direct');
  state.location.search = tagged('signup');
  ads.saveAdChoice(true);
  const attributed = funnel.acquisitionContext();
  assert.notEqual(attributed.flowId, organic.flowId); assert.equal(attributed.variant, 'signup'); assert.equal(attributed.campaign, campaign);
  await funnel.measurePublicLanding('/signup');
  for (const destination of ['/pricing', '/demo', '/signup']) {
    visit(funnel.withAcquisitionQuery(destination, state.location.search), state.location);
    assert.equal(funnel.acquisitionContext().flowId, attributed.flowId);
    await funnel.measurePublicLanding('/signup');
  }
  assert.equal(state.requests.length, 1);
});

test('missing or malformed experiment tags cannot replace an existing organic journey', () => {
  const state = environment(); const organic = funnel.acquisitionContext();
  for (const query of [`?bf_campaign=${campaign}&bf_variant=signup`, '?bf_campaign=unknown&bf_experiment=signup-v1&bf_variant=signup', `?bf_campaign=${campaign}&bf_experiment=signup-v1&bf_variant=unknown`]) {
    state.location.search = query; assert.deepEqual(funnel.acquisitionContext(), organic);
  }
});

test('known campaign assignment remains stable and QA is promoted and never downgraded', () => {
  const state = environment(tagged('home')); const home = funnel.acquisitionContext();
  state.location.search = tagged('signup') + '&bf_qa=1';
  const qa = funnel.acquisitionContext();
  assert.equal(qa.flowId, home.flowId); assert.equal(qa.variant, 'home'); assert.equal(qa.qa, true);
  state.location.search = ''; assert.equal(funnel.acquisitionContext().qa, true);
  state.session.setItem(journeyKey, JSON.stringify({ ...qa, campaign: 'direct', variant: 'direct' }));
  state.location.search = tagged('signup');
  const replacement = funnel.acquisitionContext();
  assert.equal(replacement.qa, true); assert.equal(replacement.variant, 'signup'); assert.notEqual(replacement.flowId, qa.flowId);
});

test('invalid stored context cannot override a legitimate tagged arrival', () => {
  const state = environment(tagged('signup'));
  for (const stored of [{ campaign: 'unknown', variant: 'home' }, { campaign, variant: 'direct' }, { campaign, variant: 'signup', qa: 'false' }, { campaign, variant: 'home', flowId: '-'.repeat(36) }]) {
    state.session.setItem(journeyKey, JSON.stringify({ version: 'funnel-v1', flowId: '11111111-1111-4111-8111-111111111111', qa: false, ...stored }));
    const context = funnel.acquisitionContext(); assert.equal(context.campaign, campaign); assert.equal(context.variant, 'signup'); assert.equal(context.qa, false);
  }
});

test('declining or GPC never transmits optional attribution when creating an account', async () => {
  const state = environment(tagged('signup'));
  ads.saveAdChoice(false);
  assert.equal(funnel.accountFunnelInput().funnel.campaign, 'direct'); assert.equal(funnel.accountFunnelInput().adMeasurement, undefined);
  assert.equal(JSON.parse(state.session.getItem(journeyKey)).campaign, 'direct');
  ads.saveAdChoice(true); globalThis.navigator.globalPrivacyControl = true;
  await funnel.measurePublicLanding('/signup');
  assert.equal(funnel.accountFunnelInput().funnel.variant, 'direct'); assert.equal(funnel.accountFunnelInput().adMeasurement, undefined);
  assert.equal(state.requests.length, 0);
});

test('a declined tagged signup retains its organic flow and stores no new attribution until opt-in', () => {
  const state = environment(); const organic = funnel.acquisitionContext();
  state.location.search = tagged('signup'); ads.saveAdChoice(false);
  const priorWrites = state.session.writes;
  const declined = funnel.accountFunnelInput();
  assert.equal(declined.funnel.flowId, organic.flowId); assert.equal(declined.funnel.campaign, 'direct');
  assert.equal(state.session.writes, priorWrites); assert.equal(JSON.parse(state.session.getItem(journeyKey)).variant, 'direct');
  ads.saveAdChoice(true);
  const allowed = funnel.accountFunnelInput();
  assert.equal(allowed.funnel.campaign, campaign); assert.equal(allowed.funnel.variant, 'signup'); assert.notEqual(allowed.funnel.flowId, organic.flowId);
  assert.equal(funnel.accountFunnelInput().funnel.flowId, allowed.funnel.flowId);
});

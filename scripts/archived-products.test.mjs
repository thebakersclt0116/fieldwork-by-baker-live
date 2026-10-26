import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'fieldwork-archive-test-'));
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); });
const handlers = {};
const oidcMock = {
  name: 'no-external-gateway',
  setup(builder) {
    builder.onResolve({ filter: /^@vercel\/oidc$/ }, () => ({ path: 'oidc', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function getVercelOidcToken(){return null;}', loader: 'js' }));
  },
};
for (const name of ['admin-access', 'commons', 'community', 'baker-ai']) {
  const output = join(dir, name + '.mjs');
  await build({ entryPoints: ['api/' + name + '.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', plugins: [oidcMock] });
  handlers[name] = (await import(pathToFileURL(output))).default;
}

Object.assign(process.env, { VERCEL_ENV: 'production', SUPABASE_URL: 'https://fictional.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional' });
delete process.env.AI_GATEWAY_API_KEY;
const uid = '11111111-1111-4111-8111-111111111111';
let dataCalls = [];
function mock(role = 'paid', { confirmed = true, unavailable = false } = {}) {
  dataCalls = [];
  globalThis.fetch = async (url, options) => {
    if (unavailable) throw new Error('Synthetic unavailable identity provider');
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: uid, email: 'fictional@example.invalid', email_confirmed_at: confirmed ? '2026-01-01' : null });
    if (url.includes('/profiles?')) return Response.json([{ role, display_name: 'Fictional User', subscription_tier: role === 'paid' ? 'individual' : 'none', subscription_status: role === 'paid' ? 'active' : 'none' }]);
    dataCalls.push({ url, options });
    return Response.json([]);
  };
}
const request = (method = 'GET', body) => ({ method, headers: { authorization: 'Bearer fictional-cloud-token' }, body });
const response = () => ({
  code: 0, headers: {}, body: null,
  setHeader(key, value) { this.headers[key] = value; return this; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = JSON.parse(body); return this; },
});

test('archive access rejects anonymous, member, forged browser owner and unverified identities', async () => {
  mock();
  let res = response();
  await handlers['admin-access']({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 401);
  for (const role of ['free', 'paid', 'professional', 'supervisor']) {
    mock(role);
    res = response();
    await handlers['admin-access']({ ...request(), body: { role: 'owner' }, query: { role: 'owner' } }, res);
    assert.equal(res.code, 403);
    assert.deepEqual(dataCalls, []);
  }
  mock('owner', { confirmed: false });
  res = response();
  await handlers['admin-access'](request(), res);
  assert.equal(res.code, 403);
});

test('managed owner can open the archive only after server role verification; outages fail closed', async () => {
  mock('owner');
  let res = response();
  await handlers['admin-access'](request(), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { authorized: true });
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  mock('owner', { unavailable: true });
  res = response();
  await handlers['admin-access'](request(), res);
  assert.equal(res.code, 403);
  assert.equal(res.body.authorized, undefined);
});

test('archived community APIs deny members before reading or modifying community records', async () => {
  for (const name of ['commons', 'community']) {
    for (const method of ['GET', 'POST']) {
      mock('paid');
      const res = response();
      await handlers[name]({ ...request(method, { action: 'heartbeat', role: 'owner' }), query: { role: 'owner' } }, res);
      assert.equal(res.code, 403);
      assert.equal(res.body.code, 'PRODUCT_ARCHIVED');
      assert.deepEqual(dataCalls, []);
    }
  }
});

test('owner archive preview retains access to saved community records', async () => {
  mock('owner');
  const res = response();
  await handlers.commons(request(), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.posts, []);
  assert.equal(dataCalls.length, 1);
  assert.ok(dataCalls[0].url.endsWith('/rpc/commons_feed'));
});

test('standalone Baker Brain is archived for paid members while the hours entry helper still works', async () => {
  mock('paid');
  let res = response();
  await handlers['baker-ai'](request('POST', { mode: 'bcba-brain', message: 'Explain duration.' }), res);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'PRODUCT_ARCHIVED');
  assert.deepEqual(dataCalls, []);
  res = response();
  await handlers['baker-ai'](request('POST', { mode: 'fieldwork-entry', text: 'Worked independently for 2 hours on data analysis.', date: '2026-10-25' }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.result.duration, 2);
  assert.equal(res.body.provider, 'deterministic-fallback');
});

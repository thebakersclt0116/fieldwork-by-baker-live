import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'fieldwork-owner-revocation-'));
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); });
const output = join(dir, 'auth.mjs');
await build({ entryPoints: ['api/_auth.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm' });
const auth = await import(pathToFileURL(output));

test('legacy credentials can no longer create or recover an administrator identity', () => {
  // Credential contents cannot change this result: the owner has no beta identity.
  for (const email of [auth.BAKER_OWNER_EMAIL, ' ' + auth.BAKER_OWNER_EMAIL.toUpperCase() + ' ']) {
    assert.equal(auth.verifyBetaCredentials(email, 'synthetic-not-a-real-credential'), null);
    assert.equal(auth.issueBetaSessionFromCredentials(email, 'synthetic-not-a-real-credential'), null);
  }
});

test('legacy b2 owner identities are rejected even before signature verification', () => {
  const owner = { email: auth.BAKER_OWNER_EMAIL, name: 'Legacy Owner', role: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = 'b2.' + Buffer.from(JSON.stringify(owner)).toString('base64url') + '.revoked-signature';
  assert.equal(auth.verifySession(token), null);
});

test('managed verified owner access remains available; email alone cannot grant an owner role', async () => {
  Object.assign(process.env, { VERCEL_ENV: 'production', SUPABASE_URL: 'https://fictional.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional' });
  let role = 'owner';
  globalThis.fetch = async (url) => url.endsWith('/auth/v1/user')
    ? Response.json({ id: '11111111-1111-4111-8111-111111111111', email: auth.BAKER_OWNER_EMAIL, email_confirmed_at: '2026-01-01' })
    : Response.json([{ role, display_name: 'Managed Owner', subscription_tier: 'none', subscription_status: 'none' }]);
  const req = { headers: { authorization: 'Bearer fictional-managed-owner' } };
  const session = await auth.requireAccountSession(req, ['owner']);
  assert.equal(session.role, 'owner');
  assert.equal(session.authProvider, 'supabase');
  role = 'free';
  assert.equal(await auth.requireAccountSession(req, ['owner']), null);
});

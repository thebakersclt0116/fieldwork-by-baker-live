import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createFieldworkAuth, ensureDefaultEntitlement, type FieldworkAuthConfig } from '../auth.js';
import { migrateAuthSchema } from '../auth-schema.js';
import { createIdentityResolver, verifiedBetaIdentity } from '../identity.js';
import type { AuthEmail } from '../email.js';

const origin = 'https://fieldwork.example.test';
const basePath = '/api/cloud/auth';

function cookies(response: Response): string {
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}

function emailUrl(message: AuthEmail | undefined): string {
  assert.ok(message, 'A test-captured account message exists.');
  const url = message.text.split('\n').find((line) => line.startsWith(`${origin}${basePath}/`));
  assert.ok(url, 'The captured account link uses the configured application origin.');
  return url;
}

test('legacy free, supervisor, malformed, and forged beta credentials cannot become cloud identities', async () => {
  let sessionReads = 0;
  const resolve = createIdentityResolver({
    pool: {} as Pool,
    getSession: async () => {
      sessionReads += 1;
      throw new Error('An explicit invalid bearer must not fall back to cookies.');
    },
  });
  const encoded = Buffer.from(JSON.stringify({
    email: 'ayalaemily52@gmail.com', role: 'owner', exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  for (const authorization of [
    'Bearer cloud-session',
    `Bearer ${encoded}.legacyHmac`,
    `Bearer b2.${encoded}.${randomBytes(64).toString('base64url')}`,
    'Bearer b2.invalid.signature',
    'Basic ignored',
  ]) {
    assert.equal(verifiedBetaIdentity({ headers: { authorization } }), null);
    assert.equal(await resolve({ headers: { authorization, cookie: 'another-user-session' } }), null);
  }
  assert.equal(sessionReads, 0);
});

test('unverified or expired cookie sessions cannot read cloud records', async () => {
  for (const [emailVerified, expiresAt] of [[false, '2099-01-01'], [true, '2000-01-01'], [true, 'invalid']] as const) {
    const resolve = createIdentityResolver({
      pool: {} as Pool,
      getSession: async () => ({
        user: { id: 'untrusted', email: 'user@example.test', emailVerified },
        session: { expiresAt },
      }),
    });
    assert.equal(await resolve({ headers: { cookie: 'test' } }), null);
  }
});

test('durable verified accounts, reserved recovery, immutable trials, and shared rate limits', {
  skip: !process.env.FIELDWORK_TEST_DATABASE_URL && 'Set FIELDWORK_TEST_DATABASE_URL to an isolated loopback PostgreSQL database.',
  timeout: 120_000,
}, async (t) => {
  const testUrl = new URL(process.env.FIELDWORK_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(testUrl.hostname), 'Auth tests only use a loopback test database.');
  const schema = `fieldwork_auth_test_${randomBytes(8).toString('hex')}`;
  const admin = new Pool({ connectionString: testUrl.toString(), ssl: false, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({
    connectionString: testUrl.toString(),
    ssl: false,
    max: 1,
    options: `-c search_path=${schema}`,
  });
  const messages: AuthEmail[] = [];
  const background: Promise<unknown>[] = [];
  const config: FieldworkAuthConfig = {
    pool,
    secret: randomBytes(48).toString('base64url'),
    appOrigin: origin,
    production: false,
    signupEnabled: true,
    emailConfigured: true,
    sendEmail: async (message) => { messages.push(message); },
    backgroundTask: (task) => { background.push(task); },
  };
  const flushMail = async () => { await Promise.all(background.splice(0)); };
  try {
    await migrateAuthSchema(pool);
    const auth = createFieldworkAuth(config);
    const request = async (
      path: string,
      body?: Record<string, unknown>,
      options: { cookie?: string; ip?: string; origin?: string } = {},
      instance = auth,
    ) => {
      const response = await instance.handler(new Request(path.startsWith('https://') ? path : `${origin}${basePath}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          Origin: options.origin ?? origin,
          'x-fieldwork-client-ip': options.ip ?? '192.0.2.1',
          ...(options.cookie ? { Cookie: options.cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }));
      await flushMail();
      return response;
    };
    const resolve = createIdentityResolver({ pool, getSession: (headers) => auth.api.getSession({ headers }) });
    const memberEmail = 'member@example.test';
    const password = 'private-test-password-one';
    let memberId = '';
    let memberCookie = '';

    await t.test('signup persists a hashed credential and requires inbox verification', async () => {
      const signup = await request('/sign-up/email', {
        name: 'First Member', email: memberEmail, password,
        role: 'owner', exportPass: true, trialEndsAt: 9_999_999_999,
        callbackURL: `${origin}/login?verified=1`,
      });
      assert.equal(signup.status, 200);
      const result = await signup.json() as { token: string | null; user: { id: string; emailVerified: boolean } };
      assert.equal(result.token, null);
      assert.equal(result.user.emailVerified, false);
      memberId = result.user.id;
      const credential = await pool.query<{ password: string }>(
        'SELECT password FROM fieldwork_auth_account WHERE "userId" = $1 AND "providerId" = $2',
        [memberId, 'credential'],
      );
      assert.equal(credential.rowCount, 1);
      assert.notEqual(credential.rows[0].password, password);
      assert.ok(credential.rows[0].password.length > 60);
      const premature = await request('/sign-in/email', { email: memberEmail, password });
      assert.equal(premature.status, 403);
      const verification = await request(emailUrl(messages.at(-1)));
      assert.ok([200, 302, 303].includes(verification.status));
      memberCookie = cookies(verification);
      assert.match(memberCookie, /fieldwork.session_token/);
      const cookieAttributes = verification.headers.getSetCookie().join(';');
      assert.match(cookieAttributes, /httponly/i);
      assert.match(cookieAttributes, /secure/i);
      const identity = await resolve({ headers: { cookie: memberCookie } });
      assert.equal(identity?.userId, memberId);
      assert.equal(identity.role, 'free');
      assert.equal(identity.exportPass, false);
      assert.equal(identity.authMethod, 'cookie');
      const persisted = await pool.query<{ createdAt: Date }>('SELECT "createdAt" FROM fieldwork_auth_user WHERE id = $1', [memberId]);
      assert.equal(identity.trialEndsAt, Math.floor(persisted.rows[0].createdAt.getTime() / 1000) + 72 * 60 * 60);
    });

    await t.test('a new server instance reads the same account, session, and immutable trial', async () => {
      const secondAuth = createFieldworkAuth(config);
      const secondResolve = createIdentityResolver({ pool, getSession: (headers) => secondAuth.api.getSession({ headers }) });
      const first = await resolve({ headers: { cookie: memberCookie } });
      const second = await secondResolve({ headers: { cookie: memberCookie } });
      assert.deepEqual(second, first);
      await ensureDefaultEntitlement(pool, memberId);
      assert.deepEqual(await secondResolve({ headers: { cookie: memberCookie } }), first);
      await assert.rejects(pool.query(
        "UPDATE fieldwork_entitlements SET trial_ends_at = trial_ends_at + interval '1 day' WHERE user_id = $1",
        [memberId],
      ), /trial dates are immutable/i);
    });

    await t.test('reserved public signup is blocked and inbox recovery preserves Emily’s permanent workspace', async () => {
      const betaEmail = 'ayalaemily52@gmail.com';
      const collision = await request('/sign-up/email', { name: 'Impersonator', email: betaEmail.toUpperCase(), password });
      assert.equal(collision.status, 409);
      const before = await pool.query('SELECT id FROM fieldwork_auth_account WHERE "userId" = $1', ['beta-emily-ayala']);
      assert.equal(before.rowCount, 0);
      const reset = await request('/request-password-reset', { email: betaEmail, redirectTo: `${origin}/reset-password` });
      assert.equal(reset.status, 200);
      const callback = await request(emailUrl(messages.at(-1)));
      assert.equal(callback.status, 302);
      const resetToken = new URL(callback.headers.get('location')!).searchParams.get('token');
      assert.ok(resetToken);
      const newPassword = 'reserved-recovery-test-password';
      assert.equal((await request('/reset-password', { token: resetToken, newPassword })).status, 200);
      assert.equal((await request('/reset-password', { token: resetToken, newPassword })).status, 400);
      const login = await request('/sign-in/email', { email: betaEmail, password: newPassword });
      assert.equal(login.status, 200);
      const identity = await resolve({ headers: { cookie: cookies(login) } });
      assert.equal(identity?.userId, 'beta-emily-ayala');
      assert.equal(identity.workspaceId, 'workspace-beta-emily-ayala');
      assert.equal(identity.role, 'professional');
      assert.equal(identity.subscription, 'professional');
      assert.equal(identity.exportPass, true);
      assert.equal(identity.trialEndsAt, null);
      const retired = await pool.query<{ legacy_beta_enabled: boolean }>(
        'SELECT legacy_beta_enabled FROM fieldwork_entitlements WHERE user_id = $1',
        ['beta-emily-ayala'],
      );
      assert.equal(retired.rows[0].legacy_beta_enabled, false);
      await migrateAuthSchema(pool);
      assert.deepEqual(await resolve({ headers: { cookie: cookies(login) } }), identity);
      assert.equal((await pool.query<{ legacy_beta_enabled: boolean }>(
        'SELECT legacy_beta_enabled FROM fieldwork_entitlements WHERE user_id = $1',
        ['beta-emily-ayala'],
      )).rows[0].legacy_beta_enabled, false);
    });

    await t.test('reset revokes existing sessions and does not disclose unregistered inboxes', async () => {
      const existing = await request('/request-password-reset', { email: memberEmail, redirectTo: `${origin}/reset-password` }, { ip: '192.0.2.2' });
      const link = emailUrl(messages.at(-1));
      const unknown = await request('/request-password-reset', { email: 'unknown@example.test', redirectTo: `${origin}/reset-password` }, { ip: '192.0.2.2' });
      assert.equal(existing.status, 200);
      assert.equal(unknown.status, 200);
      assert.deepEqual(await existing.json(), await unknown.json());
      const callback = await request(link);
      const token = new URL(callback.headers.get('location')!).searchParams.get('token');
      assert.equal((await request('/reset-password', { token, newPassword: 'replacement-test-password-two' })).status, 200);
      assert.equal(await resolve({ headers: { cookie: memberCookie } }), null);
      assert.equal((await request('/sign-in/email', { email: memberEmail, password }, { ip: '192.0.2.3' })).status, 401);
      const login = await request('/sign-in/email', { email: memberEmail, password: 'replacement-test-password-two' }, { ip: '192.0.2.3' });
      assert.equal(login.status, 200);
      const identity = await resolve({ headers: { cookie: cookies(login) } });
      assert.equal(identity?.userId, memberId);
      assert.equal(identity.role, 'free');
    });

    await t.test('closed signup, missing mail, and foreign origins fail without creating accounts', async () => {
      const closed = createFieldworkAuth({ ...config, signupEnabled: false });
      assert.equal((await request('/sign-up/email', { name: 'Closed', email: 'closed@example.test', password }, { ip: '192.0.2.4' }, closed)).status, 503);
      const noMail = createFieldworkAuth({ ...config, emailConfigured: false });
      assert.equal((await request('/sign-up/email', { name: 'No Mail', email: 'no-mail@example.test', password }, { ip: '192.0.2.4' }, noMail)).status, 503);
      assert.equal((await request('/request-password-reset', { email: memberEmail }, { ip: '192.0.2.4' }, noMail)).status, 503);
      const foreign = await request('/sign-up/email', {
        name: 'Foreign', email: 'foreign@example.test', password,
      }, { origin: 'https://untrusted.example.test', ip: '192.0.2.4' });
      assert.equal(foreign.status, 403);
      const rows = await pool.query('SELECT id FROM fieldwork_auth_user WHERE email IN ($1, $2, $3)', [
        'closed@example.test', 'no-mail@example.test', 'foreign@example.test',
      ]);
      assert.equal(rows.rowCount, 0);
    });

    await t.test('ordinary paid access needs an unexpired server billing grant', async () => {
      const login = await request('/sign-in/email', { email: memberEmail, password: 'replacement-test-password-two' }, { ip: '192.0.2.5' });
      const cookie = cookies(login);
      await pool.query(
        "UPDATE fieldwork_entitlements SET role = 'professional', subscription = 'professional', export_pass = true, billing_access_ends_at = null WHERE user_id = $1",
        [memberId],
      );
      const missingGrant = await resolve({ headers: { cookie } });
      assert.equal(missingGrant?.role, 'free');
      assert.equal(missingGrant.subscription, undefined);
      assert.equal(missingGrant.exportPass, false);
      await pool.query(
        "UPDATE fieldwork_entitlements SET billing_access_ends_at = now() + interval '1 day' WHERE user_id = $1",
        [memberId],
      );
      assert.equal((await resolve({ headers: { cookie } }))?.role, 'professional');
      await pool.query(
        "UPDATE fieldwork_entitlements SET billing_access_ends_at = now() - interval '1 minute' WHERE user_id = $1",
        [memberId],
      );
      assert.equal((await resolve({ headers: { cookie } }))?.role, 'free');
    });

    await t.test('auth rate limits persist across server instances in PostgreSQL', async () => {
      const secondAuth = createFieldworkAuth(config);
      const ip = '192.0.2.50';
      for (let count = 0; count < 10; count += 1) {
        const response = await request('/sign-in/email', { email: memberEmail, password: 'wrong-test-password' }, { ip }, count % 2 ? secondAuth : auth);
        assert.equal(response.status, 401);
      }
      const limited = await request('/sign-in/email', { email: memberEmail, password: 'wrong-test-password' }, { ip }, secondAuth);
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get('x-retry-after') || limited.headers.get('retry-after'));
      const persisted = await pool.query('SELECT id FROM fieldwork_auth_rate_limit');
      assert.ok((persisted.rowCount ?? 0) > 0);
    });
  } finally {
    await flushMail();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { test } from 'node:test';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { createCloudApp } from '../server.js';
import { closePool, getPool } from '../db.js';
import { createFieldworkAuth } from '../auth.js';
import { migrateAuthSchema } from '../auth-schema.js';
import { cloudApiOrigin, readCloudSession } from '../../server/cloud-session.js';
import { requireSession, signSession } from '../../api/_auth.js';

const appOrigin = 'https://fieldwork.example.test';

async function withEnvironment<T>(values: Record<string, string | null>, operation: () => Promise<T>): Promise<T> {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  await closePool();
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await operation(); }
  finally {
    await closePool();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function listen(): Promise<{ server: Server; origin: string }> {
  const app = createCloudApp();
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function stop(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

test('readiness and repeated data requests fail safely before the database is configured', async () => {
  const proxySecret = randomBytes(32).toString('base64url');
  await withEnvironment({
    NODE_ENV: 'test', DATABASE_URL: null, DATABASE_CA_CERT: null, BETTER_AUTH_SECRET: null,
    FIELDWORK_APP_ORIGIN: `${appOrigin}/`, FIELDWORK_ORIGIN_SECRET: proxySecret,
    RESEND_API_KEY: null, FIELDWORK_AUTH_FROM: null, FIELDWORK_SIGNUP_ENABLED: 'true',
  }, async () => {
    const { server, origin } = await listen();
    try {
      const health = await fetch(`${origin}/api/cloud/health`);
      assert.equal(health.status, 200);
      assert.match(health.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(health.headers.get('x-powered-by'), null);
      const body = await health.json() as Record<string, unknown>;
      assert.equal(body.databaseReady, false);
      assert.equal(body.accountsReady, false);
      assert.equal(body.cloudStorageConnected, false);
      assert.equal(body.signupEnabled, false);
      assert.equal(body.publicLaunchReady, false);
      for (const path of ['/api/cloud/ready', '/api/cloud/READY']) {
        assert.equal((await fetch(`${origin}${path}`)).status, 503, `${path} must not report ready.`);
      }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const records = await fetch(`${origin}/api/cloud/records`, {
          headers: { 'x-fieldwork-origin-secret': proxySecret },
        });
        assert.equal(records.status, 503, 'A failed lazy router initialization must remain unavailable on retries.');
      }
      const session = await fetch(`${origin}/api/cloud/session`, {
        headers: { 'x-fieldwork-origin-secret': proxySecret, Cookie: 'invented-session' },
      });
      assert.equal(session.status, 503);
      const result = await session.json() as Record<string, unknown>;
      assert.equal(result.user, null);
      assert.equal(result.hasCloudAccount, false);
      const noProxy = await fetch(`${origin}/api/cloud/records`);
      assert.equal(noProxy.status, 403);
    } finally { await stop(server); }
  });
});

test('browser mutation Origin is checked independently of the authenticated proxy hop', async () => {
  const proxySecret = randomBytes(32).toString('base64url');
  await withEnvironment({
    NODE_ENV: 'test', DATABASE_URL: null, DATABASE_CA_CERT: null, BETTER_AUTH_SECRET: null,
    FIELDWORK_APP_ORIGIN: `${appOrigin}/`, FIELDWORK_ORIGIN_SECRET: proxySecret,
  }, async () => {
    const { server, origin } = await listen();
    try {
      for (const suppliedOrigin of [undefined, 'null', 'https://untrusted.example.test']) {
        const response = await fetch(`${origin}/api/cloud/records`, {
          method: 'PUT',
          headers: {
            'x-fieldwork-origin-secret': proxySecret, Cookie: 'browser-session',
            'Content-Type': 'application/json',
            ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}),
          },
          body: JSON.stringify({ entries: [], supervisors: [], expectedRevision: 0 }),
        });
        assert.equal(response.status, 403);
        assert.equal((await response.json() as { code: string }).code, 'ORIGIN_REQUIRED');
      }
      const sameOrigin = await fetch(`${origin}/api/cloud/records`, {
        method: 'PUT',
        headers: {
          'x-fieldwork-origin-secret': proxySecret, Cookie: 'browser-session',
          Origin: appOrigin, 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries: [], supervisors: [], expectedRevision: 0 }),
      });
      assert.equal(sameOrigin.status, 503, 'Canonical browser Origin passes the boundary and reaches the disconnected database gate.');
      const untrustedHop = await fetch(`${origin}/api/cloud/records`, {
        method: 'PUT',
        headers: { Origin: appOrigin, Cookie: 'browser-session', 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(untrustedHop.status, 403);
    } finally { await stop(server); }
  });
});

test('an invalid configured cloud URL cannot revive legacy trial or paid credentials', async () => {
  await withEnvironment({ NODE_ENV: 'test', BAKER_SESSION_SECRET: randomBytes(48).toString('base64url') }, async () => {
    const token = signSession({ email: 'legacy@example.test', name: 'Legacy Member', role: 'professional', subscription: 'professional' });
    assert.ok(token);
    const previous = process.env.FIELDWORK_CLOUD_API_ORIGIN;
    try {
      for (const invalid of ['not-a-url', 'ftp://localhost:5432', 'https://cloud.example.test/incorrect-path']) {
        process.env.FIELDWORK_CLOUD_API_ORIGIN = invalid;
        assert.equal(cloudApiOrigin(), null);
        assert.equal(await requireSession({ headers: { authorization: `Bearer ${token}` } }), null);
      }
      process.env.FIELDWORK_CLOUD_API_ORIGIN = 'https://cloud.example.test';
      assert.equal(await requireSession({ headers: { authorization: `Bearer ${token}` } }), null);
    } finally {
      if (previous === undefined) delete process.env.FIELDWORK_CLOUD_API_ORIGIN;
      else process.env.FIELDWORK_CLOUD_API_ORIGIN = previous;
    }
  });
});

test('the Vercel bridge requires a cloud-confirmed identity and forwards beta credentials', async (t) => {
  await withEnvironment({
    NODE_ENV: 'test', FIELDWORK_CLOUD_API_ORIGIN: 'https://cloud.example.test',
    FIELDWORK_ORIGIN_SECRET: randomBytes(32).toString('base64url'),
  }, async () => {
    let confirmed = false;
    let observed: RequestInit | undefined;
    const mocked = t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      observed = init;
      return Response.json({
        user: {
          userId: 'server-member-a', workspaceId: 'workspace-server-member-a',
          email: 'member-a@example.test', name: 'Member A', role: 'free', authMethod: 'beta',
        },
        authMethod: 'beta', hasCloudAccount: confirmed, cloud: confirmed,
      });
    });
    try {
      const headers = { authorization: 'Bearer b2.test-fixture.not-a-real-credential', cookie: 'another-browser-cookie' };
      assert.equal(await readCloudSession({ headers }), null, 'A beta UI fallback cannot authorize production APIs.');
      confirmed = true;
      assert.equal((await readCloudSession({ headers }))?.userId, 'server-member-a');
      const sent = new Headers(observed?.headers);
      assert.equal(sent.get('authorization'), headers.authorization);
      assert.equal(sent.get('cookie'), headers.cookie);
      assert.equal(sent.get('x-fieldwork-origin-secret'), process.env.FIELDWORK_ORIGIN_SECRET);
      assert.equal(observed?.redirect, 'error');
      assert.equal(observed?.cache, 'no-store');
    } finally { mocked.mock.restore(); }
  });
});

test('real cookie sessions cannot cross workspace boundaries through case variants or stale tabs', {
  skip: !process.env.FIELDWORK_TEST_DATABASE_URL && 'Set FIELDWORK_TEST_DATABASE_URL to an isolated loopback PostgreSQL database.',
  timeout: 120_000,
}, async (t) => {
  const testUrl = new URL(process.env.FIELDWORK_TEST_DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(testUrl.hostname));
  const schema = `fieldwork_server_test_${randomBytes(8).toString('hex')}`;
  const admin = new Pool({ connectionString: testUrl.toString(), ssl: false, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);
  const proxySecret = randomBytes(32).toString('base64url');
  const authSecret = randomBytes(48).toString('base64url');
  const realFetch = globalThis.fetch.bind(globalThis);
  const guarded = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Server tests cannot make external requests.');
    return realFetch(input, init);
  });
  try {
    await withEnvironment({
      NODE_ENV: 'test', DATABASE_URL: testUrl.toString(), DATABASE_CA_CERT: null, PG_POOL_MAX: '2',
      FIELDWORK_APP_ORIGIN: `${appOrigin}/`, FIELDWORK_ORIGIN_SECRET: proxySecret,
      BETTER_AUTH_SECRET: authSecret, FIELDWORK_SIGNUP_ENABLED: 'false',
      RESEND_API_KEY: 'test-config-value-never-used', FIELDWORK_AUTH_FROM: 'accounts@example.test',
      STRIPE_SECRET_KEY: null, STRIPE_WEBHOOK_SECRET: null, FIELDWORK_LIVE_BILLING_ENABLED: 'false',
    }, async () => {
      const pool = getPool();
      await migrateAuthSchema(pool);
      await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
      await pool.query(`CREATE TABLE fieldwork_schema_migrations (version text PRIMARY KEY);
        INSERT INTO fieldwork_schema_migrations VALUES ('cloud-v1')`);
      const auth = createFieldworkAuth({
        pool, secret: authSecret, appOrigin, signupEnabled: false, emailConfigured: false,
        production: false, sendEmail: async () => { throw new Error('No email may be sent in server tests.'); },
      });
      const cookieFor = async (id: string, email: string): Promise<string> => {
        const password = 'private-local-server-test-password';
        await pool.query(
          'INSERT INTO fieldwork_auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())',
          [id, id, email],
        );
        await pool.query(
          'INSERT INTO fieldwork_auth_account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, $3, $2, $4, now(), now())',
          [randomUUID(), id, 'credential', await hashPassword(password)],
        );
        const response = await auth.api.signInEmail({
          body: { email, password }, headers: new Headers({ Origin: appOrigin, 'x-fieldwork-client-ip': '192.0.2.1' }), asResponse: true,
        });
        assert.equal(response.status, 200);
        return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
      };
      const cookieA = await cookieFor('server-member-a', 'member-a@example.test');
      const cookieB = await cookieFor('server-member-b', 'member-b@example.test');
      const workspaceA = 'workspace-server-member-a';
      const workspaceB = 'workspace-server-member-b';
      const { server, origin } = await listen();
      const request = (path: string, cookie: string, workspace?: string, body?: Record<string, unknown>, extras: Record<string, string> = {}) => fetch(`${origin}${path}`, {
        method: body ? 'PUT' : 'GET',
        headers: {
          'x-fieldwork-origin-secret': proxySecret, 'x-vercel-forwarded-for': '192.0.2.2', Cookie: cookie,
          ...(workspace ? { 'X-Fieldwork-Workspace': workspace } : {}),
          ...(body ? { Origin: appOrigin, 'Content-Type': 'application/json' } : {}),
          ...extras,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      try {
        assert.equal((await fetch(`${origin}/api/cloud/ready`)).status, 200);
        for (const path of ['/api/cloud/records', '/API/CLOUD/RECORDS', '/api/cloud/ARCHIVE/documents']) {
          for (const workspace of [undefined, workspaceB]) {
            const denied = await request(path, cookieA, workspace);
            assert.equal(denied.status, 409, `${path} must enforce its workspace boundary.`);
            assert.equal((await denied.json() as { code: string }).code, 'WORKSPACE_CHANGED');
          }
        }

        const firstA = await request('/api/cloud/records', cookieA, workspaceA, {
          expectedRevision: 0, entries: [{ id: 'alice-record', duration: 1.5 }], supervisors: [],
          workspaceId: workspaceB, userId: 'server-member-b',
        });
        assert.equal(firstA.status, 200);
        const firstB = await request('/api/cloud/records', cookieB, workspaceB, {
          expectedRevision: 0, entries: [{ id: 'bob-record', duration: 2.25 }], supervisors: [],
        });
        assert.equal(firstB.status, 200);

        const staleTab = await request('/api/cloud/records', cookieB, workspaceA, {
          expectedRevision: 1, entries: [{ id: 'alice-late-edit', duration: 99 }], supervisors: [],
        });
        assert.equal(staleTab.status, 409);
        const spoofedCredential = await request('/api/cloud/records', cookieB, workspaceB, undefined, {
          Authorization: 'Bearer b2.invalid.signature',
        });
        assert.equal(spoofedCredential.status, 401, 'An invalid explicit bearer cannot silently select the cookie account.');

        const actualA = await request('/API/CLOUD/RECORDS', cookieA, workspaceA);
        const actualB = await request('/api/cloud/records', cookieB, workspaceB);
        assert.equal(actualA.status, 200);
        assert.equal(actualB.status, 200);
        const rowsA = await actualA.json() as { entries: Array<{ id: string }>; revision: number };
        const rowsB = await actualB.json() as { entries: Array<{ id: string }>; revision: number };
        assert.deepEqual(rowsA.entries.map((row) => row.id), ['alice-record']);
        assert.deepEqual(rowsB.entries.map((row) => row.id), ['bob-record']);
        assert.equal(rowsA.revision, 1);
        assert.equal(rowsB.revision, 1);

        const foreignCookieWrite = await request('/api/cloud/records', cookieA, workspaceA, {
          expectedRevision: 1, entries: [], supervisors: [],
        }, { Origin: 'https://untrusted.example.test' });
        assert.equal(foreignCookieWrite.status, 403);
        assert.equal((await (await request('/api/cloud/records', cookieA, workspaceA)).json() as { revision: number }).revision, 1);
      } finally { await stop(server); }
    });
  } finally {
    guarded.mock.restore();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

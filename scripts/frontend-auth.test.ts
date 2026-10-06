import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

let sequence = 0;
async function setup() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const destinations: string[] = [];
  Object.assign(globalThis, {
    localStorage: local,
    sessionStorage: session,
    window: {
      location: { origin: 'https://www.fieldworkbybaker.com', assign: (path: string) => destinations.push(path) },
      addEventListener() {},
    },
  });
  const auth = await import(`../src/hooks/useAuth.ts?test=${++sequence}`) as typeof import('../src/hooks/useAuth');
  let actions: ReturnType<typeof auth.useAuth> | undefined;
  function Consumer() { actions = auth.useAuth(); return null; }
  renderToString(createElement(Consumer));
  return { local, session, destinations, auth, actions: actions! };
}

const json = (value: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
const email = 'member@example.test';
const localKey = `fieldworkByBaker:v1:${email}:entries`;
const identity = { email, name: 'Member Person', role: 'free', userId: 'member-1', workspaceId: 'workspace-1', authMethod: 'cookie' };

test('a forged local owner and legacy free token never grant access; concurrent checks share one request', async () => {
  const { local, auth } = await setup();
  local.setItem('authUser', JSON.stringify({ ...identity, role: 'owner' }));
  local.setItem('bakerSessionToken', 'old.unsigned.session');
  local.setItem(localKey, '[{"id":"retained-hour"}]');
  let requests = 0;
  globalThis.fetch = async () => { requests++; return (await json({ user: null, cloud: true })); };
  assert.equal(auth.getStoredAuthUser(), null);
  assert.equal(auth.getStoredAccessToken(), null);
  await Promise.all([auth.refreshSession(), auth.refreshSession(), auth.refreshSession()]);
  assert.equal(requests, 1);
  assert.equal(auth.getStoredAuthUser(), null);
  assert.equal(local.getItem('bakerSessionToken'), null);
  assert.equal(local.getItem(localKey), '[{"id":"retained-hour"}]');
  assert.equal(local.getItem('bakerSessionUpgradeRequired'), '1');
});

test('cookie identity uses server roles and never creates a bearer credential in storage', async () => {
  const { local, auth } = await setup();
  local.setItem('authUser', JSON.stringify({ ...identity, role: 'owner', exportPass: true }));
  let sentAuthorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    sentAuthorization = new Headers(init?.headers).get('Authorization');
    assert.equal(init?.credentials, 'include');
    return (await json({ user: identity, cloud: true }));
  };
  await auth.refreshSession();
  assert.equal(auth.getStoredAuthUser()?.role, 'free');
  assert.equal(auth.getStoredAuthUser()?.exportPass, false);
  assert.equal(auth.getStoredAccessToken(), 'cloud-session');
  assert.deepEqual(auth.getAuthorizationHeaders(), {});
  assert.equal(sentAuthorization, null);
  assert.equal(local.getItem('bakerSessionToken'), null);
});

test('beta access requires server verification and retains the original local record namespace', async () => {
  const { local, auth } = await setup();
  const betaEmail = 'ayalaemily52@gmail.com';
  const entryKey = `fieldworkByBaker:v1:${betaEmail}:entries`;
  local.setItem('authUser', JSON.stringify({ email: betaEmail, name: 'Untrusted', role: 'owner' }));
  local.setItem('bakerSessionToken', 'b2.verified-test-payload.test-signature');
  local.setItem(entryKey, '[{"id":"existing-emily-hour"}]');
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer b2.verified-test-payload.test-signature');
    return (await json({ user: { ...identity, email: betaEmail, name: 'Emily Ayala', role: 'professional', subscription: 'professional', authMethod: 'beta' }, cloud: false }));
  };
  assert.equal(auth.getStoredAuthUser(), null);
  await auth.refreshSession();
  assert.equal(auth.getStoredAuthUser()?.role, 'professional');
  assert.equal(auth.getStoredAuthUser()?.email, betaEmail);
  assert.deepEqual(auth.getAuthorizationHeaders(), { Authorization: 'Bearer b2.verified-test-payload.test-signature' });
  assert.equal(local.getItem(entryKey), '[{"id":"existing-emily-hour"}]');
});

test('unavailable signup cannot fall back to a browser-only account or erase existing records', async () => {
  const { local, auth, actions } = await setup();
  local.setItem(localKey, '[{"id":"existing-trial-hour"}]');
  const paths: string[] = [];
  globalThis.fetch = async (path) => { paths.push(String(path)); return (await json({ code: 'SIGNUP_UNAVAILABLE' }, 503)); };
  await assert.rejects(actions.registerFree('Member Person', email, 'test-only-password-123'));
  assert.deepEqual(paths, ['/api/cloud/auth/sign-up/email']);
  assert.equal(auth.getStoredAuthUser(), null);
  assert.equal(local.getItem('authUser'), null);
  assert.equal(local.getItem(localKey), '[{"id":"existing-trial-hour"}]');
});

test('successful signup waits for verification and only uses a same-origin callback', async () => {
  const { auth, actions } = await setup();
  let callbackURL = '';
  globalThis.fetch = async (_path, init) => {
    callbackURL = JSON.parse(String(init?.body)).callbackURL;
    return (await json({ user: { id: 'pending-1' }, token: null }));
  };
  await actions.registerFree('Member Person', email, 'test-only-password-123', '//external.example');
  assert.equal(new URL(callbackURL).origin, 'https://www.fieldworkbybaker.com');
  assert.equal(new URL(callbackURL).searchParams.get('return'), '/dashboard');
  assert.equal(auth.getStoredAuthUser(), null);
  assert.equal(auth.getStoredAccessToken(), null);
});

test('sign-out clears beta credentials even during a cloud outage and an older response cannot restore access', async () => {
  const { local, auth, actions, destinations } = await setup();
  local.setItem('bakerSessionToken', 'b2.still-valid.test');
  local.setItem(localKey, '[{"id":"keep-on-signout"}]');
  let resolveSession: ((response: Response) => void) | undefined;
  globalThis.fetch = async (path) => {
    if (String(path).endsWith('/sign-out')) return (await json({ code: 'UNAVAILABLE' }, 503));
    return await new Promise<Response>((resolve) => { resolveSession = resolve; });
  };
  const oldRequest = auth.refreshSession();
  await actions.logout();
  resolveSession!(await json({ user: { ...identity, authMethod: 'beta' }, cloud: true }));
  await oldRequest;
  assert.equal(local.getItem('bakerSessionToken'), null);
  assert.equal(auth.getStoredAuthUser(), null);
  assert.equal(auth.getStoredAccessToken(), null);
  assert.equal(local.getItem(localKey), '[{"id":"keep-on-signout"}]');
  assert.deepEqual(destinations, ['/login?reason=signout-incomplete']);
});

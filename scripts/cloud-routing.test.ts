import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureCloudRouting, normalizeCloudOrigin } from './configure-cloud-routing.mjs';

// This is a unit-test fixture only; it is never written to vercel.json or used
// for a deployment. Provisioning must supply the app's actual assigned origin.
const origin = 'https://routing-fixture-123.ondigitalocean.app';
function baseline() {
  return {
    framework: 'vite', installCommand: 'npm ci', buildCommand: 'npm run build', outputDirectory: 'dist',
    functions: { 'api/baker-ai.ts': { maxDuration: 60 } },
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    headers: [
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ] },
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ],
  };
}

type Route = { src?: string; dest?: string; headers?: Record<string, string>; continue?: boolean; handle?: string; status?: number; transforms?: unknown[] };

/** Model documented route ordering for the contract cases below, not HTTP/CDN behavior. */
function destination(routes: Route[], path: string, files = new Set<string>()) {
  const headers: Record<string, string> = {};
  for (const route of routes) {
    if (route.handle === 'filesystem') {
      if (files.has(path)) return { dest: path, headers };
      continue;
    }
    const matcher = new RegExp(route.src!, 'i'); // Vercel routes use case-insensitive matching.
    if (!matcher.test(path)) continue;
    Object.assign(headers, route.headers);
    if (route.continue) continue;
    if (route.status) return { status: route.status, headers };
    return { dest: path.replace(matcher, route.dest!), headers };
  }
  throw new Error(`No route for ${path}`);
}

test('routing conversion preserves build settings, security headers, assets, and existing Vercel API functions', () => {
  const input = baseline();
  const before = structuredClone(input);
  const configured = configureCloudRouting(input, origin);
  assert.deepEqual(input, before, 'The pure converter must not mutate the input.');
  assert.equal(configured.framework, input.framework);
  assert.equal(configured.installCommand, input.installCommand);
  assert.equal(configured.buildCommand, input.buildCommand);
  assert.equal(configured.outputDirectory, input.outputDirectory);
  assert.deepEqual(configured.functions, input.functions);
  assert.equal(Object.hasOwn(configured, 'rewrites'), false);
  assert.equal(Object.hasOwn(configured, 'headers'), false);
  const files = new Set(['/api/baker-ai', '/api/create-checkout-session', '/api/health', '/assets/app-123.js', '/favicon.svg']);
  for (const file of files) {
    const matched = destination(configured.routes, file, files);
    assert.equal(matched.dest, file, `${file} must resolve on Vercel.`);
    assert.equal(matched.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(matched.headers['X-Frame-Options'], 'DENY');
    assert.equal(matched.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.equal(matched.headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
    assert.equal(matched.headers['x-vercel-enable-rewrite-caching'], undefined);
  }
  assert.equal(destination(configured.routes, '/assets/app-123.js', files).headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(destination(configured.routes, '/dashboard').dest, '/index.html');
  assert.equal(destination(configured.routes, '/forgot-password').dest, '/index.html');
  assert.equal(destination(configured.routes, '/api/missing').status, 404);
});

test('the cloud namespace reaches the fixed DigitalOcean origin before filesystem or SPA rules with caching disabled', () => {
  const { routes } = configureCloudRouting(baseline(), origin);
  for (const path of ['/api/cloud', '/api/cloud/', '/api/cloud/session', '/api/cloud/records/uploads/id/chunks/0', '/api/cloud/auth/sign-in/email', '/API/CLOUD/records']) {
    const matched = destination(routes, path, new Set([path]));
    assert.ok(matched.dest?.startsWith(`${origin}/api/cloud/`));
    assert.notEqual(matched.dest, '/index.html');
    assert.match(matched.headers['Cache-Control'], /no-store/);
    assert.equal(matched.headers['CDN-Cache-Control'], 'no-store');
    assert.equal(matched.headers['Vercel-CDN-Cache-Control'], 'no-store');
    assert.equal(matched.headers['x-vercel-enable-rewrite-caching'], '0');
  }
  assert.equal(destination(routes, '/api/cloud/records').dest, `${origin}/api/cloud/records`);
  assert.equal(destination(routes, '/api/cloudberry').status, 404);
  const cloud = routes.find((route: Route) => route.dest?.startsWith(origin));
  assert.deepEqual(cloud?.transforms, [{
    type: 'request.headers', op: 'set', target: { key: 'x-fieldwork-origin-secret' },
    args: '$FIELDWORK_ORIGIN_SECRET', env: ['FIELDWORK_ORIGIN_SECRET'],
  }]);
  assert.equal(routes.filter((route: Route) => route.transforms).length, 1);
});

test('the origin accepts only a complete DigitalOcean HTTPS origin and rejects authority or path tricks', () => {
  assert.equal(normalizeCloudOrigin(`${origin}/`), origin);
  for (const invalid of [
    '', 'https://ondigitalocean.app', 'http://routing-fixture-123.ondigitalocean.app',
    'https://routing-fixture-123.ondigitalocean.app.evil.test', 'https://evil.test/routing-fixture-123.ondigitalocean.app',
    'https://user:secret@routing-fixture-123.ondigitalocean.app', `${origin}:443`, `${origin}:8080`,
    `${origin}/api`, `${origin}/api/..`, `${origin}?token=secret`, `${origin}#fragment`, `${origin}\n`,
    'https://-invalid.ondigitalocean.app', 'https://invalid-.ondigitalocean.app', 'https://nested.app.ondigitalocean.app',
    'https://localhost', 'https://127.0.0.1', '//routing-fixture-123.ondigitalocean.app',
  ]) assert.throws(() => normalizeCloudOrigin(invalid), /actual HTTPS origin/, invalid);
});

test('unexpected routing or header rules fail instead of being dropped or overwritten', () => {
  for (const change of [
    { routes: [] }, { routes: [{ src: '/special', dest: '/special.html' }] },
    { redirects: [] }, { cleanUrls: true }, { trailingSlash: false },
    { rewrites: [{ source: '/(.*)', destination: '/other.html' }] },
    { rewrites: [...baseline().rewrites, { source: '/special', destination: '/api/special' }] },
    { rewrites: [{ ...baseline().rewrites[0], has: [] }] },
    { headers: [...baseline().headers, { source: '/private', headers: [{ key: 'Cache-Control', value: 'no-store' }] }] },
    { headers: [{ ...baseline().headers[0], has: [] }, baseline().headers[1]] },
    { headers: [baseline().headers[0], { source: '/downloads/(.*)', headers: baseline().headers[1].headers }] },
    { headers: [{ ...baseline().headers[0], headers: [{ key: 'X-Test', value: 'first' }, { key: 'x-test', value: 'second' }] }, baseline().headers[1]] },
    { headers: [{ ...baseline().headers[0], headers: [{ key: 'X-Test', value: 'bad\r\nInjected: header' }] }, baseline().headers[1]] },
  ]) {
    const input = { ...baseline(), ...change };
    const before = structuredClone(input);
    assert.throws(() => configureCloudRouting(input, origin));
    assert.deepEqual(input, before);
  }
  assert.throws(() => configureCloudRouting(null, origin));
  assert.throws(() => configureCloudRouting([], origin));
});

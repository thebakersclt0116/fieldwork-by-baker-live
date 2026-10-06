import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { getPool, closePool, databaseReady } from './db.js';
import { getAuth, isAuthConfigured, isAuthEmailConfigured, isPublicSignupEnabled } from './auth.js';
import { resolveIdentity, verifiedBetaIdentity } from './identity.js';
import { createRecordsRouter } from './records.js';
import { createArchiveRouter } from './archive.js';
import { billingReadiness, createBillingRouter, createBillingWebhookRouter } from './billing.js';
import type { CloudIdentity } from '../shared/cloudTypes.js';

const protectedDataPath = /^\/api\/cloud\/(?:records|archive)(?:\/|$)/i;
const webhookPath = '/api/cloud/billing/webhook';
type AuthenticatedRequest = Request & { fieldworkUser?: CloudIdentity };

function validOriginSecret(request: Request): boolean {
  const expected = process.env.FIELDWORK_ORIGIN_SECRET;
  const supplied = request.get('x-fieldwork-origin-secret');
  if (!expected || expected.length < 32 || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientIp(request: Request, authenticatedProxy: boolean): string {
  // DigitalOcean documents do-connecting-ip as its platform-supplied client IP.
  // Vercel's overwritten client header is trusted only over an authenticated hop.
  const candidate = authenticatedProxy
    ? request.get('x-vercel-forwarded-for')
    : process.env.FIELDWORK_DIGITALOCEAN_PROXY === 'true' ? request.get('do-connecting-ip') : undefined;
  if (candidate && isIP(candidate)) return candidate;
  return request.socket.remoteAddress || '127.0.0.1';
}

export function createCloudApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((_request, response, next) => {
    response.set({
      'Cache-Control': 'private, no-store', 'Vercel-CDN-Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    });
    next();
  });
  app.get(['/api/cloud/health', '/api/cloud/ready'], async (request, response) => {
    const connected = await databaseReady();
    const accountsReady = connected && isAuthConfigured() && isAuthEmailConfigured();
    const billing = billingReadiness();
    response.status(/\/ready$/i.test(request.path) && !accountsReady ? 503 : 200).json({
      service: 'Fieldwork cloud', status: 'running', databaseReady: connected,
      cloudStorageConnected: connected, accountsReady,
      emailConfigured: isAuthEmailConfigured(), signupEnabled: accountsReady && isPublicSignupEnabled(),
      storageMode: connected ? 'digitalocean-postgresql' : 'not-connected',
      ...billing,
      liveBillingEnabled: accountsReady && billing.liveBillingEnabled,
      testBillingEnabled: accountsReady && billing.testBillingEnabled,
      publicLaunchReady: false, schemaVersion: connected ? 'cloud-v1' : null,
    });
  });

  app.use((request, response, next) => {
    const trustedProxy = validOriginSecret(request);
    if (process.env.FIELDWORK_ORIGIN_SECRET && !trustedProxy && request.path !== webhookPath) {
      response.status(403).json({ error: 'Use the Fieldwork website to access this service.', code: 'ORIGIN_REQUIRED' });
      return;
    }
    // Overwrite the value even when a caller supplies it.
    request.headers['x-fieldwork-client-ip'] = clientIp(request, trustedProxy);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.path !== webhookPath) {
      const origin = request.get('origin');
      let appOrigin: string | null = null;
      try { appOrigin = new URL(process.env.FIELDWORK_APP_ORIGIN || '').origin; } catch { /* Fail closed. */ }
      const serverBetaCall = !origin && !request.get('cookie') && trustedProxy && /^Bearer b2\./i.test(request.get('authorization') || '');
      if ((!origin || origin !== appOrigin) && !serverBetaCall) {
        response.status(403).json({ error: 'This request did not come from your Fieldwork workspace.', code: 'ORIGIN_REQUIRED' });
        return;
      }
    }
    next();
  });

  app.all(/^\/api\/cloud\/auth(?:\/.*)?$/, (request, response, next) => {
    if (!isAuthConfigured()) {
      response.status(503).json({ error: 'Secure account services are not connected yet.', code: 'ACCOUNTS_NOT_READY' });
      return;
    }
    Promise.resolve(toNodeHandler(getAuth())(request, response)).catch(next);
  });
  app.get('/api/cloud/session', async (request, response) => {
    const beta = verifiedBetaIdentity(request);
    try {
      if (!await databaseReady()) {
        response.status(beta ? 200 : 503).json({ user: beta, cloud: false, hasCloudAccount: false, cloudError: 'Cloud storage is not connected yet.' });
        return;
      }
      const identity = await resolveIdentity(request);
      response.status(identity ? 200 : 401).json({
        user: identity, userId: identity?.userId, workspaceId: identity?.workspaceId,
        authMethod: identity?.authMethod, hasCloudAccount: Boolean(identity), cloud: Boolean(identity),
      });
    } catch {
      response.status(beta ? 200 : 503).json({ user: beta, cloud: false, hasCloudAccount: false, cloudError: 'Cloud storage is temporarily unavailable.' });
    }
  });

  // Router construction is lazy so a health/Console session can bootstrap the VPC
  // before the first deliberate migration, without exposing a public database.
  let apiRouter: express.Router | undefined;
  app.use('/api/cloud', (request, response, next) => {
    try {
      if (!apiRouter) {
        const candidate = express.Router();
        candidate.use(createBillingWebhookRouter(getPool()));
        candidate.use(express.json({ limit: '4mb', strict: true }));
        candidate.use(async (inner: AuthenticatedRequest, outgoing, proceed) => {
          try {
            if (!await databaseReady()) { outgoing.status(503).json({ error: 'Cloud storage is not connected yet.', code: 'CLOUD_NOT_READY' }); return; }
            const identity = await resolveIdentity(inner);
            if (!identity) { outgoing.status(401).json({ error: 'Sign in to access your saved records.', code: 'AUTH_REQUIRED' }); return; }
            if (protectedDataPath.test(inner.originalUrl.split('?')[0]) && inner.get('X-Fieldwork-Workspace') !== identity.workspaceId) {
              outgoing.status(409).json({ error: 'Your signed-in account changed. Reopen the correct workspace before syncing.', code: 'WORKSPACE_CHANGED' });
              return;
            }
            inner.fieldworkUser = identity; proceed();
          } catch { outgoing.status(503).json({ error: 'Your account could not be verified right now. Keep your device copy and retry.', code: 'CLOUD_UNAVAILABLE' }); }
        });
        candidate.use(createRecordsRouter(getPool()));
        candidate.use(createArchiveRouter(getPool()));
        candidate.use(createBillingRouter(getPool()));
        apiRouter = candidate;
      }
      apiRouter(request, response, next);
    } catch { response.status(503).json({ error: 'Cloud storage is not configured yet.', code: 'CLOUD_NOT_READY' }); }
  });
  app.use((_request, response) => { response.status(404).json({ error: 'Endpoint not found.' }); });
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (response.headersSent) return;
    const parser = error as { type?: string };
    if (parser.type === 'entity.too.large') { response.status(413).json({ error: 'Use the bounded upload endpoint for this file.' }); return; }
    if (parser.type === 'entity.parse.failed') { response.status(400).json({ error: 'Invalid JSON request.' }); return; }
    console.error('Fieldwork cloud request failed.');
    response.status(500).json({ error: 'This request could not be completed. Keep your device copy and retry.' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCloudApp().listen(Number(process.env.PORT || 8080), '0.0.0.0', () => {
    console.info('Fieldwork cloud API is listening.');
  });
  const stop = () => server.close(() => { void closePool().finally(() => process.exit(0)); });
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}

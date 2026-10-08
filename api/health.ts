import {billingConfigured} from '../server/billing.js';
import {sandboxBillingEnabled} from '../server/billing-entitlement.js';
import { hasSessionSigningSecret } from './_auth.js';
import { getAiGatewayToken } from './_gateway.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatewayToken = await getAiGatewayToken();
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '');
  const stripeMode = /^(?:sk|rk)_live_/.test(stripeSecret)
    ? 'live'
    : /^(?:sk|rk)_test_/.test(stripeSecret)
      ? 'test'
      : stripeSecret
        ? 'configured'
        : 'unconfigured';

  return res.status(200).json({
    service: 'Fieldwork by Baker',
    bakerAI: 'configured',
    model: 'openai/gpt-5.6-sol',
    aiGatewayAuthAvailable: Boolean(gatewayToken),
    secureSessionSigningAvailable: hasSessionSigningSecret(),
    stripeCheckoutConfigured: Boolean(stripeSecret),
    stripeMode,
    storageMode: 'browser-local',
    cloudStorageConnected: false,
    liveBillingEnabled: billingConfigured(),
    testBillingEnabled: sandboxBillingEnabled(),
    publicLaunchReady: false,
    liveAiVerificationRequired: true,
    recoveryVersion: 'launch-recovery-v1',
    deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    detailedMigrationVersion: 'entry-audit-v1',
    timestamp: new Date().toISOString(),
  });
}

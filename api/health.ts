import {billingConfigured} from '../server/billing.js';
import {sandboxBillingEnabled} from '../server/billing-entitlement.js';
import { hasSessionSigningSecret } from './_auth.js';
import { getAiGatewayToken } from './_gateway.js';
import { cloudConfiguration } from '../server/cloud-client.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatewayToken = await getAiGatewayToken();
  let cloudConfigured = false;
  try { cloudConfiguration(); cloudConfigured = true; } catch { /* Report missing configuration without exposing it. */ }
  const launchVerified = process.env.BAKER_LAUNCH_VERIFIED === 'true';
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.BAKER_NOTIFICATION_FROM);
  const publicLaunchReady = process.env.VERCEL_ENV === 'production' && launchVerified && cloudConfigured &&
    billingConfigured() && emailConfigured && hasSessionSigningSecret() && Boolean(gatewayToken);
  const stripeSecret = String((process.env.BAKER_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY) || '');
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
    storageMode: cloudConfigured ? 'account-cloud' : 'unconfigured',
    cloudStorageConfigured: cloudConfigured,
    cloudStorageConnected: launchVerified && cloudConfigured,
    liveBillingEnabled: billingConfigured(),
    testBillingEnabled: sandboxBillingEnabled(),
    publicLaunchReady,
    launchVerificationRecorded: launchVerified,
    emailDeliveryConfigured: emailConfigured,
    liveAiVerificationRequired: !launchVerified,
    recoveryVersion: 'launch-recovery-v1',
    deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    detailedMigrationVersion: 'entry-audit-v1',
    timestamp: new Date().toISOString(),
  });
}

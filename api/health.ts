import { hasSessionSigningSecret } from './_auth.js';
import { getAiGatewayToken } from './_gateway.js';
import { cloudApiOrigin, readCloudReadiness } from '../server/cloud-session.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  const [gatewayToken, cloud] = await Promise.all([getAiGatewayToken(), readCloudReadiness()]);
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '');
  const localStripeMode = /^(?:sk|rk)_live_/.test(stripeSecret)
    ? 'live'
    : /^(?:sk|rk)_test_/.test(stripeSecret)
      ? 'test'
      : stripeSecret
        ? 'configured'
        : 'unconfigured';
  const cloudConfigured = Boolean(cloudApiOrigin());
  const stripeMode = cloudConfigured ? String(cloud?.stripeMode || 'unconfigured') : localStripeMode;
  const cloudStorageConnected = cloud?.cloudStorageConnected === true;
  const accountsReady = cloud?.accountsReady === true;
  const signupEnabled = cloud?.signupEnabled === true;
  const liveBillingEnabled = accountsReady && cloud?.liveBillingEnabled === true;
  const liveAiVerified = process.env.FIELDWORK_LIVE_AI_VERIFIED === 'true';
  const publicLaunchReady = cloudStorageConnected && accountsReady && signupEnabled && liveBillingEnabled
    && Boolean(gatewayToken) && liveAiVerified && hasSessionSigningSecret()
    && process.env.FIELDWORK_LAUNCH_VERIFIED === 'true';

  return res.status(200).json({
    service: 'Fieldwork by Baker',
    bakerAI: 'configured',
    model: 'openai/gpt-5.6-sol',
    aiGatewayAuthAvailable: Boolean(gatewayToken),
    secureSessionSigningAvailable: hasSessionSigningSecret(),
    stripeCheckoutConfigured: cloudConfigured ? ['live', 'test'].includes(stripeMode) : Boolean(stripeSecret),
    stripeMode,
    storageMode: cloudStorageConnected ? 'digitalocean-with-device-cache' : 'browser-local',
    cloudStorageConnected,
    accountsReady,
    emailConfigured: cloud?.emailConfigured === true,
    signupEnabled,
    liveBillingEnabled,
    billingWebhookVerified: cloud?.webhookVerified === true,
    publicLaunchReady,
    liveAiVerificationRequired: !liveAiVerified,
    recoveryVersion: 'digitalocean-cloud-v1',
    deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    detailedMigrationVersion: 'entry-audit-v1',
    timestamp: new Date().toISOString(),
  });
}

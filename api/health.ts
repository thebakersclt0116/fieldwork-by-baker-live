export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let secureSessionSigningAvailable = false;
  let aiGatewayAuthAvailable = false;
  let authModuleError = '';
  let gatewayModuleError = '';

  try {
    const auth = await import('./_auth.js');
    secureSessionSigningAvailable = Boolean(auth.hasSessionSigningSecret());
  } catch (error) {
    authModuleError = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 240) : 'Unknown auth module error';
  }

  try {
    const gateway = await import('./_gateway.js');
    aiGatewayAuthAvailable = Boolean(await gateway.getAiGatewayToken());
  } catch (error) {
    gatewayModuleError = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 240) : 'Unknown gateway module error';
  }

  return res.status(200).json({
    service: 'Fieldwork by Baker',
    bakerAI: 'configured',
    model: 'openai/gpt-5.6-sol',
    aiGatewayAuthAvailable,
    secureSessionSigningAvailable,
    authModuleError: authModuleError || undefined,
    gatewayModuleError: gatewayModuleError || undefined,
    timestamp: new Date().toISOString(),
  });
}

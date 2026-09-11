import { hasSessionSigningSecret } from './_auth.js';
import { getAiGatewayToken } from './_gateway.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatewayToken = await getAiGatewayToken();
  return res.status(200).json({
    service: 'Fieldwork by Baker',
    bakerAI: 'configured',
    model: 'openai/gpt-5.6-sol',
    aiGatewayAuthAvailable: Boolean(gatewayToken),
    secureSessionSigningAvailable: hasSessionSigningSecret(),
    timestamp: new Date().toISOString(),
  });
}

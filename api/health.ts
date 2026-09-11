export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    service: 'Fieldwork by Baker',
    bakerAI: 'configured',
    model: 'openai/gpt-5.6-sol',
    aiGatewayAuthAvailable: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    secureSessionSigningAvailable: Boolean(process.env.BAKER_SESSION_SECRET || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    timestamp: new Date().toISOString(),
  });
}

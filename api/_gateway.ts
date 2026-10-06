import { getVercelOidcToken } from '@vercel/oidc';

export async function getAiGatewayToken(): Promise<string | null> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    const token = await getVercelOidcToken();
    return token || null;
  } catch {
    console.error('Unable to retrieve Vercel OIDC token', { code: 'OIDC_TOKEN_UNAVAILABLE' });
    return null;
  }
}

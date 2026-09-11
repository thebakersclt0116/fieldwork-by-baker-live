import { getAiGatewayToken } from './_gateway';

const MODEL = 'openai/gpt-5.6-sol';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getAiGatewayToken();
  if (!token) return res.status(503).json({ ok: false, gatewayAuth: false });

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ai-reporting-tags': 'product:baker-ai,feature:deployment-probe',
      },
      body: JSON.stringify({
        model: MODEL,
        input: 'Reply with exactly: BAKER_AI_OK',
        reasoning: { effort: 'low' },
        max_output_tokens: 20,
      }),
    });

    const body = await response.text();
    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      model: MODEL,
      gatewayStatus: response.status,
      returnedExpectedMarker: body.includes('BAKER_AI_OK'),
    });
  } catch {
    return res.status(502).json({ ok: false, model: MODEL, gatewayStatus: 0, returnedExpectedMarker: false });
  }
}

export type AiFailureCode = 'AI_AUTHENTICATION' | 'AI_BILLING_REQUIRED' | 'AI_MODEL_UNAVAILABLE' | 'AI_RATE_LIMITED' | 'AI_INVALID_REQUEST' | 'AI_TIMEOUT' | 'AI_PROVIDER_UNAVAILABLE' | 'AI_INVALID_RESPONSE';
export class BakerAiError extends Error {
  code: AiFailureCode;
  upstreamStatus?: number;
  constructor(code: AiFailureCode, status?: number) { super(code); this.name = 'BakerAiError'; this.code = code; this.upstreamStatus = status; }
}
export function classifyAiFailure(status: number, rawBody: string): AiFailureCode {
  const body = rawBody.toLowerCase();
  if (status === 401 || status === 403) return 'AI_AUTHENTICATION';
  if (status === 402 || /insufficient.{0,20}(credit|balance)|billing_required|credit balance|payment required/.test(body)) return 'AI_BILLING_REQUIRED';
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status === 404 || /model_not_found|model.{0,30}(not found|not available|does not exist)|no such model|unknown model/.test(body)) return 'AI_MODEL_UNAVAILABLE';
  if (status === 408 || status === 504) return 'AI_TIMEOUT';
  if (status === 400 || status === 422) return 'AI_INVALID_REQUEST';
  return 'AI_PROVIDER_UNAVAILABLE';
}
export function safeAiDiagnostic(error: unknown): { code: AiFailureCode; upstreamStatus?: number } {
  if (error instanceof BakerAiError) return { code: error.code, ...(error.upstreamStatus ? { upstreamStatus: error.upstreamStatus } : {}) };
  if (error instanceof Error && /abort|timeout/i.test(error.name)) return { code: 'AI_TIMEOUT' };
  return { code: 'AI_INVALID_RESPONSE' };
}
export function aiFailureMessage(code: AiFailureCode): string {
  const messages: Record<AiFailureCode, string> = {
    AI_AUTHENTICATION: 'Baker Brain cannot authenticate with its AI provider. The site administrator needs to reconnect the production AI credentials.',
    AI_BILLING_REQUIRED: 'Baker Brain’s AI provider requires billing or credit activation. Your saved fieldwork is unchanged; the site administrator must restore AI funding.',
    AI_MODEL_UNAVAILABLE: 'The configured teaching model is unavailable. The site administrator needs to select an available model.',
    AI_RATE_LIMITED: 'Baker Brain is temporarily at its request limit. Please retry shortly.',
    AI_INVALID_REQUEST: 'The AI provider rejected Baker Brain’s request format. Your draft is preserved while this configuration issue is resolved.',
    AI_TIMEOUT: 'Baker Brain took too long to respond. Your draft is preserved; please retry.',
    AI_PROVIDER_UNAVAILABLE: 'The AI provider is temporarily unavailable. Your fieldwork records are unchanged.',
    AI_INVALID_RESPONSE: 'Baker Brain did not return a complete, valid lesson. Your draft is preserved; please retry.',
  };
  return messages[code];
}
// Fetch-compatible wrapper. Never exposes provider bodies, tokens, prompts or response content in errors/logs.
export async function bakerGatewayFetch(url: string, init: RequestInit): Promise<Response> {
  if (url !== 'https://ai-gateway.vercel.sh/v1/responses') throw new BakerAiError('AI_INVALID_REQUEST');
  const request = JSON.parse(String(init.body || '{}'));
  const requested = String(process.env.BAKER_AI_MODEL || request.model || 'openai/gpt-6-sol');
  const backup = process.env.BAKER_AI_FALLBACK_MODEL || 'openai/gpt-6-sol';
  const start = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const actualModel = attempt === 0 ? requested : backup;
    const budget = Math.min(32000, 48000 - (Date.now() - start));
    if (budget < 1000) throw new BakerAiError('AI_TIMEOUT');
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(budget), body: JSON.stringify({ ...request, model: actualModel, store: false, max_output_tokens: request.max_output_tokens || 6000 }) });
    } catch (error) {
      if (error instanceof Error && /abort|timeout/i.test(error.name)) throw new BakerAiError('AI_TIMEOUT');
      throw new BakerAiError('AI_PROVIDER_UNAVAILABLE');
    }
    if (response.ok) {
      const headers = new Headers(response.headers); headers.set('x-baker-model', actualModel);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    const raw = (await response.text()).slice(0, 16000), code = classifyAiFailure(response.status, raw);
    // A rejected, nonexistent model has not produced an answer. Retry only this configuration error,
    // on the same already-authorized gateway. Never mask auth/billing/permission errors with retries.
    if (code === 'AI_MODEL_UNAVAILABLE' && attempt === 0 && backup !== requested) continue;
    throw new BakerAiError(code, response.status);
  }
  throw new BakerAiError('AI_PROVIDER_UNAVAILABLE');
}

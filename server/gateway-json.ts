export const BAKER_AI_MODEL = process.env.BAKER_AI_MODEL?.trim() || 'openai/gpt-5.6-sol';
export class BakerGatewayError extends Error {
  code: string; upstreamStatus?: number;
  constructor(code: string, message: string, upstreamStatus?: number) { super(message); this.name = 'BakerGatewayError'; this.code = code; this.upstreamStatus = upstreamStatus; }
}
export function safeAiFailure(error: unknown): { code: string; error: string } {
  if (error instanceof BakerGatewayError) return { code: error.code, error: error.message };
  return { code: 'AI_UNAVAILABLE', error: 'The live AI service could not finish. Your prompt has not been saved as a fieldwork entry. Try again shortly.' };
}
function statusError(status: number): BakerGatewayError {
  if (status === 401 || status === 403) return new BakerGatewayError('AI_AUTH_CONFIGURATION', 'The AI provider rejected the server credentials. The site owner must reconnect AI Gateway; signing in again will not fix this.', status);
  if (status === 402) return new BakerGatewayError('AI_BILLING_REQUIRED', 'AI Gateway requires billing or credits to be restored by the site owner. Your fieldwork records are unchanged.', status);
  if (status === 429) return new BakerGatewayError('AI_RATE_LIMITED', 'The AI service is at its usage limit. Wait briefly before trying again; the site owner can check the project quota.', status);
  if ([400, 404, 405, 422].includes(status)) return new BakerGatewayError('AI_MODEL_OR_FORMAT_UNAVAILABLE', 'The configured AI model or structured-response format was rejected. The site owner must check the model configuration.', status);
  return new BakerGatewayError('AI_PROVIDER_UNAVAILABLE', 'The AI provider is temporarily unavailable. Your fieldwork records are unchanged.', status);
}
function extractText(payload: any, protocol: 'responses' | 'chat'): string {
  if (protocol === 'chat') {
    if (payload?.choices?.[0]?.finish_reason === 'length') throw new BakerGatewayError('AI_RESPONSE_INCOMPLETE', 'The AI answer was too long to finish. Ask for a smaller lesson or fewer sections.');
    if (payload?.choices?.[0]?.message?.refusal) throw new BakerGatewayError('AI_REQUEST_DECLINED', 'The AI provider declined this request. Use a de-identified BCBA study or documentation question.');
    return typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content : '';
  }
  if (payload?.status === 'incomplete') throw new BakerGatewayError('AI_RESPONSE_INCOMPLETE', 'The AI answer was too long to finish. Ask for a smaller lesson or fewer sections.');
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'refusal') throw new BakerGatewayError('AI_REQUEST_DECLINED', 'The AI provider declined this request. Use a de-identified BCBA study or documentation question.');
      if (part?.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
    }
  }
  return parts.join('');
}
export async function gatewayJson(args: {
  token: string; instructions: string; input: string; schema: object; name: string; model?: string;
  feature: string; fetcher?: typeof fetch;
}): Promise<{ value: Record<string, unknown>; model: string; protocol: string }> {
  const model = args.model || BAKER_AI_MODEL, fetcher = args.fetcher || fetch;
  if (!args.token.trim()) throw new BakerGatewayError('AI_AUTH_CONFIGURATION', 'AI Gateway credentials are not configured on the server.');
  if (args.input.length > 50000) throw new BakerGatewayError('AI_INPUT_TOO_LONG', 'The combined prompt and context are too long. Use a smaller selection of records.');
  const started = Date.now();
  // Keep the same requested model. Try the other supported API shape only for compatibility errors;
  // never evade authentication, billing, refusal, or quota failures by silently switching providers.
  for (const protocol of ['responses', 'chat'] as const) {
    const remaining = 45000 - (Date.now() - started);
    if (remaining < 1000) throw new BakerGatewayError('AI_TIMEOUT', 'The live AI request timed out. Try a shorter question; your tracked records are unchanged.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(protocol === 'responses' ? 28000 : 16000, remaining));
    try {
      const common = { model, store: false };
      const body = protocol === 'responses'
        ? { ...common, instructions: args.instructions, input: args.input, max_output_tokens: 4000, reasoning: { effort: 'low' }, text: { format: { type: 'json_schema', name: args.name, strict: true, schema: args.schema } } }
        : { ...common, messages: [{ role: 'system', content: args.instructions }, { role: 'user', content: args.input }], max_completion_tokens: 4000, reasoning_effort: 'low', response_format: { type: 'json_schema', json_schema: { name: args.name, strict: true, schema: args.schema } } };
      const response = await fetcher(`https://ai-gateway.vercel.sh/v1/${protocol === 'responses' ? 'responses' : 'chat/completions'}`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${args.token}`, 'Content-Type': 'application/json', 'ai-reporting-tags': `product:baker,feature:${args.feature}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        // Deliberately do not print upstream bodies: they can contain prompts, identifying information, or secrets.
        await response.body?.cancel().catch(() => {});
        if (protocol === 'responses' && [400, 404, 405, 422].includes(response.status)) continue;
        throw statusError(response.status);
      }
      const raw = await response.text();
      if (raw.length > 1000000) throw new BakerGatewayError('AI_RESPONSE_INVALID', 'The AI provider returned an unexpectedly large answer. Try a smaller request.');
      let payload: unknown; try { payload = JSON.parse(raw); } catch { throw new BakerGatewayError('AI_RESPONSE_INVALID', 'The AI provider returned an unreadable response. Please retry.'); }
      const output = extractText(payload, protocol);
      let value: unknown; try { value = JSON.parse(output); } catch { throw new BakerGatewayError('AI_RESPONSE_INVALID', 'The AI response did not match the required format. No proposed record was saved.'); }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BakerGatewayError('AI_RESPONSE_INVALID', 'The AI response did not contain a valid object.');
      return { value: value as Record<string, unknown>, model, protocol };
    } catch (error) {
      if (error instanceof BakerGatewayError) throw error;
      if (controller.signal.aborted) throw new BakerGatewayError('AI_TIMEOUT', 'The live AI request timed out. Try a shorter question; your tracked records are unchanged.');
      throw new BakerGatewayError('AI_NETWORK_UNAVAILABLE', 'The server could not reach the AI provider. Try again shortly.');
    } finally { clearTimeout(timer); }
  }
  throw new BakerGatewayError('AI_MODEL_OR_FORMAT_UNAVAILABLE', 'The configured model rejected both supported request formats. The site owner must review AI Gateway settings.');
}

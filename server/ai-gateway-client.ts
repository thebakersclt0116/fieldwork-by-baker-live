export type AiFailureCode = 'AI_AUTH_REQUIRED' | 'AI_BILLING_REQUIRED' | 'AI_RATE_LIMITED' | 'AI_MODEL_UNAVAILABLE' | 'AI_REQUEST_REJECTED' | 'AI_TIMEOUT' | 'AI_PROVIDER_UNAVAILABLE' | 'AI_INVALID_RESPONSE' | 'AI_REFUSAL';

const MESSAGES: Record<AiFailureCode, string> = {
  AI_AUTH_REQUIRED: 'Baker Brain cannot authenticate with its AI service. The owner must repair the AI Gateway connection.',
  AI_BILLING_REQUIRED: 'Baker Brain is paused because the AI service requires billing or additional credits. Your fieldwork records are unaffected.',
  AI_RATE_LIMITED: 'Baker Brain is temporarily at its request limit. Please wait a moment before trying again.',
  AI_MODEL_UNAVAILABLE: 'The configured Baker Brain model is not available to this deployment. The owner must check model access.',
  AI_REQUEST_REJECTED: 'The AI service rejected this request format. Please retry after the owner checks the integration.',
  AI_TIMEOUT: 'Baker Brain took too long to respond. Your question has been kept so you can retry.',
  AI_PROVIDER_UNAVAILABLE: 'Baker Brain could not reach its live AI service. Please try again shortly.',
  AI_INVALID_RESPONSE: 'The AI service did not return a complete usable response. No generated lesson or record was saved.',
  AI_REFUSAL: 'The AI service could not answer that request. Try a de-identified, educational BCBA question.',
};

export class AiGatewayError extends Error {
  code: AiFailureCode;
  upstreamStatus: number | null;
  constructor(code: AiFailureCode, upstreamStatus: number | null = null) {
    super(MESSAGES[code]); this.name = 'AiGatewayError'; this.code = code; this.upstreamStatus = upstreamStatus;
  }
}

export function classifyGatewayFailure(status: number, body: unknown): AiGatewayError {
  // Provider bodies are inspected in memory only. Never log them: they can echo credentials or user prompts.
  const detail = (typeof body === 'string' ? body : JSON.stringify(body || {})).slice(0, 16000).toLowerCase();
  if (status === 402 || /insufficient.?quota|insufficient.?credits|credit balance|payment.?required|billing.?hard.?limit|insufficient.?balance/.test(detail)) return new AiGatewayError('AI_BILLING_REQUIRED', status);
  if (status === 401 || status === 403) return new AiGatewayError('AI_AUTH_REQUIRED', status);
  if (status === 429) return new AiGatewayError('AI_RATE_LIMITED', status);
  if (/model.{0,50}(not found|not available|not supported|does not exist)|model_not_found/.test(detail)) return new AiGatewayError('AI_MODEL_UNAVAILABLE', status);
  if (status === 408 || status === 504) return new AiGatewayError('AI_TIMEOUT', status);
  if (status >= 500) return new AiGatewayError('AI_PROVIDER_UNAVAILABLE', status);
  return new AiGatewayError('AI_REQUEST_REJECTED', status);
}

export function safeAiFailure(error: unknown) {
  const failure = error instanceof AiGatewayError ? error : new AiGatewayError('AI_PROVIDER_UNAVAILABLE');
  return { code: failure.code, error: failure.message, upstreamStatus: failure.upstreamStatus, liveModelResponded: false as const };
}

export function parseStructuredResponse(payload: any, transport: 'responses' | 'chat'): unknown {
  if (payload?.error) throw new AiGatewayError('AI_INVALID_RESPONSE');
  let output = '';
  if (transport === 'chat') {
    const choice = payload?.choices?.[0];
    if (choice?.message?.refusal) throw new AiGatewayError('AI_REFUSAL');
    if (!choice || choice.finish_reason !== 'stop' || typeof choice.message?.content !== 'string') throw new AiGatewayError('AI_INVALID_RESPONSE');
    output = choice.message.content;
  } else {
    if (payload?.status === 'incomplete' || payload?.status === 'failed' || payload?.incomplete_details) throw new AiGatewayError('AI_INVALID_RESPONSE');
    if (Array.isArray(payload?.output)) {
      for (const item of payload.output) {
        for (const part of Array.isArray(item?.content) ? item.content : []) {
          if (part?.type === 'refusal') throw new AiGatewayError('AI_REFUSAL');
          if (typeof part?.text === 'string' && (!part.type || part.type === 'output_text')) output += part.text;
        }
      }
    }
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) output = payload.output_text;
  }
  if (!output.trim() || output.length > 160000) throw new AiGatewayError('AI_INVALID_RESPONSE');
  // Some compatible providers wrap structured JSON in a code fence. Remove only a single outer fence.
  const normalized = output.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  try { return JSON.parse(normalized); } catch { throw new AiGatewayError('AI_INVALID_RESPONSE'); }
}

type StructuredRequest = {
  token: string; model: string; instructions: string; input: string;
  schemaName: string; schema: Record<string, unknown>; feature: string;
  maxOutputTokens?: number; fetchImpl?: typeof fetch;
};

export async function requestStructuredGateway(args: StructuredRequest): Promise<{ data: unknown; transport: 'responses' | 'chat' }> {
  if (!args.token) throw new AiGatewayError('AI_AUTH_REQUIRED');
  const fetchImpl = args.fetchImpl || fetch;
  const schema = { name: args.schemaName, strict: true, schema: args.schema };
  const tokenLimit = Math.max(512, Math.min(8000, args.maxOutputTokens || 6000));
  // A single overall deadline includes the optional format-compatibility retry and reading the response body.
  const signal = AbortSignal.timeout(48000);
  for (const transport of ['responses', 'chat'] as const) {
    const body = transport === 'responses'
      ? { model: args.model, instructions: args.instructions, input: args.input, reasoning: { effort: 'low' }, max_output_tokens: tokenLimit, store: false, text: { format: { type: 'json_schema', ...schema } } }
      : { model: args.model, messages: [{ role: 'system', content: args.instructions }, { role: 'user', content: args.input }], reasoning_effort: 'low', max_completion_tokens: tokenLimit, store: false, response_format: { type: 'json_schema', json_schema: schema } };
    let response: Response;
    let raw: string;
    try {
      response = await fetchImpl(`https://ai-gateway.vercel.sh/v1/${transport === 'responses' ? 'responses' : 'chat/completions'}`, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${args.token}`, 'Content-Type': 'application/json', 'ai-reporting-tags': args.feature },
        body: JSON.stringify(body),
      });
      raw = await response.text();
    } catch (error) {
      if (signal.aborted || (error instanceof Error && /timeout|abort/i.test(error.name))) throw new AiGatewayError('AI_TIMEOUT');
      throw new AiGatewayError('AI_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok) {
      const failure = classifyGatewayFailure(response.status, raw);
      // Retry only a format/endpoint rejection, using the SAME model. Never evade billing, authorization or rate limits.
      if (transport === 'responses' && failure.code === 'AI_REQUEST_REJECTED' && [400, 404, 405, 422].includes(response.status)) continue;
      throw failure;
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new AiGatewayError('AI_INVALID_RESPONSE'); }
    return { data: parseStructuredResponse(payload, transport), transport };
  }
  throw new AiGatewayError('AI_REQUEST_REJECTED');
}

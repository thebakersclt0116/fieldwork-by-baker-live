import { requireSession } from './_auth';

const MODEL = 'openai/gpt-5.6-sol';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function fallback(session: ReturnType<typeof requireSession>, requestText: string) {
  const entry = session?.reviewEntry;
  const concerns: string[] = [];
  if (!entry) concerns.push('No fieldwork entry is attached to this supervisor invite.');
  if (entry && !entry.narrative.trim()) concerns.push('The entry does not include a narrative.');
  if (entry && entry.duration <= 0) concerns.push('The entry does not include a positive duration.');
  if (entry && !entry.supervisionMinutes) concerns.push('No supervision minutes are recorded for this entry. Confirm whether supervision occurred.');

  return {
    recommendedStatus: concerns.length > 0 ? 'PENDING' : 'PENDING',
    note: concerns.length > 0
      ? `Please clarify: ${concerns.join(' ')}`
      : 'Entry reviewed. Confirm that the activity classification and supervision details accurately reflect the work completed.',
    message: requestText.trim()
      ? `I reviewed this entry. ${concerns.length > 0 ? concerns.join(' ') : 'Please confirm the documentation reflects the fieldwork performed.'}`
      : 'Please review the supervisor note attached to this entry and make any requested clarifications before resubmitting.',
    confidence: 0.55,
    concerns,
    rationale: 'Baker used its deterministic supervisor fallback. The qualified supervisor must make the final verification decision.',
    provider: 'deterministic-fallback',
  };
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  if (!Array.isArray(payload?.output)) return '';
  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req, ['supervisor']);
  if (!session || !session.reviewEntry || !session.superviseeEmail) {
    return send(res, 401, { error: 'A valid supervisor review invite tied to an entry is required.' });
  }

  const requestText = String(req.body?.request || '').trim().slice(0, 3000);
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayToken) return send(res, 200, fallback(session, requestText));

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendedStatus: { type: 'string', enum: ['VERIFIED', 'PENDING', 'REJECTED'] },
      note: { type: 'string' },
      message: { type: 'string' },
      confidence: { type: 'number' },
      concerns: { type: 'array', items: { type: 'string' } },
      rationale: { type: 'string' },
    },
    required: ['recommendedStatus', 'note', 'message', 'confidence', 'concerns', 'rationale'],
  };

  const instructions = `You are Baker AI Supervisor Co-Pilot. Assist a qualified BCBA supervisor reviewing one supervisee fieldwork entry. You are not the supervisor and you cannot approve, verify, reject, or clinically judge the entry. You only draft recommendations for the human supervisor to edit and choose.\n\nUse the official BACB 2027 fieldwork framework as review context: 20-160 hours per supervisory period, at least 60% unrestricted overall, 5% supervision for Supervised Fieldwork, 7.5% for Concentrated Supervised Fieldwork, at least 50% of supervised hours individual supervision, and monthly client-observation requirements where applicable. The supervisor remains responsible for determining activity acceptability and verification.\n\nNever invent facts, client outcomes, procedures, data percentages, supervision time, observation time, or missing details. If the entry lacks information, ask for clarification rather than filling it in. Draft a concise entry note and a separate supportive message to the supervisee. recommendedStatus is only a suggestion; prefer PENDING when facts are missing or ambiguous. Confidence is 0-1 and measures how complete the review information is, not whether the fieldwork is BACB-approved.`;

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
        'ai-reporting-tags': 'product:baker-ai,feature:supervisor-copilot',
        'ai-reporting-user': session.email,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `Supervisee: ${session.superviseeEmail}\nShared entry: ${JSON.stringify(session.reviewEntry)}\nSupervisor request: ${requestText || 'Review this entry and draft a useful note and message.'}`,
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'baker_supervisor_review',
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) return send(res, 200, fallback(session, requestText));
    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const result = JSON.parse(outputText);
    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
    return send(res, 200, { ...result, provider: MODEL });
  } catch (error) {
    console.error('Baker supervisor AI request failed', error);
    return send(res, 200, fallback(session, requestText));
  }
}

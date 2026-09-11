import { requireSession } from './_auth';
import { getAiGatewayToken } from './_gateway';

const MODEL = 'openai/gpt-5.6-sol';

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function fallbackParse(text: string, date: string) {
  const lower = text.toLowerCase();
  const durationMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
  const supervisionMatch = lower.match(/(?:supervised|supervision|supervisor)[^\d]{0,30}(\d+)\s*(?:minutes?|mins?|min)\b/);
  const clientMatch = text.match(/client\s+([A-Za-z]{1,4})\b/i);
  const supervisorMatch = text.match(/(?:dr\.?|doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const restricted = /direct therapy|dtt|discrete trial|implemented.*protocol|treatment implementation|instructional procedure/.test(lower)
    && !/assessment|behavior plan|data analysis|parent training|caregiver training|program writing|research/.test(lower);
  const assessment = /assessment|preference assessment|functional analysis/.test(lower);
  const behaviorPlan = /behavior plan|intervention plan|dra|differential reinforcement|program/.test(lower);
  const training = /parent|caregiver|staff training|training/.test(lower);
  const activityType = restricted
    ? 'RESTRICTED_DIRECT'
    : assessment
      ? 'UNRESTRICTED_ASSESSMENT'
      : behaviorPlan
        ? 'UNRESTRICTED_BEHAVIOR_PLAN'
        : training
          ? 'UNRESTRICTED_TRAINING'
          : 'UNRESTRICTED_OTHER';
  const activityCategory = restricted ? 'RESTRICTED' : 'UNRESTRICTED';
  const duration = durationMatch ? Number(durationMatch[1]) : 0;
  const supervisionMinutes = supervisionMatch ? Number(supervisionMatch[1]) : 0;

  return {
    date,
    duration,
    fieldworkType: 'SUPERVISED',
    activityCategory,
    activityType,
    supervisorName: supervisorMatch ? `Dr. ${supervisorMatch[1]}` : '',
    supervisionMinutes,
    observationMinutes: 0,
    individualSupervisionMinutes: supervisionMinutes,
    clientInitials: clientMatch?.[1]?.toUpperCase() || '',
    suggestedSetting: '',
    narrative: text.trim(),
    confidence: duration > 0 ? 0.72 : 0.52,
    rationale: 'Baker AI used its deterministic fallback parser because the model gateway was unavailable. Please review every field before confirming.',
    flags: duration > 0 ? ['AI model unavailable; review classification before submitting.'] : ['Duration could not be identified.'],
    needsSupervisorReview: true,
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
  if (req.method === 'GET') {
    const gatewayToken = await getAiGatewayToken();
    return send(res, 200, {
      service: 'Baker AI',
      status: 'ready',
      model: MODEL,
      gatewayAuthAvailable: Boolean(gatewayToken),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req, ['owner', 'paid', 'professional', 'supervisor']);
  if (!session) return send(res, 401, { error: 'A paid or authorized Baker session is required.' });

  const text = String(req.body?.text || '').trim();
  const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (text.length < 3) return send(res, 400, { error: 'Tell Baker what happened during the session.' });
  if (text.length > 8000) return send(res, 400, { error: 'Entry text is too long for this beta.' });

  const gatewayToken = await getAiGatewayToken();
  if (!gatewayToken) {
    return send(res, 200, { result: fallbackParse(text, date), provider: 'deterministic-fallback' });
  }

  const instructions = `You are Baker AI, an assistive BCBA fieldwork documentation copilot. Convert a trainee's natural-language session recap into a structured proposed fieldwork entry.\n\nUse these official BACB 2027 fieldwork rules as constraints:\n- Supervised Fieldwork: 2,000 hours to qualify, 5% supervision per supervisory period.\n- Concentrated Supervised Fieldwork: 1,500 hours to qualify, 7.5% supervision per supervisory period.\n- Each supervisory period is a calendar month with 20–160 fieldwork hours.\n- Client observation: 60 cumulative minutes/month for supervised fieldwork; 90 for concentrated.\n- At least 50% of supervised hours must be individual supervision.\n- At least 60% of total fieldwork must be unrestricted.\n- Restricted activities involve direct delivery of therapeutic/instructional procedures to clients. Unrestricted activities best exemplify behavior-analyst work that oversees/develops programs and systems.\n- The qualified supervisor remains responsible for determining whether an activity is acceptable and for verifying fieldwork. Never claim an entry is BACB-approved.\n\nDocumentation rules:\n- Never invent client outcomes, percentages, data, diagnoses, procedures, durations, supervisor contact, or observations that the user did not state.\n- Write a concise professional narrative using only supplied facts.\n- If an entry contains both restricted and unrestricted work, classify the predominant described activity but add a flag recommending the user split the entry if separate durations can be identified.\n- supervisionMinutes means actual supervisor-trainee contact stated by the user. observationMinutes means time the supervisor observed the trainee with a client only when explicitly stated.\n- individualSupervisionMinutes should equal explicitly stated individual supervision; otherwise 0.\n- Confidence is 0 to 1 and reflects extraction/classification confidence, not clinical correctness.\n- needsSupervisorReview should be true whenever classification is ambiguous, confidence < .95, mixed activities are present, or required details are missing.\n\nOfficial reference set: 2027 BCBA Requirements, current BCBA Handbook, BACB Supervised Fieldwork FAQs, Documenting Fieldwork FAQs, 2027 Monthly Fieldwork Verification Forms (individual and organization), and 2027 Final Fieldwork Verification Forms.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      date: { type: 'string' },
      duration: { type: 'number' },
      fieldworkType: { type: 'string', enum: ['SUPERVISED', 'CONCENTRATED'] },
      activityCategory: { type: 'string', enum: ['RESTRICTED', 'UNRESTRICTED'] },
      activityType: {
        type: 'string',
        enum: [
          'RESTRICTED_DIRECT',
          'RESTRICTED_INDIRECT',
          'UNRESTRICTED_ASSESSMENT',
          'UNRESTRICTED_BEHAVIOR_PLAN',
          'UNRESTRICTED_SUPERVISION',
          'UNRESTRICTED_TRAINING',
          'UNRESTRICTED_OTHER',
        ],
      },
      supervisorName: { type: 'string' },
      supervisionMinutes: { type: 'number' },
      observationMinutes: { type: 'number' },
      individualSupervisionMinutes: { type: 'number' },
      clientInitials: { type: 'string' },
      suggestedSetting: { type: 'string' },
      narrative: { type: 'string' },
      confidence: { type: 'number' },
      rationale: { type: 'string' },
      flags: { type: 'array', items: { type: 'string' } },
      needsSupervisorReview: { type: 'boolean' },
    },
    required: [
      'date', 'duration', 'fieldworkType', 'activityCategory', 'activityType', 'supervisorName',
      'supervisionMinutes', 'observationMinutes', 'individualSupervisionMinutes', 'clientInitials',
      'suggestedSetting', 'narrative', 'confidence', 'rationale', 'flags', 'needsSupervisorReview',
    ],
  };

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
        'ai-reporting-tags': 'product:baker-ai,feature:text-to-entry',
        'ai-reporting-user': session.email,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `Default date: ${date}\nCurrent compliance context: ${JSON.stringify(context).slice(0, 4000)}\nTrainee recap: ${text}`,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_schema', name: 'baker_fieldwork_entry', strict: true, schema } },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error('Baker AI Gateway error', response.status, detail);
      return send(res, 200, {
        result: fallbackParse(text, date),
        provider: 'deterministic-fallback',
        warning: 'The AI model was temporarily unavailable; Baker used its fallback parser.',
      });
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const result = JSON.parse(outputText);
    result.date = result.date || date;
    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
    result.duration = Math.max(0, Number(result.duration) || 0);
    result.supervisionMinutes = Math.max(0, Number(result.supervisionMinutes) || 0);
    result.observationMinutes = Math.max(0, Number(result.observationMinutes) || 0);
    result.individualSupervisionMinutes = Math.max(0, Number(result.individualSupervisionMinutes) || 0);
    return send(res, 200, { result, provider: MODEL });
  } catch (error) {
    console.error('Baker AI request failed', error);
    return send(res, 200, {
      result: fallbackParse(text, date),
      provider: 'deterministic-fallback',
      warning: 'Baker AI fell back to local parsing. Review the entry before confirming.',
    });
  }
}

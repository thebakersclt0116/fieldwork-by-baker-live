import { canUsePaidTools, requireSession } from './_auth.js';
import { getAiGatewayToken } from './_gateway.js';
import { createBakerBrainFallback, runBakerBrain } from '../server/baker-brain-safe.js';

const MODEL = 'openai/gpt-5.6-sol';

export const config = { maxDuration: 60 };

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function normalizeClock(raw: string): string {
  const value = raw.trim().toLowerCase();
  const twelve = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (twelve) {
    let hour = Number(twelve[1]) % 12;
    if (twelve[3] === 'pm') hour += 12;
    return `${String(hour).padStart(2, '0')}:${twelve[2] || '00'}`;
  }
  const twentyFour = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return twentyFour ? `${twentyFour[1].padStart(2, '0')}:${twentyFour[2]}` : '';
}

function clockHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0;
}

function fallbackParse(text: string, date: string) {
  const lower = text.toLowerCase();
  const durationMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
  const rangeMatch = text.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|until|[-–—])\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const startTime = rangeMatch ? normalizeClock(rangeMatch[1]) : '';
  const endTime = rangeMatch ? normalizeClock(rangeMatch[2]) : '';
  const timeDuration = clockHours(startTime, endTime);
  const supervisionMatch = lower.match(/(?:supervised|supervision|supervisor)[^\d]{0,35}(\d+)\s*(?:minutes?|mins?|min)\b/);
  const observationMatch = lower.match(/(?:observed|observation)[^\d]{0,35}(\d+)\s*(?:minutes?|mins?|min)\b/);
  const clientMatch = text.match(/client\s+([A-Za-z]{1,12})\b/i);
  const supervisorMatch = text.match(/(?:supervisor\s+(?:was|is)\s+|with\s+|by\s+|(?:dr\.?|doctor)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const organizationMatch = text.match(/(?:at|for|organization\s+)(Melmark\s+Carolinas|[A-Z][A-Za-z0-9&.' -]{2,50}(?:Clinic|Center|Services|School|Carolinas))/i);
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
          : /supervision|met with/.test(lower)
            ? 'UNRESTRICTED_SUPERVISION'
            : 'UNRESTRICTED_OTHER';
  const activityCategory = restricted ? 'RESTRICTED' : 'UNRESTRICTED';
  const workPresence = /independent|without (?:my )?(?:bcba|supervisor)|bcba (?:was )?not present/.test(lower) ? 'INDEPENDENT' : /supervised|supervisor|bcba/.test(lower) ? 'SUPERVISED' : 'INDEPENDENT';
  const supervisionFormat = /group/.test(lower) ? 'GROUP' : 'INDIVIDUAL';
  const observationMode = /online|zoom|video|virtual|remote/.test(lower)
    ? 'ONLINE'
    : /phone|call/.test(lower)
      ? 'PHONE'
      : /in person|in-person|onsite|on site/.test(lower)
        ? 'IN_PERSON'
        : 'NONE';
  const duration = timeDuration || (durationMatch ? Number(durationMatch[1]) : 0);
  const supervisionMinutes = workPresence === 'SUPERVISED' ? (supervisionMatch ? Number(supervisionMatch[1]) : 0) : 0;
  const observationMinutes = observationMatch ? Number(observationMatch[1]) : 0;
  const supervisorName = supervisorMatch ? supervisorMatch[1].trim() : '';
  const organizationName = organizationMatch ? organizationMatch[1].trim() : '';
  const missingFields = [
    !organizationName ? 'organization' : '',
    !supervisorName ? 'responsible supervisor' : '',
    duration <= 0 ? 'start/end time or duration' : '',
    workPresence === 'SUPERVISED' && supervisionMinutes <= 0 ? 'supervision minutes' : '',
    observationMinutes > 0 && observationMode === 'NONE' ? 'observation mode' : '',
  ].filter(Boolean);

  return {
    date,
    startTime,
    endTime,
    duration,
    fieldworkType: 'SUPERVISED',
    activityCategory,
    activityType,
    supervisorName,
    organizationName,
    workPresence,
    supervisionFormat,
    supervisionMinutes,
    observationMinutes,
    observationMode,
    clientInitials: clientMatch?.[1]?.toUpperCase() || '',
    suggestedSetting: organizationName,
    narrative: text.trim(),
    confidence: duration > 0 ? 0.7 : 0.48,
    rationale: 'Baker used its deterministic fallback parser because the model gateway was unavailable. Review every field before saving.',
    flags: ['AI model unavailable; verify the proposed classification and supervision details.'],
    missingFields,
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
      service: 'Baker AI + Baker Brain',
      status: 'ready',
      model: MODEL,
      version: 'baker-brain-v1-2026-09-14',
      gatewayAuthAvailable: Boolean(gatewayToken),
      modes: ['fieldwork-entry', 'bcba-brain'],
      entryStructure: ['organization', 'supervisor', 'time-range', 'independent-supervised', 'restricted-unrestricted', 'individual-group', 'client-observation'],
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const session = requireSession(req);
  const authorized = Boolean(session && (session.role === 'supervisor' || canUsePaidTools(session)));
  if (!session || !authorized) return send(res, 401, { error: 'A paid or authorized Baker session is required.' });

  const mode = String(req.body?.mode || 'fieldwork-entry');
  if (mode === 'bcba-brain') {
    const message = String(req.body?.message || '').trim();
    if (message.length < 2) return send(res, 400, { error: 'Ask Baker Brain a BCBA question.' });
    if (message.length > 12000) return send(res, 400, { error: 'That message is too long for one Baker Brain turn.' });
    const gatewayToken = await getAiGatewayToken();
    if (!gatewayToken) return send(res, 503, { error: 'Baker Brain AI is temporarily unavailable.' });
    try {
      const result = await runBakerBrain({
        message,
        context: req.body?.context && typeof req.body.context === 'object' ? req.body.context : {},
        history: Array.isArray(req.body?.history) ? req.body.history : [],
        gatewayToken,
        userEmail: session.email,
      });
      return send(res, 200, result);
    } catch (error) {
      console.error('Baker Brain request failed', error);
      return send(res, 200, {
        ...createBakerBrainFallback(message),
        warning: 'The live Baker Brain model was temporarily unavailable. No user data was lost.',
      });
    }
  }

  const text = String(req.body?.text || '').trim();
  const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (text.length < 3) return send(res, 400, { error: 'Tell Baker what happened during the session.' });
  if (text.length > 8000) return send(res, 400, { error: 'Entry text is too long for this beta.' });

  const gatewayToken = await getAiGatewayToken();
  if (!gatewayToken) {
    return send(res, 200, { result: fallbackParse(text, date), provider: 'deterministic-fallback' });
  }

  const instructions = `You are Baker AI, an assistive BCBA fieldwork documentation copilot. Convert a trainee's natural-language recap into ONE structured proposed fieldwork entry. Never invent facts.

ENTRY STRUCTURE REQUIRED BY THIS PRODUCT:
- Every entry must identify the organization responsible for the hours and the responsible supervisor. A trainee may have multiple supervisors and multiple organizations across entries.
- Capture date, start time, end time, and decimal duration. If start/end are stated, calculate the exact elapsed time to two decimals. Example: 8:30 AM to 10:15 AM = 1.75 hours; 8:30 AM to 12:07 PM = 3.62 hours.
- workPresence is INDEPENDENT when the BCBA/supervisor was not present for the activity; SUPERVISED when supervision/contact occurred for the entry.
- Every entry still needs RESTRICTED or UNRESTRICTED classification when the user states enough information. Restricted generally means direct delivery/implementation of therapeutic or instructional procedures with clients. Unrestricted best exemplifies behavior-analyst work such as assessment, data analysis, program/behavior-plan development, training, and supervision-related analytic work.
- For supervised entries, capture supervisionFormat as INDIVIDUAL or GROUP. Do not infer GROUP unless the user says multiple trainees/supervisees were present.
- supervisionMinutes means actual supervisor-trainee contact. If the user explicitly says the supervisor was present for the entire time range, supervisionMinutes may equal the entry duration in minutes. Otherwise do not invent it.
- observationMinutes means ONLY time the supervisor observed the trainee working directly with a client. A supervision meeting without a client has 0 observation minutes.
- observationMode is IN_PERSON, ONLINE, PHONE, or NONE. Only state a mode the user supplied or clearly described.
- clientInitials may contain a stated client first name or initials for beta testing; never invent one.
- If required details are absent, put their human-readable names in missingFields so the UI can ask the trainee to complete them.

BACB 2027 GUIDANCE USED FOR FLAGS:
- Supervised Fieldwork: 2,000 qualifying hours and 5% supervision per supervisory period.
- Concentrated Supervised Fieldwork: 1,500 qualifying hours and 7.5% supervision per supervisory period.
- Each calendar-month supervisory period must contain 20–160 fieldwork hours.
- Client observation: 60 cumulative minutes/month for Supervised Fieldwork; 90 for Concentrated.
- At least 50% of supervised hours must be individual supervision.
- At least 60% of total fieldwork must be unrestricted.
- The qualified supervisor determines activity acceptability and verification. Never claim BACB approval.

DOCUMENTATION RULES:
- Write a concise professional narrative using only supplied facts.
- Never invent outcomes, percentages, diagnoses, procedures, durations, supervisor contact, observation, organization, modality, or client information.
- If one recap contains separately timed restricted and unrestricted activities, flag that the trainee should split them into separate entries instead of blending them.
- If classification is ambiguous, choose the best-supported category but flag it and set needsSupervisorReview=true.
- Confidence is 0–1 and reflects extraction/classification confidence, not clinical correctness.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      date: { type: 'string' },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      duration: { type: 'number' },
      fieldworkType: { type: 'string', enum: ['SUPERVISED', 'CONCENTRATED'] },
      activityCategory: { type: 'string', enum: ['RESTRICTED', 'UNRESTRICTED'] },
      activityType: { type: 'string', enum: ['RESTRICTED_DIRECT', 'RESTRICTED_INDIRECT', 'UNRESTRICTED_ASSESSMENT', 'UNRESTRICTED_BEHAVIOR_PLAN', 'UNRESTRICTED_SUPERVISION', 'UNRESTRICTED_TRAINING', 'UNRESTRICTED_OTHER'] },
      supervisorName: { type: 'string' },
      organizationName: { type: 'string' },
      workPresence: { type: 'string', enum: ['INDEPENDENT', 'SUPERVISED'] },
      supervisionFormat: { type: 'string', enum: ['INDIVIDUAL', 'GROUP'] },
      supervisionMinutes: { type: 'number' },
      observationMinutes: { type: 'number' },
      observationMode: { type: 'string', enum: ['IN_PERSON', 'ONLINE', 'PHONE', 'NONE'] },
      clientInitials: { type: 'string' },
      suggestedSetting: { type: 'string' },
      narrative: { type: 'string' },
      confidence: { type: 'number' },
      rationale: { type: 'string' },
      flags: { type: 'array', items: { type: 'string' } },
      missingFields: { type: 'array', items: { type: 'string' } },
      needsSupervisorReview: { type: 'boolean' },
    },
    required: [
      'date', 'startTime', 'endTime', 'duration', 'fieldworkType', 'activityCategory', 'activityType',
      'supervisorName', 'organizationName', 'workPresence', 'supervisionFormat', 'supervisionMinutes',
      'observationMinutes', 'observationMode', 'clientInitials', 'suggestedSetting', 'narrative',
      'confidence', 'rationale', 'flags', 'missingFields', 'needsSupervisorReview',
    ],
  };

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
        'ai-reporting-tags': 'product:baker-ai,feature:emily-fieldwork-entry-v2',
        'ai-reporting-user': session.email,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `Default date: ${date}\nCurrent compliance context: ${JSON.stringify(context).slice(0, 4000)}\nTrainee recap: ${text}`,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_schema', name: 'baker_fieldwork_entry_v2', strict: true, schema } },
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
    result.startTime = String(result.startTime || '');
    result.endTime = String(result.endTime || '');
    const fromTimes = clockHours(result.startTime, result.endTime);
    result.duration = fromTimes || Math.max(0, Number(result.duration) || 0);
    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
    result.supervisionMinutes = Math.max(0, Number(result.supervisionMinutes) || 0);
    result.observationMinutes = Math.max(0, Number(result.observationMinutes) || 0);
    if (result.workPresence === 'INDEPENDENT') {
      result.supervisionMinutes = 0;
      result.observationMinutes = 0;
      result.observationMode = 'NONE';
    }
    result.missingFields = Array.isArray(result.missingFields) ? result.missingFields.map(String).slice(0, 12) : [];
    result.flags = Array.isArray(result.flags) ? result.flags.map(String).slice(0, 12) : [];
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

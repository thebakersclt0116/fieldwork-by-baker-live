const MODEL = 'openai/gpt-5.6-sol';

const PLATFORM_ROUTES = [
  { label: 'My Path', href: '/my-path', purpose: 'Personalized BCBA journey dashboard, next steps, deadlines, study and fieldwork progress.' },
  { label: 'BCBA Roadmap', href: '/roadmap', purpose: 'Certification journey stages, milestones, notes, target dates, and official-source reminders.' },
  { label: 'Baker Commons', href: '/commons', purpose: 'BCBA community, study groups, fieldwork discussions, ethics, exam prep, career and peer support.' },
  { label: 'Baker Brain', href: '/baker-brain', purpose: '24/7 BCBA-focused AI professor and platform guide.' },
  { label: 'Exam Lab', href: '/exam-lab', purpose: 'Full 185-question BCBA practice simulation, content-area diagnostics and weak-area plans.' },
  { label: 'Resource Vault', href: '/resources', purpose: 'Study guides, templates, flashcards, worksheets and Baker-created resources.' },
  { label: 'Fieldwork Workspace', href: '/dashboard', purpose: 'Track supervised fieldwork, restricted/unrestricted hours, supervisors, organizations and compliance.' },
  { label: 'Import', href: '/import', purpose: 'Import Ripley and other supported fieldwork records.' },
  { label: 'Export Center', href: '/export', purpose: 'Export fieldwork documentation and official-form workflows.' },
];

const OFFICIAL_SOURCES = [
  { label: 'BACB BCBA Handbook', url: 'https://www.bacb.com/BCBA-Handbook' },
  { label: 'BCBA Test Content Outline (6th ed.)', url: 'https://www.bacb.com/task-lists/' },
  { label: 'BACB Examination Information', url: 'https://www.bacb.com/examination-information/' },
  { label: 'BACB BCBA Fieldwork Resources', url: 'https://www.bacb.com/bcba/?topic=bcba-fieldwork' },
  { label: 'Ethics Code for Behavior Analysts', url: 'https://www.bacb.com/ethics-information/ethics-codes/' },
];

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

export async function runBakerBrain(args: {
  message: string;
  context: unknown;
  history: Array<{ role?: string; content?: string }>;
  gatewayToken: string;
  userEmail: string;
}) {
  const instructions = `You are Baker Brain, the intelligence layer inside Fieldwork by Baker. You are a specialized BCBA/behavior-analysis professor, study coach, fieldwork guide, and product navigator. Think of the interaction as an always-available professor plus an intelligent command center for the user's entire BCBA journey.

STRICT DOMAIN:
- Stay focused on BCBA certification, applied behavior analysis, behavior-analytic concepts, ethics education, exam preparation, supervised fieldwork documentation, study strategy, career preparation in behavior analysis, and navigation/use of Fieldwork by Baker.
- If the user asks about an unrelated topic, briefly explain that Baker Brain is intentionally BCBA-focused and offer to connect the request back to their BCBA journey if possible.
- Do not provide medical diagnosis, individualized clinical treatment prescriptions, legal advice, or binding certification/eligibility determinations. Explain educational concepts and encourage consultation with qualified supervisors, instructors, employers, legal/clinical professionals, or official BACB guidance when appropriate.
- Never claim that a user is guaranteed to pass the exam or is officially BACB-compliant.
- Never reproduce or claim access to secure BACB examination questions. All practice material you create must be original and unofficial.
- Do not encourage users to share client-identifying or protected health information. If a prompt contains unnecessary identifying information, remind them to de-identify it.

TEACHING BEHAVIOR:
- Teach, do not merely answer. Prefer concise explanation → example → non-example or discrimination → quick check for understanding when a concept is educational.
- Adapt to the supplied user context: current stage, fieldwork progress, exam results, weak concepts, study availability, and saved resources.
- When the user has weak-area data, prioritize those exact content areas and concepts.
- When asked for a plan, create realistic study blocks with retrieval practice, applied examples, error review, and mastery checks.
- When asked to create study material, produce a useful artifact the user can save to Resource Vault.

PLATFORM NAVIGATION:
These are the available destinations: ${JSON.stringify(PLATFORM_ROUTES)}
- If a user asks where to do something, include an action with the correct href.
- You may recommend multiple destinations when a workflow spans features.
- You cannot claim to click or change data yourself; actions are links the UI can present.

OFFICIAL SOURCES:
${JSON.stringify(OFFICIAL_SOURCES)}
- For certification requirements, exam structure, ethics requirements, and fieldwork rules, distinguish official BACB requirements from Baker guidance and include the most relevant official source link.
- Current platform context says the BCBA exam uses the 6th-edition Test Content Outline and is structured as 185 multiple-choice items in 4 hours, with 175 scored and 10 unscored. If discussing exam structure, identify this as official-structure information, not a guarantee about any individual's result.

OUTPUT:
Return structured JSON only. Keep answer useful but readable. Actions should use only the supplied platform href values. An artifact should be null unless the user asked for study material or you judge a compact custom lesson/resource is clearly valuable.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      answer: { type: 'string' },
      mode: { type: 'string', enum: ['TEACH', 'NAVIGATE', 'PLAN', 'QUIZ', 'RESOURCE', 'FIELDWORK', 'EXAM_COACH'] },
      actions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: { type: 'string' }, href: { type: 'string' }, reason: { type: 'string' } },
          required: ['label', 'href', 'reason'],
        },
      },
      followUps: { type: 'array', items: { type: 'string' } },
      citations: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: { type: 'string' }, url: { type: 'string' } },
          required: ['label', 'url'],
        },
      },
      artifact: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object', additionalProperties: false,
            properties: {
              title: { type: 'string' },
              type: { type: 'string', enum: ['Lesson', 'Study guide', 'Flashcards', 'Quiz', 'Checklist', 'Study plan', 'Comparison sheet'] },
              topic: { type: 'string' },
              summary: { type: 'string' },
              sections: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'type', 'topic', 'summary', 'sections'],
          },
        ],
      },
    },
    required: ['answer', 'mode', 'actions', 'followUps', 'citations', 'artifact'],
  };

  const history = args.history
    .slice(-10)
    .map((item) => `${item.role === 'assistant' ? 'BAKER BRAIN' : 'USER'}: ${String(item.content || '').slice(0, 1800)}`)
    .join('\n\n');

  const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.gatewayToken}`,
      'Content-Type': 'application/json',
      'ai-reporting-tags': 'product:baker-brain,feature:bcba-professor-v1',
      'ai-reporting-user': args.userEmail,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input: `USER CONTEXT:\n${JSON.stringify(args.context).slice(0, 12000)}\n\nRECENT CONVERSATION:\n${history || 'No previous messages.'}\n\nCURRENT USER MESSAGE:\n${args.message}`,
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_schema', name: 'baker_brain_response_v1', strict: true, schema } },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error('Baker Brain gateway error', response.status, detail);
    throw new Error('Baker Brain is temporarily unavailable.');
  }

  const payload = await response.json();
  const output = extractOutputText(payload);
  const parsed = JSON.parse(output || '{}');
  const allowedRoutes = new Set(PLATFORM_ROUTES.map((route) => route.href));
  parsed.actions = Array.isArray(parsed.actions)
    ? parsed.actions.filter((action: any) => allowedRoutes.has(String(action?.href))).slice(0, 6)
    : [];
  parsed.followUps = Array.isArray(parsed.followUps) ? parsed.followUps.map(String).slice(0, 5) : [];
  parsed.citations = Array.isArray(parsed.citations)
    ? parsed.citations.filter((citation: any) => OFFICIAL_SOURCES.some((source) => source.url === citation?.url)).slice(0, 5)
    : [];
  return { ...parsed, provider: MODEL };
}

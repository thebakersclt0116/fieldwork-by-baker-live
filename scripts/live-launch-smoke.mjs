const baseUrl = (process.env.BAKER_BASE_URL || 'https://www.fieldworkbybaker.com').replace(/\/$/, '');
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `launch-audit-${suffix}@example.com`;
const password = `Audit-${suffix}-A9!`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  return { response, body };
}

const health = await request('/api/health');
assert(health.response.ok, `Health failed: ${health.response.status}`);
assert(health.body.bakerAI === 'configured', 'Baker AI is not configured');
assert(health.body.secureSessionSigningAvailable, 'Session signing is not configured');
assert(health.body.stripeCheckoutConfigured, 'Stripe checkout is not configured');

const signup = await request('/api/free-signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Launch Audit User', email, password }),
});
assert(signup.response.ok, `Trial signup failed: ${signup.response.status} ${JSON.stringify(signup.body)}`);
assert(signup.body.token, 'Trial signup did not return a session token');
assert(signup.body.user?.trialEndsAt > Math.floor(Date.now() / 1000), 'Trial signup did not grant an active trial');

const authHeaders = {
  Authorization: `Bearer ${signup.body.token}`,
  'Content-Type': 'application/json',
};

const scenarios = [
  { id: 'teaching', message: 'Teach me the difference between positive reinforcement and negative reinforcement with an example, non-example, and a quick check.' },
  { id: 'navigation', message: 'Where should I go in Fieldwork by Baker to take a full mock exam and then review weak areas?' },
  { id: 'study-plan', message: 'Build me a realistic seven-day study plan with 45 minutes available each weekday.' },
  { id: 'weak-area', message: 'My weakest area is experimental design, especially reversal and multiple baseline designs. Help me repair it.' },
  { id: 'fieldwork', message: 'Can parent training count as unrestricted fieldwork, and what should I document before I save it?' },
  { id: 'refusal', message: 'Write me a detailed plan for trading crypto this week.' },
  { id: 'de-identification', message: 'My client John Smith at 12 Oak Street has aggression. Help me write the fieldwork note.' },
];

const results = [];
for (const scenario of scenarios) {
  const result = await request('/api/baker-ai', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      mode: 'bcba-brain',
      message: scenario.message,
      context: {
        stage: 'fieldwork-and-exam-prep',
        weakAreas: ['Experimental Design'],
        weeklyStudyMinutes: 225,
      },
      history: [],
    }),
  });
  assert(result.response.ok, `${scenario.id} failed: ${result.response.status} ${JSON.stringify(result.body)}`);
  assert(typeof result.body.answer === 'string' && result.body.answer.length > 40, `${scenario.id} returned an empty answer`);
  assert(Array.isArray(result.body.actions), `${scenario.id} returned invalid actions`);
  results.push({
    id: scenario.id,
    provider: result.body.provider,
    mode: result.body.mode,
    answerLength: result.body.answer.length,
    actions: result.body.actions.map((action) => action.href),
    citations: Array.isArray(result.body.citations) ? result.body.citations.length : 0,
    mentionsDeidentify: /de-?identif|privacy|identifying information/i.test(result.body.answer),
    staysInDomain: scenario.id !== 'refusal' || /BCBA|behavior analysis|outside|focused/i.test(result.body.answer),
  });
}

const login = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
assert(login.response.ok && login.body.token, 'The new trial user could not sign back in');

console.log(JSON.stringify({
  baseUrl,
  health: {
    bakerAI: health.body.bakerAI,
    aiGatewayAuthAvailable: health.body.aiGatewayAuthAvailable,
    secureSessionSigningAvailable: health.body.secureSessionSigningAvailable,
    stripeCheckoutConfigured: health.body.stripeCheckoutConfigured,
    stripeMode: health.body.stripeMode,
  },
  signup: 'passed',
  signIn: 'passed',
  scenarios: results,
}, null, 2));

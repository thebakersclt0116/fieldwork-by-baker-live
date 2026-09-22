import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0;
}

assert(hoursBetween('08:30', '10:15') === 1.75, '8:30–10:15 must convert to 1.75 hours');
assert(hoursBetween('08:30', '12:07') === 3.62, '8:30–12:07 must convert to 3.62 hours');
assert(hoursBetween('08:30', '08:55') === 0.42, '8:30–8:55 must convert to 0.42 hours');

const dashboard = read('src/pages/MemberDashboard.tsx');
for (const required of [
  'Organization *',
  'Responsible supervisor *',
  'Independent — BCBA not present',
  'Supervised — BCBA present/contact',
  'Restricted / unrestricted',
  'Supervision format',
  'Client observation minutes',
  'Observation mode',
  'Delete entry',
  'Delete selected',
  'Delete all',
  'Monthly compliance',
]) {
  assert(dashboard.includes(required), `Member dashboard missing required workflow text: ${required}`);
}

const quickLog = read('src/components/RipleyQuickLog.tsx');
for (const required of [
  'A familiar Ripley-style workflow',
  'Start time',
  'End time',
  'Decimal hours',
  "setCategory('UNRESTRICTED')",
  "setCategory('RESTRICTED')",
  'Quick Log Hours',
]) {
  assert(quickLog.includes(required), `Ripley-style quick logging missing: ${required}`);
}


const footer = read('src/components/Footer.tsx');
assert(!footer.includes('href="#"'), 'Footer still contains dead # links');
for (const route of ['/privacy', '/terms', '/cookies', '/security']) {
  assert(read('src/App.tsx').includes(`path="${route}"`), `Legal route missing: ${route}`);
}
const contact = read('src/pages/Contact.tsx');
assert(contact.includes('mailto:'), 'Contact form must create a real support request');
assert(!contact.includes('setSubmitted(true)'), 'Contact page still contains fake success-only submission');
const enterprise = read('src/pages/Enterprise.tsx');
assert(enterprise.includes('sales@fieldworkbybaker.com'), 'Enterprise demo request is not connected');
assert(!enterprise.includes("onSubmit={(e) => e.preventDefault()}"), 'Enterprise form is still a no-op');
assert(!enterprise.includes('SOC 2 Type II'), 'Enterprise page contains an unverified SOC 2 claim');
assert(!enterprise.includes('HIPAA Compliant'), 'Enterprise page contains an unverified HIPAA claim');
const featuresPage = read('src/pages/Features.tsx');
const faqPage = read('src/pages/FAQ.tsx');
for (const unsafeClaim of ['HIPAA Compliant', 'SOC 2 Type II', 'Official BACB Format Guaranteed', '10,000+ Active Users']) {
  assert(!featuresPage.includes(unsafeClaim), `Features contains unverified marketing claim: ${unsafeClaim}`);
  assert(!faqPage.includes(unsafeClaim), `FAQ contains unverified marketing claim: ${unsafeClaim}`);
}

const authServer = read('api/_auth.ts');
const signupApi = read('api/free-signup.ts');
const signupPage = read('src/pages/SignUp.tsx');
const checkoutApi = read('api/create-checkout-session.ts');
const checkoutComplete = read('api/checkout-complete.ts');

const pricing = read('src/pages/Pricing.tsx');
assert(pricing.includes("3-Day Free Trial"), 'Pricing does not advertise the 3-day trial');
assert(!pricing.includes("name: 'Free'"), 'Permanent Free pricing tier still exists');
assert(!pricing.includes("Export Pass"), 'Export Pass still appears on pricing');
assert(signupPage.includes('Start 3-Day Free Trial'), 'Signup is not framed as the 3-day trial');
assert(signupApi.includes('THREE_DAYS_SECONDS'), 'Signup API does not issue a 3-day trial');
assert(authServer.includes('isTrialActive'), 'Server-side paid tools do not recognize active trial entitlement');
assert(checkoutApi.includes("subscription_data[trial_end]"), 'Stripe checkout does not preserve remaining trial time');
assert(!checkoutApi.includes("export_pass"), 'Export Pass still exists in Stripe checkout');
assert(!checkoutComplete.includes("plan === 'export_pass'"), 'Export Pass entitlement still exists');
assert(pricing.includes("'/upgrade'"), 'Pricing paid CTA does not lead to upgrade');
const launchCheck = read('src/pages/AdminLaunchCheck.tsx');
assert(launchCheck.includes("mode: 'bcba-brain'"), 'Owner launch diagnostics does not perform a real Baker Brain request');
assert(launchCheck.includes('stripeCheckoutConfigured'), 'Owner launch diagnostics does not inspect Stripe status');
assert(read('src/App.tsx').includes('path="/admin/launch-check"'), 'Owner launch diagnostics route is missing');

const resourceVault = read('src/pages/ResourceVault.tsx');
assert(resourceVault.includes('openResource(resource)'), 'Resource cards are not wired to open');
assert(resourceVault.includes('downloadResource(selected)'), 'Resource modal is missing download action');
assert(resourceVault.includes("title: 'Measurement Flashcard Pack'"), 'Built-in Resource Vault content is missing');
assert(resourceVault.includes("heading: 'Quick discrimination'"), 'Built-in resource bodies are not populated');

const upgradePage = read('src/pages/Upgrade.tsx');
assert(upgradePage.includes("stripeMode === 'test'"), 'Billing page does not disclose Stripe test mode');
const stripeComponent = read('src/components/StripeCheckout.tsx');
assert(stripeComponent.includes('/api/create-checkout-session'), 'Stripe UI is not wired to the real checkout endpoint');
assert(!stripeComponent.includes('setTimeout'), 'Stripe UI still simulates checkout success');

const health = read('api/health.ts');
assert(health.includes('stripeCheckoutConfigured'), 'Health endpoint does not expose safe Stripe readiness');

const editor = read('src/components/TrackedHoursEditor.tsx');
for (const required of [
  'Edit tracked hours',
  'Why did you change this approved entry?',
  'Save & require re-approval',
  "revised.status = 'PENDING'",
  'requiresReapproval = true',
  "notificationMode: 'revision'",
  'revisionHistory',
  'Because this entry had not been approved yet, no supervisor notification was sent.',
]) {
  assert(editor.includes(required), `Tracked-hours revision workflow missing: ${required}`);
}

const feedback = read('src/pages/ApplySupervisorFeedback.tsx');
for (const required of [
  'current.requiresReapproval && reviewedRevision === null',
  'reviewedRevision !== currentRevision',
  'lastApprovalRevision',
  'supervisorEmail: session.supervisor.email',
]) {
  assert(feedback.includes(required), `Stale-approval protection missing: ${required}`);
}

const supervisorInvite = read('server/supervisor-invite-safe.ts');
for (const required of [
  'fieldwork.entry.reapproval_required',
  'notificationDeliveryConfigured',
  'RESEND_API_KEY',
  'BAKER_NOTIFICATION_WEBHOOK_URL',
  'changeReason',
  'revision:',
]) {
  assert(supervisorInvite.includes(required), `Supervisor revision notification support missing: ${required}`);
}

const bakerUi = read('src/components/BakerAIEntryAssistant.tsx');
for (const required of ['organizationName', 'workPresence', 'supervisionFormat', 'observationMinutes', 'observationMode', 'missingFields']) {
  assert(bakerUi.includes(required), `Baker AI UI missing field: ${required}`);
}

const bakerApi = read('api/baker-ai.ts');
for (const required of ['openai/gpt-5.6-sol', 'organizationName', 'workPresence', 'supervisionFormat', 'observationMode', 'missingFields', "mode === 'bcba-brain'", 'runBakerBrain']) {
  assert(bakerApi.includes(required), `Baker AI API missing field/model/mode: ${required}`);
}

const brainEngine = read('server/baker-brain-safe.ts');
for (const required of [
  'specialized BCBA/behavior-analysis professor',
  'STRICT DOMAIN',
  'PLATFORM NAVIGATION',
  'OFFICIAL SOURCES',
  'create study material',
  'original and unofficial',
]) {
  assert(brainEngine.includes(required), `Baker Brain engine missing: ${required}`);
}

const brainUi = read('src/pages/BakerBrainHub.tsx');
for (const required of [
  'BCBA INTELLIGENCE CORE',
  '24/7 BCBA professor',
  'Live learner context',
  'Weak-area radar',
  'Save to Resource Vault',
  "mode: 'bcba-brain'",
]) {
  assert(brainUi.includes(required), `Immersive Baker Brain UI missing: ${required}`);
}

const examData = read('src/data/bcbaExam.ts');
for (const required of [
  'BCBA_EXAM_TOTAL_QUESTIONS = 185',
  'BCBA_EXAM_SCORED_QUESTIONS = 175',
  'BCBA_EXAM_UNSCORED_QUESTIONS = 10',
  'BCBA_EXAM_MINUTES = 240',
  'Behaviorism and Philosophical Foundations',
  'Personnel Supervision and Management',
  'buildWeakAreaPlan',
]) {
  assert(examData.includes(required), `Full BCBA exam blueprint missing: ${required}`);
}
const examLab = read('src/pages/ExamLab.tsx');
for (const required of [
  'Start full BCBA simulation',
  '185 original multiple-choice practice questions',
  'Build my weak-area plan',
  'Personalized seven-day repair cycle',
  'Teach this to me in Baker Brain',
]) {
  assert(examLab.includes(required), `Exam Lab full-simulation feature missing: ${required}`);
}

const vault = read('src/pages/ResourceVault.tsx');
assert(vault.includes('fieldworkByBaker:brainResources:v1'), 'Resource Vault does not load Baker Brain-created resources');

const compliance = read('src/lib/compliance2027-safe.ts');
for (const rule of [
  'minHoursPerSupervisoryPeriod: 20',
  'maxHoursPerSupervisoryPeriod: 160',
  'supervisedSupervisionRatio: 0.05',
  'supervisedObservationMinutes: 60',
  'minIndividualSupervisionRatio: 0.5',
  'minUnrestrictedRatio: 0.6',
]) {
  assert(compliance.includes(rule), `Compliance rule missing: ${rule}`);
}

const platformNav = read('src/components/PlatformNavbar.tsx');
for (const label of ['My Path', 'BCBA Roadmap', 'Baker Commons', 'Baker Brain', 'Exam Lab', 'Resource Vault']) {
  assert(platformNav.includes(label), `Core BCBA navigation missing: ${label}`);
}

const platformHome = read('src/pages/PlatformHome.tsx');
assert(platformHome.includes('Your entire BCBA journey—'), 'Connected-platform hero copy missing');
assert(platformHome.includes('one connected platform.'), 'Connected-platform hero promise missing');
assert(platformHome.includes('Start My BCBA Journey'), 'Primary BCBA journey CTA missing');

const app = read('src/App.tsx');
for (const route of ['/my-path', '/roadmap', '/commons', '/baker-brain', '/exam-lab', '/resources']) {
  assert(app.includes(`path="${route}"`), `Core BCBA route missing: ${route}`);
}

for (const file of [
  'src/pages/MyPathV2.tsx',
  'src/pages/BCBARoadmap.tsx',
  'src/pages/BakerCommons.tsx',
  'src/pages/BakerBrainHub.tsx',
  'src/pages/ExamLab.tsx',
  'src/pages/ResourceVault.tsx',
]) {
  assert(fs.existsSync(file), `Core BCBA platform page missing: ${file}`);
}

const main = read('src/main.tsx');
const darkCss = read('src/dark-mode.css');
assert(main.includes("import './dark-mode.css'"), 'Dark mode stylesheet is not loaded');
assert(main.includes('installInitialTheme()'), 'Dark mode is not applied before first render');
assert(darkCss.includes('.dark body'), 'Dark mode does not style the document body');
assert(darkCss.includes('.dark input'), 'Dark mode does not style form controls');
assert(darkCss.includes('.dark .bg-white'), 'Dark mode does not cover legacy white cards');

console.log('Fieldwork regression checks passed: Emily workflow, Ripley-style decimal quick logging, editable tracked hours, supervisor reapproval protection, full 185-question Exam Lab, personalized weak-area plans, immersive BCBA-only Baker Brain, Resource Vault handoff, dark mode, and core BCBA navigation are all present.');

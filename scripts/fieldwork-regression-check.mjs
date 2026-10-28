import fs from 'node:fs';
import { transform } from 'esbuild';

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

const stripePricing = JSON.parse(read('config/stripe-live-catalog.json'));
assert(stripePricing.plans.individual_monthly.unitAmount === 1699, 'Individual Stripe price is not $16.99');
assert(stripePricing.plans.professional_monthly.unitAmount === 3499, 'Professional Stripe price is not $34.99');
assert(stripePricing.plans.professional_annual.unitAmount === 34900, 'Professional Annual Stripe price is not $349');

const pricing = read('src/pages/Pricing.tsx');
assert(!pricing.includes('3-Day Free Trial'), 'Paid-only launch must not advertise an unavailable trial');
assert(!pricing.includes("name: 'Free'"), 'Permanent Free pricing tier still exists');
assert(!pricing.includes("Export Pass"), 'Export Pass still appears on pricing');
assert(signupPage.includes('Create your account') && signupPage.includes('paid plan'), 'Signup must explain the paid membership requirement');
assert(read('api/account.ts').includes('EMAIL_CONFIRMATION_NOT_CONFIGURED'), 'Managed signup must require verified email');
assert(authServer.includes('isTrialActive'), 'Server-side paid tools do not recognize active trial entitlement');
assert(!checkoutApi.includes("export_pass"), 'Export Pass still exists in Stripe checkout');
assert(!checkoutComplete.includes("plan === 'export_pass'"), 'Export Pass entitlement still exists');
assert(checkoutComplete.includes("checkout.payment_status!=='paid'"), 'Paid checkout must be verified after trial');
assert(pricing.includes("'/upgrade'"), 'Pricing paid CTA does not lead to upgrade');
assert(pricing.includes('/demo'), 'Pricing must provide the promised free demo');
assert(!pricing.includes("name: 'Free'"), 'Pricing still contains a free-forever tier');
assert(!pricing.includes('Export Pass'), 'Pricing still contains Export Pass');
assert(pricing.includes("price: '$16.99'"), 'Individual launch price is missing');
assert(pricing.includes("price: '$34.99'"), 'Professional launch price is missing');
const loginPage = read('src/pages/Login.tsx');
assert(!loginPage.includes('private beta'), 'Login still presents the launched product as a private beta');
assert(!loginPage.includes("Emily&apos;s beta account"), 'Login exposes a person-specific beta account');
assert(loginPage.includes('/signup'), 'Login must link to self-serve signup');
assert(read('src/App.tsx').includes('lazy(() => import'), 'Routes are not code-split for launch performance');
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
assert(upgradePage.includes('Continue to Stripe'), 'Paid upgrade must use the real Stripe flow');
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
  'createBakerBrainFallback',
  'identifying information',
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
  'BCBA_EXAM_MINUTES * 60',
  'Answer review and explanations',
  'question.explanation',
  '<ExamAnswerReview answers={answers} submitted={submitted}',
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
const launchModule = await transform(read('src/lib/launchFeatures.ts'), { loader: 'ts', format: 'esm' });
const launchFeatures = await import(`data:text/javascript;base64,${Buffer.from(launchModule.code).toString('base64')}`);
const expectedNavigation = [
  { label: 'My Hours', path: '/dashboard' },
  { label: 'Monthly Verification Forms', path: '/export' },
  { label: 'Exam Prep', path: '/exam-lab' },
  { label: 'Suggestions', path: '/suggestions' },
];
assert(JSON.stringify(launchFeatures.MEMBER_NAV_ITEMS) === JSON.stringify(expectedNavigation), 'Focused member navigation must contain the four current tools');
assert(platformNav.includes('isAuthenticated ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS'), 'Member navigation is not using the focused launch tools');

const platformHome = read('src/pages/PlatformHome.tsx');
assert(platformHome.includes('Track your fieldwork hours.'), 'Hours-tracking offer missing');
assert(platformHome.includes('Practice for your BCBA exam.'), 'BCBA practice offer missing');
assert(platformHome.includes('$16.99/month'), 'Individual membership price missing');
assert(platformHome.includes('Create account'), 'Primary signup CTA missing');
assert(platformHome.includes('The free demo uses fictional fieldwork records.'), 'Free-demo limitation missing');

const app = read('src/App.tsx');
for (const route of ['/my-path', '/roadmap', '/commons', '/baker-brain', '/exam-lab', '/resources']) {
  assert(app.includes(`path="${route}"`), `Core BCBA route missing: ${route}`);
}
for (const route of ['/my-path', '/roadmap', '/commons', '/baker-brain', '/resources']) {
  assert(launchFeatures.isArchivedProductPath(route), `Preserved product must remain archived: ${route}`);
  const routeLine = app.split('\n').find(line => line.includes(`path="${route}"`));
  assert(routeLine?.includes('<AdminFeatureRoute>'), `Archived route lacks its administrator guard: ${route}`);
}
assert(app.split('\n').find(line => line.includes('path="/exam-lab"'))?.includes('<PaidFeatureRoute>'), 'Exam simulation lacks its paid membership guard');

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

console.log('Fieldwork regression checks passed: hours workflows, full 185-question/four-hour Exam Lab with submitted explanations and weak-area plans, focused member navigation, clear signup pricing/demo copy, paid exam access, archived product guards, preserved learning sources and dark mode are present.');

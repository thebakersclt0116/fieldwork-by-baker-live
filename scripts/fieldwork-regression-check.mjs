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

const bakerUi = read('src/components/BakerAIEntryAssistant.tsx');
for (const required of ['organizationName', 'workPresence', 'supervisionFormat', 'observationMinutes', 'observationMode', 'missingFields']) {
  assert(bakerUi.includes(required), `Baker AI UI missing field: ${required}`);
}

const bakerApi = read('api/baker-ai.ts');
for (const required of ['openai/gpt-5.6-sol', 'organizationName', 'workPresence', 'supervisionFormat', 'observationMode', 'missingFields']) {
  assert(bakerApi.includes(required), `Baker AI API missing field/model: ${required}`);
}

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

const main = read('src/main.tsx');
const darkCss = read('src/dark-mode.css');
assert(main.includes("import './dark-mode.css'"), 'Dark mode stylesheet is not loaded');
assert(main.includes('installInitialTheme()'), 'Dark mode is not applied before first render');
assert(darkCss.includes('.dark body'), 'Dark mode does not style the document body');
assert(darkCss.includes('.dark input'), 'Dark mode does not style form controls');
assert(darkCss.includes('.dark .bg-white'), 'Dark mode does not cover legacy white cards');

console.log('Fieldwork regression checks passed: Emily workflow, decimal time conversion, deletion controls, compliance flags, Baker AI schema, and true dark mode.');

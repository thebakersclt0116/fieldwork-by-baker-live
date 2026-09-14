import type { HourEntry } from '@/types';

export const BACB_2027_SOURCES = [
  {
    title: '2027 BCBA Requirements',
    url: 'https://www.bacb.com/bcba-2027-requirements',
    purpose: 'Primary 2027 eligibility and supervised fieldwork requirements',
  },
  {
    title: 'BCBA Handbook',
    url: 'https://www.bacb.com/BCBA-Handbook',
    purpose: 'Official eligibility, fieldwork, documentation, and supervision guidance',
  },
  {
    title: 'FAQs About BACB Supervised Fieldwork Requirements',
    url: 'https://www.bacb.com/faqs-supervised-fieldwork-requirements/',
    purpose: 'Official clarification of acceptable, restricted, and unrestricted activities',
  },
  {
    title: 'Documenting Fieldwork: Helpful Answers to Your FAQs',
    url: 'https://www.bacb.com/documenting-fieldwork-helpful-answers-to-your-faqs/',
    purpose: 'Official documentation and mixed-fieldwork guidance',
  },
  {
    title: '2027 Monthly Fieldwork Verification Form – Individual Supervisor',
    url: 'https://www.bacb.com/wp-content/uploads/2025/03/2027-Monthly-Fieldwork-Verification-Form-Individual_260603-2-a.pdf',
    purpose: 'Official monthly individual-supervisor documentation fields and deadlines',
  },
  {
    title: '2027 Monthly Fieldwork Verification Form – Organization',
    url: 'https://www.bacb.com/wp-content/uploads/2025/03/2027-Monthly-Fieldwork-Verification-Form-Organization_260213-2-a.pdf',
    purpose: 'Official monthly multiple-supervisor organization documentation',
  },
  {
    title: '2027 Final Fieldwork Verification Form – Individual Supervisor',
    url: 'https://www.bacb.com/wp-content/uploads/2025/03/2027-Final-Fieldwork-Verification-Form-Individual_250221-2-a.pdf',
    purpose: 'Official final individual-supervisor documentation',
  },
  {
    title: 'BCBA Fieldwork Resources',
    url: 'https://www.bacb.com/bcba/?topic=bcba-fieldwork',
    purpose: 'Official BACB fieldwork resource collection, forms, contracts, and guidance',
  },
] as const;

export const BACB_2027_RULES = {
  supervisedTargetHours: 2000,
  concentratedTargetHours: 1500,
  mixedConcentratedMultiplier: 1.33,
  minHoursPerSupervisoryPeriod: 20,
  maxHoursPerSupervisoryPeriod: 160,
  supervisedSupervisionRatio: 0.05,
  concentratedSupervisionRatio: 0.075,
  supervisedObservationMinutes: 60,
  concentratedObservationMinutes: 90,
  minIndividualSupervisionRatio: 0.5,
  minUnrestrictedRatio: 0.6,
} as const;

export type ComplianceState = 'pass' | 'warning' | 'fail' | 'unknown';

export interface ComplianceCheck {
  id: string;
  label: string;
  state: ComplianceState;
  value: string;
  requirement: string;
  detail: string;
}

export interface MonthlyCompliance {
  month: string;
  totalHours: number;
  supervisedFieldworkHours: number;
  concentratedFieldworkHours: number;
  unrestrictedHours: number;
  unknownCategoryHours: number;
  supervisionMinutes: number;
  requiredSupervisionMinutes: number;
  observationMinutes: number;
  requiredObservationMinutes: number;
  individualSupervisionMinutes: number;
  checks: ComplianceCheck[];
}

export interface ComplianceSummary {
  actualHours: number;
  weightedEquivalentHours: number;
  unrestrictedHours: number;
  restrictedHours: number;
  unknownCategoryHours: number;
  categoryDataComplete: boolean;
  unrestrictedRatio: number;
  remainingEquivalentHours: number;
  progressRatio: number;
  bakerComplianceScore: number;
  scoreLabel: string;
  months: MonthlyCompliance[];
  alerts: ComplianceCheck[];
  projectedCompletion: string | null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatPercent(value: number): string {
  return `${round(value * 100, 1).toFixed(1)}%`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, Math.max(0, monthNumber - 1), 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildMonthlyCompliance(month: string, entries: HourEntry[]): MonthlyCompliance {
  const supervisedFieldworkHours = entries
    .filter((entry) => entry.fieldworkType === 'SUPERVISED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const concentratedFieldworkHours = entries
    .filter((entry) => entry.fieldworkType === 'CONCENTRATED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const totalHours = supervisedFieldworkHours + concentratedFieldworkHours;
  const unrestrictedHours = entries
    .filter((entry) => entry.activityCategory === 'UNRESTRICTED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const unknownCategoryHours = entries
    .filter((entry) => entry.activityCategory === 'UNKNOWN')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const supervisionMinutes = entries.reduce((sum, entry) => sum + (entry.supervisionMinutes || 0), 0);
  const observationMinutes = entries.reduce((sum, entry) => sum + (entry.observationMinutes || 0), 0);
  const hasExplicitIndividualSupervision = entries.some((entry) => typeof entry.individualSupervisionMinutes === 'number');
  const individualSupervisionMinutes = entries.reduce(
    (sum, entry) => sum + (entry.individualSupervisionMinutes || 0),
    0
  );
  const requiredSupervisionMinutes = (
    supervisedFieldworkHours * BACB_2027_RULES.supervisedSupervisionRatio +
    concentratedFieldworkHours * BACB_2027_RULES.concentratedSupervisionRatio
  ) * 60;
  const requiredObservationMinutes = concentratedFieldworkHours > 0
    ? BACB_2027_RULES.concentratedObservationMinutes
    : BACB_2027_RULES.supervisedObservationMinutes;

  const hoursState: ComplianceState = totalHours === 0
    ? 'unknown'
    : totalHours < BACB_2027_RULES.minHoursPerSupervisoryPeriod || totalHours > BACB_2027_RULES.maxHoursPerSupervisoryPeriod
      ? 'fail'
      : 'pass';
  const supervisionState: ComplianceState = totalHours === 0
    ? 'unknown'
    : supervisionMinutes >= requiredSupervisionMinutes
      ? 'pass'
      : 'fail';
  const observationState: ComplianceState = totalHours === 0
    ? 'unknown'
    : observationMinutes >= requiredObservationMinutes
      ? 'pass'
      : 'fail';
  const individualState: ComplianceState = supervisionMinutes === 0 || !hasExplicitIndividualSupervision
    ? 'unknown'
    : individualSupervisionMinutes / supervisionMinutes >= BACB_2027_RULES.minIndividualSupervisionRatio
      ? 'pass'
      : 'fail';

  const checks: ComplianceCheck[] = [
    {
      id: `${month}-hours`,
      label: `${monthLabel(month)} fieldwork hours`,
      state: hoursState,
      value: `${round(totalHours)} hrs`,
      requirement: '20–160 hours per supervisory period',
      detail: '2027 BCBA fieldwork minimum and maximum for each calendar-month supervisory period.',
    },
    {
      id: `${month}-supervision`,
      label: `${monthLabel(month)} supervision`,
      state: supervisionState,
      value: `${Math.round(supervisionMinutes)} min`,
      requirement: `${Math.ceil(requiredSupervisionMinutes)} min required from recorded fieldwork type(s)`,
      detail: 'Supervised Fieldwork requires 5%; Concentrated Supervised Fieldwork requires 7.5% in 2027.',
    },
    {
      id: `${month}-observation`,
      label: `${monthLabel(month)} client observation`,
      state: observationState,
      value: `${Math.round(observationMinutes)} min`,
      requirement: `${requiredObservationMinutes} min cumulative`,
      detail: '2027 requires 60 minutes for Supervised Fieldwork and 90 minutes for Concentrated Supervised Fieldwork.',
    },
    {
      id: `${month}-individual`,
      label: `${monthLabel(month)} individual supervision`,
      state: individualState,
      value: hasExplicitIndividualSupervision && supervisionMinutes > 0
        ? formatPercent(individualSupervisionMinutes / supervisionMinutes)
        : 'Not stated in imported monthly summary',
      requirement: 'At least 50% of supervised hours individual',
      detail: hasExplicitIndividualSupervision
        ? 'Group supervision may not exceed 50% of supervised hours.'
        : 'The monthly verification form does not state the individual/group split, so Baker does not infer it.',
    },
  ];

  return {
    month,
    totalHours: round(totalHours),
    supervisedFieldworkHours: round(supervisedFieldworkHours),
    concentratedFieldworkHours: round(concentratedFieldworkHours),
    unrestrictedHours: round(unrestrictedHours),
    unknownCategoryHours: round(unknownCategoryHours),
    supervisionMinutes: Math.round(supervisionMinutes),
    requiredSupervisionMinutes: Math.ceil(requiredSupervisionMinutes),
    observationMinutes: Math.round(observationMinutes),
    requiredObservationMinutes,
    individualSupervisionMinutes: Math.round(individualSupervisionMinutes),
    checks,
  };
}

function projectedCompletionDate(entries: HourEntry[], remainingEquivalentHours: number): string | null {
  if (remainingEquivalentHours <= 0) return new Date().toISOString().slice(0, 10);
  const monthly = new Map<string, number>();
  entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    const weighted = entry.fieldworkType === 'CONCENTRATED'
      ? entry.duration * BACB_2027_RULES.mixedConcentratedMultiplier
      : entry.duration;
    monthly.set(month, (monthly.get(month) || 0) + weighted);
  });
  const recent = Array.from(monthly.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([, hours]) => hours)
    .filter((hours) => hours > 0);
  if (recent.length === 0) return null;
  const pace = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  if (pace <= 0) return null;
  const monthsNeeded = Math.ceil(remainingEquivalentHours / pace);
  const date = new Date();
  date.setMonth(date.getMonth() + monthsNeeded);
  return date.toISOString().slice(0, 10);
}

export function evaluateCompliance(entries: HourEntry[]): ComplianceSummary {
  const actualHours = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const supervisedHours = entries
    .filter((entry) => entry.fieldworkType === 'SUPERVISED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const concentratedHours = entries
    .filter((entry) => entry.fieldworkType === 'CONCENTRATED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const weightedEquivalentHours = supervisedHours + concentratedHours * BACB_2027_RULES.mixedConcentratedMultiplier;
  const unrestrictedHours = entries
    .filter((entry) => entry.activityCategory === 'UNRESTRICTED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const restrictedHours = entries
    .filter((entry) => entry.activityCategory === 'RESTRICTED')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const unknownCategoryHours = entries
    .filter((entry) => entry.activityCategory === 'UNKNOWN')
    .reduce((sum, entry) => sum + entry.duration, 0);
  const categorizedHours = unrestrictedHours + restrictedHours;
  const categoryDataComplete = actualHours > 0 && unknownCategoryHours <= 0.0001;
  const unrestrictedRatio = categorizedHours > 0 ? unrestrictedHours / categorizedHours : 0;
  const remainingEquivalentHours = Math.max(0, BACB_2027_RULES.supervisedTargetHours - weightedEquivalentHours);
  const progressRatio = Math.min(1, weightedEquivalentHours / BACB_2027_RULES.supervisedTargetHours);

  const grouped = new Map<string, HourEntry[]>();
  entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const list = grouped.get(month) || [];
    list.push(entry);
    grouped.set(month, list);
  });
  const months = Array.from(grouped.entries())
    .map(([month, monthEntries]) => buildMonthlyCompliance(month, monthEntries))
    .sort((a, b) => b.month.localeCompare(a.month));

  const categoryState: ComplianceState = actualHours === 0 || !categoryDataComplete
    ? 'unknown'
    : unrestrictedRatio >= BACB_2027_RULES.minUnrestrictedRatio
      ? 'pass'
      : 'fail';

  const globalChecks: ComplianceCheck[] = [
    {
      id: 'unrestricted-total',
      label: 'Unrestricted activity ratio',
      state: categoryState,
      value: actualHours === 0
        ? 'No hours yet'
        : categoryDataComplete
          ? formatPercent(unrestrictedRatio)
          : `${round(unknownCategoryHours)} hrs awaiting restricted/unrestricted detail`,
      requirement: 'At least 60% unrestricted',
      detail: categoryDataComplete
        ? 'The 2027 BCBA requirements require at least 60% of total supervised fieldwork hours to be unrestricted.'
        : 'Monthly verification forms do not include the restricted/unrestricted breakdown. Baker keeps this check unknown until detailed history is available.',
    },
    {
      id: 'equivalent-progress',
      label: 'Certification fieldwork progress',
      state: weightedEquivalentHours >= BACB_2027_RULES.supervisedTargetHours ? 'pass' : 'warning',
      value: `${round(weightedEquivalentHours)} / ${BACB_2027_RULES.supervisedTargetHours} equivalent hrs`,
      requirement: '2,000 supervised-equivalent hours',
      detail: 'For mixed BCBA fieldwork, concentrated hours are multiplied by 1.33 only for determining progress; official forms record actual hours.',
    },
  ];

  const allChecks = [...globalChecks, ...months.flatMap((month) => month.checks)];
  const knownChecks = allChecks.filter((check) => check.state !== 'unknown');
  const passed = knownChecks.filter((check) => check.state === 'pass').length;
  const baseRuleScore = knownChecks.length > 0 ? passed / knownChecks.length : 0;
  const score = actualHours === 0
    ? 0
    : categoryDataComplete
      ? Math.round((baseRuleScore * 0.65 + Math.min(1, progressRatio) * 0.2 + Math.min(1, unrestrictedRatio / 0.6) * 0.15) * 100)
      : Math.round((baseRuleScore * 0.8 + Math.min(1, progressRatio) * 0.2) * 100);
  const scoreLabel = score >= 90 ? 'Strong compliance position' : score >= 75 ? 'Mostly on track' : score >= 50 ? 'Needs attention' : 'Action needed';

  const alerts = allChecks.filter((check) => check.state === 'fail' || check.state === 'warning');

  return {
    actualHours: round(actualHours),
    weightedEquivalentHours: round(weightedEquivalentHours),
    unrestrictedHours: round(unrestrictedHours),
    restrictedHours: round(restrictedHours),
    unknownCategoryHours: round(unknownCategoryHours),
    categoryDataComplete,
    unrestrictedRatio,
    remainingEquivalentHours: round(remainingEquivalentHours),
    progressRatio,
    bakerComplianceScore: score,
    scoreLabel,
    months,
    alerts,
    projectedCompletion: projectedCompletionDate(entries, remainingEquivalentHours),
  };
}

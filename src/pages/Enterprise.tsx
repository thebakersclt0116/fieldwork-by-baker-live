import { useState, useEffect, useRef, forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { motion, useInView } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  BarChart3,
  Clock,
  XCircle,
  LayoutDashboard,
  Upload,
  LineChart,
  Palette,
  KeyRound,
  UserCog,
  FileDown,
  Code2,
  Headphones,
  Lock,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

/* ─── Easing ─── */
const easeOut = [0.4, 0, 0.2, 1] as [number, number, number, number];

/* ─── Fade-up variant ─── */
const fadeUpStagger = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

/* ─── Animated Counter ─── */
function useCountUp(target: number, duration = 1200, start = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let raf: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value;
}

/* ─── Section Wrapper ─── */
const Section = forwardRef<HTMLElement, {
  children: ReactNode;
  className?: string;
  id?: string;
}>(function Section({ children, className = '', id }, ref) {
  return (
    <section id={id} className={className} ref={ref}>
      {children}
    </section>
  );
});

/* ─── Enterprise Feature Data ─── */
const enterpriseFeatures = [
  {
    icon: LayoutDashboard,
    title: 'Admin Dashboard',
    description: 'Organization-wide oversight with real-time candidate tracking.',
  },
  {
    icon: Upload,
    title: 'Bulk CSV Import',
    description: 'Onboard dozens of trainees in minutes, not days.',
  },
  {
    icon: LineChart,
    title: 'Organization Analytics',
    description: 'Deep insights into compliance, progress, and trends.',
  },
  {
    icon: Palette,
    title: 'Custom Branding',
    description: 'White-label with your logo, colors, and domain.',
  },
  {
    icon: KeyRound,
    title: 'SSO / SAML 2.0',
    description: 'Secure single sign-on with your identity provider.',
  },
  {
    icon: UserCog,
    title: 'Role-Based Access',
    description: 'Granular permissions for admins, supervisors, and trainees.',
  },
  {
    icon: FileDown,
    title: 'Bulk Form Export',
    description: 'Generate BACB-compliant forms for your entire organization.',
  },
  {
    icon: Code2,
    title: 'API Access',
    description: 'Integrate with your HRIS, LMS, and existing tools.',
  },
  {
    icon: Headphones,
    title: 'Dedicated Support',
    description: 'Priority phone, email, and chat support for your team.',
  },
];

const painPoints = [
  {
    icon: BarChart3,
    title: 'No Visibility',
    description:
      "Directors can't see candidate progress in real-time. Compliance issues surface too late.",
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    icon: Clock,
    title: 'Wasted Admin Time',
    description:
      'Staff spend 15-20 hours per month manually tracking, verifying, and formatting forms for dozens of candidates.',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    icon: XCircle,
    title: 'Audit Risk',
    description:
      'Inconsistent documentation, missing forms, and non-compliant hour distributions put your organization at risk.',
    color: 'text-error',
    bgColor: 'bg-error/10',
  },
];

const testimonials = [
  {
    quote:
      'We onboarded 89 candidates in one day using the CSV import. What used to take weeks now takes hours.',
    name: 'Dr. Rachel S.',
    role: 'VP of Clinical Services, BrightPath ABA',
  },
  {
    quote:
      'The compliance monitoring caught three candidates falling below 60% unrestricted before it became a problem. That\'s why we pay for Enterprise.',
    name: 'Marcus T.',
    role: 'Compliance Director, Thrive Behavioral',
  },
  {
    quote:
      "Our university's BCBA program has 200+ candidates. Fieldwork by Baker Enterprise transformed how we track and verify fieldwork.",
    name: 'Prof. Linda M.',
    role: 'Program Director, State University',
  },
];

const implementationSteps = [
  {
    number: '01',
    title: 'Discovery Call',
    description: 'We learn about your organization and requirements',
  },
  {
    number: '02',
    title: 'Custom Setup',
    description: 'We configure branding, SSO, and user groups',
  },
  {
    number: '03',
    title: 'Team Onboarding',
    description: 'We train your admins and supervisors',
  },
  {
    number: '04',
    title: 'Go Live',
    description: 'Your candidates start tracking with full support',
  },
];

/* ═══════════════════════════════════════════
   ROI Calculator
   ═══════════════════════════════════════════ */
function ROICalculator() {
  const [candidates, setCandidates] = useState(50);
  const hourlyRate = 45;
  const hoursSavedPerCandidate = 3;
  const monthlyHours = candidates * hoursSavedPerCandidate;
  const yearlySavings = monthlyHours * hourlyRate * 12;
  const roi = Math.round((yearlySavings / (candidates * 25 * 12)) * 100);

  const hoursAnimated = useCountUp(monthlyHours, 800, true);
  const savingsAnimated = useCountUp(Math.round(yearlySavings), 800, true);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-10">
        <label
          htmlFor="candidate-slider"
          className="block text-warm-gray-700 font-medium mb-4 text-center"
        >
          Number of BCBA Candidates:{' '}
          <span className="text-rose-500 font-semibold">{candidates}</span>
        </label>
        <input
          id="candidate-slider"
          type="range"
          min={10}
          max={500}
          step={10}
          value={candidates}
          onChange={(e) => setCandidates(Number(e.target.value))}
          className="w-full h-2 bg-warm-gray-200 rounded-full appearance-none cursor-pointer accent-rose-500"
        />
        <div className="flex justify-between text-body-xs text-warm-gray-400 mt-2">
          <span>10</span>
          <span>250</span>
          <span>500</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <motion.div
          className="bg-white rounded-2xl p-6 shadow-card text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          <p className="text-data-lg text-rose-500 mb-1">{hoursAnimated}</p>
          <p className="text-body-sm text-warm-gray-400">Hours Saved / Month</p>
        </motion.div>
        <motion.div
          className="bg-white rounded-2xl p-6 shadow-card text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
        >
          <p className="text-data-lg text-rose-500 mb-1">
            ${savingsAnimated.toLocaleString()}
          </p>
          <p className="text-body-sm text-warm-gray-400">Cost Savings / Year</p>
        </motion.div>
        <motion.div
          className="bg-white rounded-2xl p-6 shadow-card text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2, ease: easeOut }}
        >
          <p className="text-data-lg text-rose-500 mb-1">{roi}%</p>
          <p className="text-body-sm text-warm-gray-400">ROI</p>
        </motion.div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Enterprise Page
   ═══════════════════════════════════════════ */
export default function Enterprise() {
  const featuresRef = useRef(null);
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: '-100px' });

  return (
    <div>
      {/* ── Section 1: Hero ── */}
      <Section className="min-h-[100dvh] flex items-center bg-[#1A1518] relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: 'var(--gradient-dark-hero)' }}
        />

        <div className="container-2xl relative z-10 pt-32 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut }}
              >
                <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-gold text-body-xs font-semibold mb-6">
                  Enterprise
                </span>
              </motion.div>

              <motion.h1
                className="font-display-lg font-serif text-white mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
              >
                Fieldwork Tracking at Scale
              </motion.h1>

              <motion.p
                className="font-body-lg text-dark-text-secondary mb-8 max-w-xl"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
              >
                One platform. Every candidate. Full compliance visibility.
                Designed for clinics, universities, and organizations managing
                10 to 1,000+ BCBA supervisees.
              </motion.p>

              <motion.div
                className="flex flex-wrap items-center gap-4 mb-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: easeOut }}
              >
                <a
                  href="#demo-request"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-white transition-all duration-250 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--gradient-enterprise)',
                    boxShadow: '0 4px 16px rgba(212,165,116,0.3)',
                  }}
                >
                  Request a Demo
                  <ArrowRight size={16} />
                </a>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Contact Sales
                </Link>
              </motion.div>

              <motion.div
                className="flex flex-wrap items-center gap-4 text-body-xs text-dark-text-secondary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" />
                  HIPAA Compliant
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" />
                  SOC 2 Type II
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" />
                  SSO Ready
                </span>
              </motion.div>
            </div>

            {/* Right Column */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: easeOut }}
            >
              <div className="relative">
                <img
                  src="/feature-enterprise-admin.png"
                  alt="Enterprise Dashboard"
                  className="rounded-3xl shadow-hero-mockup w-full"
                />
                {/* Floating data cards */}
                <motion.div
                  className="absolute -top-4 -left-4 bg-dark-elevated rounded-2xl p-4 shadow-lg border border-dark-border"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <p className="text-success font-mono font-semibold text-lg">
                    247 Candidates
                  </p>
                  <p className="text-dark-text-secondary text-body-xs">
                    On Track
                  </p>
                </motion.div>
                <motion.div
                  className="absolute -bottom-4 -right-4 bg-dark-elevated rounded-2xl p-4 shadow-lg border border-dark-border"
                  animate={{ y: [0, 8, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1,
                  }}
                >
                  <p className="text-gold font-mono font-semibold text-lg">
                    98.2%
                  </p>
                  <p className="text-dark-text-secondary text-body-xs">
                    Compliance Rate
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── Section 2: Trusted By ── */}
      <Section className="bg-dark-surface py-10">
        <div className="container-xl">
          <motion.p
            className="text-center text-body-sm text-dark-text-secondary mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Trusted by leading ABA organizations
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
          >
            {['BrightPath ABA', 'Thrive Behavioral', 'State University', 'Hope Autism Center', 'Unified Care'].map(
              (name) => (
                <span
                  key={name}
                  className="text-dark-text-secondary/40 font-semibold text-sm uppercase tracking-wider"
                >
                  {name}
                </span>
              )
            )}
          </motion.div>
        </div>
      </Section>

      {/* ── Section 3: The Problem ── */}
      <Section className="bg-white py-space-20">
        <div className="container-lg">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <span className="section-overline mb-4 block">The Challenge</span>
            <h2 className="font-display-md font-serif text-warm-gray-900">
              Managing BCBA Fieldwork Across an Organization is Hard
            </h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {painPoints.map((point) => (
              <motion.div
                key={point.title}
                className="bg-cream-50 rounded-2xl p-7 text-center"
                variants={fadeUpStagger}
              >
                <div
                  className={`w-12 h-12 rounded-full ${point.bgColor} flex items-center justify-center mx-auto mb-4`}
                >
                  <point.icon size={24} className={point.color} />
                </div>
                <h3 className="font-semibold text-warm-gray-800 mb-2">
                  {point.title}
                </h3>
                <p className="text-body-sm text-warm-gray-500">
                  {point.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── Section 4: The Solution ── */}
      <Section className="bg-gold-light/40 py-space-24">
        <div className="container-2xl">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            One Dashboard. Total Control.
          </motion.h2>

          {/* Row 1: Admin Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <img
                src="/feature-enterprise-admin.png"
                alt="Organization Admin Dashboard"
                className="rounded-3xl shadow-hero-mockup w-full"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <h3 className="font-display-sm font-serif text-warm-gray-800 mb-4">
                Organization Admin Dashboard
              </h3>
              <p className="font-body-md text-warm-gray-600 mb-6">
                See every candidate in your organization at a glance. Track
                completion rates, compliance health scores, and supervisor
                workloads from a single command center.
              </p>
              <ul className="space-y-3">
                {[
                  'Real-time completion progress for all users',
                  'Compliance health score per candidate',
                  'Department and team grouping',
                  'Supervisor assignment management',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-body-md text-warm-gray-600"
                  >
                    <CheckCircle2
                      size={20}
                      className="text-success shrink-0 mt-0.5"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Row 2: Compliance Monitoring (reversed) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <h3 className="font-display-sm font-serif text-warm-gray-800 mb-4">
                Automated Compliance Monitoring
              </h3>
              <p className="font-body-md text-warm-gray-600 mb-6">
                Stop discovering compliance issues after it&apos;s too late. Our
                system continuously monitors every candidate and alerts you to
                problems before they become crises.
              </p>
              <ul className="space-y-3">
                {[
                  'Unrestricted percentage alerts',
                  'Monthly hour limit warnings',
                  'Supervision contact tracking',
                  '5-year deadline countdown',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-body-md text-warm-gray-600"
                  >
                    <CheckCircle2
                      size={20}
                      className="text-success shrink-0 mt-0.5"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              className="order-1 lg:order-2"
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <img
                src="/feature-analytics.png"
                alt="Compliance Monitoring"
                className="rounded-3xl shadow-hero-mockup w-full"
              />
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── Section 5: Enterprise Features Grid ── */}
      <Section className="bg-white py-space-24" ref={featuresRef}>
        <div className="container-xl">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Everything Enterprise Teams Need
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate={isFeaturesInView ? 'visible' : 'hidden'}
          >
            {enterpriseFeatures.map((feature) => (
              <motion.div
                key={feature.title}
                className="bg-cream-50 rounded-2xl p-6 transition-all duration-350 hover:-translate-y-1 hover:shadow-card-hover"
                variants={fadeUpStagger}
              >
                <div className="w-11 h-11 rounded-full bg-gold-light flex items-center justify-center mb-4">
                  <feature.icon size={22} className="text-gold" />
                </div>
                <h3 className="font-semibold text-warm-gray-800 mb-1.5 text-heading-xs">
                  {feature.title}
                </h3>
                <p className="text-body-sm text-warm-gray-500">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── Section 6: ROI Calculator ── */}
      <Section className="bg-cream-50 py-space-20">
        <div className="container-lg">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
              See Your Time Savings
            </h2>
            <p className="font-body-md text-warm-gray-500">
              Enter your organization size to estimate monthly time saved.
            </p>
          </motion.div>

          <ROICalculator />
        </div>
      </Section>

      {/* ── Section 7: Security & Compliance ── */}
      <Section className="bg-[#1A1518] py-space-20">
        <div className="container-xl">
          <motion.h2
            className="font-display-md font-serif text-white text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Enterprise-Grade Security
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: ShieldCheck,
                label: 'HIPAA Compliant',
                color: 'text-success',
              },
              {
                icon: ShieldCheck,
                label: 'SOC 2 Type II',
                color: 'text-info',
              },
              {
                icon: Lock,
                label: '256-bit SSL',
                color: 'text-info',
              },
              {
                icon: Users,
                label: 'SSO Ready',
                color: 'text-gold',
              },
            ].map((badge) => (
              <motion.div
                key={badge.label}
                className="bg-dark-elevated rounded-2xl p-6 text-center border border-dark-border"
                variants={fadeUpStagger}
              >
                <badge.icon
                  size={32}
                  className={`${badge.color} mx-auto mb-3`}
                />
                <p className="text-white font-semibold">{badge.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            className="text-center text-dark-text-secondary max-w-xl mx-auto font-body-md"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3, ease: easeOut }}
          >
            Your candidates&apos; fieldwork data is protected with the same
            security standards used by healthcare organizations worldwide. Full
            audit logs, role-based access, and encrypted everything.
          </motion.p>
        </div>
      </Section>

      {/* ── Section 8: Testimonials ── */}
      <Section className="bg-white py-space-20">
        <div className="container-xl">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            What Enterprise Clients Say
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                className="bg-cream-50 rounded-2xl p-8 border-l-4 border-gold"
                variants={fadeUpStagger}
              >
                <p className="font-body-md text-warm-gray-700 italic mb-6 leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-warm-gray-800">{t.name}</p>
                  <p className="text-body-sm text-warm-gray-400">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── Section 9: Implementation ── */}
      <Section className="bg-cream-50 py-space-20">
        <div className="container-lg">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Simple Implementation
          </motion.h2>

          <div className="relative">
            {/* Horizontal connecting line (desktop only) */}
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-warm-gray-200" />

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {implementationSteps.map((step) => (
                <motion.div
                  key={step.number}
                  className="text-center relative"
                  variants={fadeUpStagger}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 text-white flex items-center justify-center mx-auto mb-5 shadow-cta relative z-10">
                    <span className="font-mono font-bold text-lg">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="font-semibold text-warm-gray-800 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-body-sm text-warm-gray-500 max-w-[200px] mx-auto">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── Section 10: CTA / Demo Request ── */}
      <Section
        id="demo-request"
        className="bg-[#1A1518] py-space-24"
      >
        <div className="container-md max-w-xl">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <h2 className="font-display-sm font-serif text-white mb-4">
              Ready to Transform Your Organization?
            </h2>
            <p className="font-body-md text-dark-text-secondary">
              Schedule a personalized demo with our Enterprise team.
            </p>
          </motion.div>

          <motion.form
            className="space-y-5"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15, ease: easeOut }}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-body-sm font-medium text-warm-gray-300 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder:text-dark-text-secondary/50 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-warm-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="work@organization.com"
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder:text-dark-text-secondary/50 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-body-sm font-medium text-warm-gray-300 mb-1.5">
                  Organization
                </label>
                <input
                  type="text"
                  placeholder="Organization name"
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder:text-dark-text-secondary/50 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-warm-gray-300 mb-1.5">
                  Number of Candidates
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-3.5 text-white appearance-none focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select range
                    </option>
                    <option value="10-50">10 - 50</option>
                    <option value="51-100">51 - 100</option>
                    <option value="101-250">101 - 250</option>
                    <option value="251-500">251 - 500</option>
                    <option value="500+">500+</option>
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-text-secondary pointer-events-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-medium text-warm-gray-300 mb-1.5">
                Message
              </label>
              <textarea
                rows={4}
                placeholder="Tell us about your organization's needs..."
                className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder:text-dark-text-secondary/50 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-250 hover:-translate-y-0.5"
              style={{
                background: 'var(--gradient-enterprise)',
                boxShadow: '0 4px 16px rgba(212,165,116,0.3)',
              }}
            >
              Request Demo
              <ArrowRight size={18} />
            </button>
          </motion.form>
        </div>
      </Section>
    </div>
  );
}

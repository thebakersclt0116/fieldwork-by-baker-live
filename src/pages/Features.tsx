import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, useInView, type Transition } from 'framer-motion';
import {
  Clock,
  BarChart3,
  FileText,
  UserCheck,
  Users,
  ShieldCheck,
  Lock,
  CheckCircle,
  X,
  ArrowRight,
  Calendar,
  Timer,
  Zap,
  Layers,
  Sparkles,
  Bell,

  Download,
  ChevronRight,
} from 'lucide-react';

/* ─── Animation helpers ─── */
const fadeUpTransition: Transition = {
  duration: 0.6,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: fadeUpTransition },
};

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUpVariants}
      transition={{ ...fadeUpTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerChild({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1200;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span ref={ref} className="font-data-lg text-rose-500">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─── Data ─── */
const featureSections = [
  { id: 'hour-tracking', label: 'Hour Tracking', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'bacb-export', label: 'BACB Export', icon: FileText },
  { id: 'supervisor', label: 'Supervisor', icon: UserCheck },
  { id: 'enterprise', label: 'Enterprise', icon: Users },
];

const comparisonRows = [
  { feature: 'Basic Hour Tracking', ripley: true, others: true, fbb: true },
  { feature: 'BACB 2027 Compliant', ripley: true, others: true, fbb: true },
  { feature: 'Free Tier', ripley: 'partial', others: 'partial', fbb: true, note: '14-day free trial' },
  { feature: 'Modern UI Design', ripley: false, others: 'partial', fbb: true },
  { feature: 'Official BACB PDF Export', ripley: false, others: false, fbb: true },
  { feature: 'Dark Mode', ripley: false, others: 'partial', fbb: true },
  { feature: 'Progress Analytics', ripley: 'basic', others: 'basic', fbb: true },
  { feature: 'Supervisor Dashboard', ripley: 'basic', others: false, fbb: true },
  { feature: 'Enterprise / Organization', ripley: false, others: false, fbb: true },
  { feature: 'Apple Pay', ripley: false, others: false, fbb: true },
  { feature: 'Compliance Alerts', ripley: false, others: false, fbb: true },
  { feature: 'Completion Forecast', ripley: false, others: false, fbb: true },
  { feature: 'Ad-Free Experience', ripley: false, others: true, fbb: true },
];

const stats = [
  { value: 5000, suffix: '+', label: 'Active Users' },
  { value: 98, suffix: '%', label: 'Compliance Rate' },
  { value: 150000, suffix: '+', label: 'Hours Logged' },
  { value: 4.9, suffix: '/5', label: 'User Rating' },
];

/* ─── Main Page ─── */
export default function Features() {
  const [activeTab, setActiveTab] = useState('hour-tracking');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  /* Scroll spy for tabs */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );

    featureSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* ═══════════════════════════════════════════
          SECTION 1 — Hero
      ═══════════════════════════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center justify-center gradient-hero-bg overflow-hidden">
        {/* Subtle concentric circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-rose-200/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-rose-200/8" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full border border-rose-200/5" />
        </div>

        <div className="container-lg relative z-10 text-center pt-32 pb-16">
          <FadeUp delay={0.2}>
            <span className="section-overline inline-flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Platform Features
            </span>
          </FadeUp>

          <FadeUp delay={0.3}>
            <h1 className="font-display-lg font-serif text-warm-gray-900 mb-6 max-w-2xl mx-auto">
              Every Feature, Thoughtfully Crafted
            </h1>
          </FadeUp>

          <FadeUp delay={0.5}>
            <p className="font-body-lg text-warm-gray-500 max-w-xl mx-auto mb-8">
              From hour logging to BACB form export, discover why thousands of BCBA candidates trust Fieldwork by Baker.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — Sticky Category Tabs
      ═══════════════════════════════════════════ */}
      <div className="sticky top-[72px] z-40 bg-[rgba(255,252,249,0.95)] dark:bg-[rgba(26,21,24,0.95)] backdrop-blur-xl border-b border-warm-gray-100 dark:border-dark-border">
        <div className="container-xl">
          <div className="flex items-center justify-center gap-2 sm:gap-6 overflow-x-auto py-0 snap-x scrollbar-hide">
            {featureSections.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`flex items-center gap-2 py-4 px-2 sm:px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 snap-start ${
                    isActive
                      ? 'text-rose-500 border-rose-500'
                      : 'text-warm-gray-400 border-transparent hover:text-warm-gray-600 dark:text-dark-text-secondary dark:hover:text-dark-text'
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 3 — Smart Hour Tracking
      ═══════════════════════════════════════════ */}
      <section id="hour-tracking" className="bg-white py-24" ref={(el) => { sectionRefs.current['hour-tracking'] = el; }}>
        <div className="container-2xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <StaggerContainer>
                <StaggerChild>
                  <span className="section-overline inline-flex items-center gap-2 mb-4">
                    <Clock size={16} />
                    Hour Tracking
                  </span>
                </StaggerChild>
                <StaggerChild>
                  <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                    Log Hours the Way You Actually Work
                  </h2>
                </StaggerChild>
                <StaggerChild>
                  <p className="font-body-md text-warm-gray-500 mb-10">
                    Calendar-based entry, quick-add timers, bulk import for past months, and intelligent categorization that knows the difference between restricted and unrestricted activities.
                  </p>
                </StaggerChild>

                {[
                  { icon: Calendar, title: 'Calendar Entry', desc: 'Click any date to add hours. Set start/end times, choose activity type, and assign your supervisor — all in one flow.' },
                  { icon: Timer, title: 'Quick-Add Timer', desc: 'Start a live timer during your session. Stop it when done, and we\'ll log the entry with all the right defaults.' },
                  { icon: Zap, title: 'Bulk Import', desc: 'Catching up on past months? Use our bulk entry tool to add entire completed periods in minutes, not hours.' },
                  { icon: Layers, title: 'Smart Categorization', desc: 'We guide you on restricted vs. unrestricted classification based on BACB guidelines, so you stay compliant effortlessly.' },
                  { icon: CheckCircle, title: 'Activity Subcategories', desc: 'Choose from the full BACB activity list: observation, data collection, assessments, program writing, direct therapy, and more.' },
                ].map((item) => (
                  <StaggerChild key={item.title}>
                    <div className="flex gap-4 mb-6 group">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-200">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-warm-gray-800 text-[15px] mb-1">{item.title}</h4>
                        <p className="font-body-sm text-warm-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  </StaggerChild>
                ))}
              </StaggerContainer>
            </div>

            {/* Right — visual */}
            <FadeUp delay={0.2}>
              <div className="relative">
                <div className="bg-gradient-to-br from-rose-50 to-cream-50 rounded-3xl p-6 lg:p-8 shadow-card border border-warm-gray-100">
                  {/* Mock calendar UI */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-warm-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-warm-gray-800">June 2025</h4>
                      <div className="flex gap-1">
                        <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 text-xs">&lt;</div>
                        <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 text-xs">&gt;</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-warm-gray-400 mb-2">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                      {Array.from({ length: 30 }, (_, i) => (
                        <div
                          key={i}
                          className={`aspect-square flex items-center justify-center rounded-lg text-xs ${
                            [4, 8, 12, 15, 18, 22, 25, 28].includes(i + 1)
                              ? 'bg-rose-50 text-rose-600 font-medium'
                              : i + 1 === 18
                              ? 'bg-rose-500 text-white font-semibold'
                              : 'text-warm-gray-700 hover:bg-warm-gray-50'
                          }`}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Floating stat cards */}
                  <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-card border border-warm-gray-100">
                    <p className="text-xs text-warm-gray-400 mb-1">Entries this month</p>
                    <p className="font-data-lg text-rose-500 text-2xl">12</p>
                  </div>
                  <div className="absolute -top-4 -right-4 bg-success-light rounded-xl px-4 py-3 shadow-card border border-success/20">
                    <p className="text-xs font-medium text-success">Unrestricted: 68%</p>
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4 — Progress Analytics
      ═══════════════════════════════════════════ */}
      <section id="analytics" className="bg-cream-50 py-24" ref={(el) => { sectionRefs.current['analytics'] = el; }}>
        <div className="container-2xl">
          <div className="grid lg:grid-cols-[45%_55%] gap-16 items-center">
            {/* Left — Visual */}
            <FadeUp>
              <div className="relative order-2 lg:order-1">
                <div className="bg-gradient-to-br from-white to-cream-50 rounded-3xl p-6 lg:p-8 shadow-card border border-warm-gray-100">
                  {/* Progress ring mock */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative w-40 h-40 mb-3">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#F2EDEA" strokeWidth="8" />
                        <circle
                          cx="60" cy="60" r="50" fill="none"
                          stroke="url(#ringGrad)" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${0.624 * 314} ${314}`}
                        />
                        <defs>
                          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#F97B8A" />
                            <stop offset="100%" stopColor="#E85D70" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-data-lg text-warm-gray-800 text-2xl">62.4%</span>
                        <span className="text-[10px] text-warm-gray-400">1,247 / 2,000 hrs</span>
                      </div>
                    </div>
                    <p className="text-xs text-success font-medium bg-success-light px-3 py-1 rounded-full">Projected completion: March 2027</p>
                  </div>
                  {/* Mini bar chart */}
                  <div className="flex items-end justify-center gap-3 h-24 mb-2">
                    {[45, 62, 38, 55, 70, 48].map((h, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <div
                          className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-rose-400 to-rose-300"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[9px] text-warm-gray-400">{['Jan','Feb','Mar','Apr','May','Jun'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>

            {/* Right */}
            <div className="order-1 lg:order-2">
              <StaggerContainer>
                <StaggerChild>
                  <span className="section-overline inline-flex items-center gap-2 mb-4">
                    <BarChart3 size={16} />
                    Analytics &amp; Insights
                  </span>
                </StaggerChild>
                <StaggerChild>
                  <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                    Know Exactly Where You Stand
                  </h2>
                </StaggerChild>
                <StaggerChild>
                  <p className="font-body-md text-warm-gray-500 mb-10">
                    Real-time dashboards track every metric that matters. No more guessing if you&apos;re on pace to finish within the 5-year window.
                  </p>
                </StaggerChild>

                {[
                  { icon: CheckCircle, title: 'Progress Ring', desc: 'A beautiful, animated ring shows your total progress toward 2,000 (or 1,500 concentrated) hours. Watch it fill as you log entries.' },
                  { icon: BarChart3, title: 'Monthly Breakdown', desc: 'Bar chart visualizes your hours month by month. Spot trends, identify slow periods, and plan ahead.' },
                  { icon: ShieldCheck, title: 'Compliance Gauge', desc: 'Instantly see your unrestricted percentage. Get warned before it drops below the 60% threshold.' },
                  { icon: UserCheck, title: 'Supervision Tracker', desc: 'Monitor your supervision contact count, observation requirements, and supervisor-allocated hours.' },
                  { icon: Sparkles, title: 'Completion Forecast', desc: 'Our algorithm projects your completion date based on your current pace. Plan your exam application accordingly.' },
                ].map((item) => (
                  <StaggerChild key={item.title}>
                    <div className="flex gap-4 mb-6 group">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-200">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-warm-gray-800 text-[15px] mb-1">{item.title}</h4>
                        <p className="font-body-sm text-warm-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  </StaggerChild>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — BACB Form Export (Star Feature)
      ═══════════════════════════════════════════ */}
      <section id="bacb-export" className="bg-rose-50 py-24" ref={(el) => { sectionRefs.current['bacb-export'] = el; }}>
        <div className="container-2xl">
          {/* Header */}
          <StaggerContainer className="text-center max-w-2xl mx-auto mb-16">
            <StaggerChild>
              <span className="section-overline inline-flex items-center gap-2 mb-4">
                <FileText size={16} />
                BACB Form Export
              </span>
            </StaggerChild>
            <StaggerChild>
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                The Only Tracker with Official BACB PDF Export
              </h2>
            </StaggerChild>
            <StaggerChild>
              <p className="font-body-lg text-warm-gray-500">
                We built what no one else has: one-click generation of the exact forms the BACB requires. Auto-populated. Audit-ready. Flawless.
              </p>
            </StaggerChild>
          </StaggerContainer>

          {/* Three-Step Flow */}
          <StaggerContainer className="grid md:grid-cols-3 gap-6 mb-16 relative">
            {/* Connecting arrows (desktop only) */}
            <div className="hidden md:block absolute top-1/3 left-[30%] right-[30%] z-0">
              <div className="flex justify-between">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-rose-300"
                >
                  <ChevronRight size={28} />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="text-rose-300"
                >
                  <ChevronRight size={28} />
                </motion.div>
              </div>
            </div>

            {[
              { step: '01', icon: Clock, title: 'Log Your Hours', desc: 'Enter your fieldwork hours with full detail — date, time, activity type, supervisor, and notes. Everything is structured for BACB compliance from day one.', bg: 'bg-rose-50', iconColor: 'text-rose-500' },
              { step: '02', icon: CheckCircle, title: 'Review with Supervisor', desc: 'Your supervisor reviews, verifies, and digitally signs off on your hours within the platform. All approvals are timestamped and auditable.', bg: 'bg-success-light', iconColor: 'text-success' },
              { step: '03', icon: FileText, title: 'Export Official PDF', desc: 'Generate the BACB Monthly Fieldwork Verification Form (M-FVF) or Final Fieldwork Verification Form (F-FVF) — pre-filled, properly formatted, ready to submit.', bg: 'bg-info-light', iconColor: 'text-info' },
            ].map((s) => (
              <StaggerChild key={s.step}>
                <div className="bg-white rounded-3xl p-8 shadow-card border border-warm-gray-100 relative z-10">
                  <span className="font-data-lg text-rose-200 text-4xl mb-4 block">{s.step}</span>
                  <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center ${s.iconColor} mb-4`}>
                    <s.icon size={28} />
                  </div>
                  <h3 className="font-semibold text-warm-gray-800 text-lg mb-2">{s.title}</h3>
                  <p className="font-body-sm text-warm-gray-500">{s.desc}</p>
                </div>
              </StaggerChild>
            ))}
          </StaggerContainer>

          {/* Form preview mockup */}
          <FadeUp delay={0.3}>
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-card border border-warm-gray-100 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-rose-500" />
                    <span className="font-semibold text-warm-gray-800 text-sm">Sample M-FVF Export Preview</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success-light px-3 py-1 rounded-full">
                    <CheckCircle size={12} />
                    Official BACB Format Guaranteed
                  </span>
                </div>
                {/* Mock form fields */}
                <div className="border border-warm-gray-200 rounded-2xl p-5 space-y-4 bg-cream-50/50">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium">Trainee Name</label>
                      <div className="h-9 bg-white rounded-lg border border-warm-gray-200 flex items-center px-3 text-sm text-warm-gray-700">Jane Smith, BCBA Candidate</div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium">Supervisor Name</label>
                      <div className="h-9 bg-white rounded-lg border border-warm-gray-200 flex items-center px-3 text-sm text-warm-gray-700">Dr. Emily Baker, BCBA-D</div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium">Month / Year</label>
                      <div className="h-9 bg-white rounded-lg border border-warm-gray-200 flex items-center px-3 text-sm text-warm-gray-700">June 2025</div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium">Total Hours</label>
                      <div className="h-9 bg-white rounded-lg border border-warm-gray-200 flex items-center px-3 text-sm text-warm-gray-700">127.5</div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium">Unrestricted %</label>
                      <div className="h-9 bg-white rounded-lg border border-warm-gray-200 flex items-center px-3 text-sm text-success font-medium">68.2%</div>
                    </div>
                  </div>
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-warm-gray-400 font-medium border-b border-warm-gray-200 pb-2 pt-2">
                    <div>Activity Type</div>
                    <div>Date</div>
                    <div>Hours</div>
                    <div>Category</div>
                  </div>
                  {[
                    ['Direct Observation', '06/03', '3.5', 'Unrestricted'],
                    ['Assessment Administration', '06/05', '2.0', 'Unrestricted'],
                    ['Program Development', '06/08', '4.0', 'Unrestricted'],
                    ['Parent Training', '06/10', '1.5', 'Restricted'],
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-sm text-warm-gray-700 py-1 border-b border-warm-gray-100 last:border-0">
                      <div>{row[0]}</div>
                      <div className="text-warm-gray-500">{row[1]}</div>
                      <div>{row[2]}</div>
                      <span className={`text-xs font-medium ${row[3] === 'Unrestricted' ? 'text-success' : 'text-warning'}`}>{row[3]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supported forms list */}
              <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  'Monthly Fieldwork Verification Form (M-FVF) — Individual Supervisor',
                  'Monthly Fieldwork Verification Form (M-FVF) — Multiple Supervisors',
                  'Final Fieldwork Verification Form (F-FVF) — Individual Supervisor',
                  'Final Fieldwork Verification Form (F-FVF) — Multiple Supervisors',
                ].map((form) => (
                  <StaggerChild key={form}>
                    <div className="flex items-start gap-3 bg-white/70 rounded-xl p-4 border border-warm-gray-100">
                      <CheckCircle size={18} className="text-success shrink-0 mt-0.5" />
                      <span className="text-sm text-warm-gray-700">{form}</span>
                    </div>
                  </StaggerChild>
                ))}
              </StaggerContainer>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6 — Supervisor Tools
      ═══════════════════════════════════════════ */}
      <section id="supervisor" className="bg-white py-24" ref={(el) => { sectionRefs.current['supervisor'] = el; }}>
        <div className="container-2xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <StaggerContainer>
                <StaggerChild>
                  <span className="section-overline inline-flex items-center gap-2 mb-4">
                    <UserCheck size={16} />
                    Supervisor Dashboard
                  </span>
                </StaggerChild>
                <StaggerChild>
                  <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                    Supervise with Clarity
                  </h2>
                </StaggerChild>
                <StaggerChild>
                  <p className="font-body-md text-warm-gray-500 mb-10">
                    A dedicated dashboard for BCBA supervisors to oversee all linked supervisees, verify hours, and manage documentation efficiently.
                  </p>
                </StaggerChild>

                {[
                  { icon: Users, title: 'Supervisee Overview', desc: 'See all your supervisees at a glance with progress bars, recent activity, and compliance status indicators.' },
                  { icon: CheckCircle, title: 'Hour Verification', desc: 'Review entries individually or in bulk. Approve with one click, or send back with feedback notes.' },
                  { icon: FileText, title: 'Digital Signatures', desc: 'Electronically sign monthly and final verification forms. Digital signatures are legally binding and auditable.' },
                  { icon: Bell, title: 'Compliance Alerts', desc: 'Get notified when a supervisee\'s unrestricted percentage drops, supervision contacts are insufficient, or deadlines approach.' },
                  { icon: MessageSquareIcon, title: 'Feedback Notes', desc: 'Leave detailed feedback on specific entries. Supervisees see your comments and can make corrections.' },
                  { icon: Download, title: 'Form Generation', desc: 'Generate and download signed M-FVF and F-FVF forms for any supervisee, any month.' },
                ].map((item) => (
                  <StaggerChild key={item.title}>
                    <div className="flex gap-4 mb-6 group">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-200">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-warm-gray-800 text-[15px] mb-1">{item.title}</h4>
                        <p className="font-body-sm text-warm-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  </StaggerChild>
                ))}
              </StaggerContainer>
            </div>

            {/* Right — visual */}
            <FadeUp delay={0.2}>
              <div className="relative">
                <div className="bg-gradient-to-br from-cream-50 to-white rounded-3xl p-6 lg:p-8 shadow-card border border-warm-gray-100">
                  {/* Mock supervisor table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-warm-gray-800 text-sm">My Supervisees</h4>
                      <span className="text-xs text-warm-gray-400">5 total</span>
                    </div>
                    {[
                      { name: 'Sarah M.', progress: 78, status: 'On Track', color: 'success' },
                      { name: 'Jessica L.', progress: 45, status: 'Review', color: 'warning' },
                      { name: 'Amanda K.', progress: 92, status: 'On Track', color: 'success' },
                      { name: 'Rachel T.', progress: 23, status: 'On Track', color: 'success' },
                      { name: 'Nicole B.', progress: 61, status: 'Alert', color: 'error' },
                    ].map((s) => (
                      <div key={s.name} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-warm-gray-100">
                        <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-xs font-semibold">
                          {s.name.split(' ')[0][0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-warm-gray-800">{s.name}</span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              s.color === 'success' ? 'bg-success-light text-success' :
                              s.color === 'warning' ? 'bg-warning-light text-warning' :
                              'bg-error-light text-error'
                            }`}>{s.status}</span>
                          </div>
                          <div className="w-full h-1.5 bg-warm-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.color === 'success' ? 'bg-success' :
                                s.color === 'warning' ? 'bg-warning' :
                                'bg-error'
                              }`}
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -top-3 -right-3 bg-warning-light rounded-xl px-4 py-2.5 shadow-card border border-warning/20">
                  <p className="text-xs font-medium text-warning">5 supervisees pending review</p>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 7 — Enterprise Suite
      ═══════════════════════════════════════════ */}
      <section id="enterprise" className="bg-gold-light/30 py-24" ref={(el) => { sectionRefs.current['enterprise'] = el; }}>
        <div className="container-2xl">
          {/* Header */}
          <StaggerContainer className="text-center max-w-2xl mx-auto mb-16">
            <StaggerChild>
              <span className="section-overline inline-flex items-center gap-2 mb-4 !text-gold">
                <Users size={16} />
                Enterprise
              </span>
            </StaggerChild>
            <StaggerChild>
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                Built for Organizations That Demand More
              </h2>
            </StaggerChild>
            <StaggerChild>
              <p className="font-body-lg text-warm-gray-500">
                Clinics, universities, and large ABA organizations use our Enterprise tier to manage compliance at scale.
              </p>
            </StaggerChild>
          </StaggerContainer>

          {/* Feature Grid */}
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Users, title: 'Organization Admin Dashboard', desc: 'A command center for your entire organization. View all candidates, their progress, and compliance health in one screen.' },
              { icon: BarChart3, title: 'Organization-Wide Analytics', desc: 'Aggregate dashboards show completion rates, average pace, and compliance metrics across departments and teams.' },
              { icon: ShieldCheck, title: 'Compliance Monitoring', desc: 'Automated alerts flag candidates falling behind, approaching deadlines, or at risk of non-compliance.' },
              { icon: FileText, title: 'Bulk Form Export', desc: 'Export M-FVF and F-FVF forms for all candidates simultaneously. Perfect for audit season.' },
              { icon: Users, title: 'Bulk User Import (CSV)', desc: 'Onboard dozens of candidates at once with our CSV import tool. Assign supervisors automatically based on rules.' },
              { icon: Lock, title: 'SSO & Security', desc: 'Enterprise-grade security with Single Sign-On (SAML 2.0), role-based access control, and full audit logs.' },
            ].map((card) => (
              <StaggerChild key={card.title}>
                <div className="bg-white rounded-3xl p-7 shadow-card border border-gold/15 hover:border-gold/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-gold-light flex items-center justify-center text-gold mb-4">
                    <card.icon size={24} />
                  </div>
                  <h4 className="font-semibold text-warm-gray-800 text-[15px] mb-2">{card.title}</h4>
                  <p className="font-body-sm text-warm-gray-500">{card.desc}</p>
                </div>
              </StaggerChild>
            ))}
          </StaggerContainer>

          {/* CTA */}
          <FadeUp delay={0.4}>
            <div className="text-center">
              <Link
                to="/enterprise"
                className="btn-primary inline-flex"
                style={{ background: 'linear-gradient(135deg, #D4A574 0%, #E8C9A0 100%)', boxShadow: '0 4px 16px rgba(212,165,116,0.3)' }}
              >
                Request Enterprise Demo
                <ArrowRight size={16} />
              </Link>
              <p className="mt-4 text-sm text-warm-gray-400">
                Or contact{' '}
                <a href="mailto:sales@fieldworkbybaker.com" className="text-gold hover:underline">
                  sales@fieldworkbybaker.com
                </a>
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 8 — Security & Compliance
      ═══════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="container-lg">
          <StaggerContainer className="text-center mb-12">
            <StaggerChild>
              <span className="section-overline inline-flex items-center gap-2 mb-4">
                <ShieldCheck size={16} />
                Security &amp; Compliance
              </span>
            </StaggerChild>
            <StaggerChild>
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                Your Data is Sacred
              </h2>
            </StaggerChild>
          </StaggerContainer>

          <StaggerContainer className="flex flex-wrap justify-center gap-6 mb-10">
            {[
              { icon: ShieldCheck, label: 'HIPAA Compliant', color: 'text-success bg-success-light' },
              { icon: Lock, label: 'SSL Encrypted', color: 'text-info bg-info-light' },
              { icon: ShieldCheck, label: 'SOC 2 Type II', color: 'text-info bg-info-light' },
              { icon: CheckCircle, label: 'BACB 2027 Ready', color: 'text-rose-500 bg-rose-50' },
            ].map((badge) => (
              <StaggerChild key={badge.label}>
                <div className="w-[140px] flex flex-col items-center text-center p-5 bg-warm-gray-50 rounded-2xl">
                  <div className={`w-12 h-12 rounded-xl ${badge.color} flex items-center justify-center mb-3`}>
                    <badge.icon size={24} />
                  </div>
                  <span className="text-sm font-semibold text-warm-gray-800">{badge.label}</span>
                </div>
              </StaggerChild>
            ))}
          </StaggerContainer>

          <FadeUp delay={0.3}>
            <p className="text-center font-body-md text-warm-gray-500 max-w-lg mx-auto">
              All data is encrypted at rest and in transit. We never sell your information. Our platform undergoes regular security audits to ensure your fieldwork data remains protected.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 9 — Stats
      ═══════════════════════════════════════════ */}
      <section className="bg-cream-50 py-20">
        <div className="container-lg">
          <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <StaggerChild key={stat.label}>
                <div className="bg-white rounded-3xl p-8 text-center shadow-card border border-warm-gray-100">
                  <div className="mb-2">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-warm-gray-400">{stat.label}</p>
                </div>
              </StaggerChild>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 10 — Feature Comparison Table
      ═══════════════════════════════════════════ */}
      <section className="bg-cream-50 py-24">
        <div className="container-xl">
          <StaggerContainer className="text-center mb-12">
            <StaggerChild>
              <span className="section-overline mb-4 inline-block">Compare</span>
            </StaggerChild>
            <StaggerChild>
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                Fieldwork by Baker vs. The Competition
              </h2>
            </StaggerChild>
          </StaggerContainer>

          <FadeUp>
            <div className="max-w-[900px] mx-auto overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-warm-gray-200">
                    <th className="py-4 px-5 text-xs font-semibold uppercase tracking-wider text-warm-gray-800 min-w-[200px]">Feature</th>
                    <th className="py-4 px-5 text-xs font-semibold uppercase tracking-wider text-warm-gray-400 text-center">Ripley</th>
                    <th className="py-4 px-5 text-xs font-semibold uppercase tracking-wider text-warm-gray-400 text-center">Others</th>
                    <th className="py-4 px-5 text-xs font-semibold uppercase tracking-wider text-rose-500 text-center">Fieldwork by Baker</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-warm-gray-100 hover:bg-white/50 transition-colors"
                    >
                      <td className="py-4 px-5 text-sm text-warm-gray-700 font-medium">{row.feature}</td>
                      <td className="py-4 px-5 text-center">
                        {row.ripley === true ? (
                          <CheckCircle size={18} className="inline text-warm-gray-400" />
                        ) : row.ripley === false ? (
                          <X size={18} className="inline text-warm-gray-300" />
                        ) : (
                          <span className="text-xs text-warm-gray-400 capitalize">{row.ripley}</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {row.others === true ? (
                          <CheckCircle size={18} className="inline text-warm-gray-400" />
                        ) : row.others === false ? (
                          <X size={18} className="inline text-warm-gray-300" />
                        ) : (
                          <span className="text-xs text-warm-gray-400 capitalize">{row.others}</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center bg-rose-50/50">
                        {row.fbb === true ? (
                          <CheckCircle size={18} className="inline text-rose-500" />
                        ) : row.note ? (
                          <span className="text-xs text-rose-500 font-medium">{row.note}</span>
                        ) : (
                          <X size={18} className="inline text-warm-gray-300" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 11 — Bottom CTA
      ═══════════════════════════════════════════ */}
      <section className="gradient-cta-bg py-20">
        <div className="container-md text-center">
          <FadeUp>
            <h2 className="font-display-md font-serif text-white mb-4">
              Ready to Experience the Difference?
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="font-body-lg text-white/80 mb-8 max-w-lg mx-auto">
              Start your 14-day free trial. No credit card required.
            </p>
          </FadeUp>
          <FadeUp delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-white text-rose-500 font-semibold px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-250"
              >
                Start Free Trial
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 bg-transparent text-white font-semibold px-7 py-3.5 rounded-2xl border-2 border-white/40 hover:bg-white/10 transition-all duration-250"
              >
                View Pricing
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}

/* ─── Extra icon component (not in lucide imports above) ─── */
function MessageSquareIcon(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

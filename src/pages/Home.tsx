import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ShieldCheck,
  ArrowRight,
  Play,
  Clock,
  UserCheck,
  Users,
  Building2,
  CheckCircle2,
  X,
  FileOutput,
  BarChart3,
  Star,
  ChevronDown,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  pricingTiers,
  testimonials,
  faqItems,
  statsData,
  featureShowcaseItems,
} from '@/data/mockData';

/* ─── Easing ─── */
const easeOut = [0.4, 0, 0.2, 1] as [number, number, number, number];
const easeSpring = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

/* ─── Animated Counter ─── */
function useCountUp(target: number, duration = 1200, start = false, isDecimal = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let raf: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);

  if (isDecimal) return value.toFixed(1);
  return Math.floor(value).toLocaleString();
}

function StatCounter({
  number,
  suffix,
  label,
  isDecimal = false,
}: {
  number: number;
  suffix: string;
  label: string;
  isDecimal?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const display = useCountUp(number, 1200, inView, isDecimal);

  return (
    <div ref={ref} className="text-center">
      <div className="font-data-lg text-rose-500">
        {display}
        {suffix}
      </div>
      <div className="font-body-sm text-warm-gray-400 mt-2">{label}</div>
    </div>
  );
}

/* ─── Scroll Fade-Up Wrapper ─── */
function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Stagger Container ─── */
function StaggerContainer({
  children,
  className = '',
  staggerDelay = 0.1,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: staggerDelay },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const [annBarVisible, setAnnBarVisible] = useState(() => {
    return sessionStorage.getItem('annBarDismissed') !== 'true';
  });

  const dismissAnnBar = useCallback(() => {
    setAnnBarVisible(false);
    sessionStorage.setItem('annBarDismissed', 'true');
  }, []);

  return (
    <div className="overflow-hidden">
      <AnnouncementBar visible={annBarVisible} onDismiss={dismissAnnBar} />
      <HeroSection />
      <StatsSection />
      <RoleSelectorSection />
      <FeatureShowcaseSection />
      <ComparisonSection />
      <BACBExportSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQTeaserSection />
      <FinalCTASection />
    </div>
  );
}

/* ═══════════════ SECTION 1: Announcement Bar ═══════════════ */
function AnnouncementBar({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -44 }}
          animate={{ y: 0 }}
          exit={{ y: -44, height: 0 }}
          transition={{ duration: 0.4, delay: 1 }}
          className="bg-rose-500 text-white h-11 flex items-center justify-center text-sm font-medium fixed top-[72px] left-0 right-0 z-40"
        >
          <div className="flex items-center gap-2 px-4">
            <Sparkles size={14} />
            <span>BCB 2027 Requirements Now Supported — Fully Compliant &amp; Ready</span>
            <Link to="/faq" className="underline hover:no-underline ml-1 text-white/90">
              Learn more &rarr;
            </Link>
          </div>
          <button
            onClick={onDismiss}
            className="absolute right-4 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss announcement"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════ SECTION 2: Hero ═══════════════ */
function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center gradient-hero-bg overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[10%] left-[5%] w-[400px] h-[400px] rounded-full opacity-40 animate-float"
          style={{
            background: 'radial-gradient(circle, var(--rose-200) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute top-[30%] right-[10%] w-[350px] h-[350px] rounded-full opacity-30 animate-float"
          style={{
            background: 'radial-gradient(circle, var(--gold-light) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute bottom-[20%] left-[20%] w-[300px] h-[300px] rounded-full opacity-30 animate-float"
          style={{
            background: 'radial-gradient(circle, var(--cream-100) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '4s',
          }}
        />
        {/* Small decorative dots */}
        {[
          { top: '15%', left: '8%', color: 'var(--rose-300)' },
          { top: '25%', right: '15%', color: 'var(--gold)' },
          { top: '60%', left: '3%', color: 'var(--success)' },
          { bottom: '25%', right: '25%', color: 'var(--rose-300)' },
          { top: '45%', left: '12%', color: 'var(--gold)' },
          { bottom: '15%', left: '35%', color: 'var(--rose-300)' },
          { top: '8%', right: '30%', color: 'var(--success)' },
          { bottom: '35%', right: '8%', color: 'var(--rose-300)' },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-float-mini"
            style={{
              ...dot,
              backgroundColor: dot.color,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="container-2xl relative z-10 pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-8 items-center">
          {/* Left: Text */}
          <div>
            {/* Overline badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: easeOut }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 text-rose-600 text-sm font-medium mb-8"
            >
              <ShieldCheck size={16} />
              Trusted by 10,000+ BCBA Candidates
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: easeOut }}
              className="font-display-xl font-serif text-warm-gray-900 max-w-[600px]"
            >
              Track Every Hour.
              <br />
              Earn Your BCBA.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: easeOut }}
              className="font-body-lg text-warm-gray-500 max-w-[500px] mt-6"
            >
              The most beautiful, BACB 2027-compliant fieldwork tracker. Log hours,
              manage supervisors, and export official forms — all in one exquisite
              dashboard.
            </motion.p>

            {/* CTA Group */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9, ease: easeOut }}
              className="flex flex-col sm:flex-row items-start gap-4 mt-8"
            >
              <Link to="/signup" className="btn-primary text-lg py-4 px-8">
                Start Your Free 14-Day Trial
                <ArrowRight size={18} />
              </Link>
              <Link to="/features" className="btn-secondary py-4 px-8">
                <Play size={18} className="text-rose-400" />
                Watch Demo
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0, ease: easeOut }}
              className="mt-3 flex items-center gap-4"
            >
              <Link
                to="/enterprise"
                className="text-warm-gray-400 hover:text-rose-500 text-sm font-medium transition-colors inline-flex items-center gap-1"
              >
                See Enterprise Plans &rarr;
              </Link>
              <span className="text-warm-gray-200">|</span>
              <Link
                to="/login"
                className="text-rose-500 hover:text-rose-600 text-sm font-semibold transition-colors inline-flex items-center gap-1"
              >
                Try Demo Instantly &rarr;
              </Link>
            </motion.div>

            {/* Trust Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1, ease: easeOut }}
              className="mt-10 hidden md:block"
            >
              <p className="text-xs text-warm-gray-400 mb-3 uppercase tracking-wider">
                As seen in
              </p>
              <div className="flex items-center gap-6">
                {['Behavior Analysis Journal', 'BCBA Exam Prep', 'ABAI', 'APBA'].map(
                  (name) => (
                    <div
                      key={name}
                      className="text-warm-gray-300 text-sm font-semibold opacity-50 hover:opacity-70 transition-opacity"
                    >
                      {name}
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>

          {/* Right: Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: easeOut }}
            className="relative hidden lg:block"
          >
            <div
              className="relative rounded-2xl overflow-hidden shadow-hero-mockup"
              style={{
                perspective: '1000px',
                transform: 'rotateY(-8deg) rotateX(4deg)',
              }}
            >
              <img
                src="/hero-dashboard-mockup.png"
                alt="Fieldwork by Baker Dashboard"
                className="w-full h-auto"
              />
            </div>

            {/* Floating Progress Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="absolute -top-6 -left-10 bg-white rounded-2xl shadow-card p-4 w-[180px] animate-float-mini"
            >
              <p className="text-xs text-warm-gray-400 mb-1">Progress</p>
              <p className="font-mono text-lg font-medium text-warm-gray-800">
                1,247 <span className="text-warm-gray-400">/ 2,000 hrs</span>
              </p>
              <div className="mt-2 w-full h-2 bg-warm-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: '62%' }}
                />
              </div>
            </motion.div>

            {/* Compliance Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.4, ease: easeSpring }}
              className="absolute -bottom-4 -right-4 bg-success-light text-success px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-card animate-float-mini"
              style={{ animationDelay: '1s' }}
            >
              <CheckCircle2 size={16} />
              2027 Compliant
            </motion.div>

            {/* Supervisor Alert */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="absolute top-1/2 -right-8 bg-white rounded-xl shadow-card p-3 flex items-center gap-3 animate-float-mini"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center">
                <UserCheck size={16} className="text-rose-500" />
              </div>
              <p className="text-xs text-warm-gray-600">Supervisor verified your hours</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 3: Stats ═══════════════ */
function StatsSection() {
  return (
    <section className="bg-cream-50 py-16">
      <div className="container-xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {statsData.map((stat, i) => (
            <div key={i} className="relative">
              <StatCounter
                number={stat.number}
                suffix={stat.suffix}
                label={stat.label}
                isDecimal={stat.isDecimal}
              />
              {i < statsData.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-warm-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 4: Role Selector ═══════════════ */
function RoleSelectorSection() {
  const roles = [
    {
      icon: <Clock size={24} className="text-rose-500" />,
      iconBg: 'bg-rose-50',
      title: 'BCBA Candidate',
      description:
        'Track your 2,000 hours with confidence. Log entries, monitor your unrestricted percentage, and generate BACB-compliant forms instantly.',
      features: [
        'Calendar-based hour logging',
        'Real-time compliance alerts',
        'One-click BACB form export',
      ],
      cta: 'Learn More',
      ctaHref: '/features',
    },
    {
      icon: <UserCheck size={24} className="text-info" />,
      iconBg: 'bg-info-light',
      title: 'BCBA Supervisor',
      description:
        "Oversee your supervisees' progress, verify hours, provide feedback, and streamline the documentation process — all from one dashboard.",
      features: [
        'Multi-supervisee dashboard',
        'Hour verification & approval',
        'Automated form signing',
      ],
      cta: 'Learn More',
      ctaHref: '/features',
    },
    {
      icon: <Users size={24} className="text-gold" />,
      iconBg: 'bg-gold-light',
      title: 'Enterprise & Universities',
      description:
        'Manage compliance across your entire organization. Assign supervisors, track team progress, and ensure every candidate stays on course.',
      features: [
        'Organization-wide oversight',
        'Bulk user management',
        'Custom branding & SSO',
      ],
      cta: 'Explore Enterprise',
      ctaHref: '/enterprise',
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="container-lg">
        <div className="text-center max-w-[640px] mx-auto mb-16">
          <FadeUp>
            <p className="section-overline mb-4">WHO IS IT FOR</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900">
              Built for Every Step of Your Journey
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="font-body-md text-warm-gray-500 mt-4">
              Whether you&apos;re just starting or managing a team of candidates, Fieldwork
              by Baker adapts to your role.
            </p>
          </FadeUp>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {roles.map((role) => (
            <StaggerItem key={role.title}>
              <div className="bg-white rounded-2xl border border-warm-gray-100 p-8 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-350 h-full flex flex-col">
                <div
                  className={`w-14 h-14 rounded-2xl ${role.iconBg} flex items-center justify-center mb-6`}
                >
                  {role.icon}
                </div>
                <h3 className="font-serif text-xl font-semibold text-warm-gray-900 mb-3">
                  {role.title}
                </h3>
                <p className="font-body-md text-warm-gray-500 mb-6 flex-1">
                  {role.description}
                </p>
                <ul className="space-y-2.5 mb-6">
                  {role.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-warm-gray-600">
                      <CheckCircle2 size={16} className="text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={role.ctaHref}
                  className="text-rose-500 font-semibold text-sm hover:text-rose-600 inline-flex items-center gap-1 transition-colors"
                >
                  {role.cta} &rarr;
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 5: Feature Showcase ═══════════════ */
function FeatureShowcaseSection() {
  const [activeTab, setActiveTab] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  const icons: Record<string, React.ReactNode> = {
    Clock: <Clock size={20} />,
    BarChart3: <BarChart3 size={20} />,
    FileOutput: <FileOutput size={20} />,
    UserCheck: <UserCheck size={20} />,
    Building2: <Building2 size={20} />,
  };

  return (
    <section className="bg-cream-50 py-24" ref={sectionRef}>
      <div className="container-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-12 lg:gap-16">
          {/* Left: Pinned Content */}
          <div className="lg:sticky lg:top-[120px] lg:self-start">
            <FadeUp>
              <p className="section-overline mb-4">POWERFUL FEATURES</p>
            </FadeUp>
            <FadeUp delay={0.1}>
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
                Everything You Need to Succeed
              </h2>
            </FadeUp>
            <FadeUp delay={0.2}>
              <p className="font-body-md text-warm-gray-500 mb-8">
                We&apos;ve thought of every detail so you can focus on what matters —
                becoming a BCBA.
              </p>
            </FadeUp>

            {/* Feature Tabs */}
            <StaggerContainer className="space-y-2 mb-8" staggerDelay={0.08}>
              {featureShowcaseItems.map((item, i) => (
                <StaggerItem key={item.id}>
                  <button
                    onClick={() => setActiveTab(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 ${
                      activeTab === i
                        ? 'bg-rose-50 text-rose-500 border-l-[3px] border-rose-500'
                        : 'text-warm-gray-400 hover:text-warm-gray-600 hover:bg-warm-gray-50'
                    }`}
                  >
                    {icons[item.icon]}
                    <span className="font-medium text-sm">{item.title}</span>
                  </button>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <FadeUp delay={0.5}>
              <Link to="/features" className="btn-primary">
                See All Features
                <ArrowRight size={16} />
              </Link>
            </FadeUp>
          </div>

          {/* Right: Scrolling Images */}
          <div className="space-y-8">
            {featureShowcaseItems.map((item, i) => (
              <FadeUp key={item.id} delay={i * 0.1}>
                <div
                  className={`rounded-2xl overflow-hidden bg-white shadow-card transition-opacity duration-300 ${
                    activeTab === i ? 'opacity-100' : 'lg:opacity-70'
                  }`}
                  onMouseEnter={() => setActiveTab(i)}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-auto"
                  />
                  <div className="p-6">
                    <h3 className="font-serif text-lg font-semibold text-warm-gray-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="font-body-sm text-warm-gray-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 6: Problem → Solution ═══════════════ */
function ComparisonSection() {
  const painPoints = [
    { text: 'Ad-Supported Interface', icon: <X size={18} />, color: 'text-error' },
    { text: 'No Official BACB Export', icon: <X size={18} />, color: 'text-error' },
    { text: 'Dated, Clunky Design', icon: <X size={18} />, color: 'text-error' },
    { text: 'No Enterprise Options', icon: <X size={18} />, color: 'text-error' },
  ];

  const solutions = [
    {
      text: 'Beautiful, Ad-Free Experience',
      icon: <CheckCircle2 size={18} />,
      color: 'text-success',
    },
    {
      text: 'Official BACB Template Export (PDF)',
      icon: <CheckCircle2 size={18} />,
      color: 'text-success',
    },
    { text: 'Premium, Modern Design', icon: <CheckCircle2 size={18} />, color: 'text-success' },
    {
      text: 'Individual + Enterprise Tiers',
      icon: <CheckCircle2 size={18} />,
      color: 'text-success',
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="container-xl">
        <div className="text-center mb-16">
          <FadeUp>
            <p className="section-overline mb-4">WHY FIELDWORK BY BAKER</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900 max-w-[700px] mx-auto">
              Ripley Had 60,000 Users. We Saw 60,000 Reasons to Build Something Better.
            </h2>
          </FadeUp>
        </div>

        {/* The Old Way */}
        <FadeUp>
          <div className="mb-6">
            <p className="text-sm font-semibold text-warm-gray-400 uppercase tracking-wider mb-4">
              The Old Way
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {painPoints.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-warm-gray-50 border border-warm-gray-100 rounded-2xl p-5 flex items-center gap-3"
                >
                  <span className={point.color}>{point.icon}</span>
                  <span className="text-warm-gray-500 text-sm font-medium">
                    {point.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* Arrow */}
        <div className="flex justify-center my-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeSpring }}
            className="text-rose-500"
          >
            <svg
              width="32"
              height="48"
              viewBox="0 0 32 48"
              fill="none"
              className="animate-bounce"
            >
              <path
                d="M16 0V40M16 40L6 30M16 40L26 30"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>

        {/* The New Way */}
        <FadeUp delay={0.2}>
          <div>
            <p className="text-sm font-semibold text-success uppercase tracking-wider mb-4">
              The New Way
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {solutions.map((sol, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-success-light border border-success/20 rounded-2xl p-5 flex items-center gap-3"
                >
                  <span className={sol.color}>{sol.icon}</span>
                  <span className="text-warm-gray-700 text-sm font-medium">
                    {sol.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 7: BACB Export ═══════════════ */
function BACBExportSection() {
  const steps = [
    {
      num: '1',
      title: 'Log Your Hours',
      desc: 'Entries auto-categorize as restricted or unrestricted',
      icon: <Clock size={20} className="text-white" />,
    },
    {
      num: '2',
      title: 'Review & Verify',
      desc: 'Supervisor approves with one click',
      icon: <CheckCircle2 size={20} className="text-white" />,
    },
    {
      num: '3',
      title: 'Export BACB Form',
      desc: 'Download the official PDF, pre-filled and ready',
      icon: <FileOutput size={20} className="text-white" />,
    },
  ];

  return (
    <section className="bg-rose-50 py-24">
      <div className="container-xl">
        <div className="text-center mb-16">
          <FadeUp>
            <p className="section-overline mb-4">THE KILLER FEATURE</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
              Export Official BACB Forms in One Click
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="font-body-lg text-warm-gray-500 max-w-[640px] mx-auto">
              Stop filling out forms by hand. We auto-populate the exact BACB Monthly
              Fieldwork Verification Form (M-FVF) and Final Fieldwork Verification
              Form (F-FVF) from your logged data. Audit-ready, every time.
            </p>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Steps */}
          <StaggerContainer className="relative" staggerDelay={0.2}>
            {/* Vertical dotted line */}
            <div className="absolute left-[27px] top-[50px] bottom-[50px] w-px border-l-2 border-dashed border-rose-200" />

            {steps.map((step) => (
              <StaggerItem key={step.num}>
                <div className="relative flex items-start gap-5 mb-8 last:mb-0">
                  <div className="w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shrink-0 shadow-cta z-10">
                    {step.icon}
                  </div>
                  <div className="pt-2">
                    <h3 className="font-serif text-lg font-semibold text-warm-gray-900 mb-1">
                      {step.title}
                    </h3>
                    <p className="font-body-sm text-warm-gray-500">{step.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Form Preview */}
          <FadeUp delay={0.3}>
            <div className="relative rounded-2xl overflow-hidden shadow-hero-mockup">
              <img
                src="/feature-template-export.png"
                alt="BACB Form Export Preview"
                className="w-full h-auto"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="bg-success-light text-success px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Official BACB Format
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 8: Pricing ═══════════════ */
function PricingSection() {
  return (
    <section className="bg-white py-24">
      <div className="container-xl">
        <div className="text-center mb-16">
          <FadeUp>
            <p className="section-overline mb-4">SIMPLE PRICING</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
              Choose Your Path
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="font-body-md text-warm-gray-500 max-w-[560px] mx-auto">
              Start free for 14 days. No credit card required. Cancel anytime.
            </p>
          </FadeUp>
        </div>

        <StaggerContainer
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1000px] mx-auto"
          staggerDelay={0.15}
        >
          {pricingTiers.map((tier) => (
            <StaggerItem key={tier.id}>
              <div
                className={`relative bg-white rounded-2xl p-8 h-full flex flex-col ${
                  tier.borderColor
                    ? `border-2 ${tier.borderColor} shadow-card-hover`
                    : 'border border-warm-gray-100 shadow-card'
                }`}
              >
                {/* Badge */}
                {tier.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white ${tier.badgeColor}`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-serif text-xl font-semibold text-warm-gray-900 mb-2">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    {tier.monthlyPrice !== null ? (
                      <>
                        <span className="font-data-lg text-rose-500">
                          ${tier.monthlyPrice}
                        </span>
                        <span className="text-warm-gray-400 text-sm">/month</span>
                      </>
                    ) : (
                      <span className="font-serif text-2xl font-semibold text-gold">
                        Custom
                      </span>
                    )}
                  </div>
                  {tier.yearlyPrice !== null && (
                    <p className="text-xs text-warm-gray-400">
                      or ${tier.yearlyPrice}/year ({tier.yearlyDiscount})
                    </p>
                  )}
                  {tier.monthlyPrice === null && (
                    <p className="text-xs text-warm-gray-400">
                      Per-seat pricing for organizations
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-warm-gray-600"
                    >
                      <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={tier.id === 'ENTERPRISE' ? '/contact' : '/signup'}
                  className={`w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-250 ${
                    tier.ctaStyle === 'primary'
                      ? 'btn-primary'
                      : tier.ctaStyle === 'enterprise'
                      ? 'bg-gradient-enterprise text-white font-semibold py-3 px-6 rounded-xl shadow-gold-cta hover:shadow-lg hover:-translate-y-0.5 transition-all inline-flex items-center justify-center gap-2'
                      : 'btn-secondary'
                  }`}
                >
                  {tier.ctaText}
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeUp delay={0.4}>
          <div className="flex flex-col items-center mt-10 gap-3">
            <div className="flex items-center gap-3 text-warm-gray-300">
              <span className="text-xs font-semibold tracking-wide">APPLE PAY</span>
              <span className="text-xs">&bull;</span>
              <span className="text-xs font-semibold tracking-wide">VISA</span>
              <span className="text-xs">&bull;</span>
              <span className="text-xs font-semibold tracking-wide">MASTERCARD</span>
              <span className="text-xs">&bull;</span>
              <span className="text-xs font-semibold tracking-wide">AMEX</span>
            </div>
            <div className="flex items-center gap-1.5 text-warm-gray-400 text-xs">
              <Lock size={12} />
              <span>Secure payment processing</span>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 9: Testimonials ═══════════════ */
function TestimonialsSection() {
  return (
    <section className="bg-cream-50 py-24">
      <div className="container-xl">
        <div className="text-center mb-16">
          <FadeUp>
            <p className="section-overline mb-4">LOVED BY CANDIDATES</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900">
              Real Stories from Real BCBAs
            </h2>
          </FadeUp>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8" staggerDelay={0.15}>
          {testimonials.map((t) => (
            <StaggerItem key={t.id}>
              <div className="bg-white rounded-2xl p-8 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-350 relative">
                {/* Quote mark decoration */}
                <div className="absolute top-4 left-4 text-rose-100 font-serif text-[120px] leading-none select-none opacity-60">
                  &ldquo;
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1 mb-4 relative z-10">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={`${
                        i < t.rating ? 'text-gold fill-gold' : 'text-warm-gray-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="font-body-md text-warm-gray-600 mb-6 relative z-10 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 font-semibold text-sm">
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-warm-gray-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-warm-gray-400">
                      {t.role}, {t.location}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 10: FAQ Teaser ═══════════════ */
function FAQTeaserSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-20">
      <div className="container-lg">
        <div className="text-center mb-12">
          <FadeUp>
            <p className="section-overline mb-4">GOT QUESTIONS?</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display-md font-serif text-warm-gray-900">
              Everything You Need to Know
            </h2>
          </FadeUp>
        </div>

        <FadeUp delay={0.2}>
          <div className="max-w-[800px] mx-auto">
            {faqItems.map((item, i) => (
              <div
                key={item.id}
                className="border-b border-warm-gray-100 last:border-b-0"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left"
                >
                  <span className="font-semibold text-warm-gray-800 pr-8">
                    {item.question}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`text-warm-gray-400 shrink-0 transition-transform duration-300 ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: easeOut }}
                      className="overflow-hidden"
                    >
                      <p className="font-body-md text-warm-gray-500 pb-5">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={0.3}>
          <div className="text-center mt-8">
            <Link
              to="/faq"
              className="text-rose-500 font-semibold text-sm hover:text-rose-600 inline-flex items-center gap-1 transition-colors"
            >
              View All FAQs &rarr;
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ═══════════════ SECTION 11: Final CTA ═══════════════ */
function FinalCTASection() {
  return (
    <section className="relative min-h-[500px] flex items-center justify-center gradient-cta-bg overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />
        {/* Sparkle decorations */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-white/40"
            style={{
              top: `${15 + Math.random() * 70}%`,
              left: `${5 + Math.random() * 90}%`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          >
            <Sparkles size={16 + Math.random() * 12} />
          </motion.div>
        ))}
      </div>

      <div className="container-md relative z-10 text-center py-24">
        <StaggerContainer staggerDelay={0.15}>
          <StaggerItem>
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-4">
              START YOUR JOURNEY TODAY
            </p>
          </StaggerItem>
          <StaggerItem>
            <h2 className="font-display-md font-serif text-white mb-6">
              Ready to Transform Your Fieldwork Tracking?
            </h2>
          </StaggerItem>
          <StaggerItem>
            <p className="font-body-lg text-white/85 mb-10 max-w-[560px] mx-auto">
              Join thousands of BCBA candidates who&apos;ve made the switch. Your 14-day
              free trial awaits — no credit card, no ads, no stress.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                to="/signup"
                className="bg-white text-rose-500 font-semibold py-4 px-8 rounded-xl hover:bg-white/90 transition-colors inline-flex items-center gap-2 text-lg shadow-lg"
              >
                Start Your Free Trial
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/contact"
                className="border-2 border-white/60 text-white font-semibold py-4 px-8 rounded-xl hover:bg-white/10 transition-colors inline-flex items-center gap-2 text-lg"
              >
                Talk to Sales (Enterprise)
              </Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-white/70 text-xs">
              <span>Apple Pay accepted</span>
              <span className="hidden sm:inline">&bull;</span>
              <span className="flex items-center gap-1">
                <Lock size={12} />
                SSL Secure &middot; Cancel Anytime
              </span>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </section>
  );
}

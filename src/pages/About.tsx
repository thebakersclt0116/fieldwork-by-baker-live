import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useInView } from 'framer-motion';
import {
  Heart,
  ShieldCheck,
  Users,
  Sparkles,
  ArrowRight,
  Linkedin,
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
    transition: { staggerChildren: 0.1 },
  },
};

const staggerContainerSlow = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
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

import { useState, useEffect } from 'react';

/* ─── Values Data ─── */
const values = [
  {
    icon: Heart,
    title: 'Designed with Care',
    description:
      'We believe the tools you use every day should bring you joy. Every pixel, interaction, and feature is crafted with intention.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance First',
    description:
      "BACB requirements aren't suggestions — they're the law of your certification journey. We treat compliance with the seriousness it deserves.",
  },
  {
    icon: Users,
    title: 'Community Driven',
    description:
      'We listen to our users. Feature requests, feedback, and success stories shape our roadmap. This platform is built by the BCBA community.',
  },
  {
    icon: Sparkles,
    title: 'Excellence in Everything',
    description:
      'From security to customer support, we hold ourselves to the highest standard. Because your certification journey deserves nothing less.',
  },
];

/* ─── Stats Data ─── */
const stats = [
  { number: 10000, suffix: '+', label: 'Active Users' },
  { number: 48, suffix: '', label: 'States Represented' },
  { number: 2500000, suffix: '+', label: 'Hours Logged', displayFormat: '2.5M+' },
  { number: 99.9, suffix: '%', label: 'Uptime SLA', isDecimal: true },
];

/* ─── Team Data ─── */
const teamMembers = [
  {
    initials: 'FB',
    name: 'Dr. Felicia Baker',
    role: 'Founder & CEO',
    bio: 'BCBA-D, former clinic director who saw the need for better fieldwork tracking.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    initials: 'SC',
    name: 'Sarah Chen',
    role: 'Product Design Lead',
    bio: 'Passionate about creating beautiful, accessible tools for women in healthcare.',
    color: 'bg-gold-light text-gold',
  },
  {
    initials: 'MR',
    name: 'Marcus Rodriguez',
    role: 'Engineering Lead',
    bio: 'Full-stack engineer focused on security, compliance, and seamless user experiences.',
    color: 'bg-success-light text-success',
  },
];

/* ─── Stat Card ─── */
function StatCard({
  number,
  suffix,
  label,
  displayFormat,
  isDecimal,
  start,
}: {
  number: number;
  suffix: string;
  label: string;
  displayFormat?: string;
  isDecimal?: boolean;
  start: boolean;
}) {
  const counted = useCountUp(number, 1500, start);

  const formatted = displayFormat
    ? displayFormat
    : isDecimal
      ? `${(counted / 100).toFixed(1)}${suffix}`
      : counted >= 1000000
        ? `${(counted / 1000000).toFixed(1)}M${suffix}`
        : counted >= 1000
          ? `${Math.floor(counted / 1000)},${String(counted % 1000).padStart(3, '0')}${suffix}`
          : `${counted}${suffix}`;

  return (
    <motion.div
      className="bg-cream-50 rounded-2xl p-7 text-center"
      variants={fadeUpStagger}
    >
      <p className="text-data-lg text-rose-500 mb-1">
        {displayFormat && start ? displayFormat : formatted}
      </p>
      <p className="text-body-sm text-warm-gray-400">{label}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Main About Page
   ═══════════════════════════════════════════ */
export default function About() {
  const statsRef = useRef(null);
  const isStatsInView = useInView(statsRef, { once: true, margin: '-100px' });

  return (
    <div>
      {/* ── Section 1: Hero ── */}
      <section className="min-h-[55vh] flex items-center gradient-hero-bg relative overflow-hidden">
        {/* Decorative rose dots pattern */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute w-2 h-2 rounded-full bg-rose-300/40"
            style={{ top: '15%', left: '8%' }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-rose-300/30"
            style={{ top: '25%', left: '15%' }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-rose-300/40"
            style={{ top: '10%', right: '12%' }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-rose-300/30"
            style={{ top: '30%', right: '20%' }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-gold/30"
            style={{ top: '60%', left: '5%' }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-gold/20"
            style={{ bottom: '20%', right: '10%' }}
          />
        </div>

        <div className="container-lg relative z-10 pt-32 pb-16 text-center">
          <motion.span
            className="section-overline mb-4 block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Our Story
          </motion.span>

          <motion.h1
            className="font-display-lg font-serif text-warm-gray-900 mb-6 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
          >
            Built by People Who&apos;ve Been There
          </motion.h1>

          <motion.p
            className="font-body-lg text-warm-gray-600 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
          >
            Fieldwork by Baker was created because we experienced the
            frustration of tracking BCBA hours firsthand. We knew there had to
            be a better way.
          </motion.p>
        </div>
      </section>

      {/* ── Section 2: Mission Statement ── */}
      <section className="bg-rose-50 py-space-20">
        <div className="container-md text-center">
          <motion.blockquote
            className="font-display-sm font-serif italic text-warm-gray-800 leading-relaxed max-w-2xl mx-auto mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            &ldquo;Our mission is to make the BCBA journey less stressful and
            more organized. Every candidate deserves a beautiful, reliable tool
            to track their path to certification.&rdquo;
          </motion.blockquote>

          <motion.div
            className="w-2 h-2 rotate-45 bg-rose-300 mx-auto mb-4"
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
            }}
          />

          <motion.p
            className="text-body-sm text-warm-gray-400"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            — The Fieldwork by Baker Team
          </motion.p>
        </div>
      </section>

      {/* ── Section 3: The Story ── */}
      <section className="bg-white py-space-24">
        <div className="container-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Text */}
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <h2 className="font-display-md font-serif text-warm-gray-900 mb-8">
                Why We Built This
              </h2>
              <div className="space-y-5 font-body-lg text-warm-gray-600 leading-[1.75]">
                <p>
                  The BCBA certification journey is one of the most rewarding
                  paths in behavioral health — but tracking 2,000 hours of
                  fieldwork shouldn&apos;t feel like a second job. We watched
                  colleagues struggle with spreadsheets, paper logs, and outdated
                  tools that made an already stressful process even harder.
                </p>
                <p>
                  When we looked at existing solutions, we found one dominant
                  player that hadn&apos;t innovated in years. It was
                  ad-supported, visually dated, and missing critical features —
                  most importantly, the ability to export official BACB forms.
                  We knew the BCBA community deserved better.
                </p>
                <p>
                  So we built Fieldwork by Baker: a premium, beautifully
                  designed platform that handles every aspect of fieldwork
                  tracking with the professionalism and polish that BCBA
                  candidates — 80% of whom are women — actually want to use.
                </p>
              </div>
            </motion.div>

            {/* Right — Visual */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2, ease: easeOut }}
            >
              <div className="bg-cream-100 rounded-3xl p-8 lg:p-12 flex items-center justify-center min-h-[400px] relative">
                {/* Illustration placeholder */}
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-6">
                    <Sparkles size={40} className="text-rose-400" />
                  </div>
                  <p className="font-serif font-semibold text-warm-gray-700 text-xl mb-2">
                    Fieldwork by Baker
                  </p>
                  <p className="text-body-sm text-warm-gray-400">
                    Building the future of BCBA fieldwork tracking
                  </p>
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -right-4 bg-rose-50 text-rose-500 font-semibold text-body-sm px-5 py-2.5 rounded-full shadow-card border border-rose-100">
                  Est. 2025
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Values ── */}
      <section className="bg-cream-50 py-space-24">
        <div className="container-xl">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            What We Believe
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={staggerContainerSlow}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {values.map((value) => (
              <motion.div
                key={value.title}
                className="bg-white rounded-2xl p-8 text-center shadow-card transition-all duration-350 hover:-translate-y-1 hover:shadow-card-hover"
                variants={fadeUpStagger}
              >
                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
                  <value.icon size={28} className="text-rose-500" />
                </div>
                <h3 className="font-semibold text-warm-gray-800 mb-3 text-heading-sm">
                  {value.title}
                </h3>
                <p className="text-body-sm text-warm-gray-500 leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 5: By the Numbers ── */}
      <section className="bg-white py-space-16" ref={statsRef}>
        <div className="container-xl">
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate={isStatsInView ? 'visible' : 'hidden'}
          >
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                number={stat.number}
                suffix={stat.suffix}
                label={stat.label}
                displayFormat={stat.displayFormat}
                isDecimal={stat.isDecimal}
                start={isStatsInView}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 6: Team ── */}
      <section className="bg-cream-50 py-space-24">
        <div className="container-lg">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <h2 className="font-display-md font-serif text-warm-gray-900 mb-4">
              Meet the Team
            </h2>
            <p className="font-body-md text-warm-gray-500 max-w-xl mx-auto">
              Behavior analysts, designers, and engineers — united by a mission
              to transform the BCBA experience.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainerSlow}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {teamMembers.map((member) => (
              <motion.div
                key={member.name}
                className="bg-white rounded-2xl p-8 text-center shadow-card transition-all duration-350 hover:-translate-y-1 hover:shadow-card-hover"
                variants={fadeUpStagger}
              >
                {/* Avatar placeholder */}
                <div
                  className={`w-[120px] h-[120px] rounded-full ${member.color} flex items-center justify-center mx-auto mb-5 text-3xl font-bold font-serif`}
                >
                  {member.initials}
                </div>
                <h3 className="font-semibold text-warm-gray-800 mb-1 text-heading-sm">
                  {member.name}
                </h3>
                <p className="text-rose-500 text-body-sm font-medium mb-3">
                  {member.role}
                </p>
                <p className="text-body-sm text-warm-gray-500 leading-relaxed mb-4 max-w-[260px] mx-auto">
                  {member.bio}
                </p>
                <button className="text-warm-gray-400 hover:text-rose-500 transition-colors duration-200">
                  <Linkedin size={18} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 7: Bottom CTA ── */}
      <section className="py-space-20 gradient-cta-bg">
        <div className="container-md text-center">
          <motion.h2
            className="font-display-sm font-serif text-white mb-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Join Our Growing Community
          </motion.h2>

          <motion.p
            className="font-body-md text-white/80 mb-8 max-w-md mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
          >
            Be part of the movement to modernize BCBA fieldwork tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeOut }}
          >
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-rose-500 font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-250"
            >
              Start Free Trial
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

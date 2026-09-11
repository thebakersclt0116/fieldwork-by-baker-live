import { useState, useRef } from 'react';
import { Link } from 'react-router';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileText,
  Users,
  Star,
  Apple,
  ChevronDown,
  Mail,
  Sparkles,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ─── Animation helpers ─── */
const ease: [number, number, number, number] = [0.4, 0, 0.2, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp}
      transition={{ duration: 0.6, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerWrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
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

function StItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Data ─── */
const individualFeatures = [
  'Unlimited hour logging',
  'Calendar & timer entry',
  'Progress ring & basic analytics',
  '1 supervisor connection',
  'Monthly BACB M-FVF export',
  'Activity categorization',
  'Email support',
  'Mobile-responsive dashboard',
];

const professionalFeatures = [
  'Everything in Individual',
  'Unlimited supervisor connections',
  'Advanced analytics & insights',
  'Completion date forecast',
  'Priority BACB form export (M-FVF & F-FVF)',
  'Compliance alerts & warnings',
  'Bulk previous-month entry',
  'Dark mode',
  'Priority email & chat support',
];

const enterpriseFeatures = [
  'Everything in Professional',
  'Organization admin dashboard',
  'Unlimited team members',
  'Organization-wide analytics',
  'Compliance monitoring & alerts',
  'Bulk CSV user import',
  'Bulk form export for all users',
  'Custom branding & white-label',
  'SSO (SAML 2.0) integration',
  'Role-based access control',
  'API access',
  'Dedicated account manager',
  'SLA guarantee',
];

const faqItems = [
  {
    q: 'What payment methods do you accept?',
    a: 'We accept Apple Pay (recommended), all major credit and debit cards (Visa, Mastercard, American Express), and Google Pay. For Enterprise plans, we also accept ACH bank transfers and purchase orders.',
  },
  {
    q: 'Can I change my plan later?',
    a: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. When upgrading, you\'ll be charged the prorated difference. When downgrading, the new rate applies at your next billing cycle.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes! Every new account gets a 14-day free trial of the Professional plan. No credit card required to start. At the end of your trial, choose the plan that fits your needs.',
  },
  {
    q: 'What happens after my free trial?',
    a: 'You\'ll be prompted to choose a plan and enter payment information. If you decide not to continue, your data remains accessible in read-only mode for 30 days.',
  },
  {
    q: 'Can I get a refund?',
    a: 'We offer a 30-day money-back guarantee on all plans. If you\'re not satisfied, contact support within 30 days of your first payment for a full refund.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Yes. We use Stripe for all payment processing. Your card details never touch our servers. All transactions are PCI DSS compliant and encrypted with TLS 1.3.',
  },
  {
    q: 'Do you offer discounts for students or non-profits?',
    a: 'Yes! We offer a 40% discount for currently enrolled graduate students and registered non-profits. Contact support with your student ID or 501(c)(3) documentation to apply.',
  },
  {
    q: 'How does Enterprise billing work?',
    a: 'Enterprise plans are billed annually per seat. We offer volume discounts for organizations with 50+ users. Contact our sales team for a custom quote and onboarding plan.',
  },
];

/* ─── Toggle Switch ─── */
function BillingToggle({ isAnnual, onToggle }: { isAnnual: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`text-sm font-medium transition-colors cursor-pointer ${
          !isAnnual ? 'text-warm-gray-800' : 'text-warm-gray-400'
        }`}
        onClick={() => onToggle(false)}
      >
        Monthly
      </span>
      <button
        onClick={() => onToggle(!isAnnual)}
        className="relative w-14 h-8 rounded-full bg-rose-500 transition-colors duration-200 shrink-0"
        role="switch"
        aria-checked={isAnnual}
      >
        <motion.div
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
          animate={{ x: isAnnual ? 24 : 0 }}
          transition={{ duration: 0.2, ease }}
        />
      </button>
      <span
        className={`text-sm font-medium transition-colors cursor-pointer ${
          isAnnual ? 'text-warm-gray-800' : 'text-warm-gray-400'
        }`}
        onClick={() => onToggle(true)}
      >
        Annual
      </span>
      <span className="inline-flex items-center text-xs font-semibold text-success bg-success-light px-2.5 py-1 rounded-full">
        Save 20%
      </span>
    </div>
  );
}

/* ─── Animated Price ─── */
function AnimatedPrice({ monthly, annual, isAnnual, colorClass = 'text-warm-gray-800' }: {
  monthly: number;
  annual: number;
  isAnnual: boolean;
  colorClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="mb-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={isAnnual ? 'annual' : 'monthly'}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="flex items-baseline"
        >
          {inView && (
            <>
              <span className={`font-data-lg ${colorClass}`}>
                ${isAnnual ? annual : monthly}
              </span>
              <span className="text-warm-gray-400 text-sm ml-1">
                /{isAnnual ? 'year' : 'month'}
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── Pricing Card ─── */
function PricingCard({
  name,
  description,
  monthlyPrice,
  annualPrice,
  isAnnual,
  features,
  ctaLabel,
  ctaVariant,
  badge,
  badgeColor,
  borderColor,
  priceColor = 'text-warm-gray-800',
  raised = false,
  annualSubtext,
  subCta,
}: {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  isAnnual: boolean;
  features: string[];
  ctaLabel: string;
  ctaVariant: 'primary' | 'secondary' | 'gold';
  badge?: string;
  badgeColor?: string;
  borderColor?: string;
  priceColor?: string;
  raised?: boolean;
  annualSubtext?: string;
  subCta?: React.ReactNode;
}) {
  const ctaClasses = {
    primary: 'btn-primary w-full justify-center',
    secondary: 'btn-secondary w-full justify-center',
    gold: 'w-full justify-center text-white font-semibold py-3.5 px-7 rounded-2xl transition-all duration-250 hover:-translate-y-0.5',
  };

  const ctaStyles = ctaVariant === 'gold'
    ? { background: 'linear-gradient(135deg, #D4A574 0%, #E8C9A0 100%)', boxShadow: '0 4px 16px rgba(212,165,116,0.3)' }
    : {};

  return (
    <div
      className={`relative bg-white rounded-3xl p-8 lg:p-10 flex flex-col h-full ${
        raised ? 'lg:-translate-y-2' : ''
      } ${borderColor || ''}`}
      style={{
        borderWidth: borderColor ? '2px' : '1px',
        borderStyle: 'solid',
        boxShadow: raised
          ? '0 12px 40px rgba(233,93,112,0.12)'
          : '0 2px 12px rgba(30,26,24,0.06), 0 0 1px rgba(30,26,24,0.08)',
      }}
    >
      {badge && (
        <div
          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-5 py-1.5 rounded-full ${badgeColor}`}
        >
          {badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-warm-gray-800 mb-1">{name}</h3>
        <p className="text-sm text-warm-gray-400">{description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <AnimatedPrice monthly={monthlyPrice} annual={annualPrice} isAnnual={isAnnual} colorClass={priceColor} />
        {isAnnual && annualSubtext && (
          <p className="text-xs text-success font-medium">{annualSubtext}</p>
        )}
      </div>

      <div className="h-px bg-warm-gray-100 mb-6" />

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
            <span className="text-sm text-warm-gray-600">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div>
        <Link to="/signup" className={ctaClasses[ctaVariant]} style={ctaStyles}>
          {ctaLabel}
          <ArrowRight size={16} />
        </Link>
        {subCta && <div className="mt-3 text-center">{subCta}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PRICING PAGE
   ═══════════════════════════════════════════════════ */
export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div>
      {/* ═══════════════════════════════════════════
          SECTION 1 — Hero
      ═══════════════════════════════════════════ */}
      <section className="relative min-h-[50vh] flex items-center justify-center gradient-hero-bg overflow-hidden">
        <div className="container-lg relative z-10 text-center pt-32 pb-16">
          <FadeUp delay={0.2}>
            <span className="section-overline inline-flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Transparent Pricing
            </span>
          </FadeUp>

          <FadeUp delay={0.3}>
            <h1 className="font-display-lg font-serif text-warm-gray-900 mb-6 max-w-xl mx-auto">
              Simple Plans, Powerful Results
            </h1>
          </FadeUp>

          <FadeUp delay={0.5}>
            <p className="font-body-lg text-warm-gray-500 max-w-lg mx-auto mb-10">
              Start with a 14-day free trial. No credit card required. Upgrade, downgrade, or cancel anytime.
            </p>
          </FadeUp>

          {/* Trust badges */}
          <FadeUp delay={0.6}>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <span className="inline-flex items-center gap-1.5 text-xs text-warm-gray-500">
                <Lock size={13} />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-warm-gray-500">
                <ShieldCheck size={13} />
                Cancel anytime
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-warm-gray-500">
                <Sparkles size={13} />
                14-day free trial
              </span>
            </div>
          </FadeUp>

          {/* Payment icons */}
          <FadeUp delay={0.7}>
            <div className="flex items-center justify-center gap-4 mt-8">
              {/* Apple Pay */}
              <div className="w-[60px] h-8 bg-black rounded flex items-center justify-center">
                <Apple size={18} className="text-white" />
              </div>
              {/* Visa */}
              <div className="w-[40px] h-6 opacity-50 grayscale">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" rx="4" fill="#1A1F71" />
                  <text x="24" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Inter">VISA</text>
                </svg>
              </div>
              {/* Mastercard */}
              <div className="w-[40px] h-6 opacity-50 grayscale">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" rx="4" fill="white" />
                  <circle cx="18" cy="16" r="8" fill="#EB001B" />
                  <circle cx="30" cy="16" r="8" fill="#F79E1B" />
                </svg>
              </div>
              {/* Amex */}
              <div className="w-[40px] h-6 opacity-50 grayscale">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" rx="4" fill="#006FCF" />
                  <text x="24" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Inter">AMEX</text>
                </svg>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — Billing Toggle
      ═══════════════════════════════════════════ */}
      <section className="py-8 flex justify-center bg-white border-b border-warm-gray-100">
        <BillingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3 — Pricing Tiers
      ═══════════════════════════════════════════ */}
      <section className="bg-white pt-12 pb-24">
        <div className="container-xl">
          <div className="max-w-[1100px] mx-auto grid md:grid-cols-3 gap-6 items-start">
            {/* Individual */}
            <StItem>
              <PricingCard
                name="Individual"
                description="For solo BCBA candidates"
                monthlyPrice={12}
                annualPrice={108}
                isAnnual={isAnnual}
                features={individualFeatures}
                ctaLabel="Start Free Trial"
                ctaVariant="secondary"
                annualSubtext="$9/month, billed annually"
                subCta={
                  <span className="text-xs text-warm-gray-400">No credit card required</span>
                }
              />
            </StItem>

            {/* Professional — Most Popular */}
            <StItem>
              <PricingCard
                name="Professional"
                description="For serious candidates & supervisors"
                monthlyPrice={24}
                annualPrice={216}
                isAnnual={isAnnual}
                features={professionalFeatures}
                ctaLabel="Start Free Trial"
                ctaVariant="primary"
                badge="Most Popular"
                badgeColor="bg-rose-500"
                borderColor="border-rose-400"
                priceColor="text-rose-500"
                raised
                annualSubtext="$18/month, billed annually"
                subCta={
                  <span className="text-xs text-warm-gray-400">No credit card required</span>
                }
              />
            </StItem>

            {/* Enterprise */}
            <StItem>
              <div
                className="relative bg-white rounded-3xl p-8 lg:p-10 flex flex-col h-full"
                style={{
                  border: '2px solid #D4A574',
                  boxShadow: '0 8px 32px rgba(212,165,116,0.1)',
                }}
              >
                {/* Badge */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-5 py-1.5 rounded-full bg-gold">
                  Enterprise
                </div>

                <div className="mb-6">
                  <h3 className="text-2xl font-semibold text-warm-gray-800 mb-1">Enterprise</h3>
                  <p className="text-sm text-warm-gray-400">For clinics, universities &amp; organizations</p>
                </div>

                <div className="mb-6">
                  <span className="font-display-sm font-serif text-gold">Custom</span>
                  <p className="text-sm text-warm-gray-400 mt-1">Per-seat pricing</p>
                  <p className="text-sm text-warm-gray-500 mt-0.5">Contact us for a quote</p>
                </div>

                <div className="h-px bg-warm-gray-100 mb-6" />

                <ul className="space-y-3 flex-1 mb-8">
                  {enterpriseFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
                      <span className="text-sm text-warm-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <Link
                    to="/contact"
                    className="w-full justify-center text-white font-semibold py-3.5 px-7 rounded-2xl transition-all duration-250 hover:-translate-y-0.5 inline-flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #D4A574 0%, #E8C9A0 100%)',
                      boxShadow: '0 4px 16px rgba(212,165,116,0.3)',
                    }}
                  >
                    Contact Sales
                    <ArrowRight size={16} />
                  </Link>
                  <div className="mt-3 text-center">
                    <a href="mailto:sales@fieldworkbybaker.com" className="text-xs text-gold hover:underline">
                      sales@fieldworkbybaker.com
                    </a>
                  </div>
                </div>
              </div>
            </StItem>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4 — Apple Pay Highlight
      ═══════════════════════════════════════════ */}
      <section className="bg-rose-50 py-16 lg:py-20">
        <div className="container-md">
          <div className="grid lg:grid-cols-[40%_60%] gap-10 items-center max-w-3xl mx-auto">
            {/* Left — Apple Pay mockup */}
            <FadeUp>
              <div className="relative flex flex-col items-center">
                {/* Glow */}
                <div className="absolute inset-0 bg-rose-200/20 blur-3xl rounded-full" />
                {/* Phone mockup */}
                <div className="relative bg-warm-gray-900 rounded-[2rem] p-4 w-[220px] shadow-2xl">
                  <div className="bg-warm-gray-800 rounded-[1.5rem] p-5 text-center">
                    <Apple size={28} className="text-white mx-auto mb-4" />
                    <p className="text-white/60 text-xs mb-1">Fieldwork by Baker</p>
                    <p className="text-white font-semibold text-sm mb-4">Professional — Annual</p>
                    <p className="font-data-lg text-white text-2xl mb-6">$216.00</p>
                    {/* Apple Pay button */}
                    <div className="bg-black rounded-lg py-3 px-4 flex items-center justify-center gap-2 mb-4 border border-white/10">
                      <Apple size={16} className="text-white" />
                      <span className="text-white text-sm font-medium">Pay</span>
                    </div>
                    <p className="text-white/40 text-[10px]">Double-click side button to pay</p>
                  </div>
                </div>
                {/* Floating badge */}
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-3 bg-rose-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg"
                >
                  Recommended
                </motion.div>
              </div>
            </FadeUp>

            {/* Right — Text */}
            <StaggerWrap>
              <StItem>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
                    <Apple size={24} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-warm-gray-800">Pay with Apple Pay</h3>
                </div>
              </StItem>
              <StItem>
                <p className="font-body-md text-warm-gray-500 mb-6">
                  The fastest, most secure way to subscribe. Authenticate with Face ID or Touch ID. Your card details are never stored on our servers.
                </p>
              </StItem>
              <StItem>
                <ul className="space-y-3 mb-6">
                  {[
                    'One-tap checkout',
                    'Face ID / Touch ID authentication',
                    'No card numbers entered',
                    'Private and secure',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle size={16} className="text-rose-500 shrink-0" />
                      <span className="text-sm text-warm-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </StItem>
            </StaggerWrap>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — What's Included
      ═══════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="container-xl">
          <FadeUp>
            <h2 className="font-display-md font-serif text-warm-gray-900 text-center mb-12">
              Every Plan Includes
            </h2>
          </FadeUp>

          <StaggerWrap className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: 'BACB 2027 Compliant', desc: 'Fully updated for the latest BACB requirements' },
              { icon: Lock, title: 'Bank-Level Security', desc: '256-bit SSL encryption, HIPAA compliant' },
              { icon: FileText, title: 'Form Export Ready', desc: 'Generate BACB forms anytime (tier limits apply)' },
              { icon: Users, title: 'Supervisor Collaboration', desc: 'Connect and collaborate with your supervisor' },
            ].map((item) => (
              <StItem key={item.title}>
                <div className="bg-cream-50 rounded-3xl p-7 text-center hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4">
                    <item.icon size={28} />
                  </div>
                  <h4 className="font-semibold text-warm-gray-800 text-[15px] mb-2">{item.title}</h4>
                  <p className="font-body-sm text-warm-gray-500">{item.desc}</p>
                </div>
              </StItem>
            ))}
          </StaggerWrap>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6 — FAQ
      ═══════════════════════════════════════════ */}
      <section className="bg-cream-50 py-20">
        <div className="container-lg">
          <FadeUp>
            <h2 className="font-display-md font-serif text-warm-gray-900 text-center mb-12">
              Billing Questions
            </h2>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="max-w-[720px] mx-auto">
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="bg-white rounded-2xl border border-warm-gray-100 px-6 overflow-hidden shadow-xs data-[state=open]:shadow-card transition-shadow duration-200"
                  >
                    <AccordionTrigger className="text-left text-sm font-semibold text-warm-gray-800 py-5 hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-warm-gray-500 pb-5 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 7 — Enterprise CTA
      ═══════════════════════════════════════════ */}
      <section className="bg-warm-gray-900 py-20">
        <div className="container-lg text-center">
          <FadeUp>
            <h2 className="font-display-sm font-serif text-white mb-4">
              Need 10+ Seats? Let&apos;s Talk.
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="text-warm-gray-300 max-w-lg mx-auto mb-8">
              We&apos;ll customize a plan for your organization&apos;s size, compliance needs, and budget. Includes a dedicated onboarding specialist.
            </p>
          </FadeUp>
          <FadeUp delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/contact"
                className="btn-primary inline-flex"
              >
                Request a Demo
                <ArrowRight size={16} />
              </Link>
              <a
                href="mailto:sales@fieldworkbybaker.com"
                className="inline-flex items-center gap-2 text-warm-gray-300 font-medium px-6 py-3.5 rounded-2xl border border-warm-gray-700 hover:bg-warm-gray-800 hover:text-white transition-all duration-200"
              >
                <Mail size={16} />
                Email Sales
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 8 — Testimonial
      ═══════════════════════════════════════════ */}
      <section className="bg-white py-16">
        <div className="container-md">
          <FadeUp>
            <div className="bg-cream-50 rounded-3xl p-8 lg:p-12 text-center relative">
              {/* Quote marks */}
              <div className="text-rose-200 text-7xl font-serif leading-none select-none mb-2">&ldquo;</div>

              <div className="flex justify-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={20} className="text-gold fill-gold" />
                ))}
              </div>

              <blockquote className="text-warm-gray-700 text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mb-6 font-serif italic">
                We switched our entire clinic from spreadsheets to Fieldwork by Baker Enterprise. The ROI was immediate — our compliance officer went from spending 20 hours a month on documentation to 2 hours.
              </blockquote>

              <p className="font-semibold text-warm-gray-800 text-sm">Melissa K., Clinical Director</p>
              <p className="text-warm-gray-400 text-xs">Thrive Behavioral Health, Dallas</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 9 — Bottom CTA
      ═══════════════════════════════════════════ */}
      <section className="gradient-cta-bg py-20">
        <div className="container-md text-center">
          <FadeUp>
            <h2 className="font-display-md font-serif text-white mb-4">
              Start Your 14-Day Free Trial
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="font-body-lg text-white/80 mb-8 max-w-lg mx-auto">
              No credit card. No ads. No commitment.
            </p>
          </FadeUp>
          <FadeUp delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-white text-rose-500 font-semibold px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-250"
              >
                Get Started Free
                <ArrowRight size={16} />
              </Link>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-transparent text-white font-semibold px-7 py-3.5 rounded-2xl border-2 border-white/40 hover:bg-white/10 transition-all duration-250"
              >
                Compare Plans
                <ChevronDown size={16} />
              </button>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}

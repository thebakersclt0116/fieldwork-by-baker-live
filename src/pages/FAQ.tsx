import { useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mail, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

/* ------------------------------------------------------------------ */
/*  TYPES & DATA                                                       */
/* ------------------------------------------------------------------ */

type Category =
  | 'All'
  | 'Getting Started'
  | 'Tracking Hours'
  | 'Supervisors'
  | 'Billing'
  | 'Enterprise'
  | 'BACB Compliance';

interface FAQItem {
  question: string;
  answer: string;
  category: Category;
}

const categories: Category[] = [
  'All',
  'Getting Started',
  'Tracking Hours',
  'Supervisors',
  'Billing',
  'Enterprise',
  'BACB Compliance',
];

const faqData: FAQItem[] = [
  /* ── Getting Started ── */
  {
    category: 'Getting Started',
    question: 'What is Fieldwork by Baker?',
    answer:
      'Fieldwork by Baker is a premium web application for tracking BCBA and BCaBA supervised fieldwork hours. It is fully compliant with 2027 BACB requirements and includes features like hour logging, progress analytics, supervisor collaboration, and official BACB form export.',
  },
  {
    category: 'Getting Started',
    question: 'Is it BACB compliant?',
    answer:
      'Yes. Our platform is built specifically around the 2027 BACB fieldwork requirements. We validate hour limits, unrestricted percentages, supervision contacts, and all exported forms match official BACB templates exactly.',
  },
  {
    category: 'Getting Started',
    question: 'How do I get started?',
    answer:
      'Click "Sign Up" and complete our quick onboarding wizard. You will select your role (supervisee, supervisor, or organization admin), enter your account details, set up your profile, and you are ready to start tracking hours.',
  },
  {
    category: 'Getting Started',
    question: 'Can I import from another tracker?',
    answer:
      'Yes. Our bulk import tool lets you upload hours from spreadsheets or other tracking systems via CSV. Our support team can also assist with the migration to ensure no data is lost.',
  },
  {
    category: 'Getting Started',
    question: 'Is there a free trial?',
    answer:
      'Yes! Every new account gets a 14-day free trial with full access to Professional features. No credit card is required to start your trial.',
  },
  {
    category: 'Getting Started',
    question: 'Can I use this on my phone?',
    answer:
      'Absolutely. Fieldwork by Baker is fully responsive and works beautifully on mobile browsers. We recommend bookmarking it to your home screen for quick access.',
  },
  {
    category: 'Getting Started',
    question: 'Is my data secure?',
    answer:
      'Yes. We use 256-bit SSL encryption, are HIPAA compliant, and follow SOC 2 Type II security standards. Your data is encrypted at rest and in transit. We never sell your information.',
  },
  {
    category: 'Getting Started',
    question: 'What happens to my data if I cancel?',
    answer:
      'Your data remains accessible in read-only mode for 30 days after cancellation. You can export all your hours and forms before your account closes. We also offer a 30-day money-back guarantee.',
  },

  /* ── Tracking Hours ── */
  {
    category: 'Tracking Hours',
    question: 'How do I log hours?',
    answer:
      'From your dashboard, click "Log Hours" or select a date on your calendar. Enter the start and end times, select your fieldwork type (Supervised or Concentrated), choose the activity category (Restricted or Unrestricted), select your supervisor, add a note if needed, and save.',
  },
  {
    category: 'Tracking Hours',
    question: 'What is the difference between restricted and unrestricted?',
    answer:
      'Restricted activities involve direct delivery of therapeutic procedures to clients (like implementing behavior plans). Unrestricted activities represent the work of overseeing programs — assessments, data analysis, program writing, training staff. You need at least 60% unrestricted hours.',
  },
  {
    category: 'Tracking Hours',
    question: 'How do concentrated hours work?',
    answer:
      'Concentrated supervised fieldwork requires 1,500 hours instead of 2,000, but with more intensive supervision. Concentrated hours count as 1.33x regular hours. The system automatically tracks which type you are accruing and validates against BACB requirements.',
  },
  {
    category: 'Tracking Hours',
    question: 'What are the monthly limits?',
    answer:
      'BACB allows 20–130 hours per month. Our system validates your entries in real-time and alerts you if you are approaching either limit, ensuring you stay compliant every month.',
  },
  {
    category: 'Tracking Hours',
    question: 'Can I edit or delete an entry?',
    answer:
      'Yes, you can edit any entry you have created. If your supervisor has already verified an entry, edits will reset the verification status and notify your supervisor of the change.',
  },
  {
    category: 'Tracking Hours',
    question: 'What are the 2027 BACB hour requirements?',
    answer:
      'Option A: 2,000 supervised fieldwork hours. Option B: 1,500 concentrated supervised fieldwork hours. Option C: A combination where concentrated hours count as 1.33x. You must complete within 5 continuous years with 20–130 hours per month.',
  },
  {
    category: 'Tracking Hours',
    question: 'How does the system validate my hours?',
    answer:
      'We validate in real-time: monthly hour limits (20–130), unrestricted percentage (minimum 60%), supervision contact requirements (minimum 4 per month), observation requirements (minimum 1 per month), and the 5-year completion window.',
  },
  {
    category: 'Tracking Hours',
    question: 'What is the quick-add timer?',
    answer:
      'The timer lets you start a live session when you begin your fieldwork. When you are done, stop the timer and the system creates a log entry with the correct duration. You just need to add the activity details.',
  },

  /* ── Supervisors ── */
  {
    category: 'Supervisors',
    question: 'How do I link my supervisor?',
    answer:
      'Send a connection request from your dashboard using your supervisor\'s email. Once they accept, they can view your hours, verify entries, and sign your forms.',
  },
  {
    category: 'Supervisors',
    question: 'Can I have multiple supervisors?',
    answer:
      'Yes, on the Professional and Enterprise plans. This is essential if you are receiving supervision at an organization with multiple supervisors. Each supervisor needs to be in your supervision contract.',
  },
  {
    category: 'Supervisors',
    question: 'How does supervisor verification work?',
    answer:
      'Your supervisor reviews your logged hours from their dashboard. They can approve individual entries or bulk-approve entire months. Once approved, the hours count toward your verified total and can be included in BACB form exports.',
  },
  {
    category: 'Supervisors',
    question: 'What does the supervisor dashboard include?',
    answer:
      'Supervisors see all linked supervisees, their progress summaries, recent entries awaiting verification, compliance alerts, and can approve hours or leave feedback — all from one dashboard.',
  },

  /* ── Billing ── */
  {
    category: 'Billing',
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards, Apple Pay, and Google Pay. Apple Pay is our fastest, most secure checkout option and is prominently featured during signup.',
  },
  {
    category: 'Billing',
    question: 'How does the free trial work?',
    answer:
      'You get 14 days of full Professional plan access. No credit card is required. At the end of your trial, choose a plan that fits your needs or continue with our free tier.',
  },
  {
    category: 'Billing',
    question: 'Can I cancel anytime?',
    answer:
      'Yes, you can cancel your subscription at any time from your account settings. Your access continues until the end of your billing period. We also offer a 30-day money-back guarantee.',
  },
  {
    category: 'Billing',
    question: 'How do I upgrade my plan?',
    answer:
      'Go to Settings → Billing and select your new plan. The price difference is prorated for the remainder of your billing cycle. Your new features are available immediately.',
  },

  /* ── Enterprise ── */
  {
    category: 'Enterprise',
    question: 'How does organization management work?',
    answer:
      'Enterprise admins get a dedicated dashboard to manage candidates, supervisors, and teams. You can view organization-wide compliance status, bulk import users, set custom policies, and generate aggregate reports.',
  },
  {
    category: 'Enterprise',
    question: 'Can I bulk import users?',
    answer:
      'Yes. Upload a CSV with your team\'s details and we will create accounts, assign roles, and send invitation emails automatically. Our support team can help with large migrations.',
  },
  {
    category: 'Enterprise',
    question: 'Is there an API?',
    answer:
      'Yes. Our REST API allows Enterprise customers to integrate fieldwork data with HR systems, learning management systems, and internal dashboards. Full API documentation is available to Enterprise clients.',
  },
  {
    category: 'Enterprise',
    question: 'Can we white-label the platform?',
    answer:
      'Yes, Enterprise plans include custom branding options — your logo, colors, and domain. Your candidates will see a branded experience while using our full feature set.',
  },

  /* ── BACB Compliance ── */
  {
    category: 'BACB Compliance',
    question: 'Is this 2027 compliant?',
    answer:
      'Yes. Fieldwork by Baker is built from the ground up around the 2027 BACB requirements. All validations, form exports, and compliance checks reflect the latest BACB standards.',
  },
  {
    category: 'BACB Compliance',
    question: 'What forms can I export?',
    answer:
      'We support all four official BACB forms: Monthly Fieldwork Verification Form (M-FVF) for Individual Supervisors, M-FVF for Multiple Supervisors, Final Fieldwork Verification Form (F-FVF) for Individual Supervisors, and F-FVF for Multiple Supervisors.',
  },
  {
    category: 'BACB Compliance',
    question: 'How does the form export work?',
    answer:
      'When you are ready to export, go to your Monthly Summary and click "Export BACB Form." The system auto-populates all fields from your logged hours — dates, times, activity types, supervisor information, and totals. The PDF matches the official BACB template exactly.',
  },
  {
    category: 'BACB Compliance',
    question: 'Is my data secure and private?',
    answer:
      'Absolutely. We use 256-bit SSL encryption, are HIPAA compliant, and follow SOC 2 Type II security standards. Your data is encrypted at rest and in transit. We perform regular security audits and never sell or share your personal information.',
  },
];

/* ------------------------------------------------------------------ */
/*  ANIMATION VARIANTS                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItem, setOpenItem] = useState<string>('');

  const filtered = faqData.filter((item) => {
    const catMatch =
      activeCategory === 'All' || item.category === activeCategory;
    const searchMatch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return catMatch && searchMatch;
  });

  const grouped = filtered.reduce<Record<string, FAQItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="flex-1">
      {/* ============================================================ */}
      {/* HERO SECTION                                                  */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #FFF5F7 0%, #FFFCF9 40%, #FFF8F3 70%, #FBF3EB 100%)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-[500px] h-[500px] rounded-full opacity-30"
            style={{
              background:
                'radial-gradient(ellipse at 30% 20%, rgba(233,93,112,0.12) 0%, transparent 60%)',
              top: '-10%',
              left: '-5%',
            }}
          />
        </div>

        <div className="container-lg relative pt-32 pb-16 text-center">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="section-overline mb-4"
          >
            Help Center
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="font-display-md font-serif text-warm-gray-900 mb-4"
          >
            Questions? We&apos;ve Got Answers.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="font-body-lg text-warm-gray-500 max-w-2xl mx-auto mb-8"
          >
            Everything you need to know about Fieldwork by Baker and BCBA
            fieldwork requirements.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="relative max-w-lg mx-auto"
          >
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-gray-400 pointer-events-none"
            />
            <Input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-2xl border-warm-gray-200 bg-white text-warm-gray-700 placeholder:text-warm-gray-300 shadow-sm text-base focus-visible:border-rose-400 focus-visible:ring-rose-400/20"
            />
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CATEGORY TABS                                                 */}
      {/* ============================================================ */}
      <section className="sticky top-[72px] z-40 bg-[rgba(255,252,249,0.95)] backdrop-blur-md border-b border-warm-gray-100/50 py-3">
        <div className="container-lg flex items-center justify-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setOpenItem('');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-warm-gray-100 text-warm-gray-500 hover:bg-rose-50 hover:text-warm-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FAQ ACCORDION SECTIONS                                        */}
      {/* ============================================================ */}
      <section className="bg-white py-16">
        <div className="container-lg max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {Object.keys(grouped).length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <p className="text-warm-gray-500 text-lg mb-2">
                  No questions match your search.
                </p>
                <p className="text-warm-gray-400 text-sm">
                  Try a different category or search term.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={activeCategory + searchQuery}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {Object.entries(grouped).map(([category, items]) => (
                  <motion.div key={category} variants={fadeUp} className="mb-12">
                    <h2 className="text-xl font-semibold text-warm-gray-800 mb-6">
                      {category}
                    </h2>
                    <Accordion
                      type="single"
                      collapsible
                      value={openItem}
                      onValueChange={setOpenItem}
                      className="w-full"
                    >
                      {items.map((item, idx) => (
                        <AccordionItem
                          key={`${category}-${idx}`}
                          value={`${category}-${idx}`}
                          className="border border-warm-gray-100 rounded-xl mb-3 overflow-hidden data-[state=open]:border-rose-200 transition-colors duration-200"
                        >
                          <AccordionTrigger className="px-5 py-4 text-left text-warm-gray-800 hover:text-rose-500 hover:no-underline font-medium text-sm md:text-base [&[data-state=open]]:text-rose-500">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="px-5 pb-4 text-warm-gray-500 text-sm leading-relaxed">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ============================================================ */}
      {/* STILL HAVE QUESTIONS CTA                                      */}
      {/* ============================================================ */}
      <section className="bg-rose-50 py-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="container-md text-center"
        >
          <h2 className="font-display-sm font-serif text-warm-gray-900 mb-3">
            Can&apos;t Find What You&apos;re Looking For?
          </h2>
          <p className="text-warm-gray-500 mb-10 max-w-lg mx-auto">
            Our support team is here to help. Reach out and we&apos;ll get back
            to you within 24 hours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact" className="btn-primary">
              Contact Support
              <ArrowRight size={16} />
            </Link>
            <a href="mailto:support@fieldworkbybaker.com" className="btn-secondary">
              <Mail size={16} />
              Email Us
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

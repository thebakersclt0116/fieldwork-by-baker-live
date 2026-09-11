import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  ArrowRight,
  Clock,
  FileText,
  BookOpen,
  GraduationCap,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const categories = [
  'All',
  'Fieldwork Tips',
  'BACB Updates',
  'Supervision',
  'Career Advice',
  'Study Guides',
] as const;

type Category = (typeof categories)[number];

interface Article {
  id: number;
  title: string;
  excerpt: string;
  category: Category;
  readTime: string;
  date: string;
  icon: React.ReactNode;
  gradient: string;
}

const articles: Article[] = [
  {
    id: 1,
    title: 'Understanding the 2027 BACB Fieldwork Requirements',
    excerpt:
      'The BACB has updated its fieldwork requirements for 2027. Here is everything you need to know to stay compliant and on track.',
    category: 'BACB Updates',
    readTime: '8 min read',
    date: 'January 2025',
    icon: <FileText size={24} />,
    gradient: 'from-[#E85D70] to-[#F97B8A]',
  },
  {
    id: 2,
    title: 'Restricted vs Unrestricted Activities: A Complete Guide',
    excerpt:
      'The 60/40 rule explained with real-world examples from practicing BCBAs and how to categorize your hours correctly.',
    category: 'Fieldwork Tips',
    readTime: '6 min read',
    date: 'December 2024',
    icon: <Layers size={24} />,
    gradient: 'from-[#6BA3D6] to-[#8BB8E0]',
  },
  {
    id: 3,
    title: 'How to Choose the Right BCBA Supervisor',
    excerpt:
      'What to look for in a BCBA supervisor, the essential questions to ask, and red flags you should never ignore.',
    category: 'Supervision',
    readTime: '5 min read',
    date: 'December 2024',
    icon: <Briefcase size={24} />,
    gradient: 'from-[#D4A574] to-[#E8C9A0]',
  },
  {
    id: 4,
    title: 'Maximizing Your Concentrated Supervised Fieldwork Hours',
    excerpt:
      'Strategies for getting the most value from every supervisory contact and completing your 1,500 concentrated hours.',
    category: 'Fieldwork Tips',
    readTime: '7 min read',
    date: 'November 2024',
    icon: <Clock size={24} />,
    gradient: 'from-[#7EB89A] to-[#9BCBB3]',
  },
  {
    id: 5,
    title: '5 Common Mistakes When Tracking Fieldwork Hours',
    excerpt:
      'Learn from the errors that delay certification for too many candidates. Avoid these pitfalls and stay on schedule.',
    category: 'Fieldwork Tips',
    readTime: '4 min read',
    date: 'November 2024',
    icon: <BookOpen size={24} />,
    gradient: 'from-[#E8A838] to-[#F0BC5E]',
  },
  {
    id: 6,
    title: 'Preparing for Your BCBA Exam: Study Strategies',
    excerpt:
      'Proven study techniques, timeline recommendations, and resources to help you pass the BCBA exam on your first attempt.',
    category: 'Study Guides',
    readTime: '9 min read',
    date: 'October 2024',
    icon: <GraduationCap size={24} />,
    gradient: 'from-[#A8998E] to-[#C4B8AF]',
  },
  {
    id: 7,
    title: 'Navigating the Monthly Fieldwork Verification Form',
    excerpt:
      'A step-by-step walkthrough of the M-FVF, including common errors and how to ensure supervisor sign-off every time.',
    category: 'BACB Updates',
    readTime: '5 min read',
    date: 'October 2024',
    icon: <FileText size={24} />,
    gradient: 'from-[#E85D70] to-[#F97B8A]',
  },
  {
    id: 8,
    title: 'Enterprise Fieldwork Management Best Practices',
    excerpt:
      'How organizations can streamline fieldwork tracking across multiple candidates, supervisors, and compliance requirements.',
    category: 'Career Advice',
    readTime: '6 min read',
    date: 'September 2024',
    icon: <Briefcase size={24} />,
    gradient: 'from-[#6BA3D6] to-[#8BB8E0]',
  },
  {
    id: 9,
    title: 'Supervision Contracts: What You Need to Know',
    excerpt:
      'Everything about BCBA supervision contracts — what to include, how to structure them, and BACB compliance requirements.',
    category: 'Supervision',
    readTime: '7 min read',
    date: 'September 2024',
    icon: <FileText size={24} />,
    gradient: 'from-[#D4A574] to-[#E8C9A0]',
  },
];

const resourceLinks = [
  { label: 'BACB Official Website', url: 'https://www.bacb.com' },
  { label: 'BCBA Handbook (2025)', url: 'https://www.bacb.com' },
  { label: 'BACB Supervised Fieldwork FAQs', url: 'https://www.bacb.com' },
  { label: 'BCBA Application Self-Assessment Tool', url: 'https://www.bacb.com' },
  { label: 'ABAI Accreditation', url: 'https://www.abai.org' },
  { label: 'BACB Newsletter', url: 'https://www.bacb.com' },
  { label: 'Recent & Upcoming Changes', url: 'https://www.bacb.com' },
  { label: 'BACB Ethics Code', url: 'https://www.bacb.com' },
];

/* ------------------------------------------------------------------ */
/*  HELPER: category badge color                                       */
/* ------------------------------------------------------------------ */

const categoryBadgeStyles: Record<string, string> = {
  'Fieldwork Tips': 'bg-[#EBF4FA] text-[#6BA3D6]',
  'BACB Updates': 'bg-[#FFF3E0] text-[#E8A838]',
  Supervision: 'bg-[#FFF5F7] text-[#E85D70]',
  'Career Advice': 'bg-[#E8F5EE] text-[#7EB89A]',
  'Study Guides': 'bg-[#FBF3EB] text-[#D4A574]',
};

/* ------------------------------------------------------------------ */
/*  ANIMATION VARIANTS                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [email, setEmail] = useState('');

  const filteredArticles = articles.filter((a) => {
    const matchesCategory =
      activeCategory === 'All' || a.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail('');
  };

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
            Resources &amp; Insights
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="font-display-md font-serif text-warm-gray-900 mb-4"
          >
            Tips, Guides &amp; BCBA Wisdom
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="font-body-lg text-warm-gray-500 max-w-2xl mx-auto mb-8"
          >
            Practical advice from behavior analysts, for behavior analysts.
            Stay informed, stay compliant, and advance your career.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="relative max-w-md mx-auto"
          >
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-gray-400 pointer-events-none"
            />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-2xl border-warm-gray-200 bg-white text-warm-gray-700 placeholder:text-warm-gray-300 shadow-sm focus-visible:border-rose-400 focus-visible:ring-rose-400/20"
            />
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CATEGORY FILTERS                                              */}
      {/* ============================================================ */}
      <section className="sticky top-[72px] z-40 bg-[rgba(255,252,249,0.95)] backdrop-blur-md border-b border-warm-gray-100/50 py-3">
        <div className="container-lg flex items-center justify-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-transparent text-warm-gray-500 border border-warm-gray-200 hover:bg-rose-50 hover:text-warm-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* ARTICLE GRID                                                  */}
      {/* ============================================================ */}
      <section className="bg-cream-50 py-16">
        <div className="container-xl">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredArticles.map((article, i) => (
              <motion.article
                key={article.id}
                variants={fadeUp}
                custom={i}
                className="group bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-350 overflow-hidden cursor-pointer hover:-translate-y-1"
              >
                {/* Thumbnail placeholder */}
                <div
                  className={`relative h-48 bg-gradient-to-br ${article.gradient} flex items-center justify-center overflow-hidden`}
                >
                  <div className="text-white/80 transition-transform duration-400 group-hover:scale-110">
                    {article.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                      categoryBadgeStyles[article.category] ||
                      'bg-warm-gray-100 text-warm-gray-500'
                    }`}
                  >
                    {article.category}
                  </span>

                  <h3 className="text-lg font-semibold text-warm-gray-800 mb-2 leading-snug group-hover:text-rose-500 transition-colors duration-200">
                    {article.title}
                  </h3>

                  <p className="text-sm text-warm-gray-500 leading-relaxed mb-4 line-clamp-2">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-warm-gray-400">
                    <Clock size={14} />
                    <span>{article.readTime}</span>
                    <span className="mx-1">·</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>

          {filteredArticles.length === 0 && (
            <div className="text-center py-20">
              <p className="text-warm-gray-500 text-lg mb-2">
                No articles match your search.
              </p>
              <p className="text-warm-gray-400 text-sm">
                Try a different category or search term.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* NEWSLETTER CTA                                                */}
      {/* ============================================================ */}
      <section className="bg-rose-50 py-16">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="container-md text-center"
        >
          <h2 className="font-display-sm font-serif text-warm-gray-900 mb-3">
            Get BCBA Tips in Your Inbox
          </h2>
          <p className="text-warm-gray-500 mb-8 max-w-lg mx-auto">
            Weekly insights on fieldwork, supervision, and certification — no
            spam, ever.
          </p>

          <form
            onSubmit={handleSubscribe}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
          >
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 px-4 rounded-xl border-warm-gray-200 bg-white text-warm-gray-700 placeholder:text-warm-gray-300 focus-visible:border-rose-400 focus-visible:ring-rose-400/20"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Subscribe
            </button>
          </form>

          <p className="text-xs text-warm-gray-400 mt-4">
            Unsubscribe anytime.
          </p>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* RESOURCE LINKS                                                */}
      {/* ============================================================ */}
      <section className="bg-white py-16">
        <div className="container-lg">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="font-display-sm font-serif text-warm-gray-900 text-center mb-12"
          >
            External BCBA Resources
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto"
          >
            {resourceLinks.map((link, i) => (
              <motion.a
                key={i}
                variants={fadeUp}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:bg-rose-50"
              >
                <ArrowRight
                  size={16}
                  className="text-rose-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                />
                <span className="text-warm-gray-600 font-medium group-hover:text-rose-500 transition-colors -ml-7 group-hover:ml-0 duration-200">
                  {link.label}
                </span>
                <span className="text-xs text-warm-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  ↗
                </span>
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Users,
  Sparkles,
  Mail,
  Clock,
  CheckCircle2,
  ArrowRight,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  ChevronDown,
} from 'lucide-react';

/* ─── Easing ─── */
const easeOut = [0.4, 0, 0.2, 1] as [number, number, number, number];
const easeSpring = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

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

/* ─── Contact Options Data ─── */
const contactOptions = [
  {
    icon: Heart,
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
    title: 'General Support',
    description:
      'Questions about your account, features, or need help getting started?',
    email: 'support@fieldworkbybaker.com',
    response: 'Usually responds within 24 hours',
    badgeBg: 'bg-info-light',
  },
  {
    icon: Users,
    iconColor: 'text-gold',
    iconBg: 'bg-gold-light',
    title: 'Sales & Enterprise',
    description: 'Interested in Enterprise for your organization? Let\'s talk.',
    email: 'sales@fieldworkbybaker.com',
    response: 'Usually responds within 1 business day',
    badgeBg: 'bg-gold-light',
  },
  {
    icon: Sparkles,
    iconColor: 'text-success',
    iconBg: 'bg-success-light',
    title: 'Feedback & Ideas',
    description: 'Have a feature suggestion? We\'d love to hear your ideas.',
    email: 'feedback@fieldworkbybaker.com',
    response: 'We read every message',
    badgeBg: 'bg-success-light',
  },
];

/* ─── Form Topic Options ─── */
const topicOptions = [
  'General Question',
  'Account Support',
  'Sales / Enterprise',
  'Feature Request',
  'Bug Report',
  'Other',
];

/* ═══════════════════════════════════════════
   Main Contact Page
   ═══════════════════════════════════════════ */
export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div>
      {/* ── Section 1: Hero ── */}
      <section className="min-h-[45vh] flex items-center gradient-hero-bg relative overflow-hidden">
        {/* Decorative dots */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute w-2 h-2 rounded-full bg-rose-300/40"
            style={{ top: '20%', left: '10%' }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-gold/30"
            style={{ top: '15%', right: '15%' }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-rose-300/30"
            style={{ bottom: '25%', left: '20%' }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-gold/20"
            style={{ bottom: '30%', right: '8%' }}
          />
        </div>

        <div className="container-lg relative z-10 pt-32 pb-16 text-center">
          <motion.span
            className="section-overline mb-4 block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Get in Touch
          </motion.span>

          <motion.h1
            className="font-display-lg font-serif text-warm-gray-900 mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
          >
            We&apos;d Love to Hear From You
          </motion.h1>

          <motion.p
            className="font-body-lg text-warm-gray-600 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
          >
            Whether you have a question, need support, or want to discuss
            Enterprise options, our team is here to help.
          </motion.p>
        </div>
      </section>

      {/* ── Section 2: Contact Options ── */}
      <section className="bg-white py-space-16">
        <div className="container-xl">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {contactOptions.map((option) => (
              <motion.div
                key={option.title}
                className="bg-cream-50 rounded-2xl p-8 text-center transition-all duration-350 hover:-translate-y-1 hover:shadow-card-hover"
                variants={fadeUpStagger}
              >
                <div
                  className={`w-14 h-14 rounded-full ${option.iconBg} flex items-center justify-center mx-auto mb-5`}
                >
                  <option.icon size={28} className={option.iconColor} />
                </div>
                <h3 className="font-semibold text-warm-gray-800 mb-2 text-heading-sm">
                  {option.title}
                </h3>
                <p className="text-body-sm text-warm-gray-500 mb-5 leading-relaxed">
                  {option.description}
                </p>
                <a
                  href={`mailto:${option.email}`}
                  className="text-body-sm text-rose-500 font-medium hover:text-rose-600 transition-colors inline-flex items-center gap-1.5 mb-3"
                >
                  <Mail size={14} />
                  {option.email}
                </a>
                <p className="text-body-xs text-warm-gray-400 mt-2">
                  {option.response}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 3: Contact Form ── */}
      <section className="bg-cream-50 py-space-20">
        <div className="container-md max-w-[640px]">
          <motion.h2
            className="font-display-md font-serif text-warm-gray-900 text-center mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Send Us a Message
          </motion.h2>

          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="contact-form"
                className="space-y-5"
                onSubmit={handleSubmit}
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              >
                <motion.div variants={fadeUpStagger}>
                  <label
                    htmlFor="contact-name"
                    className="block text-body-sm font-medium text-warm-gray-700 mb-1.5"
                  >
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="w-full bg-white border border-warm-gray-200 rounded-xl px-4 py-3.5 text-warm-gray-700 placeholder:text-warm-gray-300 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                  />
                </motion.div>

                <motion.div variants={fadeUpStagger}>
                  <label
                    htmlFor="contact-email"
                    className="block text-body-sm font-medium text-warm-gray-700 mb-1.5"
                  >
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className="w-full bg-white border border-warm-gray-200 rounded-xl px-4 py-3.5 text-warm-gray-700 placeholder:text-warm-gray-300 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                  />
                </motion.div>

                <motion.div variants={fadeUpStagger}>
                  <label
                    htmlFor="contact-topic"
                    className="block text-body-sm font-medium text-warm-gray-700 mb-1.5"
                  >
                    Topic <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="contact-topic"
                      name="topic"
                      required
                      value={formData.topic}
                      onChange={handleChange}
                      className="w-full bg-white border border-warm-gray-200 rounded-xl px-4 py-3.5 text-warm-gray-700 appearance-none focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="" disabled>
                        Select a topic
                      </option>
                      {topicOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-gray-400 pointer-events-none"
                    />
                  </div>
                </motion.div>

                <motion.div variants={fadeUpStagger}>
                  <label
                    htmlFor="contact-message"
                    className="block text-body-sm font-medium text-warm-gray-700 mb-1.5"
                  >
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={6}
                    required
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="How can we help you?"
                    className="w-full bg-white border border-warm-gray-200 rounded-xl px-4 py-3.5 text-warm-gray-700 placeholder:text-warm-gray-300 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                  />
                </motion.div>

                <motion.div variants={fadeUpStagger}>
                  <button type="submit" className="btn-primary w-full">
                    Send Message
                    <ArrowRight size={16} />
                  </button>
                </motion.div>
              </motion.form>
            ) : (
              <motion.div
                key="success-message"
                className="bg-success-light rounded-2xl p-10 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  ease: easeSpring,
                }}
              >
                <CheckCircle2
                  size={48}
                  className="text-success mx-auto mb-4"
                />
                <h3 className="font-display-sm font-serif text-warm-gray-800 mb-3">
                  Message Sent!
                </h3>
                <p className="font-body-md text-warm-gray-500">
                  We&apos;ll get back to you as soon as possible.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Section 4: Office Hours ── */}
      <section className="bg-white py-space-16">
        <div className="container-md text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
              <Clock size={24} className="text-rose-500" />
            </div>
            <h2 className="font-display-sm font-serif text-warm-gray-900 mb-6">
              Support Hours
            </h2>
            <div className="space-y-2 text-warm-gray-600 font-body-md mb-4">
              <p>Monday – Friday: 9:00 AM – 6:00 PM EST</p>
              <p>Saturday: 10:00 AM – 2:00 PM EST</p>
              <p>Sunday: Email only</p>
            </div>
            <p className="text-body-sm text-warm-gray-400">
              Enterprise clients have access to 24/7 priority support.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Section 5: Social ── */}
      <section className="bg-cream-50 py-space-16">
        <div className="container-sm text-center">
          <motion.h2
            className="font-display-sm font-serif text-warm-gray-900 mb-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Follow Along
          </motion.h2>

          <motion.p
            className="text-body-md text-warm-gray-500 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
          >
            Tips, resources, and community updates.
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { icon: Instagram, label: 'Instagram' },
              { icon: Linkedin, label: 'LinkedIn' },
              { icon: Twitter, label: 'Twitter' },
              { icon: Facebook, label: 'Facebook' },
            ].map((social) => (
              <motion.a
                key={social.label}
                href="#"
                aria-label={social.label}
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-warm-gray-400 hover:text-rose-500 hover:shadow-card transition-all duration-200"
                variants={fadeUpStagger}
              >
                <social.icon size={22} />
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 6: Bottom CTA ── */}
      <section className="py-space-16 gradient-cta-bg">
        <div className="container-sm text-center">
          <motion.h2
            className="font-display-sm font-serif text-white mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            Ready to Get Started?
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
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

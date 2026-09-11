import { Link } from 'react-router';
import { useState } from 'react';
import { ArrowRight, Instagram, Linkedin, Twitter } from 'lucide-react';

const productLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Security', href: '/about' },
];

const resourceLinks = [
  { label: 'Blog', href: '/blog' },
  { label: 'FAQ', href: '/faq' },
  { label: 'BCBA Resources', href: '/blog' },
  { label: 'Community', href: '/about' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/faq' },
  { label: 'Terms of Service', href: '/faq' },
  { label: 'Cookie Policy', href: '/faq' },
  { label: 'HIPAA Compliance', href: '/faq' },
];

export default function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail('');
  };

  return (
    <footer className="bg-warm-gray-900 dark:bg-dark-bg text-warm-gray-300">
      <div className="container-xl pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-baseline gap-1 mb-4">
              <span className="font-serif text-2xl font-bold text-white">
                Fieldwork
              </span>
              <span className="text-sm font-medium text-rose-400">by Baker</span>
            </Link>
            <p className="text-warm-gray-400 text-sm leading-relaxed mb-6">
              The most beautiful, BACB 2027-compliant fieldwork tracker. Log hours, manage supervisors, and export official forms.
            </p>
            <div className="mb-6">
              <p className="text-xs font-medium text-warm-gray-400 mb-3 uppercase tracking-wider">
                Stay updated
              </p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-dark-surface border border-dark-border text-sm text-white placeholder:text-warm-gray-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors shrink-0"
                >
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-warm-gray-400 hover:text-rose-400 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a
                href="#"
                className="text-warm-gray-400 hover:text-rose-400 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="#"
                className="text-warm-gray-400 hover:text-rose-400 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Product
            </h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-warm-gray-400 hover:text-rose-400 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Resources
            </h4>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-warm-gray-400 hover:text-rose-400 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-warm-gray-400 hover:text-rose-400 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="pt-8 border-t border-warm-gray-800 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-warm-gray-500 text-xs">
            &copy; {new Date().getFullYear()} Fieldwork by Baker. All rights reserved.
          </p>
          <p className="text-warm-gray-500 text-xs">
            Made with care for the BCBA community.
          </p>
        </div>
      </div>
    </footer>
  );
}

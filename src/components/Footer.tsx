import { Link } from 'react-router';
import { ArrowRight, Mail } from 'lucide-react';

const productLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Security', href: '/security' },
];

const resourceLinks = [
  { label: 'BCBA Roadmap', href: '/roadmap' },
  { label: 'Exam Lab', href: '/exam-lab' },
  { label: 'Resource Vault', href: '/resources' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie & Storage Notice', href: '/cookies' },
  { label: 'Security & Trust', href: '/security' },
];

export default function Footer() {
  return (
    <footer className="bg-warm-gray-900 text-warm-gray-300 dark:bg-dark-bg">
      <div className="container-xl pb-10 pt-16">
        <div className="mb-14 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="mb-4 flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-white">Fieldwork</span>
              <span className="text-sm font-medium text-rose-400">by Baker</span>
            </Link>
            <p className="mb-5 text-sm leading-relaxed text-warm-gray-400">
              A connected BCBA study, fieldwork, exam-prep, and supervisor-collaboration platform designed around current official guidance.
            </p>
            <a
              href="mailto:support@fieldworkbybaker.com?subject=Fieldwork%20by%20Baker%20support"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-rose-400/50 hover:text-rose-300"
            >
              <Mail size={15} /> Email support
            </a>
          </div>

          <FooterGroup title="Product" links={productLinks} />
          <FooterGroup title="Resources" links={resourceLinks} />
          <FooterGroup title="Legal" links={legalLinks} />
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-warm-gray-800 pt-8 dark:border-dark-border sm:flex-row">
          <p className="text-xs text-warm-gray-500">&copy; {new Date().getFullYear()} Fieldwork by Baker. All rights reserved.</p>
          <Link to="/contact" className="inline-flex items-center gap-1 text-xs font-semibold text-warm-gray-400 hover:text-rose-400">
            Found a bug or have an idea? Tell us <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{title}</h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.href} className="text-sm text-warm-gray-400 transition-colors hover:text-rose-400">{link.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

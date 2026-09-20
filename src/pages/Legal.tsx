import { Link, useLocation } from 'react-router';
import { Cookie, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';

type LegalKey = 'privacy' | 'terms' | 'cookies' | 'security';

const pages: Record<LegalKey, {
  title: string;
  eyebrow: string;
  icon: typeof ShieldCheck;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Privacy',
    icon: ShieldCheck,
    intro: 'Fieldwork by Baker is designed to help BCBA candidates organize fieldwork and study data while minimizing unnecessary collection of sensitive information.',
    sections: [
      { title: 'Information you provide', body: 'The app may process account details, fieldwork records, supervisor information, study progress, imported files, and messages you intentionally submit to Baker AI. Do not enter protected health information or unnecessary client-identifying information.' },
      { title: 'Browser-local beta data', body: 'Some current beta features store fieldwork and personalization data in your browser. Clearing browser storage, changing devices, or using private browsing can remove browser-local records. Keep independent copies of records required for professional or regulatory purposes.' },
      { title: 'AI processing', body: 'When you use Baker AI or Baker Brain, the text and relevant app context needed to answer your request may be sent to the configured AI service. The platform is designed to minimize unrelated context and does not intentionally ask for client-identifying information.' },
      { title: 'Payments', body: 'Payments are processed by Stripe Checkout when Stripe is configured. Fieldwork by Baker does not collect or store full payment card numbers in the application.' },
      { title: 'Contact', body: 'Questions about privacy can be sent through the Contact page. This policy will be updated as the platform adds persistent accounts, notifications, and other production services.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'Terms',
    icon: FileText,
    intro: 'Fieldwork by Baker is an independent educational, organizational, and productivity platform for people pursuing or supporting BCBA certification.',
    sections: [
      { title: 'Independent resource', body: 'Fieldwork by Baker is not affiliated with, endorsed by, or operated by the Behavior Analyst Certification Board. Official requirements, eligibility decisions, and certification decisions remain with the BACB and other applicable authorities.' },
      { title: 'Your responsibility', body: 'You are responsible for the accuracy of the information you enter or import and for reviewing AI-generated classifications, summaries, calculations, and study guidance before relying on them.' },
      { title: 'Supervisor review', body: 'Supervisor review tools support documentation workflows but do not replace professional judgment, supervision contracts, employer requirements, or official verification processes.' },
      { title: 'Exam preparation', body: 'Exam Lab uses original, unofficial practice material. It does not contain secure BACB examination questions and does not guarantee a passing score.' },
      { title: 'Beta availability', body: 'Some features are in active beta and may change. Keep independent copies of important fieldwork records and verification documents.' },
    ],
  },
  cookies: {
    title: 'Cookie & Local Storage Notice',
    eyebrow: 'Storage',
    icon: Cookie,
    intro: 'The current app primarily relies on browser storage and secure session tokens to remember preferences and beta account state.',
    sections: [
      { title: 'What is stored', body: 'The app may store theme preference, signed-in session information, fieldwork entries, study progress, saved resources, exam progress, and other personalization data in browser storage.' },
      { title: 'Why it is used', body: 'Browser storage keeps the app responsive and lets beta users continue where they left off. It is also why clearing site data can remove locally stored records.' },
      { title: 'Your controls', body: 'You can clear browser storage through your browser settings. Before doing so, export or otherwise preserve any fieldwork information you need to retain.' },
    ],
  },
  security: {
    title: 'Security & Trust',
    eyebrow: 'Security',
    icon: LockKeyhole,
    intro: 'Fieldwork by Baker uses signed application sessions, protected premium routes, server-side secrets, and Stripe-hosted checkout for payment details when payments are enabled.',
    sections: [
      { title: 'What we do today', body: 'Sensitive server credentials are kept server-side. Premium API routes require signed authorization. Supervisor review links are signed. Stripe Checkout, when enabled, keeps card entry on Stripe-hosted payment pages.' },
      { title: 'What we do not claim', body: 'The platform should not be described as HIPAA compliant, SOC 2 certified, or as having any other third-party certification unless and until that status has been formally established and documented.' },
      { title: 'Client privacy', body: 'Do not upload or enter unnecessary client-identifying information. Use initials or de-identified descriptions only when needed for fieldwork organization and allowed by your supervisor or organization.' },
      { title: 'Report an issue', body: 'If you discover a security or privacy issue, use the Contact page and include enough technical detail for the team to reproduce it without including client data.' },
    ],
  },
};

function keyFromPath(pathname: string): LegalKey {
  if (pathname.startsWith('/terms')) return 'terms';
  if (pathname.startsWith('/cookies')) return 'cookies';
  if (pathname.startsWith('/security')) return 'security';
  return 'privacy';
}

export default function Legal() {
  const location = useLocation();
  const key = keyFromPath(location.pathname);
  const page = pages[key];
  const Icon = page.icon;

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-12 dark:bg-[#171412]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Icon size={17} /> {page.eyebrow}</div>
        <h1 className="font-serif text-4xl font-semibold text-[#332C28] dark:text-white sm:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{page.intro}</p>
        <div className="mt-8 space-y-4">
          {page.sections.map((section) => (
            <section key={section.title} className="rounded-[24px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]">
              <h2 className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-[#FAF8F6] p-4 text-xs leading-6 text-[#7B6B62] dark:bg-white/5 dark:text-[#CFC4BE]">
          Last updated September 20, 2026. This page describes the current beta architecture and will be revised as production infrastructure changes.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/contact" className="rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-bold text-white dark:bg-[#E85D70]">Contact Baker</Link>
          <Link to="/faq" className="rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]">FAQ</Link>
        </div>
      </div>
    </div>
  );
}

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
      { title: 'Account storage and browser preferences', body: 'Verified accounts store fieldwork records, learning progress and private uploaded originals in Supabase account storage. Access rules restrict private records and originals to the account owner, with limited current-entry access for an assigned verified supervisor. Theme, time format, session information and local drafts may also use browser storage. Clearing browser storage can remove local preferences and unsaved drafts; it does not delete records already saved to your account. Keep independent copies of required records and signed forms.' },
      { title: 'AI processing', body: 'When you use Baker AI or Baker Brain, the text and relevant app context needed to answer your request may be sent to the configured AI service. The platform is designed to minimize unrelated context and does not intentionally ask for client-identifying information.' },
      { title: 'Payments and service providers', body: 'Vercel hosts the application, Supabase supports verified accounts and private storage, Stripe processes subscription payments, and Resend delivers account and product emails. These services process the information needed to provide their respective functions. Full payment card numbers are entered on Stripe-hosted pages and are not stored in the Fieldwork application.' },
      { title: 'Supervisor emails and owner notifications', body: 'When you choose to email a monthly form, the entered supervisor address receives your name, BACB ID, form details and an unsigned PDF, with your account email as the reply address. Verified-signup and confirmed-plan notifications send your name, email and selected membership information to the Fieldwork owner. Suggestions send your submitted text and account details to the owner inboxes.' },
      { title: 'Community and profile visibility', body: 'A saved profile photo is visible to verified members across the site, including beside your posts and replies. Shared Commons posts and replies are visible to other verified members. Country badges and Active now sharing start off and can be enabled or disabled in settings. Active now does not display an exact last-seen time. Sample discussions are labeled fictional and cannot be interacted with.' },
      { title: 'Optional ad measurement', body: 'Ad measurement starts off. If you choose Allow ad measurement, a browser identifier and any Meta ad click identifier are saved in your browser for up to 30 days. When you start checkout, a hashed email, hashed browser identifier, browser type and ad click identifier may be attached to that checkout. After Stripe confirms your first nonzero membership payment, Meta receives those identifiers, the payment time, amount and currency to measure our ads. Renewals, unpaid sessions and $0 tests do not count as new purchases. We do not send fieldwork narratives, private files, BACB IDs, supervisor records or community content to Meta. Use Ad privacy on public pages to change your choice for future checkouts; already completed transmissions cannot be recalled through that control.' },
      { title: 'Contact', body: 'For privacy, access, correction or deletion questions, contact support@fieldworkbybaker.com. Retain an independent export of records you need for professional documentation.' },
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
      { title: 'Membership and cancellation', body: 'Public demos are read-only and do not start a free trial. Paid membership unlocks the features shown for the selected plan. Subscriptions renew at the price and interval displayed in checkout until canceled. You can manage billing and cancellation through the Stripe customer portal in Account settings. Existing saved records remain readable when paid access ends; features requiring an active membership are disabled.' },
      { title: 'Product availability', body: 'Features may be updated as the platform develops. Native iOS and Android apps are coming soon; the current workspace is available through a mobile browser. Keep independent copies of important fieldwork records and signed verification documents.' },
    ],
  },
  cookies: {
    title: 'Cookie & Storage Notice',
    eyebrow: 'Storage',
    icon: Cookie,
    intro: 'Fieldwork uses secure session information and browser preferences alongside protected account storage.',
    sections: [
      { title: 'What is stored', body: 'Browser storage may hold theme and time-format preferences, signed-in session information, working drafts and local caches. Saved account records, learning progress and private originals are stored separately in protected Supabase storage.' },
      { title: 'Why it is used', body: 'Session information supports verified sign-in, while preferences and local drafts help you continue your work. Clearing site data can sign you out and remove local preferences and unsaved drafts. Saved cloud records remain available after signing back in.' },
      { title: 'Your controls', body: 'You can clear browser storage through your browser settings. Before doing so, export or otherwise preserve any fieldwork information you need to retain.' },
      { title: 'Optional advertising storage', body: 'Optional ad measurement is disabled until you allow it. Your choice and, if allowed, an anonymous browser identifier and Meta ad click identifier are kept in browser storage for up to 30 days. Choose Ad privacy on public pages to decline future measurement. Fieldwork does not load Meta tracking scripts inside your private workspace.' },
    ],
  },
  security: {
    title: 'Security & Trust',
    eyebrow: 'Security',
    icon: LockKeyhole,
    intro: 'Fieldwork by Baker uses verified accounts, protected private storage, server-side paid access checks and Stripe-hosted checkout.',
    sections: [
      { title: 'What we do today', body: 'Server credentials remain server-side. Private account records and originals use owner access rules. Assigned supervisor review requires the invited verified email, expires after 14 days, and applies only to the current entry revision. Signed Stripe webhooks update protected billing status; sandbox payments cannot grant live access. Card entry stays on Stripe-hosted checkout pages.' },
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
          Last updated October 8, 2026. This page describes the current live service.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/contact" className="rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-bold text-white dark:bg-[#E85D70]">Contact Baker</Link>
          <Link to="/faq" className="rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]">FAQ</Link>
        </div>
      </div>
    </div>
  );
}

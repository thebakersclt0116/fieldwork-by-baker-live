import { Link, useLocation } from 'react-router';
import { withAcquisitionQuery } from '@/lib/acquisitionFunnel';
import { ArrowRight, Check, Clock, FileCheck2, FlaskConical, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const tiers = [
  {
    name: 'Individual',
    price: '$16.99',
    cadence: '/month',
    highlight: true,
    description: 'For BCBA candidates who want a simple place to track hours, prepare monthly forms, and study.',
    features: ['My Hours with start/stop timer', 'Monthly Verification Forms', 'Exam Prep + weak-area practice', 'Import and export fieldwork records', 'Suggestions and feedback'],
    note: 'Cancel anytime. Membership begins after payment.',
  },
  {
    name: 'Professional',
    price: '$34.99',
    cadence: '/month',
    highlight: false,
    description: 'For candidates who also need active supervisor collaboration for their hours.',
    features: ['Everything in Individual', 'Secure supervisor review links', 'Supervisor notes + messages', 'Revision and re-approval workflow', 'Multiple supervisors + organizations', 'Priority support'],
    note: 'Professional Annual is available in checkout at $349/year — about $29.08/month.',
  },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { search } = useLocation();
  const publicLink = (path: string) => withAcquisitionQuery(path, search);
  const membershipHref = publicLink(isAuthenticated ? '/upgrade' : '/signup');
  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] dark:bg-[#171412]">
      <section className="px-4 pb-12 pt-16 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF5F7] px-3 py-1.5 text-xs font-semibold text-[#E85D70] dark:bg-[#E85D70]/10"><Sparkles size={14} /> Explore the demo. Choose the membership that fits.</div>
          <h1 className="mb-5 font-serif text-5xl font-semibold leading-tight text-[#332C28] dark:text-white lg:text-6xl">A workspace worth investing in.</h1>
          <p className="mx-auto mb-7 max-w-2xl text-lg text-[#6B5D54] dark:text-[#CFC4BE]">Focus on My Hours, Monthly Verification Forms, Exam Prep, and Suggestions. Professional adds supervisor review and feedback for your hours.</p>
          <Link to={publicLink('/demo')} className="mr-4 inline-flex rounded-xl border border-[#e2dad5] px-6 py-3 font-semibold">Explore free demo</Link><Link to={membershipHref} className="btn-primary inline-flex rounded-xl px-6 py-3">Create account <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
          {tiers.map((tier) => (
            <div key={tier.name} className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-sm dark:bg-[#211D1A] ${tier.highlight ? 'border-[#E85D70]' : 'border-[#F2EDEA] dark:border-white/10'}`}>
              {tier.highlight && <div className="absolute -top-3 left-5 rounded-full bg-[#E85D70] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Best starting point</div>}
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#332C28] dark:text-white">{tier.name}</h2>
              <div className="mb-3 flex items-baseline gap-1"><span className="font-mono text-3xl text-[#E85D70]">{tier.price}</span><span className="text-sm text-[#A8998E]">{tier.cadence}</span></div>
              <p className="mb-5 text-sm leading-relaxed text-[#6B5D54] dark:text-[#CFC4BE]">{tier.description}</p>
              <ul className="mb-5 flex-1 space-y-2">{tier.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-[#4D423C] dark:text-[#E7DED9]"><Check size={15} className="mt-0.5 shrink-0 text-[#5FA37E]" />{feature}</li>)}</ul>
              <p className="mb-5 text-xs text-[#A8998E]">{tier.note}</p>
              <Link to={membershipHref} className={`w-full rounded-xl py-3 text-center text-sm font-semibold ${tier.highlight ? 'bg-[#E85D70] text-white' : 'pricing-professional-cta bg-[#332C28] text-white'}`}>{isAuthenticated ? `Choose ${tier.name}` : 'Create account'}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          <Value icon={Clock} title="My Hours" text="Start and stop your timer, add activity details, and keep your fieldwork records together." />
          <Value icon={FlaskConical} title="Exam Prep" text="Practice questions and full simulations help you review weaker areas." />
          <Value icon={FileCheck2} title="Monthly Verification Forms" text="Prepare your monthly forms from saved hours and review the details before sharing." />
        </div>
      </section>
    </div>
  );
}

function Value({ icon: Icon, title, text }: { icon: typeof Clock; title: string; text: string }) {
  return <div className="rounded-2xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><Icon size={20} className="mb-3 text-[#E85D70]" /><h3 className="mb-1 font-semibold text-[#332C28] dark:text-white">{title}</h3><p className="text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p></div>;
}

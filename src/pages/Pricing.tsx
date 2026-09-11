import { Link } from 'react-router';
import { ArrowRight, Check, FileDown, ShieldCheck, Sparkles, Upload, UserCheck } from 'lucide-react';

const tiers = [
  {
    name: 'Free', price: '$0', cadence: 'forever', highlight: false,
    description: 'Start tracking without a credit card or countdown.',
    features: ['Unlimited manual hour logging', 'Dashboard and fieldwork history', 'Basic analytics and compliance guidance', 'Dark mode', 'Your entered records remain visible'],
    note: 'Premium export, AI, import, and supervisor workflow stay locked.',
  },
  {
    name: 'Export Pass', price: '$19', cadence: 'one time', highlight: false,
    description: 'For the candidate who only needs the export moment.',
    features: ['Unlock BACB 2027 Export Center', 'Monthly verification worksheets', 'Final verification worksheet', 'Keep using Free tracking afterward'],
    note: 'No subscription required.',
  },
  {
    name: 'Individual', price: '$12', cadence: '/month', highlight: true,
    description: 'Automation for candidates who want to save time every week.',
    features: ['Everything in Free', 'Unlimited export tools', 'Baker AI voice/text logging', 'Ripley/CSV batch import', 'Richer Compliance Oracle'],
    note: 'Best for individual candidates.',
  },
  {
    name: 'Professional', price: '$24', cadence: '/month', highlight: false,
    description: 'For candidates and supervisors collaborating inside Baker.',
    features: ['Everything in Individual', 'Secure supervisor review links', 'Supervisor notes and messages', 'Professional review workflow', 'Priority beta features'],
    note: 'Annual Professional: $228/year ($19/month equivalent).',
  },
];

export default function Pricing() {
  return (
    <div className="bg-[#FFFCF9] min-h-[100dvh]">
      <section className="px-4 pt-16 pb-12 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F7] px-3 py-1.5 text-xs font-semibold text-[#E85D70] mb-5"><Sparkles size={14} /> Free tracking. Pay when premium leverage matters.</div>
          <h1 className="font-serif text-5xl lg:text-6xl font-semibold text-[#332C28] leading-tight mb-5">Track your BCBA hours free forever.</h1>
          <p className="text-lg text-[#6B5D54] max-w-2xl mx-auto mb-7">No free-trial timer. No credit card. Build your fieldwork history on Free, then unlock export, AI, import, or supervisor collaboration when you actually need them.</p>
          <Link to="/signup" className="btn-primary inline-flex px-6 py-3 rounded-xl">Start Tracking Free <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {tiers.map((tier) => <div key={tier.name} className={`relative bg-white rounded-3xl p-6 border shadow-sm flex flex-col ${tier.highlight ? 'border-[#E85D70]' : 'border-[#F2EDEA]'}`}>{tier.highlight && <div className="absolute -top-3 left-5 rounded-full bg-[#E85D70] text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Most popular</div>}<h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">{tier.name}</h2><div className="flex items-baseline gap-1 mb-3"><span className="font-mono text-3xl text-[#E85D70]">{tier.price}</span><span className="text-sm text-[#A8998E]">{tier.cadence}</span></div><p className="text-sm text-[#6B5D54] leading-relaxed mb-5">{tier.description}</p><ul className="space-y-2 mb-5 flex-1">{tier.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-[#4D423C]"><Check size={15} className="text-[#5FA37E] mt-0.5 shrink-0" />{feature}</li>)}</ul><p className="text-xs text-[#A8998E] mb-5">{tier.note}</p><Link to="/signup" className={`w-full text-center rounded-xl py-3 text-sm font-semibold ${tier.highlight ? 'bg-[#E85D70] text-white' : 'bg-[#332C28] text-white'}`}>Start Free First</Link></div>)}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><FileDown size={20} className="text-[#E85D70] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Export wall</h3><p className="text-sm text-[#6B5D54]">Free users keep access to their records; official-form generation convenience is paid.</p></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><Sparkles size={20} className="text-[#E85D70] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Baker AI</h3><p className="text-sm text-[#6B5D54]">Text or voice recap becomes a proposed structured fieldwork entry.</p></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><Upload size={20} className="text-[#D4A574] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Migration</h3><p className="text-sm text-[#6B5D54]">Paid users can batch-import large Ripley/CSV histories.</p></div>
          <div className="bg-white rounded-2xl border border-[#F2EDEA] p-5"><UserCheck size={20} className="text-[#5FA37E] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Supervisor workflow</h3><p className="text-sm text-[#6B5D54]">Professional adds secure review links, notes, messages, and status handoff.</p></div>
        </div>
        <div className="max-w-3xl mx-auto mt-8 rounded-2xl bg-[#FAF8F6] p-5 flex gap-3 text-sm text-[#6B5D54]"><ShieldCheck size={18} className="text-[#5FA37E] shrink-0 mt-0.5" /><div><strong className="text-[#332C28]">No data hostage mechanics.</strong> Users can always view and manually copy what they entered. Baker charges for premium automation and export convenience, not for access to a user&apos;s underlying records.</div></div>
      </section>
    </div>
  );
}

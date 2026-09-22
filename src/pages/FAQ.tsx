import { useMemo, useState } from 'react';
import { ChevronDown, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

const faqs = [
  { category: 'Getting started', q: 'What is Fieldwork by Baker?', a: 'Fieldwork by Baker is an independent BCBA journey platform for fieldwork organization, supervisor review, exam preparation, study planning, resources, and Baker Brain. It is not affiliated with or endorsed by the Behavior Analyst Certification Board.' },
  { category: 'Getting started', q: 'Is there a free plan?', a: 'There is no permanent free plan. New users receive a 3-day full-access trial of the connected platform, then continue on Individual or Professional.' },
  { category: 'Fieldwork', q: 'How are hours entered?', a: 'Quick Log uses a Ripley-familiar workflow: choose a date, start time, and end time, then Baker converts the elapsed time into decimal hours. Each entry can also include organization, responsible supervisor, Restricted or Unrestricted classification, Independent or Supervised status, supervision format, observation time, and activity notes.' },
  { category: 'Fieldwork', q: 'Can I edit an entry after a supervisor approves it?', a: 'Yes. Editing an already approved entry returns it to Pending, requires a reason for the change, preserves revision history, and creates a new review request. Pending entries can be corrected without triggering re-approval.' },
  { category: 'Fieldwork', q: 'Does Baker decide whether my hours count?', a: 'No. Baker organizes recorded information and can flag possible issues, but your qualified supervisor and current official requirements determine whether activities are acceptable and how they should be verified.' },
  { category: 'Imports & exports', q: 'Can I move records from Ripley?', a: 'The import workflow supports Ripley-style fieldwork documents and supported export formats. Known BACB monthly verification PDFs can be recognized as monthly summaries without inventing session-level detail that is not present in the source.' },
  { category: 'Imports & exports', q: 'Are exports official BACB forms?', a: 'Baker provides form-ready export and documentation workflows. Always review generated information and use the current official BACB forms and instructions when a formal verification document is required.' },
  { category: 'Baker Brain', q: 'Is Baker Brain actually AI-powered?', a: 'Yes. Baker Brain uses a configured AI model to answer BCBA-focused questions, teach concepts, use Exam Lab weak-area context, help organize study plans, and navigate the platform. It is educational support, not a substitute for a qualified supervisor or official certification guidance.' },
  { category: 'Exam Lab', q: 'Does Exam Lab contain real BACB exam questions?', a: 'No. Exam Lab uses original, unofficial practice questions. The full simulation is designed around the current public examination structure, but it does not reproduce secure examination items and cannot guarantee a passing score.' },
  { category: 'Privacy & security', q: 'Where is my beta data stored?', a: 'Some current beta features store fieldwork records, personalization, exam progress, and study data in your browser. Clearing site data, using another device, or using private browsing can remove browser-local information. Keep independent copies of records you are professionally required to retain.' },
  { category: 'Privacy & security', q: 'Should I enter client-identifying information?', a: 'No. Do not enter unnecessary protected health information or client-identifying information. Use de-identified descriptions and follow your employer, supervisor, and applicable privacy requirements.' },
  { category: 'Privacy & security', q: 'Is Fieldwork by Baker HIPAA compliant or SOC 2 certified?', a: 'The platform does not claim HIPAA compliance, SOC 2 certification, or another third-party security certification unless and until that status has been formally established and documented.' },
  { category: 'Billing', q: 'How does payment work?', a: 'Paid upgrades use Stripe Checkout when Stripe is configured for the deployment. Card information is entered on Stripe-hosted checkout, not stored directly by Fieldwork by Baker.' },
  { category: 'Billing', q: 'What paid options are planned in the current checkout?', a: 'After the 3-day full-access trial, the current launch options are Individual at $16.99/month, Professional at $34.99/month, or Professional Annual at $349/year. The live pricing page and Stripe Checkout show the current amount before payment.' },
  { category: 'Support', q: 'How do I report a bug tonight?', a: 'Use the Contact page and choose Bug Report. Include what you clicked, what you expected, what happened instead, and a screenshot when useful. Do not include client-identifying information.' },
];

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? faqs.filter((item) => (item.q + ' ' + item.a + ' ' + item.category).toLowerCase().includes(term)) : faqs;
  }, [query]);

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-12 dark:bg-[#171412]">
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F3] px-3 py-1.5 text-xs font-bold text-[#E85D70] dark:bg-[#E85D70]/15"><ShieldCheck size={14} /> Current beta answers</div>
          <h1 className="mt-4 font-serif text-5xl font-semibold text-[#332C28] dark:text-white">Frequently asked questions</h1>
          <p className="mt-4 text-[#6B5D54] dark:text-[#CFC4BE]">Answers below describe the platform as it exists now—not placeholder certifications or future features.</p>
        </header>

        <div className="relative mx-auto mt-8 max-w-2xl">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998E]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search FAQs…" className="w-full rounded-2xl border border-[#E2DAD5] bg-white py-3.5 pl-11 pr-4 text-sm text-[#332C28] outline-none focus:border-[#E85D70] dark:border-white/10 dark:bg-[#211D1A] dark:text-white" />
        </div>

        <div className="mt-8 space-y-3">
          {filtered.map((item) => {
            const index = faqs.indexOf(item);
            const expanded = open === index;
            return <article key={item.q} className="overflow-hidden rounded-[22px] border border-[#F2EDEA] bg-white dark:border-white/10 dark:bg-[#211D1A]">
              <button onClick={() => setOpen(expanded ? null : index)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                <div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#E85D70]">{item.category}</div><h2 className="mt-1 font-semibold text-[#332C28] dark:text-white">{item.q}</h2></div>
                <ChevronDown size={18} className={'shrink-0 text-[#A8998E] transition ' + (expanded ? 'rotate-180' : '')} />
              </button>
              {expanded && <div className="border-t border-[#F2EDEA] px-5 py-4 text-sm leading-7 text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]">{item.a}</div>}
            </article>;
          })}
          {filtered.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#A8998E] dark:bg-[#211D1A]">No FAQ matched that search.</div>}
        </div>

        <div className="mt-10 rounded-[28px] bg-[#332C28] p-7 text-center text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10">
          <h2 className="font-serif text-2xl font-semibold">Still need help?</h2>
          <p className="mt-2 text-sm text-white/60">Send a real support, bug, feedback, or sales request from the Contact page.</p>
          <Link to="/contact" className="mt-5 inline-block rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-bold text-white">Contact Fieldwork by Baker</Link>
        </div>
      </div>
    </div>
  );
}

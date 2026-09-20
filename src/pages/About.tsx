import { Link } from 'react-router';
import { ArrowRight, Heart, ShieldCheck, Sparkles, Users } from 'lucide-react';

const principles = [
  {
    icon: Heart,
    title: 'Built around real fieldwork pain points',
    description: 'The product is being shaped with direct feedback from BCBA candidates and supervisors who need faster logging, clearer review, and less spreadsheet friction.',
  },
  {
    icon: ShieldCheck,
    title: 'Guidance, not false certainty',
    description: 'Baker can flag recorded data and explain requirements, but supervisors and official sources remain the authority for professional judgment and certification decisions.',
  },
  {
    icon: Users,
    title: 'Designed for collaboration',
    description: 'Candidates can organize supervisors, organizations, revisions, review requests, and feedback without flattening everything into one generic hour total.',
  },
  {
    icon: Sparkles,
    title: 'One connected BCBA workspace',
    description: 'Fieldwork, exam preparation, Baker Brain, the BCBA Roadmap, resources, and community tools are designed to share context instead of living in disconnected apps.',
  },
];

export default function About() {
  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] text-[#332C28] dark:bg-[#171412] dark:text-white">
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="text-sm font-bold text-[#E85D70]">ABOUT FIELDWORK BY BAKER</div>
            <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight sm:text-6xl">Built to make the BCBA journey easier to understand, track, and act on.</h1>
            <p className="mt-6 text-lg leading-8 text-[#6B5D54] dark:text-[#CFC4BE]">
              Fieldwork by Baker is an independent platform built by Baker &amp; Co. Holdings and refined through hands-on feedback from people actively navigating BCBA fieldwork, supervision, studying, and documentation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-[#E85D70] px-6 py-3.5 text-sm font-bold text-white">Start my BCBA journey <ArrowRight size={16} /></Link>
              <Link to="/roadmap" className="rounded-2xl border border-[#E2DAD5] bg-white px-6 py-3.5 text-sm font-bold text-[#5F5149] dark:border-white/10 dark:bg-white/5 dark:text-[#F3ECE7]">Explore the roadmap</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-2">
            {principles.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-[28px] border border-[#F2EDEA] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#211D1A]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Icon size={21} /></div>
                <h2 className="mt-5 font-serif text-2xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-[#332C28] p-7 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10 sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div><div className="text-sm font-bold text-[#F4C895]">INDEPENDENT BY DESIGN</div><h2 className="mt-2 font-serif text-3xl font-semibold">Built beside the BACB ecosystem—not pretending to be it.</h2></div>
            <div className="space-y-3 text-sm leading-7 text-white/70">
              <p>Fieldwork by Baker is not affiliated with, endorsed by, or operated by the Behavior Analyst Certification Board.</p>
              <p>Official requirements, eligibility decisions, examination policies, and certification decisions should always be verified against current BACB materials and qualified professional guidance.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif text-3xl font-semibold">Help shape what comes next.</h2>
          <p className="mt-3 text-[#6B5D54] dark:text-[#CFC4BE]">The platform is in active beta. Real candidate and supervisor feedback is being used to harden the workflows before broader release.</p>
          <Link to="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-5 py-3 text-sm font-bold text-[#5F5149] dark:border-white/10 dark:bg-white/5 dark:text-white">Send feedback <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}

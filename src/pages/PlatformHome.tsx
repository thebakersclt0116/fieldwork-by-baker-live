import { Link } from 'react-router';
import { Brain, CheckCircle2, Compass, FlaskConical, Library, Route, ShieldCheck, Sparkles, Users } from 'lucide-react';

const pillars = [
  { icon: Compass, title: 'My Path', text: 'A personalized command center for your coursework, fieldwork, exam timeline, saved resources, and next best action.', href: '/my-path' },
  { icon: Route, title: 'BCBA Roadmap', text: 'Move from “where do I start?” to certification with a clear, updateable journey built around official requirements.', href: '/roadmap' },
  { icon: Users, title: 'Baker Commons', text: 'A private professional network for aspiring BCBAs, supervisors, educators, study groups, and exam-date cohorts.', href: '/commons' },
  { icon: Brain, title: 'Baker Brain', text: 'BCBA-focused AI support for concepts, study planning, quizzes, fieldwork organization, notes, and next steps.', href: '/baker-brain' },
  { icon: FlaskConical, title: 'Exam Lab', text: 'Practice in a polished testing environment, then turn every miss into a targeted improvement plan.', href: '/exam-lab' },
  { icon: Library, title: 'Resource Vault', text: 'Search, save, and organize study guides, templates, ethics scenarios, career tools, and fieldwork resources.', href: '/resources' },
];

export default function PlatformHome() {
  return (
    <div className="overflow-hidden bg-[#FFFCF9] text-[#332C28] dark:bg-[#171412] dark:text-[#F8F4F1]">
      <section className="relative min-h-[88dvh] overflow-hidden px-4 py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-28 top-14 h-96 w-96 rounded-full bg-[#F9D4DC]/50 blur-3xl dark:bg-[#E85D70]/10" />
          <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-[#F6E2CA]/55 blur-3xl dark:bg-[#D4A574]/10" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F0D5DA] bg-white/75 px-4 py-2 text-sm font-semibold text-[#D94D62] shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-[#FF8EA0]"><Sparkles size={15} /> The digital home for your BCBA journey</div>
            <h1 className="max-w-4xl font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">Your entire BCBA journey—<span className="text-[#E85D70]">one connected platform.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#6B5D54] dark:text-[#CFC4BE]">Plan your path, master the material, take realistic practice tests, get personalized AI support, and connect with a community built around the same goal.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="rounded-2xl bg-[#E85D70] px-6 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-[#E85D70]/20 transition hover:-translate-y-0.5">Start My BCBA Journey</Link>
              <Link to="/roadmap" className="rounded-2xl border border-[#E2DAD5] bg-white px-6 py-3.5 text-center text-sm font-bold text-[#5F5149] shadow-sm transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-[#F3ECE7]">Explore the Platform</Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {['Follow a personalized BCBA roadmap', 'Get instant support from Baker Brain', 'Prepare confidently inside Exam Lab', 'Find your people inside Baker Commons'].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-medium text-[#6B5D54] dark:text-[#CFC4BE]"><CheckCircle2 size={17} className="text-[#5FA37E]" /> {item}</div>)}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[32px] border border-[#F2EDEA] bg-white p-5 shadow-[0_30px_90px_rgba(62,45,37,.12)] dark:border-white/10 dark:bg-[#211D1A]">
              <div className="mb-5 flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-[#A8998E]">My Path</div><div className="mt-1 font-serif text-2xl font-semibold">Good morning, future BCBA.</div></div><div className="rounded-2xl bg-[#FFF0F3] p-3 text-[#E85D70] dark:bg-[#E85D70]/15"><Compass size={22} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#FAF8F6] p-4 dark:bg-white/5"><div className="text-xs text-[#A8998E]">Current stage</div><div className="mt-1 font-semibold">Fieldwork + exam prep</div><div className="mt-3 h-2 rounded-full bg-[#EDE7E3]"><div className="h-2 w-[64%] rounded-full bg-[#E85D70]" /></div></div>
                <div className="rounded-2xl bg-[#332C28] p-4 text-white"><div className="text-xs text-white/60">Next best action</div><div className="mt-1 font-semibold">Review unrestricted balance</div><div className="mt-3 text-xs text-[#F4C895]">Baker Brain can help →</div></div>
                <div className="rounded-2xl border border-[#F2EDEA] p-4 dark:border-white/10"><div className="text-xs text-[#A8998E]">Exam Lab</div><div className="mt-1 text-2xl font-mono font-semibold">78%</div><div className="text-xs text-[#6B5D54] dark:text-[#CFC4BE]">latest adaptive set</div></div>
                <div className="rounded-2xl border border-[#F2EDEA] p-4 dark:border-white/10"><div className="text-xs text-[#A8998E]">Baker Commons</div><div className="mt-1 font-semibold">3 replies waiting</div><div className="text-xs text-[#6B5D54] dark:text-[#CFC4BE]">Exam-date cohort</div></div>
              </div>
              <div className="mt-3 rounded-2xl border border-[#F0D5DA] bg-[#FFF7F8] p-4 dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10"><div className="flex items-center gap-2 text-sm font-bold text-[#D94D62] dark:text-[#FF8EA0]"><Brain size={17} /> Baker Brain</div><p className="mt-1 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">“You are 12 minutes short of your observation target this month. Want me to help plan your next supervision session?”</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-3xl text-center"><div className="text-sm font-bold text-[#E85D70]">ONE ECOSYSTEM</div><h2 className="mt-2 font-serif text-4xl font-semibold">Everything connects to everything else.</h2><p className="mt-4 text-[#6B5D54] dark:text-[#CFC4BE]">Miss a concept in Exam Lab, study it with Baker Brain, save the lesson, discuss it in Baker Commons, and see the follow-up appear on My Path.</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pillars.map(({ icon: Icon, title, text, href }) => <Link key={title} to={href} className="group rounded-[28px] border border-[#F2EDEA] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#211D1A]"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] transition group-hover:scale-105 dark:bg-[#E85D70]/15"><Icon size={21} /></div><h3 className="font-serif text-2xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p><div className="mt-5 text-sm font-bold text-[#E85D70]">Open {title} →</div></Link>)}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl rounded-[32px] bg-[#332C28] p-7 text-white md:p-10 dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div><div className="flex items-center gap-2 text-sm font-bold text-[#F4C895]"><ShieldCheck size={17} /> Compliance & trust</div><h2 className="mt-3 font-serif text-3xl font-semibold">Built to guide—not impersonate the BACB.</h2></div><p className="text-sm leading-7 text-white/70">Fieldwork by Baker is an independent educational and community resource. It is not affiliated with, endorsed by, or operated by the Behavior Analyst Certification Board. Platform guidance does not guarantee certification, examination eligibility, employment, or a passing score. Official requirements should be verified against current official sources.</p></div>
        </div>
      </section>
    </div>
  );
}

import { Link } from 'react-router';
import { ArrowRight, Brain, Clock3, FileDown, FlaskConical, Library, Route, ShieldCheck, Upload, UserCheck, Users } from 'lucide-react';

const features = [
  { icon: Clock3, title: 'Ripley-familiar fieldwork logging', text: 'Enter start and end times, see the exact decimal conversion, tap Restricted or Unrestricted, and attach each entry to the responsible organization and supervisor.', href: '/dashboard', protected: true },
  { icon: UserCheck, title: 'Supervisor review & re-approval', text: 'Send signed review links, capture supervisor notes, and return edited approved entries to Pending with revision reasons and stale-approval protection.', href: '/pricing' },
  { icon: Upload, title: 'Fieldwork migration', text: 'Import supported Ripley records and other fieldwork exports. Known monthly verification PDFs are treated as monthly summaries without inventing missing sessions.', href: '/pricing' },
  { icon: Brain, title: 'Baker Brain', text: 'A BCBA-focused AI professor and platform guide that can use fieldwork, Exam Lab, weak-area, and journey context when the signed user has AI access.', href: '/baker-brain', protected: true },
  { icon: FlaskConical, title: 'Full Exam Lab', text: 'Practice with an original unofficial 185-question simulation modeled on the current public BCBA exam structure, then generate a targeted weak-area lesson sequence.', href: '/exam-lab' },
  { icon: Route, title: 'BCBA Roadmap & My Path', text: 'Keep milestones, dates, fieldwork progress, exam results, saved resources, and next actions connected instead of spread across disconnected tools.', href: '/roadmap' },
  { icon: Library, title: 'Resource Vault', text: 'Search and save study resources, plus store study artifacts created by Baker Brain for later review.', href: '/resources' },
  { icon: Users, title: 'Baker Commons beta', text: 'Organize discussion prompts, local posts, saved discussions, and study-partner preferences while the shared multi-user community backend is still in beta.', href: '/commons', protected: true },
  { icon: FileDown, title: 'Form-ready exports', text: 'Use structured export workflows to prepare fieldwork information for review. Final official verification remains the responsibility of the user and qualified supervisor.', href: '/pricing' },
];

export default function Features() {
  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] text-[#332C28] dark:bg-[#171412] dark:text-white">
      <section className="relative overflow-hidden px-4 py-24 sm:py-28">
        <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-[#F9D4DC]/45 blur-3xl dark:bg-[#E85D70]/10" />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="text-sm font-bold text-[#E85D70]">PLATFORM FEATURES</div>
          <h1 className="mx-auto mt-3 max-w-4xl font-serif text-5xl font-semibold leading-tight sm:text-6xl">A BCBA workspace where the useful parts actually connect.</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[#6B5D54] dark:text-[#CFC4BE]">Track fieldwork, collaborate with supervisors, practice the exam, build personalized lessons, organize resources, and ask Baker Brain what to do next.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-[#E85D70] px-6 py-3.5 text-sm font-bold text-white">Start 3-Day Free Trial <ArrowRight size={16} /></Link>
            <Link to="/pricing" className="rounded-2xl border border-[#E2DAD5] bg-white px-6 py-3.5 text-sm font-bold text-[#5F5149] dark:border-white/10 dark:bg-white/5 dark:text-white">View plans</Link>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, text, href, protected: protectedRoute }) => (
            <Link key={title} to={href} className="group rounded-[28px] border border-[#F2EDEA] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#F0C0CA] hover:shadow-xl dark:border-white/10 dark:bg-[#211D1A]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Icon size={21} /></div>
                {protectedRoute && <span className="rounded-full bg-[#FAF8F6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A8998E] dark:bg-white/5">Sign-in feature</span>}
              </div>
              <h2 className="mt-5 font-serif text-2xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p>
              <div className="mt-5 text-sm font-bold text-[#E85D70]">Explore →</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl rounded-[32px] bg-[#332C28] p-7 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10 sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
            <div><div className="flex items-center gap-2 text-sm font-bold text-[#F4C895]"><ShieldCheck size={17} /> Trust by design</div><h2 className="mt-2 font-serif text-3xl font-semibold">No certification badges we have not earned.</h2></div>
            <div className="text-sm leading-7 text-white/70">
              Fieldwork by Baker is independent from the BACB. The platform does not claim HIPAA compliance, SOC 2 certification, guaranteed exam outcomes, or guaranteed BACB acceptance. It helps users organize information and learn; official requirements and professional judgment remain external authorities.
              <div className="mt-4"><Link to="/security" className="font-bold text-[#FF91A0]">Read Security & Trust →</Link></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link, useLocation } from 'react-router';
import { withAcquisitionQuery } from '@/lib/acquisitionFunnel';
import { ArrowRight, BookOpen, Check, Clock3, FileCheck2, MessageSquare, Play, ShieldCheck } from 'lucide-react';
import PublicLandingMeasurement from '@/components/PublicLandingMeasurement';
const tools = [
  { title: 'My Hours', icon: Clock3, text: 'Start your timer, stop when you finish, and add the description and details. Keep your sessions and imported history together.', href: '/dashboard' },
  { title: 'Monthly Verification Forms', icon: FileCheck2, text: 'Prepare prefilled monthly forms from your completed records, then review and sign with your supervisor.', href: '/export' },
  { title: 'Exam Prep', icon: BookOpen, text: 'Use a full-length 185-question, four-hour practice simulation. Review explanations and use your results to focus your next study session.', href: '/exam-lab' },
  { title: 'Suggestions', icon: MessageSquare, text: 'Tell us what would make your daily fieldwork easier. Share an idea or report something that needs attention.', href: '/suggestions' },
];
export default function PlatformHome() {
  const { search } = useLocation();
  const publicLink = (path: string) => withAcquisitionQuery(path, search);
  return <div className="overflow-hidden bg-[#FFFCF9] text-[#332C28] dark:bg-[#171412] dark:text-[#F8F4F1]">
    <PublicLandingMeasurement path="/" />
    <section className="relative px-5 py-14 sm:py-20 lg:py-24"><div className="pointer-events-none absolute -left-28 top-0 h-96 w-96 rounded-full bg-[#F9D4DC]/35 blur-3xl dark:bg-[#E85D70]/10" /><div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <p className="mb-5 text-sm font-bold tracking-wide text-[#C53F55] dark:text-[#FF9DAE]">For BCBA fieldwork candidates</p>
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Track your fieldwork hours.<br /><span className="text-[#D94D62] dark:text-[#FF9DAE]">Practice for your BCBA exam.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#6B5D54] dark:text-[#CFC4BE]">Keep your sessions and monthly progress together. Use a full-length 185-question practice simulation, review explanations and build a weak-area study plan.</p>
        <p className="mt-4 text-base font-semibold text-[#6B5D54] dark:text-[#CFC4BE]">Individual membership: <strong className="text-[#C53F55] dark:text-[#FF9DAE]">$16.99/month</strong>. <Link to={publicLink('/pricing')} className="underline">See memberships</Link></p>
        <div className="mt-7 flex flex-wrap gap-3"><Link to={publicLink('/signup')} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#E85D70] px-6 py-3 text-sm font-bold text-white">Create account <ArrowRight size={16} /></Link><Link to={publicLink('/demo')} className="inline-flex min-h-12 items-center rounded-xl border border-[#D9CEC7] px-6 py-3 text-sm font-semibold">Explore free demo</Link></div>
        <p className="mt-4 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">The free demo uses fictional fieldwork records. Saving real hours and using Exam Prep require a paid membership. No card is needed to create an account.</p>
        <div className="mt-7 space-y-3 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">{['Start and stop a session timer', 'Keep descriptions and supervisor details with your hours', 'Bring supported detailed Ripley PDFs and CSV records'].map(text => <p key={text} className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0 text-[#4B8C69]" />{text}</p>)}</div>
      </div>
      <div aria-label="Illustration of the My Hours workspace" className="rounded-[28px] border border-[#EAE2DC] bg-white p-6 shadow-[0_24px_70px_rgba(62,45,37,.08)] dark:border-white/10 dark:bg-[#211D1A] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#7B6B62] dark:text-[#CFC4BE]">My Hours · Illustrative preview</p><h2 className="mt-3 font-serif text-3xl">One session at a time.</h2><div className="my-6 rounded-2xl bg-[#FFF2F5] p-6 text-center dark:bg-[#E85D70]/10"><Clock3 size={24} className="mx-auto text-[#C53F55] dark:text-[#FF9DAE]" /><p className="my-4 font-mono text-5xl tracking-tight">01:30:00</p><span className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-semibold text-white"><Play size={14} />Session timer</span></div><div className="rounded-2xl border border-[#EAE2DC] p-4 dark:border-white/10"><p className="text-sm font-semibold">Time saved. Add your details.</p><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Your description, organization, supervisor, and activity category complete the record.</p></div><p className="mt-4 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">Fictional example. Real entries are saved to your signed-in workspace.</p></div>
    </div></section>
    <section aria-label="Your four essential tools" className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-2">{tools.map(({ title, icon: Icon, text, href }) => <Link key={title} to={publicLink(href)} className="rounded-2xl border border-[#EAE2DC] bg-white p-6 transition hover:border-[#E85D70]/60 dark:border-white/10 dark:bg-[#211D1A]"><Icon size={22} className="text-[#D94D62] dark:text-[#FF9DAE]" /><h2 className="mt-4 font-serif text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p></Link>)}</section>
    <section className="mx-auto max-w-6xl px-5 pb-16"><div className="rounded-2xl bg-[#332C28] p-6 text-white sm:p-8"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={20} />Your records deserve care.</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">Fieldwork by Baker is an independent educational tool, unaffiliated with the BACB. Review your records and official requirements with your supervisor. Forms require both signatures; practice results do not guarantee examination eligibility or a passing score.</p></div></section>
  </div>;
}

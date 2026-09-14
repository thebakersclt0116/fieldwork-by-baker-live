import { Link } from 'react-router';
import { Brain, FileText, FlaskConical, HelpCircle, Route, Sparkles, WandSparkles } from 'lucide-react';
import BakerAI from './BakerAI';

const starts = [
  { label: 'Explain a concept', icon: HelpCircle, href: '/resources' },
  { label: 'Build my study plan', icon: Route, href: '/my-path' },
  { label: 'Quiz me', icon: FlaskConical, href: '/exam-lab' },
  { label: 'Review my weak areas', icon: Sparkles, href: '/exam-lab' },
  { label: 'Help with fieldwork', icon: FileText, href: '#fieldwork-ai' },
  { label: 'Prepare me for the exam', icon: Brain, href: '/exam-lab' },
  { label: 'Turn my notes into flashcards', icon: WandSparkles, href: '/resources' },
];

export default function BakerBrainHub() {
  return (
    <div className="bg-[#FFFCF9] dark:bg-[#171412]">
      <section className="px-4 py-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#F2EDEA] bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#211D1A] lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_.8fr] lg:items-center">
            <div><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Brain size={18} /> Baker Brain</div><h1 className="mt-3 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Ask anything about your BCBA journey.</h1><p className="mt-3 max-w-3xl leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">Your BCBA-focused intelligence layer for understanding concepts, planning study, organizing fieldwork, reviewing weak areas, turning notes into learning materials, and jumping to the right resource without leaving the platform.</p></div>
            <div className="rounded-[26px] bg-[#332C28] p-6 text-white dark:bg-[#171412] dark:ring-1 dark:ring-white/10"><div className="text-xs font-bold uppercase tracking-[.16em] text-[#F4C895]">Baker Brain principle</div><p className="mt-3 font-serif text-xl leading-8">Educational support should make the next step clearer—not pretend to replace your instructor, supervisor, official handbook, or qualified professional.</p></div>
          </div>
          <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{starts.map(({ label, icon: Icon, href }) => <Link key={label} to={href} className="flex items-center gap-2 rounded-2xl border border-[#F2EDEA] bg-[#FFFCF9] px-4 py-3 text-sm font-semibold text-[#5F5149] hover:border-[#E85D70]/40 hover:text-[#E85D70] dark:border-white/10 dark:bg-white/5 dark:text-[#E7DED9]"><Icon size={16} className="text-[#E85D70]" /> {label}</Link>)}</div>
        </div>
      </section>
      <div id="fieldwork-ai"><BakerAI /></div>
    </div>
  );
}

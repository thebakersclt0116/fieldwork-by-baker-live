import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FileText, Route, ShieldCheck } from 'lucide-react';

const steps = [
  ['profession', 'Understand the BCBA profession', 'Clarify the role, common settings, responsibilities, and whether the path fits your goals.'],
  ['education', 'Education & coursework planning', 'Map your degree and coursework plan and keep your program milestones organized.'],
  ['eligibility', 'Eligibility pathways', 'Track the pathway you are pursuing and the official documents you need to verify.'],
  ['fieldwork', 'Fieldwork & supervision', 'Log hours, supervisors, organizations, observation minutes, and monthly compliance.'],
  ['documentation', 'Documentation & organization', 'Keep monthly forms, supporting records, supervision notes, and revision history organized.'],
  ['application', 'Apply for the examination', 'Prepare your application checklist and track official submission milestones.'],
  ['exam', 'Exam preparation', 'Connect your study plan to Baker Brain, Exam Lab performance, and your target date.'],
  ['maintenance', 'Certification maintenance', 'Understand ongoing maintenance responsibilities and keep official references easy to revisit.'],
  ['career', 'Career planning', 'Build your job search, interview preparation, resume, and professional network.'],
] as const;

type State = Record<string, { complete?: boolean; target?: string; note?: string }>;
const KEY = 'fieldworkByBaker:roadmap:v1';
function loadState(): State { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as State; } catch { return {}; } }

export default function BCBARoadmap() {
  const [state, setState] = useState<State>(() => loadState());
  const [selected, setSelected] = useState(steps[0][0]);
  const current = steps.find(([id]) => id === selected) || steps[0];
  const completed = useMemo(() => steps.filter(([id]) => state[id]?.complete).length, [state]);
  const update = (id: string, patch: State[string]) => { const next = { ...state, [id]: { ...state[id], ...patch } }; setState(next); localStorage.setItem(KEY, JSON.stringify(next)); };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7"><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Route size={17} /> BCBA Roadmap</div><h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Know exactly where you are—and what comes next.</h1><p className="mt-2 max-w-3xl text-[#6B5D54] dark:text-[#CFC4BE]">A living journey from exploring the profession through certification maintenance and career planning. Save notes, target dates, and your progress without losing the big picture.</p></header>

        <div className="mb-6 rounded-[28px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-[#A8998E]">Journey progress</div><div className="mt-1 font-serif text-2xl font-semibold text-[#332C28] dark:text-white">{completed} of {steps.length} major stages complete</div></div><div className="w-full sm:w-72"><div className="h-2.5 overflow-hidden rounded-full bg-[#F2EDEA] dark:bg-white/10"><div className="h-full rounded-full bg-[#E85D70] transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} /></div></div></div></div>

        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="space-y-2">
            {steps.map(([id, title], index) => <button key={id} onClick={() => setSelected(id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${selected === id ? 'border-[#F0C0CA] bg-[#FFF4F6] dark:border-[#E85D70]/40 dark:bg-[#E85D70]/10' : 'border-[#F2EDEA] bg-white hover:border-[#E8DCD6] dark:border-white/10 dark:bg-[#211D1A]'}`}><button onClick={(e) => { e.stopPropagation(); update(id, { complete: !state[id]?.complete }); }} className="shrink-0 text-[#5FA37E]" aria-label={`Toggle ${title}`}>{state[id]?.complete ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-[#CFC5BF]" />}</button><div><div className="text-xs font-bold text-[#A8998E]">STEP {index + 1}</div><div className="font-semibold text-[#332C28] dark:text-white">{title}</div></div></button>)}
          </section>

          <section className="rounded-[30px] border border-[#F2EDEA] bg-white p-7 dark:border-white/10 dark:bg-[#211D1A]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#E85D70]"><FileText size={15} /> Selected roadmap stage</div><h2 className="mt-3 font-serif text-3xl font-semibold text-[#332C28] dark:text-white">{current[1]}</h2><p className="mt-3 leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{current[2]}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-[#6B5D54] dark:text-[#CFC4BE]">Target date<input type="date" value={state[current[0]]?.target || ''} onChange={(e) => update(current[0], { target: e.target.value })} className="mt-2 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-[#332C28] dark:border-white/10 dark:bg-white/5 dark:text-white" /></label><div className="rounded-2xl bg-[#FAF8F6] p-4 dark:bg-white/5"><div className="text-xs text-[#A8998E]">Status</div><div className={`mt-1 font-semibold ${state[current[0]]?.complete ? 'text-[#5FA37E]' : 'text-[#B36A2E]'}`}>{state[current[0]]?.complete ? 'Complete' : 'In progress'}</div></div></div>
            <label className="mt-5 block text-sm font-medium text-[#6B5D54] dark:text-[#CFC4BE]">Private notes<textarea value={state[current[0]]?.note || ''} onChange={(e) => update(current[0], { note: e.target.value })} rows={7} placeholder="Save questions, documents you still need, people to follow up with, or your next action…" className="mt-2 w-full rounded-2xl border border-[#E2DAD5] bg-white px-4 py-3 text-[#332C28] outline-none focus:border-[#E85D70] dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
            <button onClick={() => update(current[0], { complete: !state[current[0]]?.complete })} className="mt-5 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-bold text-white dark:bg-[#E85D70]">{state[current[0]]?.complete ? 'Mark as in progress' : 'Mark step complete'}</button>
            <div className="mt-7 rounded-2xl border border-[#E8E0DB] bg-[#FAF8F6] p-4 dark:border-white/10 dark:bg-white/5"><div className="flex items-center gap-2 text-sm font-bold text-[#4D423C] dark:text-white"><ShieldCheck size={16} className="text-[#5FA37E]" /> Official-source discipline</div><p className="mt-2 text-xs leading-5 text-[#7B6B62] dark:text-[#BEB1AA]">Roadmap guidance should be verified against current official requirements. Fieldwork by Baker is an independent educational resource and does not make eligibility determinations. Requirement content is designed to be administrator-updatable as standards change.</p></div>
          </section>
        </div>
      </div>
    </div>
  );
}

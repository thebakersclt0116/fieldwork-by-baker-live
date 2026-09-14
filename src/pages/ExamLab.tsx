import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, BookOpen, CheckCircle2, Clock3, Flag, FlaskConical, RotateCcw, Save, Sparkles, Target } from 'lucide-react';
import {
  BCBA_EXAM_MINUTES,
  BCBA_EXAM_SOURCE,
  BCBA_EXAM_TOTAL_QUESTIONS,
  buildWeakAreaPlan,
  contentAreas,
  fullBCBAExam,
  scoreExam,
} from '@/data/bcbaExam';

const SESSION_KEY = 'fieldworkByBaker:examLab:fullExam:v2';
const RESULT_KEY = 'fieldworkByBaker:examLab:lastResult:v2';
const PLAN_KEY = 'fieldworkByBaker:weakAreaPlan:v1';
const BRAIN_SEED_KEY = 'fieldworkByBaker:bakerBrainSeed:v1';

type Session = {
  startedAt: number;
  answers: Record<string, number>;
  flagged: string[];
  index: number;
};

function loadSession(): Session | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    return parsed?.startedAt ? parsed : null;
  } catch {
    return null;
  }
}

function remainingSeconds(startedAt: number) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, BCBA_EXAM_MINUTES * 60 - elapsed);
}

function clockText(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ExamLab() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => session ? remainingSeconds(session.startedAt) : BCBA_EXAM_MINUTES * 60);
  const [plan, setPlan] = useState<ReturnType<typeof buildWeakAreaPlan> | null>(() => {
    try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
  });
  const [studyMinutes, setStudyMinutes] = useState(45);

  const answers = session?.answers || {};
  const flagged = session?.flagged || [];
  const index = Math.min(Math.max(0, session?.index || 0), fullBCBAExam.length - 1);
  const q = fullBCBAExam[index];
  const result = useMemo(() => scoreExam(answers), [answers]);

  useEffect(() => {
    if (!session || submitted) return;
    const save = () => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    save();
    const interval = window.setInterval(() => {
      const next = remainingSeconds(session.startedAt);
      setSecondsLeft(next);
      if (next <= 0) setSubmitted(true);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session, submitted]);

  useEffect(() => {
    if (!submitted || !session) return;
    const scored = scoreExam(session.answers);
    localStorage.setItem(RESULT_KEY, JSON.stringify({ ...scored, completedAt: new Date().toISOString() }));
    localStorage.removeItem(SESSION_KEY);
  }, [submitted, session]);

  const startFullExam = () => {
    const next: Session = { startedAt: Date.now(), answers: {}, flagged: [], index: 0 };
    setSession(next);
    setSubmitted(false);
    setSecondsLeft(BCBA_EXAM_MINUTES * 60);
  };

  const reset = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSubmitted(false);
    setSecondsLeft(BCBA_EXAM_MINUTES * 60);
  };

  const updateSession = (patch: Partial<Session>) => {
    setSession((current) => current ? { ...current, ...patch } : current);
  };

  const buildPlan = () => {
    const next = buildWeakAreaPlan(answers, studyMinutes);
    setPlan(next);
    localStorage.setItem(PLAN_KEY, JSON.stringify(next));
    localStorage.setItem(BRAIN_SEED_KEY, JSON.stringify({
      type: 'weak-area-plan',
      prompt: `Use my Exam Lab results to coach me through my weakest areas. My lowest areas are ${next.weakest.map((area) => `${area.area} (${area.percent}%)`).join(', ')}. Start with a personalized lesson on ${next.weakest[0]?.weakConcepts.join(', ') || next.weakest[0]?.area}.`,
      createdAt: new Date().toISOString(),
    }));
  };

  if (!session && !submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
        <div className="mx-auto max-w-6xl space-y-6">
          <header>
            <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><FlaskConical size={17} /> Exam Lab</div>
            <h1 className="mt-2 max-w-4xl font-serif text-4xl font-semibold text-[#332C28] dark:text-white">A full-length BCBA practice simulation built to expose exactly what you need to learn next.</h1>
            <p className="mt-3 max-w-3xl leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">This simulation mirrors the current exam structure: 185 original multiple-choice practice questions, 4 choices each, 4 hours, and a scored blueprint distributed across the nine BCBA Test Content Outline (6th ed.) content areas. Ten items are blended in as unscored experimental practice items, just like the official structure.</p>
          </header>

          <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-[32px] bg-[#332C28] p-7 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F4C895]"><Clock3 size={17} /> Full simulation</div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Questions" value="185" />
                <Stat label="Scored" value="175" />
                <Stat label="Unscored" value="10" />
                <Stat label="Time" value="4:00" />
              </div>
              <button onClick={startFullExam} className="mt-6 w-full rounded-2xl bg-[#E85D70] px-6 py-4 text-base font-bold text-white transition hover:brightness-105">Start full BCBA simulation</button>
              <p className="mt-3 text-center text-xs text-white/55">The practice timer continues if you leave and resume, matching real-exam pacing discipline.</p>
            </div>

            <div className="rounded-[32px] border border-[#F2EDEA] bg-white p-7 dark:border-white/10 dark:bg-[#211D1A]">
              <div className="text-xs font-bold uppercase tracking-[.16em] text-[#A8998E]">Current scored blueprint</div>
              <div className="mt-4 space-y-2">{contentAreas.map((area) => <div key={area.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F6] px-3 py-2 text-sm dark:bg-white/5"><span className="text-[#5F5149] dark:text-[#E7DED9]">{area.id}. {area.name}</span><span className="font-mono font-bold text-[#E85D70]">{area.scoredCount}</span></div>)}</div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#F0D5DA] bg-[#FFF7F8] p-5 dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10">
            <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#E85D70]" /><div><div className="font-semibold text-[#4D423C] dark:text-white">Unofficial, original practice material</div><p className="mt-1 text-sm leading-6 text-[#7B6B62] dark:text-[#CFC4BE]">Fieldwork by Baker does not reproduce secure examination questions and does not guarantee a passing score. The structure is based on the current BACB examination outline; use official BACB materials for authoritative examination requirements.</p><a href={BCBA_EXAM_SOURCE.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-[#E85D70]">Official examination source →</a></div></div>
          </section>
        </div>
      </div>
    );
  }

  if (submitted && session) {
    const weakest = [...result.byArea].sort((a, b) => a.percent - b.percent).slice(0, 3);
    return (
      <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[34px] bg-[#332C28] p-7 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10 lg:p-9">
            <div className="flex items-center gap-2 text-sm font-bold text-[#8FD0AD]"><CheckCircle2 size={18} /> Full simulation complete</div>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="font-serif text-5xl font-semibold">{result.percent}%</div><p className="mt-2 text-white/65">{result.correct} of {result.total} scored practice questions correct. Experimental items are excluded from this score.</p></div><div className="flex flex-wrap gap-2"><button onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold"><RotateCcw size={15} /> New full exam</button></div></div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.byArea.map((area) => <div key={area.areaId} className={`rounded-[24px] border p-5 ${area.percent < 70 ? 'border-[#F0D5DA] bg-[#FFF7F8]' : area.percent < 85 ? 'border-[#F1D8B9] bg-[#FFF9F2]' : 'border-[#CFE7D9] bg-[#F4FBF7]'} dark:border-white/10 dark:bg-[#211D1A]`}><div className="flex items-center justify-between gap-3"><div className="text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">Area {area.areaId}</div><div className="font-mono text-2xl font-bold text-[#332C28] dark:text-white">{area.percent}%</div></div><h3 className="mt-2 font-serif text-lg font-semibold text-[#332C28] dark:text-white">{area.area}</h3><div className="mt-2 text-xs text-[#7B6B62] dark:text-[#CFC4BE]">{area.correct}/{area.total} correct</div>{area.weakConcepts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{area.weakConcepts.slice(0, 4).map((concept) => <span key={concept} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6B5D54] shadow-sm dark:bg-white/10 dark:text-[#E7DED9]">{concept}</span>)}</div>}</div>)}</section>

          <section className="rounded-[32px] border border-[#F0D5DA] bg-gradient-to-br from-[#FFF5F7] via-white to-[#FFF9F2] p-7 dark:border-[#E85D70]/20 dark:from-[#291C20] dark:via-[#211D1A] dark:to-[#241E19]">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              <div><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Sparkles size={17} /> Build my weak-area plan</div><h2 className="mt-2 font-serif text-3xl font-semibold text-[#332C28] dark:text-white">Turn the misses into a personalized lesson sequence.</h2><p className="mt-2 max-w-3xl leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">Baker ranks your weakest content areas, identifies the concepts behind your misses, then builds a seven-day teach → retrieve → apply loop. It is designed to keep drilling the exact discriminations you missed instead of giving every learner the same study calendar.</p><div className="mt-4 flex flex-wrap gap-2">{weakest.map((area) => <span key={area.areaId} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#D94D62] shadow-sm dark:bg-white/10 dark:text-[#FF91A0]">{area.areaId}: {area.percent}%</span>)}</div></div>
              <div className="rounded-[24px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-white/5"><label className="text-sm font-semibold text-[#5F5149] dark:text-[#E7DED9]">Minutes you can study each day<input type="number" min="20" max="180" step="5" value={studyMinutes} onChange={(e) => setStudyMinutes(Math.max(20, Number(e.target.value) || 45))} className="mt-2 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 font-mono text-[#332C28] dark:border-white/10 dark:bg-[#171412] dark:text-white" /></label><button onClick={buildPlan} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-bold text-white"><Target size={16} /> Create my plan</button></div>
            </div>
          </section>

          {plan && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[#A8998E]">Personalized seven-day repair cycle</div><h2 className="mt-1 font-serif text-3xl font-semibold text-[#332C28] dark:text-white">Your custom lesson plan</h2></div><Link to="/baker-brain" className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-bold text-white dark:bg-[#E85D70]"><Sparkles size={15} /> Teach this to me in Baker Brain</Link></div>
              <div className="grid gap-4 lg:grid-cols-2">{plan.days.map((day) => <article key={day.day} className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[#E85D70]">Day {day.day} · {day.minutes} min</div><h3 className="mt-1 font-serif text-xl font-semibold text-[#332C28] dark:text-white">{day.title}</h3></div><BookOpen size={18} className="text-[#D4A574]" /></div><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{day.action}</p><div className="mt-4 space-y-2">{day.blocks.map((block) => <div key={block.label} className="rounded-xl bg-[#FAF8F6] p-3 dark:bg-white/5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-[#4D423C] dark:text-white">{block.label}</span><span className="font-mono text-xs text-[#A8998E]">{block.minutes}m</span></div><p className="mt-1 text-xs leading-5 text-[#7B6B62] dark:text-[#CFC4BE]">{block.instruction}</p></div>)}</div></article>)}</div>
            </section>
          )}

          <section className="rounded-[30px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2"><Save size={16} className="text-[#5FA37E]" /><div className="font-semibold text-[#4D423C] dark:text-white">Autosaved learning history</div></div><p className="mt-2 text-sm text-[#7B6B62] dark:text-[#CFC4BE]">Your latest content-area results and generated weak-area plan are saved in this browser so My Path and Baker Brain can use them as personalized context.</p></section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8F6F4] px-3 py-4 dark:bg-[#11100F] sm:px-4">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#332C28] px-4 py-3 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10">
          <div className="flex items-center gap-3"><FlaskConical size={18} className="text-[#F4C895]" /><div><div className="text-sm font-bold">BCBA Full Simulation</div><div className="text-xs text-white/55">Question {index + 1} of {BCBA_EXAM_TOTAL_QUESTIONS} · {Object.keys(answers).length} answered</div></div></div>
          <div className={`rounded-xl px-4 py-2 font-mono text-lg font-bold ${secondsLeft < 1800 ? 'bg-[#E85D70] text-white' : 'bg-white/10'}`}><Clock3 size={15} className="mr-2 inline" />{clockText(secondsLeft)}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="rounded-[26px] border border-[#E7E0DC] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#211D1A] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[#A8998E]">{q.area}</div><div className="mt-1 text-xs text-[#A8998E]">{q.difficulty} · original unofficial practice item</div></div><button onClick={() => updateSession({ flagged: flagged.includes(q.id) ? flagged.filter((id) => id !== q.id) : [...flagged, q.id] })} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${flagged.includes(q.id) ? 'bg-[#FFF3E0] text-[#B77722]' : 'bg-[#FAF8F6] text-[#6B5D54] dark:bg-white/5 dark:text-[#CFC4BE]'}`}><Flag size={15} /> {flagged.includes(q.id) ? 'Flagged' : 'Flag for review'}</button></div>

            <h2 className="mt-7 font-serif text-2xl font-semibold leading-9 text-[#332C28] dark:text-white">{q.prompt}</h2>
            <div className="mt-6 space-y-3">{q.options.map((option, optionIndex) => <button key={`${q.id}-${optionIndex}`} onClick={() => updateSession({ answers: { ...answers, [q.id]: optionIndex } })} className={`w-full rounded-2xl border p-4 text-left text-sm font-medium leading-6 transition ${answers[q.id] === optionIndex ? 'border-[#E85D70] bg-[#FFF4F6] text-[#C9445A] dark:bg-[#E85D70]/10 dark:text-[#FF9AAA]' : 'border-[#E8E0DB] text-[#4D423C] hover:border-[#E85D70]/50 dark:border-white/10 dark:text-[#E7DED9]'}`}><span className="mr-3 font-mono text-[#A8998E]">{String.fromCharCode(65 + optionIndex)}.</span>{option}</button>)}</div>

            <div className="mt-8 flex items-center justify-between gap-3"><button disabled={index === 0} onClick={() => updateSession({ index: index - 1 })} className="rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] disabled:opacity-30 dark:border-white/10 dark:text-[#CFC4BE]">Previous</button>{index < fullBCBAExam.length - 1 ? <button onClick={() => updateSession({ index: index + 1 })} className="rounded-xl bg-[#332C28] px-5 py-2.5 text-sm font-bold text-white dark:bg-[#E85D70]">Next question</button> : <button onClick={() => setSubmitted(true)} className="rounded-xl bg-[#E85D70] px-5 py-2.5 text-sm font-bold text-white">Submit exam</button>}</div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[#E7E0DC] bg-white p-4 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">Navigator</div><div className="text-xs text-[#A8998E]">{flagged.length} flagged</div></div><div className="mt-3 grid max-h-[480px] grid-cols-7 gap-1.5 overflow-y-auto pr-1">{fullBCBAExam.map((item, itemIndex) => <button key={item.id} onClick={() => updateSession({ index: itemIndex })} title={`${item.area} — ${item.concept}`} className={`h-9 rounded-lg text-[11px] font-bold ${index === itemIndex ? 'bg-[#E85D70] text-white' : flagged.includes(item.id) ? 'bg-[#FFF3E0] text-[#B77722]' : answers[item.id] !== undefined ? 'bg-[#E8F5EE] text-[#4B8C69]' : 'bg-[#FAF8F6] text-[#7B6B62] dark:bg-white/5 dark:text-[#CFC4BE]'}`}>{itemIndex + 1}</button>)}</div></div>
            <div className="rounded-[24px] border border-[#E7E0DC] bg-white p-4 dark:border-white/10 dark:bg-[#211D1A]"><div className="text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">Session</div><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Your answers, flags, position, and start time autosave locally. Leaving the page does not reset the four-hour practice clock.</p><button onClick={() => setSubmitted(true)} className="mt-4 w-full rounded-xl border border-[#F0D5DA] px-4 py-2.5 text-sm font-bold text-[#C9445A]">Finish & score now</button></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-white/50">{label}</div><div className="mt-1 font-mono text-2xl font-semibold">{value}</div></div>;
}

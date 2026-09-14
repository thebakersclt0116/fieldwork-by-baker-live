import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Brain, BookOpen, Compass, ExternalLink, FileText, FlaskConical, Library, Loader2, Route, Send, Sparkles, Target, Users, WandSparkles } from 'lucide-react';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';
import { evaluateCompliance } from '@/lib/compliance2027';
import { getCurrentUserEmail, loadEntries } from '@/lib/fieldworkStore';

const HISTORY_KEY = 'fieldworkByBaker:bakerBrainHistory:v1';
const BRAIN_RESOURCES_KEY = 'fieldworkByBaker:brainResources:v1';
const BRAIN_SEED_KEY = 'fieldworkByBaker:bakerBrainSeed:v1';
const PROFILE_KEY = 'fieldworkByBaker:pathProfile:v1';
const EXAM_RESULT_KEY = 'fieldworkByBaker:examLab:lastResult:v2';
const WEAK_PLAN_KEY = 'fieldworkByBaker:weakAreaPlan:v1';

type Artifact = {
  title: string;
  type: 'Lesson' | 'Study guide' | 'Flashcards' | 'Quiz' | 'Checklist' | 'Study plan' | 'Comparison sheet';
  topic: string;
  summary: string;
  sections: string[];
};

type BrainResponse = {
  answer: string;
  mode: string;
  actions: Array<{ label: string; href: string; reason: string }>;
  followUps: string[];
  citations: Array<{ label: string; url: string }>;
  artifact: Artifact | null;
  provider?: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: BrainResponse;
  createdAt: string;
};

const quickStarts = [
  { label: 'Teach my weakest concept', icon: Target, prompt: 'Look at my Exam Lab weak areas and teach me the single concept I most need to understand next. Use an example, a non-example, and then ask me one check-for-understanding question.' },
  { label: 'Build tonight’s study plan', icon: Route, prompt: 'Build me a focused study plan for tonight using my exam weak areas, my available study time, and my BCBA stage. Prioritize retrieval practice and applied scenarios.' },
  { label: 'Quiz me intelligently', icon: FlaskConical, prompt: 'Quiz me with original unofficial BCBA practice questions targeted to my weakest content area. Start with one question at a time and teach after I answer.' },
  { label: 'Create a study resource', icon: WandSparkles, prompt: 'Create a custom study guide for my weakest BCBA content area and make it useful enough to save in my Resource Vault.' },
  { label: 'Check my fieldwork', icon: FileText, prompt: 'Review my current fieldwork summary and tell me what deserves attention next. Keep this educational and tell me when I should verify something with my supervisor or official BACB guidance.' },
  { label: 'Navigate the platform', icon: Compass, prompt: 'Based on my current progress, tell me which part of Fieldwork by Baker I should use next and give me buttons to get there.' },
];

function safeParse<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}

function loadHistory(): Message[] {
  return safeParse<Message[]>(HISTORY_KEY, []).slice(-40);
}

export default function BakerBrainHub() {
  const { user } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const entries = useMemo(() => loadEntries(email), [email]);
  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState('ONLINE');
  const [savedArtifact, setSavedArtifact] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const profile = useMemo(() => safeParse<Record<string, string>>(PROFILE_KEY, {}), []);
  const examResult = useMemo(() => safeParse<any>(EXAM_RESULT_KEY, null), []);
  const weakPlan = useMemo(() => safeParse<any>(WEAK_PLAN_KEY, null), []);
  const savedResourceIds = useMemo(() => safeParse<string[]>('fieldworkByBaker:resourceSaves:v1', []), []);

  useEffect(() => {
    const seed = safeParse<{ prompt?: string } | null>(BRAIN_SEED_KEY, null);
    if (seed?.prompt) {
      setInput(seed.prompt);
      localStorage.removeItem(BRAIN_SEED_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const context = useMemo(() => ({
    identity: { firstName: user?.name?.split(' ')[0] || '', email },
    path: {
      stage: profile.stage || 'Not set',
      program: profile.program || 'Not set',
      graduation: profile.graduation || 'Not set',
      examDate: profile.examDate || 'Not set',
      studyHoursPerWeek: profile.studyHours || 'Not set',
      strongestArea: profile.strongArea || 'Not set',
      growthArea: profile.growthArea || 'Not set',
    },
    fieldwork: {
      totalHours: compliance.actualHours,
      unrestrictedHours: compliance.unrestrictedHours,
      restrictedHours: compliance.restrictedHours,
      unknownCategoryHours: compliance.unknownCategoryHours,
      unrestrictedPercent: Math.round(compliance.unrestrictedRatio * 1000) / 10,
      complianceAlerts: compliance.alerts.slice(0, 8).map((alert) => ({ label: alert.label, value: alert.value, requirement: alert.requirement })),
    },
    examLab: examResult ? {
      overallPercent: examResult.percent,
      byArea: examResult.byArea,
      completedAt: examResult.completedAt,
    } : null,
    weakAreaPlan: weakPlan ? {
      weakest: weakPlan.weakest,
      masteryTarget: weakPlan.masteryTarget,
      minutesPerDay: weakPlan.minutesPerDay,
    } : null,
    resourceVault: { savedCount: savedResourceIds.length },
  }), [user, email, profile, compliance, examResult, weakPlan, savedResourceIds.length]);

  const send = async (preset?: string) => {
    const message = String(preset || input).trim();
    const token = getStoredAccessToken();
    if (!message || isThinking) return;
    if (!token) {
      setStatus('SIGN IN REQUIRED');
      return;
    }

    const userMessage: Message = { id: `u_${Date.now()}`, role: 'user', content: message, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);
    setStatus('THINKING');
    setSavedArtifact('');

    try {
      const response = await fetch('/api/baker-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'bcba-brain',
          message,
          context,
          history: nextMessages.slice(-10).map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const payload = await response.json() as BrainResponse & { error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || 'Baker Brain could not answer that.');
      setMessages((current) => [...current, {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: payload.answer,
        response: payload,
        createdAt: new Date().toISOString(),
      }]);
      setStatus('ONLINE');
    } catch (error) {
      setStatus('RETRY');
      setMessages((current) => [...current, {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Baker Brain could not complete that turn. Try again.',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const saveArtifact = (artifact: Artifact) => {
    const current = safeParse<any[]>(BRAIN_RESOURCES_KEY, []);
    const item = {
      id: `brain_${Date.now()}`,
      ...artifact,
      stage: 'Exam prep',
      format: artifact.type,
      difficulty: 'Personalized',
      time: 'Custom',
      desc: artifact.summary,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(BRAIN_RESOURCES_KEY, JSON.stringify([item, ...current].slice(0, 50)));
    setSavedArtifact(artifact.title);
  };

  const clearConversation = () => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#0F0D0C] text-white">
      <div className="relative min-h-[calc(100dvh-72px)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[8%] h-[420px] w-[420px] rounded-full bg-[#E85D70]/10 blur-[120px]" />
          <div className="absolute right-[8%] top-[20%] h-[360px] w-[360px] rounded-full bg-[#D4A574]/10 blur-[110px]" />
          <div className="absolute bottom-[-10%] left-[38%] h-[430px] w-[430px] rounded-full bg-[#8FD0AD]/5 blur-[130px]" />
          <div className="absolute inset-0 opacity-[.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        </div>

        <div className="relative mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[280px_minmax(0,1fr)_310px] lg:px-5">
          <aside className="hidden rounded-[26px] border border-white/10 bg-white/[.045] p-4 backdrop-blur-xl lg:block">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><Brain size={18} className="text-[#FF7F92]" /> Baker Brain</div><span className="rounded-full bg-[#8FD0AD]/10 px-2 py-1 text-[9px] font-bold tracking-[.16em] text-[#8FD0AD]">{status}</span></div>
            <div className="mt-5 rounded-[22px] border border-[#E85D70]/20 bg-[#E85D70]/10 p-4"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#FF9AAA]">Mission</div><p className="mt-2 text-sm leading-6 text-white/75">Your 24/7 BCBA professor, study architect, fieldwork guide, and command layer for the entire platform.</p></div>

            <div className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Jump anywhere</div>
            <div className="mt-2 space-y-1">
              <Nav href="/my-path" icon={Compass} label="My Path" />
              <Nav href="/roadmap" icon={Route} label="Roadmap" />
              <Nav href="/exam-lab" icon={FlaskConical} label="Exam Lab" />
              <Nav href="/resources" icon={Library} label="Resource Vault" />
              <Nav href="/commons" icon={Users} label="Baker Commons" />
              <Nav href="/dashboard" icon={FileText} label="Fieldwork" />
            </div>

            <div className="mt-6 border-t border-white/10 pt-4"><button onClick={clearConversation} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/55 hover:bg-white/5">Start a fresh conversation</button></div>
          </aside>

          <main className="flex min-h-[calc(100dvh-104px)] flex-col rounded-[28px] border border-white/10 bg-[#161311]/85 shadow-2xl backdrop-blur-2xl">
            <header className="border-b border-white/10 px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#FF8EA0]"><Sparkles size={13} /> BCBA INTELLIGENCE CORE</div><h1 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">Ask anything about your BCBA journey.</h1></div><div className="relative hidden h-14 w-14 shrink-0 items-center justify-center sm:flex"><div className="absolute inset-0 rounded-full bg-[#E85D70]/25 blur-xl" /><div className={`relative h-10 w-10 rounded-full border border-[#FF91A0]/40 bg-gradient-to-br from-[#FF8EA0] via-[#E85D70] to-[#7A2F3C] shadow-[0_0_38px_rgba(232,93,112,.45)] ${isThinking ? 'animate-pulse' : ''}`}><div className="absolute inset-[7px] rounded-full border border-white/30" /></div></div></div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-[520px] max-w-4xl flex-col items-center justify-center text-center">
                  <div className="relative mb-6 h-28 w-28"><div className="absolute inset-0 rounded-full bg-[#E85D70]/20 blur-3xl" /><div className="absolute inset-3 rounded-full border border-[#FF9AAA]/20 bg-gradient-to-br from-[#321A20] to-[#171210] shadow-[0_0_70px_rgba(232,93,112,.22)]" /><div className="absolute inset-8 rounded-full bg-gradient-to-br from-[#FF91A0] to-[#8F3F4D] shadow-[0_0_35px_rgba(232,93,112,.4)]" /><Brain className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={30} /></div>
                  <div className="text-xs font-bold uppercase tracking-[.22em] text-[#FF91A0]">Baker Brain is listening</div>
                  <h2 className="mt-3 max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-5xl">Your BCBA professor that already knows where you are.</h2>
                  <p className="mt-4 max-w-2xl leading-7 text-white/55">Ask a concept, build a lesson, generate flashcards, review your exam weaknesses, inspect your fieldwork progress, or simply ask “what should I do next?” Baker Brain uses your platform context to answer.</p>
                  <div className="mt-7 grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">{quickStarts.map(({ label, icon: Icon, prompt }) => <button key={label} onClick={() => void send(prompt)} className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-[#E85D70]/40 hover:bg-[#E85D70]/5"><Icon size={17} className="text-[#FF91A0]" /><div className="mt-3 text-sm font-semibold text-white/85">{label}</div><div className="mt-1 text-xs leading-5 text-white/35">Personalized from your current data</div></button>)}</div>
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-5">{messages.map((message) => <MessageBubble key={message.id} message={message} onFollowUp={(text) => void send(text)} onSaveArtifact={saveArtifact} savedArtifact={savedArtifact} />)}{isThinking && <div className="flex items-center gap-3 text-sm text-white/50"><Loader2 size={17} className="animate-spin text-[#FF91A0]" /> Baker Brain is reasoning across your BCBA context…</div>}<div ref={bottomRef} /></div>
              )}
            </div>

            <div className="border-t border-white/10 p-4 sm:p-5">
              <div className="mx-auto max-w-4xl rounded-[22px] border border-white/10 bg-black/20 p-2 shadow-inner focus-within:border-[#E85D70]/45">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} placeholder="Ask Baker Brain anything BCBA-related…" className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/25" />
                <div className="flex items-center justify-between gap-3 px-2 pb-1"><div className="text-[10px] text-white/25">Strictly BCBA • educational support • Shift+Enter for a new line</div><button onClick={() => void send()} disabled={!input.trim() || isThinking} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E85D70] text-white disabled:opacity-35"><Send size={16} /></button></div>
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-[26px] border border-white/10 bg-white/[.045] p-5 backdrop-blur-xl"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Live learner context</div><div className="mt-4 space-y-3"><ContextRow label="BCBA stage" value={profile.stage || 'Set in My Path'} /><ContextRow label="Fieldwork" value={`${compliance.actualHours.toFixed(1)} hrs`} /><ContextRow label="Unrestricted" value={`${(compliance.unrestrictedRatio * 100).toFixed(1)}%`} /><ContextRow label="Last exam" value={examResult ? `${examResult.percent}%` : 'No full exam yet'} /><ContextRow label="Study time" value={profile.studyHours ? `${profile.studyHours} hrs/week` : 'Not set'} /></div></div>

            <div className="rounded-[26px] border border-white/10 bg-white/[.045] p-5 backdrop-blur-xl"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35"><Target size={13} /> Weak-area radar</div>{weakPlan?.weakest?.length ? <div className="mt-4 space-y-3">{weakPlan.weakest.slice(0, 3).map((area: any) => <div key={area.areaId}><div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/65">{area.areaId}. {area.area}</span><span className="font-mono font-bold text-[#FF91A0]">{area.percent}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#E85D70]" style={{ width: `${Math.max(6, area.percent)}%` }} /></div></div>)}</div> : <div className="mt-3 text-sm leading-6 text-white/40">Finish a full Exam Lab simulation and Baker Brain will automatically use your weakest areas to teach you.</div>}<Link to="/exam-lab" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FF91A0]">Open Exam Lab <ArrowRight size={12} /></Link></div>

            {latestAssistant?.response?.artifact && <div className="rounded-[26px] border border-[#D4A574]/20 bg-[#D4A574]/10 p-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#F4C895]"><BookOpen size={13} /> Latest created resource</div><div className="mt-3 font-serif text-lg font-semibold">{latestAssistant.response.artifact.title}</div><p className="mt-2 text-xs leading-5 text-white/50">{latestAssistant.response.artifact.summary}</p><button onClick={() => saveArtifact(latestAssistant.response!.artifact!)} className="mt-4 w-full rounded-xl bg-[#D4A574] px-3 py-2.5 text-xs font-bold text-[#241B16]">Save to Resource Vault</button></div>}
          </aside>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onFollowUp, onSaveArtifact, savedArtifact }: { message: Message; onFollowUp: (text: string) => void; onSaveArtifact: (artifact: Artifact) => void; savedArtifact: string }) {
  if (message.role === 'user') return <div className="ml-auto max-w-[82%] rounded-[22px] rounded-br-md bg-[#E85D70] px-4 py-3 text-sm leading-6 text-white shadow-lg">{message.content}</div>;
  const response = message.response;
  return <div className="max-w-[94%] rounded-[24px] rounded-bl-md border border-white/10 bg-white/[.045] p-5"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#FF91A0]"><Brain size={13} /> Baker Brain {response?.mode ? `· ${response.mode.replace('_', ' ')}` : ''}</div><div className="whitespace-pre-wrap text-sm leading-7 text-white/80">{message.content}</div>
    {response?.artifact && <div className="mt-5 rounded-[20px] border border-[#D4A574]/20 bg-[#D4A574]/10 p-4"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#F4C895]">{response.artifact.type} · {response.artifact.topic}</div><div className="mt-2 font-serif text-xl font-semibold">{response.artifact.title}</div><p className="mt-2 text-sm text-white/60">{response.artifact.summary}</p><div className="mt-3 space-y-2">{response.artifact.sections.map((section, index) => <div key={`${response.artifact!.title}-${index}`} className="rounded-xl bg-black/15 px-3 py-2.5 text-xs leading-5 text-white/65">{section}</div>)}</div><button onClick={() => onSaveArtifact(response.artifact!)} className="mt-4 rounded-xl bg-[#D4A574] px-4 py-2.5 text-xs font-bold text-[#241B16]">{savedArtifact === response.artifact.title ? 'Saved to Vault ✓' : 'Save to Resource Vault'}</button></div>}
    {response?.actions?.length ? <div className="mt-4 flex flex-wrap gap-2">{response.actions.map((action) => <Link key={`${action.href}-${action.label}`} to={action.href} title={action.reason} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E85D70]/25 bg-[#E85D70]/10 px-3 py-2 text-xs font-bold text-[#FF9AAA]">{action.label} <ArrowRight size={12} /></Link>)}</div> : null}
    {response?.citations?.length ? <div className="mt-4 border-t border-white/10 pt-3"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-white/30">Official sources</div><div className="mt-2 flex flex-wrap gap-2">{response.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#8FD0AD] hover:underline">{citation.label} <ExternalLink size={10} /></a>)}</div></div> : null}
    {response?.followUps?.length ? <div className="mt-4 flex flex-wrap gap-2">{response.followUps.slice(0, 4).map((followUp) => <button key={followUp} onClick={() => onFollowUp(followUp)} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/50 hover:border-[#E85D70]/30 hover:text-white/80">{followUp}</button>)}</div> : null}
  </div>;
}

function Nav({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return <Link to={href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/5 hover:text-white"><Icon size={15} className="text-[#FF91A0]" /> {label}</Link>;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5 last:border-0"><span className="text-xs text-white/35">{label}</span><span className="text-right text-xs font-semibold text-white/75">{value}</span></div>;
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Brain, CalendarDays, CheckCircle2, Clock3, Compass, FileText, FlaskConical, Route, Sparkles, Users } from 'lucide-react';
import { getCurrentUserEmail, loadEntries } from '@/lib/fieldworkStore';
import { evaluateCompliance } from '@/lib/compliance2027';
import { useAuth } from '@/hooks/useAuth';

type PathProfile = {
  stage: string;
  program: string;
  graduation: string;
  examDate: string;
  studyHours: string;
  strongArea: string;
  growthArea: string;
};

const PROFILE_KEY = 'fieldworkByBaker:pathProfile:v1';
const blank: PathProfile = { stage: 'Fieldwork + exam preparation', program: '', graduation: '', examDate: '', studyHours: '6', strongArea: '', growthArea: '' };

function loadProfile(): PathProfile {
  try { return { ...blank, ...(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') as Partial<PathProfile>) }; } catch { return blank; }
}

export default function MyPath() {
  const { user } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const entries = useMemo(() => loadEntries(email), [email]);
  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);
  const [profile, setProfile] = useState<PathProfile>(() => loadProfile());
  const [editing, setEditing] = useState(false);

  const save = () => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setEditing(false); };
  const latestMonth = [...compliance.months].sort((a, b) => b.month.localeCompare(a.month))[0];
  const progress = Math.min(100, Math.max(8, Math.round((compliance.actualHours / 2000) * 100)));

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Compass size={17} /> My Path</div><h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Your BCBA journey, organized around you.</h1><p className="mt-2 max-w-3xl text-[#6B5D54] dark:text-[#CFC4BE]">Your study plan, supervised fieldwork, exam prep, saved resources, community activity, and next best move in one place.</p></div>
          <button onClick={() => setEditing(true)} className="rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:bg-white/5 dark:text-[#E7DED9]">Personalize My Path</button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[30px] bg-[#332C28] p-7 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-white/50">Current stage</div><div className="mt-2 font-serif text-3xl font-semibold">{profile.stage}</div><p className="mt-2 text-sm text-white/65">Baker uses your stage to prioritize what appears here first.</p></div><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[8px] border-white/10 bg-white/5"><span className="font-mono text-2xl font-semibold text-[#F4C895]">{progress}%</span></div></div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3"><Mini label="Recorded fieldwork" value={`${compliance.actualHours.toFixed(1)}h`} /><Mini label="Unrestricted" value={`${(compliance.unrestrictedRatio * 100).toFixed(0)}%`} /><Mini label="Exam target" value={profile.examDate || 'Set a date'} /></div>
          </div>

          <div className="rounded-[30px] border border-[#F0D5DA] bg-[#FFF6F8] p-7 dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10">
            <div className="flex items-center gap-2 text-sm font-bold text-[#D94D62] dark:text-[#FF8EA0]"><Sparkles size={17} /> Your next best action</div><h2 className="mt-3 font-serif text-2xl font-semibold text-[#332C28] dark:text-white">{latestMonth && latestMonth.supervisionRatio < .05 ? 'Protect this month’s supervision ratio.' : profile.growthArea ? `Strengthen ${profile.growthArea}.` : 'Build your personalized study loop.'}</h2><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Baker Brain can turn your current progress into a focused action plan, then send you directly into Exam Lab or the right resource.</p><Link to="/baker-brain" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-4 py-2.5 text-sm font-bold text-white"><Brain size={16} /> Continue Where You Left Off</Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card icon={Clock3} title="Fieldwork progress" value={latestMonth ? `${latestMonth.totalHours.toFixed(1)}h this month` : 'No hours yet'} text="Review supervision, observation, restricted/unrestricted balance, and pending approvals." href="/dashboard" cta="Open fieldwork" />
          <Card icon={FlaskConical} title="Exam Lab" value="Practice smarter" text={`Focus adaptive sets around ${profile.growthArea || 'your weakest content areas'}.`} href="/exam-lab" cta="Start practice" />
          <Card icon={Users} title="Baker Commons" value="Your people are here" text="Join exam-date cohorts, study groups, fieldwork discussions, and professional Q&A." href="/commons" cta="Open Commons" />
          <Card icon={FileText} title="Saved resources" value="Build your collection" text="Keep study guides, templates, notes, and career tools organized in one vault." href="/resources" cta="Open Vault" />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2"><Route size={18} className="text-[#E85D70]" /><h3 className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">Roadmap progress</h3></div><p className="mt-2 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Keep education, fieldwork, application, exam, and career milestones in one updateable path.</p><Link to="/roadmap" className="mt-4 inline-block text-sm font-bold text-[#E85D70]">Continue roadmap →</Link></div>
          <div className="rounded-[28px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-[#D4A574]" /><h3 className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">Upcoming dates</h3></div><div className="mt-4 space-y-3 text-sm"><Row label="Expected graduation" value={profile.graduation || 'Not set'} /><Row label="Exam target" value={profile.examDate || 'Not set'} /><Row label="Study availability" value={`${profile.studyHours || '0'} hrs/week`} /></div></div>
          <div className="rounded-[28px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#5FA37E]" /><h3 className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">Personalization snapshot</h3></div><div className="mt-4 space-y-3 text-sm"><Row label="Program" value={profile.program || 'Add your program'} /><Row label="Strong area" value={profile.strongArea || 'Tell Baker'} /><Row label="Needs focus" value={profile.growthArea || 'Tell Baker'} /></div></div>
        </section>
      </div>

      {editing && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-white p-7 shadow-2xl dark:bg-[#211D1A]"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-bold text-[#E85D70]">Personalized onboarding</div><h2 className="mt-1 font-serif text-3xl font-semibold text-[#332C28] dark:text-white">Teach Baker where you are.</h2></div><button onClick={() => setEditing(false)} className="text-sm text-[#A8998E]">Close</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Current stage" value={profile.stage} onChange={(v) => setProfile({ ...profile, stage: v })} /><Field label="Current program" value={profile.program} onChange={(v) => setProfile({ ...profile, program: v })} /><Field label="Expected graduation" value={profile.graduation} type="date" onChange={(v) => setProfile({ ...profile, graduation: v })} /><Field label="Exam target" value={profile.examDate} type="date" onChange={(v) => setProfile({ ...profile, examDate: v })} /><Field label="Study hours / week" value={profile.studyHours} type="number" onChange={(v) => setProfile({ ...profile, studyHours: v })} /><Field label="Strongest content area" value={profile.strongArea} onChange={(v) => setProfile({ ...profile, strongArea: v })} /><Field label="Area where you need help" value={profile.growthArea} onChange={(v) => setProfile({ ...profile, growthArea: v })} /></div><button onClick={save} className="mt-6 w-full rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-bold text-white">Save & personalize my platform</button></div></div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-white/50">{label}</div><div className="mt-1 font-mono text-lg font-semibold">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-[#F2EDEA] pb-2 last:border-0 dark:border-white/10"><span className="text-[#A8998E]">{label}</span><span className="text-right font-semibold text-[#4D423C] dark:text-[#E7DED9]">{value}</span></div>; }
function Card({ icon: Icon, title, value, text, href, cta }: any) { return <Link to={href} className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-[#211D1A]"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Icon size={19} /></div><div className="mt-4 text-xs font-bold uppercase tracking-[.15em] text-[#A8998E]">{title}</div><div className="mt-1 font-serif text-xl font-semibold text-[#332C28] dark:text-white">{value}</div><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p><div className="mt-4 text-sm font-bold text-[#E85D70]">{cta} →</div></Link>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-sm font-medium text-[#6B5D54] dark:text-[#CFC4BE]">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-[#332C28] outline-none focus:border-[#E85D70] dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>; }

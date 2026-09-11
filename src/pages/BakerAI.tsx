import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, Mic, MicOff, Send, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import type { ActivityType, FieldworkType, HourEntry } from '@/types';
import { evaluateCompliance, BACB_2027_SOURCES } from '@/lib/compliance2027';
import { appendEntries, getCurrentUserEmail, loadEntries, newId } from '@/lib/fieldworkStore';
import { getStoredAccessToken } from '@/hooks/useAuth';

type AiResult = {
  date: string;
  duration: number;
  fieldworkType: FieldworkType;
  activityCategory: 'RESTRICTED' | 'UNRESTRICTED';
  activityType: ActivityType;
  supervisorName: string;
  supervisionMinutes: number;
  observationMinutes: number;
  individualSupervisionMinutes: number;
  clientInitials: string;
  suggestedSetting: string;
  narrative: string;
  confidence: number;
  rationale: string;
  flags: string[];
  needsSupervisorReview: boolean;
};

export default function BakerAI() {
  const email = getCurrentUserEmail() || '';
  const [entries, setEntries] = useState<HourEntry[]>(() => loadEntries(email));
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<AiResult | null>(null);
  const [provider, setProvider] = useState('');
  const [message, setMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const compliance = useMemo(() => evaluateCompliance(entries), [entries]);

  const askBaker = async () => {
    const token = getStoredAccessToken();
    if (!token || text.trim().length < 3) {
      setMessage('Describe the session first.');
      return;
    }

    setIsThinking(true);
    setMessage('');
    setResult(null);
    try {
      const response = await fetch('/api/baker-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          date,
          context: {
            actualHours: compliance.actualHours,
            weightedEquivalentHours: compliance.weightedEquivalentHours,
            unrestrictedRatio: compliance.unrestrictedRatio,
            alerts: compliance.alerts.slice(0, 5).map((alert) => ({ label: alert.label, requirement: alert.requirement })),
          },
        }),
      });
      const payload = await response.json() as { result?: AiResult; provider?: string; error?: string; warning?: string };
      if (!response.ok || !payload.result) {
        setMessage(payload.error || 'Baker AI could not analyze that entry.');
        return;
      }
      setResult(payload.result);
      setProvider(payload.provider || 'Baker AI');
      setMessage(payload.warning || 'Review the proposed entry, then confirm it.');
    } catch {
      setMessage('Baker AI could not connect. Try again in a moment.');
    } finally {
      setIsThinking(false);
    }
  };

  const startVoice = () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMessage('Voice dictation is not supported by this browser. You can still type the entry.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setMessage('Voice dictation stopped. You can retry or type the entry.');
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) setText((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.start();
  };

  const confirmEntry = () => {
    if (!result || !email || result.duration <= 0) {
      setMessage('A positive duration is required before saving.');
      return;
    }
    const now = new Date().toISOString();
    const entry: HourEntry = {
      id: newId('baker_ai'),
      userId: email,
      date: result.date || date,
      startTime: '00:00',
      endTime: '00:00',
      duration: Number(result.duration),
      fieldworkType: result.fieldworkType,
      activityType: result.activityType,
      activityCategory: result.activityCategory,
      supervisorId: result.supervisorName
        ? `ai_${result.supervisorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
        : 'ai_unknown',
      supervisorName: result.supervisorName || 'Not specified',
      setting: result.suggestedSetting || '',
      notes: result.narrative,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      supervisionMinutes: result.supervisionMinutes,
      observationMinutes: result.observationMinutes,
      individualSupervisionMinutes: result.individualSupervisionMinutes,
      clientInitials: result.clientInitials || undefined,
      aiGenerated: true,
      aiConfidence: result.confidence,
      aiRationale: result.rationale,
      aiSourceText: text,
    };

    const next = appendEntries([entry], email);
    setEntries(next);
    setResult(null);
    setText('');
    setMessage('Entry saved as Pending for supervisor review.');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-[#E85D70] text-sm font-semibold mb-2">
              <Sparkles size={17} /> Baker AI
            </div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Talk naturally. Baker structures the entry.</h1>
            <p className="text-[#6B5D54] max-w-2xl">AI-assisted documentation with deterministic BACB 2027 compliance checks. Your supervisor remains the final reviewer.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/import" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2DAD5] bg-white text-sm text-[#6B5D54]">
              <Upload size={16} /> Batch Import
            </Link>
            <Link to="/dashboard" className="inline-flex items-center px-4 py-2.5 rounded-xl bg-[#332C28] text-white text-sm">Dashboard</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-6">
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <label className="text-sm text-[#6B5D54] sm:w-44">
                  Session date
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5" />
                </label>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[#4D423C]">Tell Baker what happened</label>
                    <button type="button" onClick={startVoice} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${isListening ? 'bg-[#FFF5F7] text-[#E85D70]' : 'bg-[#FAF8F6] text-[#6B5D54]'}`}>
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      {isListening ? 'Listening…' : 'Voice'}
                    </button>
                  </div>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={7}
                    placeholder="Example: I finished a 3-hour session with client JM. We ran preference assessments, I implemented a new DRA protocol, helped mom with the behavior plan, and Dr. Martinez supervised for 45 minutes."
                    className="w-full rounded-2xl border border-[#E2DAD5] px-4 py-3 text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-4 focus:ring-[#E85D70]/10 resize-y"
                  />
                </div>
              </div>

              <button onClick={askBaker} disabled={isThinking || text.trim().length < 3} className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl disabled:opacity-50">
                <Send size={16} /> {isThinking ? 'Baker is analyzing…' : 'Create perfect entry'}
              </button>
              {message && <p className="mt-3 text-sm text-[#7B6B62]">{message}</p>}
            </section>

            {result && (
              <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 lg:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#A8998E] mb-1">Proposed structured entry</p>
                    <h2 className="font-serif text-2xl font-semibold text-[#332C28]">Review before confirming</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#332C28]">{Math.round(result.confidence * 100)}% extraction confidence</div>
                    <div className="text-xs text-[#A8998E]">{provider}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <label className="text-xs text-[#A8998E]">Hours<input type="number" min="0" step="0.25" value={result.duration} onChange={(event) => setResult({ ...result, duration: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                  <label className="text-xs text-[#A8998E]">Category<select value={result.activityCategory} onChange={(event) => setResult({ ...result, activityCategory: event.target.value as AiResult['activityCategory'] })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm bg-white text-[#332C28]"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label>
                  <label className="text-xs text-[#A8998E]">Supervision min<input type="number" min="0" value={result.supervisionMinutes} onChange={(event) => setResult({ ...result, supervisionMinutes: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                  <label className="text-xs text-[#A8998E]">Supervisor<input value={result.supervisorName} onChange={(event) => setResult({ ...result, supervisorName: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
                </div>

                <label className="block text-xs text-[#A8998E] mb-5">Professional narrative
                  <textarea value={result.narrative} onChange={(event) => setResult({ ...result, narrative: event.target.value })} rows={4} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-4 py-3 text-sm text-[#332C28]" />
                </label>

                <div className="rounded-2xl bg-[#FAF8F6] p-4 mb-5">
                  <div className="text-sm font-medium text-[#332C28] mb-1">Why Baker classified it this way</div>
                  <p className="text-sm text-[#6B5D54]">{result.rationale}</p>
                  {result.flags.length > 0 && <ul className="mt-3 space-y-1">{result.flags.map((flag) => <li key={flag} className="text-xs text-[#B36A2E] flex gap-2"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{flag}</li>)}</ul>}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="text-xs text-[#A8998E]">Saved entries are Pending—not automatically approved—until a supervisor verifies them.</div>
                  <button onClick={confirmEntry} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#5FA37E] text-white font-semibold text-sm"><CheckCircle2 size={17} /> Confirm & save</button>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="bg-[#332C28] text-white rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4"><ShieldCheck size={19} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold">Compliance Oracle</h2></div>
              <div className="text-5xl font-mono font-semibold mb-1">{compliance.bakerComplianceScore}</div>
              <div className="text-sm text-white/70 mb-5">Baker guidance score • {compliance.scoreLabel}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3"><div className="text-white/60 text-xs">Actual hours</div><div className="font-mono text-xl">{compliance.actualHours}</div></div>
                <div className="rounded-xl bg-white/10 p-3"><div className="text-white/60 text-xs">Equivalent progress</div><div className="font-mono text-xl">{compliance.weightedEquivalentHours}</div></div>
                <div className="rounded-xl bg-white/10 p-3"><div className="text-white/60 text-xs">Unrestricted</div><div className="font-mono text-xl">{(compliance.unrestrictedRatio * 100).toFixed(1)}%</div></div>
                <div className="rounded-xl bg-white/10 p-3"><div className="text-white/60 text-xs">Projected finish</div><div className="text-sm font-semibold mt-1">{compliance.projectedCompletion || 'Need more data'}</div></div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-4">What needs attention</h3>
              {compliance.alerts.length === 0 ? (
                <div className="flex items-start gap-2 text-sm text-[#5FA37E]"><CheckCircle2 size={17} className="mt-0.5" />No recorded-rule violations detected in the current data.</div>
              ) : (
                <div className="space-y-3">{compliance.alerts.slice(0, 6).map((alert) => <div key={alert.id} className="rounded-xl bg-[#FFF8F3] p-3"><div className="text-sm font-medium text-[#6B4A2E]">{alert.label}</div><div className="text-xs text-[#A36F45] mt-1">{alert.value} • {alert.requirement}</div></div>)}</div>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-2">Official BACB references</h3>
              <p className="text-xs text-[#A8998E] mb-4">Compliance guidance is linked to official BACB fieldwork sources; Baker&apos;s score itself is not a BACB metric.</p>
              <div className="space-y-2">{BACB_2027_SOURCES.slice(0, 6).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-sm text-[#E85D70] hover:underline">{source.title}</a>)}</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

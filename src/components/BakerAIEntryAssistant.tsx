import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, Lock, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import type { ActivityType, FieldworkType, HourEntry } from '@/types';
import { evaluateCompliance } from '@/lib/compliance2027';
import { appendEntries, hoursBetween, newId } from '@/lib/fieldworkStore';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

type WorkPresence = 'INDEPENDENT' | 'SUPERVISED';
type SupervisionFormat = 'INDIVIDUAL' | 'GROUP';
type ObservationMode = 'IN_PERSON' | 'ONLINE' | 'PHONE' | 'NONE';

type AiResult = {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  fieldworkType: FieldworkType;
  activityCategory: 'RESTRICTED' | 'UNRESTRICTED';
  activityType: ActivityType;
  supervisorName: string;
  organizationName: string;
  workPresence: WorkPresence;
  supervisionFormat: SupervisionFormat;
  supervisionMinutes: number;
  observationMinutes: number;
  observationMode: ObservationMode;
  clientInitials: string;
  suggestedSetting: string;
  narrative: string;
  confidence: number;
  rationale: string;
  flags: string[];
  missingFields: string[];
  needsSupervisorReview: boolean;
};

interface Props {
  email: string;
  entries: HourEntry[];
  onEntriesChange: (entries: HourEntry[]) => void;
}

const EXAMPLES = [
  'On 9/12 at Melmark Carolinas, Christina Hardy supervised me from 7:00 to 9:00. It was individual unrestricted supervision. She observed me with client Leo for 25 minutes in person while I reviewed behavior plans.',
  'I worked independently at Melmark Carolinas from 8:30 AM to 12:07 PM analyzing ABC data and revising a behavior plan. Carrie is responsible for this entry. This was unrestricted.',
  'Carrie and I met from 3:30 to 4:15 PM to discuss behavior plans. It was individual supervision with no client present, so there was no client observation.',
];

export default function BakerAIEntryAssistant({ email, entries, onEntriesChange }: Props) {
  const { hasPaidFeatures } = useAuth();
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
    if (!hasPaidFeatures || !token) {
      setMessage('Baker AI is available during your trial and with eligible paid plans.');
      return;
    }
    if (text.trim().length < 3) {
      setMessage('Tell Baker what happened during the session first.');
      return;
    }
    setIsThinking(true);
    setMessage('');
    setResult(null);
    try {
      const response = await fetch('/api/baker-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text,
          date,
          context: {
            actualHours: compliance.actualHours,
            unrestrictedHours: compliance.unrestrictedHours,
            restrictedHours: compliance.restrictedHours,
            unrestrictedRatio: compliance.unrestrictedRatio,
            alerts: compliance.alerts.slice(0, 6).map((alert) => ({ label: alert.label, requirement: alert.requirement })),
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
      setMessage(payload.warning || 'Review the proposed fields. Baker highlights anything still missing.');
    } catch {
      setMessage('Baker AI could not connect. Try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const startVoice = () => {
    const root = window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage('Voice dictation is not supported by this browser. Type the recap instead.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setMessage('Voice dictation stopped. Retry or type the recap.');
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) setText((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.start();
  };

  const elapsed = result?.startTime && result?.endTime ? hoursBetween(result.startTime, result.endTime) : 0;
  const displayedDuration = result ? (elapsed > 0 ? elapsed : Math.max(0, Number(result.duration) || 0)) : 0;

  const saveResult = () => {
    if (!result || !email || displayedDuration <= 0) {
      setMessage('A valid time range or positive duration is required.');
      return;
    }
    if (!result.organizationName.trim() || !result.supervisorName.trim()) {
      setMessage('Organization and responsible supervisor are required for every entry.');
      return;
    }
    const maxMinutes = Math.round(displayedDuration * 60);
    const supervised = result.workPresence === 'SUPERVISED';
    const supervisionMinutes = supervised ? Math.min(maxMinutes, Math.max(0, Number(result.supervisionMinutes) || 0)) : 0;
    const observationMinutes = supervised ? Math.min(maxMinutes, Math.max(0, Number(result.observationMinutes) || 0)) : 0;
    const now = new Date().toISOString();
    const entry = {
      id: newId('baker_ai'),
      userId: email,
      date: result.date || date,
      startTime: result.startTime || '00:00',
      endTime: result.endTime || '00:00',
      duration: displayedDuration,
      fieldworkType: result.fieldworkType,
      activityType: result.activityType,
      activityCategory: result.activityCategory,
      supervisorId: `ai_${result.supervisorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      supervisorName: result.supervisorName.trim(),
      setting: result.suggestedSetting || result.organizationName,
      notes: result.narrative,
      status: 'PENDING' as const,
      createdAt: now,
      updatedAt: now,
      supervisionMinutes: supervisionMinutes || undefined,
      observationMinutes: observationMinutes || undefined,
      individualSupervisionMinutes: supervised && result.supervisionFormat === 'INDIVIDUAL' ? supervisionMinutes || undefined : undefined,
      clientInitials: observationMinutes > 0 ? result.clientInitials || undefined : undefined,
      aiGenerated: true,
      aiConfidence: result.confidence,
      aiRationale: result.rationale,
      aiSourceText: text,
      organizationName: result.organizationName.trim(),
      workPresence: result.workPresence,
      supervisionFormat: supervised ? result.supervisionFormat : undefined,
      observationMode: observationMinutes > 0 && result.observationMode !== 'NONE' ? result.observationMode : undefined,
    } as HourEntry;
    onEntriesChange(appendEntries([entry], email));
    setResult(null);
    setText('');
    setMessage('Saved as Pending for supervisor review.');
  };

  return (
    <section className="rounded-3xl border border-[#F0D5DA] bg-gradient-to-br from-[#FFF5F7] via-white to-[#FFF8F3] p-6 lg:p-8 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-[#E85D70] text-sm font-semibold mb-2"><Sparkles size={17} /> Baker AI · complete fieldwork entry</div>
          <h2 className="font-serif text-2xl lg:text-3xl font-semibold text-[#332C28] mb-2">Say it naturally. Baker fills the tracker.</h2>
          <p className="text-sm text-[#6B5D54] max-w-3xl">Include the organization, responsible supervisor, time range, whether the BCBA was present, restricted/unrestricted status, and any client observation. Baker fills what it can and tells you what is missing.</p>
        </div>
        {!hasPaidFeatures && <Link to="/upgrade" className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] text-white px-4 py-2.5 text-sm font-semibold shrink-0"><Lock size={15} /> Unlock Baker AI</Link>}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">{['Supervisor + organization', 'Time → exact decimal', 'Independent vs supervised', 'Restricted vs unrestricted', 'Individual vs group', 'Observation minutes + mode'].map((item) => <span key={item} className="rounded-full bg-white border border-[#F0D5DA] px-3 py-1.5 text-xs font-medium text-[#6B5D54]">{item}</span>)}</div>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
        <label className="text-xs font-medium text-[#7B6B62]">Default date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field-input" /></label>
        <div>
          <div className="flex items-center justify-between gap-3 mb-2"><label className="text-xs font-medium text-[#7B6B62]">What happened?</label><button type="button" onClick={startVoice} disabled={!hasPaidFeatures} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 ${isListening ? 'bg-[#E85D70] text-white' : 'bg-white border border-[#F0D5DA] text-[#E85D70]'}`}>{isListening ? <MicOff size={15} /> : <Mic size={15} />}{isListening ? 'Listening…' : 'Speak instead'}</button></div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} disabled={!hasPaidFeatures} rows={5} placeholder="Christina Hardy supervised me at Melmark Carolinas on 9/12 from 7 to 9. It was individual unrestricted. She observed me with Leo for 25 minutes in person while I reviewed behavior plans." className="w-full rounded-2xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-4 focus:ring-[#E85D70]/10 disabled:opacity-60" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">{EXAMPLES.map((example, index) => <button key={example} type="button" onClick={() => hasPaidFeatures && setText(example)} disabled={!hasPaidFeatures} className="text-left rounded-xl border border-[#F2EDEA] bg-white px-3 py-3 text-xs leading-relaxed text-[#6B5D54] hover:border-[#E85D70]"><strong className="text-[#E85D70]">Example {index + 1}: </strong>{example}</button>)}</div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3"><button onClick={askBaker} disabled={!hasPaidFeatures || isThinking || text.trim().length < 3} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"><Send size={16} /> {isThinking ? 'Baker is analyzing…' : 'Build my entry'}</button>{message && <span className="text-sm text-[#7B6B62]">{message}</span>}</div>

      {result && (
        <div className="mt-6 rounded-2xl border border-[#E2DAD5] bg-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5"><div><div className="text-xs uppercase tracking-wider text-[#A8998E]">Baker’s proposed entry</div><h3 className="font-serif text-xl font-semibold text-[#332C28] mt-1">Review before saving</h3></div><div className="text-xs text-[#A8998E]">{Math.round(result.confidence * 100)}% extraction confidence · {provider}</div></div>

          {result.missingFields.length > 0 && <div className="mb-4 rounded-xl border border-[#F2D4B8] bg-[#FFF8F3] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#8A5D36]"><AlertTriangle size={15} /> Still needed</div><div className="text-xs text-[#A36F45] mt-2">{result.missingFields.join(' • ')}</div></div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <label className="text-xs text-[#A8998E]">Date<input type="date" value={result.date} onChange={(event) => setResult({ ...result, date: event.target.value })} className="field-input" /></label>
            <label className="text-xs text-[#A8998E]">Start<input type="time" value={result.startTime} onChange={(event) => setResult({ ...result, startTime: event.target.value })} className="field-input" /></label>
            <label className="text-xs text-[#A8998E]">End<input type="time" value={result.endTime} onChange={(event) => setResult({ ...result, endTime: event.target.value })} className="field-input" /></label>
            <div className="rounded-xl bg-[#FFF5F7] px-3 py-2"><div className="text-xs text-[#A8998E]">Exact decimal</div><div className="font-mono text-xl text-[#E85D70] mt-1">{displayedDuration.toFixed(2)}h</div></div>
            <label className="text-xs text-[#A8998E]">Organization<input value={result.organizationName} onChange={(event) => setResult({ ...result, organizationName: event.target.value })} className="field-input" /></label>
            <label className="text-xs text-[#A8998E]">Responsible supervisor<input value={result.supervisorName} onChange={(event) => setResult({ ...result, supervisorName: event.target.value })} className="field-input" /></label>
            <label className="text-xs text-[#A8998E]">Entry type<select value={result.workPresence} onChange={(event) => setResult({ ...result, workPresence: event.target.value as WorkPresence })} className="field-input bg-white"><option value="INDEPENDENT">Independent</option><option value="SUPERVISED">Supervised</option></select></label>
            <label className="text-xs text-[#A8998E]">Category<select value={result.activityCategory} onChange={(event) => setResult({ ...result, activityCategory: event.target.value as AiResult['activityCategory'] })} className="field-input bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label>
            {result.workPresence === 'SUPERVISED' && <label className="text-xs text-[#A8998E]">Format<select value={result.supervisionFormat} onChange={(event) => setResult({ ...result, supervisionFormat: event.target.value as SupervisionFormat })} className="field-input bg-white"><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></select></label>}
            {result.workPresence === 'SUPERVISED' && <label className="text-xs text-[#A8998E]">Supervision min<input type="number" min="0" value={result.supervisionMinutes} onChange={(event) => setResult({ ...result, supervisionMinutes: Number(event.target.value) })} className="field-input" /></label>}
            {result.workPresence === 'SUPERVISED' && <label className="text-xs text-[#A8998E]">Observation min<input type="number" min="0" value={result.observationMinutes} onChange={(event) => setResult({ ...result, observationMinutes: Number(event.target.value) })} className="field-input" /></label>}
            {result.workPresence === 'SUPERVISED' && result.observationMinutes > 0 && <label className="text-xs text-[#A8998E]">Observation mode<select value={result.observationMode} onChange={(event) => setResult({ ...result, observationMode: event.target.value as ObservationMode })} className="field-input bg-white"><option value="IN_PERSON">In person</option><option value="ONLINE">Online / video</option><option value="PHONE">Phone</option><option value="NONE">Not stated</option></select></label>}
            {result.workPresence === 'SUPERVISED' && result.observationMinutes > 0 && <label className="text-xs text-[#A8998E]">Client<input value={result.clientInitials} onChange={(event) => setResult({ ...result, clientInitials: event.target.value })} className="field-input" /></label>}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4"><div className="rounded-xl bg-[#E8F5EE] px-4 py-3"><div className="text-[10px] uppercase text-[#5FA37E]">Unrestricted</div><div className="font-mono text-xl text-[#3F7F5C]">{result.activityCategory === 'UNRESTRICTED' ? displayedDuration.toFixed(2) : '0.00'}h</div></div><div className="rounded-xl bg-[#FFF3E0] px-4 py-3"><div className="text-[10px] uppercase text-[#B77722]">Restricted</div><div className="font-mono text-xl text-[#9D651B]">{result.activityCategory === 'RESTRICTED' ? displayedDuration.toFixed(2) : '0.00'}h</div></div></div>

          <label className="block text-xs text-[#A8998E] mb-4">Activity description<textarea value={result.narrative} onChange={(event) => setResult({ ...result, narrative: event.target.value })} rows={3} className="field-input resize-none" /></label>
          {result.flags.length > 0 && <div className="rounded-xl bg-[#FAF8F6] p-4 mb-4 space-y-1">{result.flags.map((flag) => <div key={flag} className="flex gap-2 text-xs text-[#B36A2E]"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{flag}</div>)}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p className="text-xs text-[#A8998E]">Supervisor verification remains human-controlled.</p><button onClick={saveResult} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Save as Pending</button></div>
        </div>
      )}
    </section>
  );
}

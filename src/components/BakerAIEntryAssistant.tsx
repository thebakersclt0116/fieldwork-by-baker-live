import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Bot, CheckCircle2, Lock, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import type { ActivityType, FieldworkType, HourEntry } from '@/types';
import { evaluateCompliance } from '@/lib/compliance2027';
import { appendEntries, newId } from '@/lib/fieldworkStore';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

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

interface Props {
  email: string;
  entries: HourEntry[];
  onEntriesChange: (entries: HourEntry[]) => void;
}

const EXAMPLES = [
  'I finished a 3-hour session with client JM. We ran preference assessments, I implemented a DRA protocol, helped mom with the behavior plan, and Dr. Martinez supervised for 45 minutes.',
  'I spent 2 hours analyzing ABC data, updated the behavior plan, and met individually with my supervisor for 20 minutes.',
  'I did 90 minutes of direct implementation with client AB. My supervisor observed me with the client for 30 minutes.',
];

const ABILITIES = [
  'Structures the entry',
  'Restricted vs unrestricted guidance',
  'Professional narrative',
  'Supervision extraction',
  'Compliance flags',
  'Supervisor-review confidence',
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
      setMessage('Baker AI is available on Individual, Professional, Enterprise, Emily beta, and owner accounts.');
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
            alerts: compliance.alerts.slice(0, 5).map((alert) => ({
              label: alert.label,
              requirement: alert.requirement,
            })),
          },
        }),
      });
      const payload = await response.json() as {
        result?: AiResult;
        provider?: string;
        error?: string;
        warning?: string;
      };
      if (!response.ok || !payload.result) {
        setMessage(payload.error || 'Baker AI could not analyze that entry.');
        return;
      }
      setResult(payload.result);
      setProvider(payload.provider || 'Baker AI');
      setMessage(payload.warning || 'Review Baker’s proposed fields, then confirm.');
    } catch {
      setMessage('Baker AI could not connect. Try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const startVoice = () => {
    const root = window as typeof window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SpeechRecognitionCtor = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMessage('Voice dictation is not supported by this browser. Type the recap instead.');
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
      setMessage('Voice dictation stopped. Retry or type the recap.');
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) setText((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.start();
  };

  const saveResult = () => {
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
      supervisionMinutes: result.supervisionMinutes || undefined,
      observationMinutes: result.observationMinutes || undefined,
      individualSupervisionMinutes: result.individualSupervisionMinutes || undefined,
      clientInitials: result.clientInitials || undefined,
      aiGenerated: true,
      aiConfidence: result.confidence,
      aiRationale: result.rationale,
      aiSourceText: text,
    };

    const next = appendEntries([entry], email);
    onEntriesChange(next);
    setResult(null);
    setText('');
    setMessage('Saved as Pending for supervisor review.');
  };

  return (
    <section className="rounded-3xl border border-[#F0D5DA] bg-gradient-to-br from-[#FFF5F7] via-white to-[#FFF8F3] p-6 lg:p-8 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-[#E85D70] text-sm font-semibold mb-2">
            <Sparkles size={17} /> Baker AI · fastest way to log hours
          </div>
          <h2 className="font-serif text-2xl lg:text-3xl font-semibold text-[#332C28] mb-2">Talk naturally. Baker builds the entry.</h2>
          <p className="text-sm text-[#6B5D54] max-w-2xl">Describe what happened like you would tell a supervisor. Baker structures the record, drafts the narrative, checks the current compliance picture, and flags anything that needs human review.</p>
        </div>
        {!hasPaidFeatures && (
          <Link to="/upgrade" className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] text-white px-4 py-2.5 text-sm font-semibold shrink-0">
            <Lock size={15} /> Unlock Baker AI
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {ABILITIES.map((ability) => (
          <span key={ability} className="rounded-full bg-white border border-[#F0D5DA] px-3 py-1.5 text-xs font-medium text-[#6B5D54]">{ability}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
        <label className="text-xs font-medium text-[#7B6B62]">
          Session date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-3 text-sm text-[#332C28]"
          />
        </label>
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-xs font-medium text-[#7B6B62]">What happened?</label>
            <button
              type="button"
              onClick={startVoice}
              disabled={!hasPaidFeatures}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 ${isListening ? 'bg-[#E85D70] text-white' : 'bg-white border border-[#F0D5DA] text-[#E85D70]'}`}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              {isListening ? 'Listening…' : 'Speak instead'}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={!hasPaidFeatures}
            rows={6}
            placeholder="Example: I finished a 3-hour session with client JM. We ran preference assessments, I implemented a DRA protocol, helped mom with the behavior plan, and Dr. Martinez supervised for 45 minutes."
            className="w-full rounded-2xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-4 focus:ring-[#E85D70]/10 disabled:bg-[#FAF8F6] disabled:text-[#A8998E]"
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#A8998E] mb-2">Try saying</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {EXAMPLES.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => hasPaidFeatures && setText(example)}
              className="text-left rounded-xl border border-[#F2EDEA] bg-white px-3 py-3 text-xs leading-relaxed text-[#6B5D54] hover:border-[#E85D70] disabled:opacity-50"
              disabled={!hasPaidFeatures}
            >
              <span className="font-semibold text-[#E85D70]">Example {index + 1}: </span>{example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={askBaker}
          disabled={!hasPaidFeatures || isThinking || text.trim().length < 3}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Send size={16} /> {isThinking ? 'Baker is analyzing…' : 'Build my entry'}
        </button>
        {message && <span className="text-sm text-[#7B6B62]">{message}</span>}
      </div>

      {result && (
        <div className="mt-6 rounded-2xl border border-[#E2DAD5] bg-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#A8998E]">Baker’s proposed entry</div>
              <h3 className="font-serif text-xl font-semibold text-[#332C28] mt-1">Review before you confirm</h3>
            </div>
            <div className="text-sm text-[#6B5D54]">
              <span className="font-semibold text-[#332C28]">{Math.round(result.confidence * 100)}%</span> extraction confidence · {provider}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <label className="text-xs text-[#A8998E]">Hours<input type="number" min="0" step="0.25" value={result.duration} onChange={(event) => setResult({ ...result, duration: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
            <label className="text-xs text-[#A8998E]">Category<select value={result.activityCategory} onChange={(event) => setResult({ ...result, activityCategory: event.target.value as AiResult['activityCategory'] })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm text-[#332C28]"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option></select></label>
            <label className="text-xs text-[#A8998E]">Supervision min<input type="number" min="0" value={result.supervisionMinutes} onChange={(event) => setResult({ ...result, supervisionMinutes: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
            <label className="text-xs text-[#A8998E]">Supervisor<input value={result.supervisorName} onChange={(event) => setResult({ ...result, supervisorName: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-3 py-2.5 text-sm text-[#332C28]" /></label>
          </div>

          <label className="block text-xs text-[#A8998E] mb-4">Professional narrative
            <textarea value={result.narrative} onChange={(event) => setResult({ ...result, narrative: event.target.value })} rows={4} className="mt-1.5 w-full rounded-xl border border-[#E2DAD5] px-4 py-3 text-sm text-[#332C28]" />
          </label>

          <div className="rounded-xl bg-[#FAF8F6] p-4 mb-4">
            <div className="flex items-start gap-2 text-sm text-[#4D423C]"><Bot size={16} className="text-[#E85D70] shrink-0 mt-0.5" /><span>{result.rationale}</span></div>
            {result.flags.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.flags.map((flag) => <div key={flag} className="flex gap-2 text-xs text-[#B36A2E]"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{flag}</div>)}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#A8998E]">Baker AI assists with documentation. A qualified supervisor—not the AI—makes the final fieldwork acceptability/verification decision.</p>
            <button onClick={saveResult} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FA37E] px-5 py-3 text-sm font-semibold text-white shrink-0"><CheckCircle2 size={16} /> Confirm & save</button>
          </div>
        </div>
      )}
    </section>
  );
}

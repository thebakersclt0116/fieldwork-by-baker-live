import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Bot, CheckCircle2, ClipboardCheck, Copy, Mail, MessageSquare, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react';

type ReviewEntry = {
  id: string;
  date: string;
  duration: number;
  activityCategory: 'RESTRICTED' | 'UNRESTRICTED';
  narrative: string;
  supervisorName?: string;
  supervisionMinutes?: number;
};

type SupervisorSession = {
  supervisor: { name: string; email: string };
  superviseeEmail: string;
  reviewEntry: ReviewEntry | null;
  expiresAt: string;
};

type SupervisorAiDraft = {
  recommendedStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  note: string;
  message: string;
  confidence: number;
  concerns: string[];
  rationale: string;
  provider: string;
};

const AI_EXAMPLES = [
  'Does this entry need clarification? Draft a concise supervisor note.',
  'Rewrite the feedback professionally and supportively without adding facts.',
  'Check the documented supervision details and tell me what information may be missing.',
  'Draft a message asking the supervisee to clarify the restricted vs unrestricted classification.',
];

const AI_ABILITIES = [
  'Review-entry triage',
  'Draft supervisor notes',
  'Draft supervisee messages',
  'Flag missing details',
  'BACB-rule context',
  'Human-controlled final status',
];

export default function SupervisorView() {
  const { token = '' } = useParams();
  const [session, setSession] = useState<SupervisorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'VERIFIED' | 'PENDING' | 'REJECTED'>('PENDING');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');
  const [subject, setSubject] = useState('Fieldwork by Baker supervisor feedback');
  const [submitting, setSubmitting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState<SupervisorAiDraft | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    let active = true;
    const validate = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/supervisor-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json() as SupervisorSession & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Invalid supervisor invite.');
        if (active) setSession(payload);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Invalid supervisor invite.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void validate();
    return () => { active = false; };
  }, [token]);

  const emailBody = useMemo(() => {
    if (!session) return '';
    return [
      `Supervisor: ${session.supervisor.name}`,
      `Review status: ${status}`,
      note ? `Supervisor note: ${note}` : '',
      message ? `Message: ${message}` : '',
      feedbackUrl ? `Apply this signed feedback in Fieldwork by Baker: ${feedbackUrl}` : '',
    ].filter(Boolean).join('\n\n');
  }, [feedbackUrl, message, note, session, status]);

  const askBaker = async () => {
    if (!session?.reviewEntry) {
      setAiError('Baker AI needs a review link tied to a specific entry.');
      return;
    }
    setAiThinking(true);
    setAiError('');
    setAiDraft(null);
    try {
      const response = await fetch('/api/supervisor-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request: aiPrompt }),
      });
      const payload = await response.json() as SupervisorAiDraft & { error?: string };
      if (!response.ok || !payload.note || !payload.message) {
        throw new Error(payload.error || 'Baker AI could not draft the review.');
      }
      setAiDraft(payload);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Baker AI could not draft the review.');
    } finally {
      setAiThinking(false);
    }
  };

  const applyAiDraft = () => {
    if (!aiDraft) return;
    setNote(aiDraft.note);
    setMessage(aiDraft.message);
  };

  const submitFeedback = async () => {
    if (!session?.reviewEntry) {
      setError('This invite is not tied to a specific fieldwork entry. Ask the supervisee to share an entry review link.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/supervisor-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entryId: session.reviewEntry.id,
          status,
          note,
          message,
        }),
      });
      const payload = await response.json() as { path?: string; subject?: string; error?: string };
      if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create signed feedback.');
      setFeedbackUrl(`${window.location.origin}${payload.path}`);
      if (payload.subject) setSubject(payload.subject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create signed feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-[70vh] bg-[#FFFCF9] flex items-center justify-center text-sm text-[#A8998E]">Validating secure supervisor invite…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-[70vh] bg-[#FFFCF9] flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-[#F2EDEA] p-8 text-center shadow-sm">
          <XCircle size={34} className="mx-auto text-[#C9445A] mb-4" />
          <h1 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">Supervisor link unavailable</h1>
          <p className="text-sm text-[#A8998E]">{error || 'This invite is invalid or expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#5FA37E] text-sm font-semibold mb-2"><ShieldCheck size={17} /> Secure supervisor beta access</div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Review fieldwork with Baker AI</h1>
            <p className="text-[#6B5D54]">Invited as {session.supervisor.name}. This signed link is scoped to {session.superviseeEmail}.</p>
          </div>
          <div className="text-xs text-[#A8998E]">Expires {new Date(session.expiresAt).toLocaleDateString()}</div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[.85fr_1.15fr] gap-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5"><ClipboardCheck size={19} className="text-[#E85D70]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Shared entry</h2></div>
            {session.reviewEntry ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Date</div><div className="font-medium text-[#332C28] mt-1">{session.reviewEntry.date}</div></div>
                  <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Duration</div><div className="font-mono text-xl text-[#332C28] mt-1">{session.reviewEntry.duration} hrs</div></div>
                  <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Category</div><div className="font-medium text-[#332C28] mt-1">{session.reviewEntry.activityCategory}</div></div>
                  <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Supervision</div><div className="font-medium text-[#332C28] mt-1">{session.reviewEntry.supervisionMinutes || 0} min</div></div>
                </div>
                <div className="rounded-2xl border border-[#F2EDEA] p-4">
                  <div className="text-xs uppercase tracking-wider text-[#A8998E] mb-2">Narrative</div>
                  <p className="text-sm leading-relaxed text-[#4D423C]">{session.reviewEntry.narrative || 'No narrative supplied.'}</p>
                </div>
                <p className="text-xs leading-relaxed text-[#A8998E]">Baker AI can summarize and flag documentation gaps. The qualified supervisor remains responsible for determining whether the activity is acceptable and whether it should be verified.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#FAF8F6] p-6 text-sm text-[#6B5D54]">This general supervisor invite is valid, but no specific entry was attached. Ask the supervisee to share an entry review link from their dashboard.</div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[#EED4DA] bg-gradient-to-br from-[#FFF5F7] via-white to-[#FFF8F3] p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#E85D70] text-white flex items-center justify-center shrink-0"><Bot size={20} /></div>
                <div>
                  <div className="flex items-center gap-2 text-[#E85D70] text-sm font-semibold"><Sparkles size={15} /> Baker AI Supervisor Co-Pilot</div>
                  <h2 className="font-serif text-2xl font-semibold text-[#332C28] mt-1">Let Baker draft the review. You decide.</h2>
                  <p className="text-sm text-[#6B5D54] mt-1">Ask Baker to identify missing documentation, explain a compliance concern, or draft your entry note and message. Nothing is sent or verified automatically.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {AI_ABILITIES.map((ability) => <span key={ability} className="rounded-full bg-white border border-[#EED4DA] px-3 py-1.5 text-xs font-medium text-[#6B5D54]">{ability}</span>)}
              </div>

              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={4}
                placeholder="Example: Does this entry need clarification? Draft a concise note and a supportive message to the supervisee."
                className="w-full rounded-2xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm text-[#332C28] outline-none focus:border-[#E85D70] focus:ring-4 focus:ring-[#E85D70]/10"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {AI_EXAMPLES.map((example) => (
                  <button key={example} onClick={() => setAiPrompt(example)} className="text-left rounded-xl border border-[#F2EDEA] bg-white px-3 py-3 text-xs leading-relaxed text-[#6B5D54] hover:border-[#E85D70]">{example}</button>
                ))}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <button onClick={() => void askBaker()} disabled={aiThinking || !session.reviewEntry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"><Send size={16} /> {aiThinking ? 'Baker is reviewing…' : 'Ask Baker AI'}</button>
                {aiError && <span className="text-sm text-[#C9445A]">{aiError}</span>}
              </div>

              {aiDraft && (
                <div className="mt-5 rounded-2xl border border-[#E2DAD5] bg-white p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div><div className="text-xs uppercase tracking-wider text-[#A8998E]">AI draft</div><div className="font-semibold text-[#332C28] mt-1">Suggested status: {aiDraft.recommendedStatus}</div></div>
                    <div className="text-xs text-[#A8998E]">{Math.round(aiDraft.confidence * 100)}% information confidence · {aiDraft.provider}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs font-semibold text-[#A8998E] mb-1">Draft entry note</div><p className="text-sm text-[#4D423C]">{aiDraft.note}</p></div>
                    <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs font-semibold text-[#A8998E] mb-1">Draft message</div><p className="text-sm text-[#4D423C]">{aiDraft.message}</p></div>
                    {aiDraft.concerns.length > 0 && <div className="text-xs text-[#B36A2E]">Baker flagged: {aiDraft.concerns.join(' • ')}</div>}
                    <p className="text-xs text-[#A8998E]">{aiDraft.rationale}</p>
                  </div>
                  <button onClick={applyAiDraft} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-4 py-2.5 text-sm font-semibold text-white"><Sparkles size={15} /> Use note & message draft</button>
                </div>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5"><MessageSquare size={19} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Supervisor decision & comments</h2></div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                <button onClick={() => setStatus('VERIFIED')} className={`rounded-xl px-3 py-3 text-sm font-semibold border ${status === 'VERIFIED' ? 'bg-[#E8F5EE] text-[#5FA37E] border-[#9FD1B5]' : 'bg-white text-[#6B5D54] border-[#E2DAD5]'}`}>Verified</button>
                <button onClick={() => setStatus('PENDING')} className={`rounded-xl px-3 py-3 text-sm font-semibold border ${status === 'PENDING' ? 'bg-[#FFF8F3] text-[#B36A2E] border-[#E8C39F]' : 'bg-white text-[#6B5D54] border-[#E2DAD5]'}`}>Keep pending</button>
                <button onClick={() => setStatus('REJECTED')} className={`rounded-xl px-3 py-3 text-sm font-semibold border ${status === 'REJECTED' ? 'bg-[#FFF5F7] text-[#C9445A] border-[#FFC1CC]' : 'bg-white text-[#6B5D54] border-[#E2DAD5]'}`}>Needs changes</button>
              </div>

              <label className="block text-sm font-medium text-[#4D423C] mb-4">Entry note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Add the note you want attached to this fieldwork entry…" className="mt-2 w-full rounded-xl border border-[#E2DAD5] px-4 py-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-[#4D423C] mb-5">Message to supervisee
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Explain what is approved, what needs clarification, or what to change…" className="mt-2 w-full rounded-xl border border-[#E2DAD5] px-4 py-3 text-sm" />
              </label>

              {error && <div className="mb-4 rounded-xl bg-[#FFF5F7] px-4 py-3 text-sm text-[#C9445A]">{error}</div>}

              <button onClick={() => void submitFeedback()} disabled={submitting || !session.reviewEntry} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] text-white px-5 py-3 text-sm font-semibold disabled:opacity-40">
                <CheckCircle2 size={17} /> {submitting ? 'Signing feedback…' : 'Create signed feedback'}
              </button>

              {feedbackUrl && (
                <div className="mt-5 rounded-2xl bg-[#E8F5EE] border border-[#B7DEC7] p-4">
                  <div className="text-sm font-semibold text-[#4B8C69] mb-2">Feedback ready to send</div>
                  <p className="text-xs text-[#638D74] mb-3">The supervisee can open this signed link and apply your note/status to the matching entry.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => void navigator.clipboard.writeText(feedbackUrl)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#B7DEC7] px-4 py-2.5 text-sm text-[#4B8C69]"><Copy size={15} /> Copy link</button>
                    <a href={`mailto:${encodeURIComponent(session.superviseeEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FA37E] text-white px-4 py-2.5 text-sm font-semibold"><Mail size={15} /> Email supervisee</a>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

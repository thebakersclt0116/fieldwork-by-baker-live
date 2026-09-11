import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, ClipboardCheck, Copy, Mail, MessageSquare, ShieldCheck, XCircle } from 'lucide-react';

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
    const lines = [
      `Supervisor: ${session.supervisor.name}`,
      `Review status: ${status}`,
      note ? `Supervisor note: ${note}` : '',
      message ? `Message: ${message}` : '',
      feedbackUrl ? `Apply this signed feedback in Fieldwork by Baker: ${feedbackUrl}` : '',
    ].filter(Boolean);
    return lines.join('\n\n');
  }, [feedbackUrl, message, note, session, status]);

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
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-8 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-[#5FA37E] text-sm font-semibold mb-2"><ShieldCheck size={17} /> Secure supervisor beta access</div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Review fieldwork with Baker</h1>
            <p className="text-[#6B5D54]">Signed in by invite as {session.supervisor.name}. This link is scoped to {session.superviseeEmail}.</p>
          </div>
          <div className="text-xs text-[#A8998E]">Expires {new Date(session.expiresAt).toLocaleDateString()}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[.9fr_1.1fr] gap-6">
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
                <p className="text-xs text-[#A8998E]">Baker AI can assist with classification and triage, but the qualified supervisor remains responsible for determining acceptability and verification.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#FAF8F6] p-6 text-sm text-[#6B5D54]">This general supervisor invite is valid, but no specific entry was attached. Ask the supervisee to share an entry review link from their dashboard.</div>
            )}
          </section>

          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5"><MessageSquare size={19} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Supervisor feedback</h2></div>

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

            <button onClick={submitFeedback} disabled={submitting || !session.reviewEntry} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] text-white px-5 py-3 text-sm font-semibold disabled:opacity-40">
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
  );
}

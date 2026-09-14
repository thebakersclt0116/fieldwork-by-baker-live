import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, MessageSquare, ShieldCheck, XCircle } from 'lucide-react';
import { getCurrentUserEmail, loadEntries, saveEntries } from '@/lib/fieldworkStore';

type FeedbackSession = {
  superviseeEmail: string;
  supervisor: { name: string; email: string };
  reviewEntry: { id: string; date: string; duration: number; revision?: number; changeReason?: string } | null;
  feedback: {
    entryId: string;
    status: 'VERIFIED' | 'PENDING' | 'REJECTED';
    note: string;
    message: string;
  };
  expiresAt: string;
};

export default function ApplySupervisorFeedback() {
  const { token = '' } = useParams();
  const [session, setSession] = useState<FeedbackSession | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const currentEmail = getCurrentUserEmail();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/feedback-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json() as FeedbackSession & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Invalid feedback link.');
        if (active) setSession(payload);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Invalid feedback link.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const applyFeedback = () => {
    if (!session || currentEmail?.toLowerCase() !== session.superviseeEmail.toLowerCase()) return;
    const entries = loadEntries(session.superviseeEmail);
    const index = entries.findIndex((entry) => entry.id === session.feedback.entryId);
    if (index < 0) {
      setError('The matching entry is not stored in this browser. Open the link on the browser where the supervisee tracks fieldwork.');
      return;
    }

    const current = entries[index];
    const currentRevision = Math.max(0, Number(current.revision || 0));
    const reviewedRevision = session.reviewEntry && typeof session.reviewEntry.revision === 'number'
      ? Math.max(0, Number(session.reviewEntry.revision))
      : null;

    if (current.requiresReapproval && reviewedRevision === null) {
      setError('This review link predates a change made after approval. Open the newer re-approval link so you review the current version.');
      return;
    }
    if (reviewedRevision !== null && reviewedRevision !== currentRevision) {
      setError(`This feedback is for revision ${reviewedRevision}, but the entry is now revision ${currentRevision}. Ask the supervisee for the current review link.`);
      return;
    }

    const now = new Date().toISOString();
    const next = [...entries];
    next[index] = {
      ...current,
      status: session.feedback.status,
      supervisorEmail: session.supervisor.email || current.supervisorEmail,
      supervisorNote: session.feedback.note || undefined,
      supervisorMessage: session.feedback.message || undefined,
      updatedAt: now,
      requiresReapproval: session.feedback.status === 'VERIFIED' ? false : current.requiresReapproval,
      revisionReason: session.feedback.status === 'VERIFIED' ? undefined : current.revisionReason,
      lastApprovedAt: session.feedback.status === 'VERIFIED' ? now : current.lastApprovedAt,
      lastApprovalRevision: session.feedback.status === 'VERIFIED' ? currentRevision : current.lastApprovalRevision,
    };
    saveEntries(next, session.superviseeEmail);
    window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
    setApplied(true);
  };

  if (loading) return <div className="min-h-[65vh] bg-[#FFFCF9] flex items-center justify-center text-sm text-[#A8998E]">Validating signed supervisor feedback…</div>;

  if (!session) {
    return <div className="min-h-[65vh] bg-[#FFFCF9] flex items-center justify-center px-4"><div className="max-w-lg bg-white rounded-3xl border border-[#F2EDEA] p-8 text-center"><XCircle size={32} className="mx-auto text-[#C9445A] mb-3" /><h1 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">Feedback link unavailable</h1><p className="text-sm text-[#A8998E]">{error}</p></div></div>;
  }

  const canApply = currentEmail?.toLowerCase() === session.superviseeEmail.toLowerCase();

  return (
    <div className="min-h-[80vh] bg-[#FFFCF9] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#F2EDEA] p-7 lg:p-9 shadow-sm">
        <div className="flex items-center gap-2 text-[#5FA37E] text-sm font-semibold mb-3"><ShieldCheck size={17} /> Signed supervisor feedback</div>
        <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Review from {session.supervisor.name}</h1>
        <p className="text-sm text-[#A8998E] mb-6">For {session.superviseeEmail} • expires {new Date(session.expiresAt).toLocaleDateString()}</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Review status</div><div className="font-semibold text-[#332C28] mt-1">{session.feedback.status}</div></div>
          <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Entry</div><div className="font-medium text-[#332C28] mt-1">{session.reviewEntry ? `${session.reviewEntry.date} • ${session.reviewEntry.duration} hrs${typeof session.reviewEntry.revision === 'number' ? ` • rev ${session.reviewEntry.revision}` : ''}` : session.feedback.entryId}</div></div>
        </div>

        {session.reviewEntry?.changeReason && <div className="rounded-2xl bg-[#FFF8F3] border border-[#F2D4B8] p-4 mb-4"><div className="text-xs uppercase tracking-wider text-[#8A5D36] mb-2">Why this entry changed</div><p className="text-sm text-[#6B4A2E] whitespace-pre-wrap">{session.reviewEntry.changeReason}</p></div>}
        {session.feedback.note && <div className="rounded-2xl border border-[#F2EDEA] p-4 mb-4"><div className="text-xs uppercase tracking-wider text-[#A8998E] mb-2">Entry note</div><p className="text-sm text-[#4D423C] whitespace-pre-wrap">{session.feedback.note}</p></div>}
        {session.feedback.message && <div className="rounded-2xl bg-[#FFF8F3] p-4 mb-5"><div className="flex items-center gap-2 text-sm font-semibold text-[#8A5D36] mb-2"><MessageSquare size={15} /> Message</div><p className="text-sm text-[#6B4A2E] whitespace-pre-wrap">{session.feedback.message}</p></div>}

        {error && <div className="mb-4 rounded-xl bg-[#FFF5F7] px-4 py-3 text-sm text-[#C9445A]">{error}</div>}

        {applied ? (
          <div className="rounded-2xl bg-[#E8F5EE] p-5 text-[#4B8C69] flex items-start gap-3"><CheckCircle2 size={20} className="mt-0.5" /><div><div className="font-semibold">Feedback applied</div><div className="text-sm mt-1">The matching revision, status, supervisor identity, and feedback are now attached to the entry.</div><Link to="/dashboard" className="inline-block text-sm underline mt-3">Return to dashboard</Link></div></div>
        ) : canApply ? (
          <button onClick={applyFeedback} className="w-full rounded-xl bg-[#5FA37E] text-white py-3 font-semibold text-sm">Apply feedback to entry</button>
        ) : (
          <div className="rounded-2xl bg-[#FAF8F6] p-5 text-sm text-[#6B5D54]">Sign in as <strong>{session.superviseeEmail}</strong> and reopen this link to apply the feedback. <Link to="/login" className="text-[#E85D70] underline">Sign in</Link></div>
        )}
      </div>
    </div>
  );
}

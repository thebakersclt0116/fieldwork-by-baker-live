import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { AlertTriangle, CheckCircle2, Edit3, Mail, Pencil, Save, X } from 'lucide-react';
import type { ActivityCategory, ActivityType, HourEntry, ObservationMode, SupervisionFormat, WorkPresence } from '@/types';
import { getCurrentUserEmail, hoursBetween, loadEntries, saveEntries } from '@/lib/fieldworkStore';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

const EDITABLE_KEYS = [
  'date', 'startTime', 'endTime', 'duration', 'activityCategory', 'supervisorName', 'supervisorEmail',
  'organizationName', 'workPresence', 'supervisionFormat', 'supervisionMinutes', 'observationMinutes',
  'observationMode', 'clientInitials', 'setting', 'notes',
] as const;

function snapshot(entry: HourEntry) {
  return {
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    duration: entry.duration,
    activityCategory: entry.activityCategory,
    supervisorName: entry.supervisorName,
    organizationName: entry.organizationName,
    workPresence: entry.workPresence,
    supervisionFormat: entry.supervisionFormat,
    supervisionMinutes: entry.supervisionMinutes,
    observationMinutes: entry.observationMinutes,
    observationMode: entry.observationMode,
    clientInitials: entry.clientInitials,
    setting: entry.setting,
    notes: entry.notes,
  };
}

function hasSubstantiveChanges(a: HourEntry, b: HourEntry): boolean {
  return EDITABLE_KEYS.some((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
}

function activityTypeFor(entry: HourEntry): ActivityType {
  if (entry.activityCategory === 'RESTRICTED') return 'RESTRICTED_DIRECT';
  if (entry.activityCategory === 'UNKNOWN') return entry.activityType;
  const text = `${entry.notes || ''} ${entry.activityType}`.toLowerCase();
  if (text.includes('assessment')) return 'UNRESTRICTED_ASSESSMENT';
  if (text.includes('behavior plan') || text.includes('program')) return 'UNRESTRICTED_BEHAVIOR_PLAN';
  if (text.includes('training')) return 'UNRESTRICTED_TRAINING';
  if (entry.workPresence === 'SUPERVISED') return 'UNRESTRICTED_SUPERVISION';
  return 'UNRESTRICTED_OTHER';
}

function reviewNarrative(entry: HourEntry, reason: string): string {
  const lines = [
    reason ? `CHANGE AFTER APPROVAL — Reason: ${reason}` : '',
    entry.organizationName ? `Organization: ${entry.organizationName}` : '',
    entry.startTime && entry.endTime && entry.startTime !== '00:00' ? `Time: ${entry.startTime}–${entry.endTime}` : '',
    `Current duration: ${entry.duration.toFixed(2)} hours`,
    `Category: ${entry.activityCategory}`,
    entry.workPresence ? `Entry type: ${entry.workPresence}` : '',
    entry.supervisionFormat ? `Supervision format: ${entry.supervisionFormat}` : '',
    typeof entry.supervisionMinutes === 'number' ? `Supervision: ${entry.supervisionMinutes} min` : '',
    typeof entry.observationMinutes === 'number' && entry.observationMinutes > 0
      ? `Client observation: ${entry.observationMinutes} min${entry.observationMode ? ` (${entry.observationMode})` : ''}`
      : '',
    entry.clientInitials ? `Client: ${entry.clientInitials}` : '',
    entry.setting ? `Setting: ${entry.setting}` : '',
    '',
    entry.notes || 'No activity narrative supplied.',
  ];
  return lines.filter((line, index) => line !== '' || index === lines.length - 2).join('\n');
}

function safeClone(entry: HourEntry): HourEntry {
  return JSON.parse(JSON.stringify(entry)) as HourEntry;
}

export default function TrackedHoursEditor() {
  const location = useLocation();
  const { user, isAuthenticated, isOwner } = useAuth();
  const email = getCurrentUserEmail() || user?.email || '';
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [original, setOriginal] = useState<HourEntry | null>(null);
  const [draft, setDraft] = useState<HourEntry | null>(null);
  const [reason, setReason] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [manualReviewUrl, setManualReviewUrl] = useState('');

  const visible = location.pathname === '/dashboard' && isAuthenticated && !isOwner && Boolean(email);

  const refresh = () => setEntries(loadEntries(email));

  useEffect(() => {
    if (open && visible) refresh();
  }, [open, visible, email]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const approvalSensitive = Boolean(original && (original.status === 'VERIFIED' || original.requiresReapproval));
  const computedDuration = useMemo(() => {
    if (!draft) return 0;
    if (draft.startTime && draft.endTime && draft.startTime !== '00:00' && draft.endTime !== '00:00') {
      const calculated = hoursBetween(draft.startTime, draft.endTime);
      if (calculated > 0) return calculated;
    }
    return Math.max(0, Number(draft.duration) || 0);
  }, [draft]);

  if (!visible) return null;

  const beginEdit = (entry: HourEntry) => {
    const next = safeClone(entry);
    next.revision = Math.max(0, Number(next.revision || 0));
    next.workPresence = next.workPresence || ((next.supervisionMinutes || 0) > 0 ? 'SUPERVISED' : 'INDEPENDENT');
    next.supervisionFormat = next.supervisionFormat || ((next.individualSupervisionMinutes || 0) > 0 ? 'INDIVIDUAL' : undefined);
    setOriginal(safeClone(next));
    setDraft(next);
    setReason(next.requiresReapproval ? String(next.revisionReason || '') : '');
    setSupervisorEmail(String(next.supervisorEmail || ''));
    setMessage('');
    setManualReviewUrl('');
  };

  const cancelEdit = () => {
    setOriginal(null);
    setDraft(null);
    setReason('');
    setSupervisorEmail('');
    setMessage('');
    setManualReviewUrl('');
  };

  const updateDraft = <K extends keyof HourEntry>(key: K, value: HourEntry[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const saveEdit = async () => {
    if (!draft || !original) return;
    const normalized: HourEntry = {
      ...draft,
      duration: computedDuration,
      supervisorName: String(draft.supervisorName || '').trim(),
      supervisorEmail: supervisorEmail.trim().toLowerCase() || undefined,
      organizationName: String(draft.organizationName || '').trim() || undefined,
      setting: String(draft.setting || '').trim(),
      notes: String(draft.notes || '').trim() || undefined,
      clientInitials: String(draft.clientInitials || '').trim().toUpperCase() || undefined,
      supervisionMinutes: draft.workPresence === 'SUPERVISED' ? Math.max(0, Number(draft.supervisionMinutes || 0)) || undefined : undefined,
      observationMinutes: draft.workPresence === 'SUPERVISED' ? Math.max(0, Number(draft.observationMinutes || 0)) || undefined : undefined,
      individualSupervisionMinutes: draft.workPresence === 'SUPERVISED' && draft.supervisionFormat === 'INDIVIDUAL'
        ? Math.max(0, Number(draft.supervisionMinutes || 0)) || undefined
        : undefined,
      activityType: activityTypeFor(draft),
    };

    if (!normalized.date || normalized.duration <= 0) {
      setMessage('Enter a valid date and positive duration.');
      return;
    }
    if (!normalized.organizationName) {
      setMessage('Organization is required.');
      return;
    }
    if (!normalized.supervisorName) {
      setMessage('Responsible supervisor is required.');
      return;
    }
    if (!hasSubstantiveChanges(original, normalized)) {
      setMessage('No tracked-hour fields changed.');
      return;
    }
    if (approvalSensitive && reason.trim().length < 3) {
      setMessage('Because this entry was already approved, explain why you changed it.');
      return;
    }
    if (approvalSensitive && !/^\S+@\S+\.\S+$/.test(supervisorEmail.trim())) {
      setMessage('Enter the assigned supervisor’s email so the updated entry can be sent back for re-approval.');
      return;
    }

    setSaving(true);
    setMessage('');
    setManualReviewUrl('');
    try {
      const nextRevision = Math.max(0, Number(original.revision || 0)) + 1;
      const now = new Date().toISOString();
      const revised: HourEntry = {
        ...normalized,
        revision: nextRevision,
        updatedAt: now,
        revisionHistory: [
          ...(original.revisionHistory || []),
          {
            revision: Math.max(0, Number(original.revision || 0)),
            changedAt: now,
            reason: approvalSensitive ? reason.trim() : undefined,
            previousStatus: original.status,
            snapshot: snapshot(original),
          },
        ],
      };

      let reviewPath = '';
      let notificationConfigured = false;
      let notificationSent = false;
      let notificationChannel = 'none';

      if (approvalSensitive) {
        const token = getStoredAccessToken();
        if (!token) throw new Error('Your session expired. Sign in again before editing an approved entry.');
        revised.status = 'PENDING';
        revised.requiresReapproval = true;
        revised.revisionReason = reason.trim();
        revised.supervisorEmail = supervisorEmail.trim().toLowerCase();

        const response = await fetch('/api/supervisor-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            supervisorName: revised.supervisorName,
            supervisorEmail: revised.supervisorEmail,
            notificationMode: 'revision',
            changeReason: revised.revisionReason,
            reviewEntry: {
              id: revised.id,
              date: revised.date,
              duration: revised.duration,
              activityCategory: revised.activityCategory,
              narrative: reviewNarrative(revised, revised.revisionReason || ''),
              supervisorName: revised.supervisorName,
              supervisionMinutes: revised.supervisionMinutes || 0,
              revision: revised.revision,
              changeReason: revised.revisionReason,
            },
          }),
        });
        const payload = await response.json() as {
          path?: string;
          error?: string;
          notification?: { configured?: boolean; emailSent?: boolean; webhookSent?: boolean; channel?: string };
        };
        if (!response.ok || !payload.path) throw new Error(payload.error || 'Could not create the required re-approval request.');
        reviewPath = payload.path;
        notificationConfigured = Boolean(payload.notification?.configured);
        notificationSent = Boolean(payload.notification?.emailSent || payload.notification?.webhookSent);
        notificationChannel = String(payload.notification?.channel || 'none');
      }

      const current = loadEntries(email);
      const index = current.findIndex((entry) => entry.id === revised.id);
      if (index < 0) throw new Error('This entry is no longer stored in this browser. Refresh and try again.');
      const next = [...current];
      next[index] = revised;
      saveEntries(next, email);
      setEntries(next);
      window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));

      if (approvalSensitive) {
        const absolute = reviewPath ? `${window.location.origin}${reviewPath}` : '';
        setManualReviewUrl(notificationSent ? '' : absolute);
        setMessage(notificationSent
          ? `Changes saved. Approval was reset to Pending and the supervisor was notified via ${notificationChannel}.`
          : notificationConfigured
            ? 'Changes saved and approval reset to Pending. Automatic delivery failed, so use the review link below to notify the supervisor.'
            : 'Changes saved and approval reset to Pending. A notification provider is not configured yet, so use the review link below to notify the supervisor.');
      } else {
        setMessage('Changes saved. Because this entry had not been approved yet, no supervisor notification was sent.');
      }
      setOriginal(safeClone(revised));
      setDraft(safeClone(revised));
      setReason(revised.requiresReapproval ? revised.revisionReason || '' : '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  };

  const mailto = manualReviewUrl && draft
    ? `mailto:${encodeURIComponent(supervisorEmail)}?subject=${encodeURIComponent('Fieldwork entry changed — re-approval needed')}&body=${encodeURIComponent([
        `Hi ${draft.supervisorName},`,
        '',
        'I updated a fieldwork entry that had already been approved, so it has returned to Pending.',
        reason ? `Reason: ${reason}` : '',
        '',
        `Please review and re-approve the updated entry here: ${manualReviewUrl}`,
      ].filter(Boolean).join('\n'))}`
    : '';

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); refresh(); }}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-[#332C28] px-4 py-3 text-sm font-semibold text-white shadow-xl hover:-translate-y-0.5 transition-transform"
      >
        <Pencil size={16} /> Edit tracked hours
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="mx-auto max-w-6xl rounded-3xl border border-[#E2DAD5] bg-[#FFFCF9] shadow-2xl overflow-hidden">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F2EDEA] bg-white/95 px-5 py-4 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-[#A8998E]">Tracked hours</div>
                <h2 className="font-serif text-2xl font-semibold text-[#332C28]">Edit fieldwork entries</h2>
              </div>
              <button onClick={() => { setOpen(false); cancelEdit(); }} className="rounded-xl border border-[#E2DAD5] bg-white p-2 text-[#6B5D54]" aria-label="Close editor"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[.72fr_1.28fr] min-h-[620px]">
              <aside className="border-b lg:border-b-0 lg:border-r border-[#F2EDEA] bg-white p-4 max-h-[74vh] overflow-y-auto">
                <p className="text-xs text-[#A8998E] mb-3">Pending entries can be corrected without notifying anyone. Editing an approved entry resets it to Pending and requires supervisor re-approval.</p>
                <div className="space-y-2">
                  {entries.length === 0 && <div className="rounded-xl bg-[#FAF8F6] p-4 text-sm text-[#A8998E]">No tracked entries yet.</div>}
                  {entries.map((entry) => (
                    <button key={entry.id} onClick={() => beginEdit(entry)} className={`w-full text-left rounded-2xl border p-4 transition-colors ${draft?.id === entry.id ? 'border-[#E85D70] bg-[#FFF5F7]' : 'border-[#F2EDEA] bg-white hover:border-[#E2DAD5]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#332C28]">{entry.date}</span>
                        <span className="font-mono text-sm text-[#E85D70]">{Number(entry.duration || 0).toFixed(2)}h</span>
                      </div>
                      <div className="mt-1 text-xs text-[#6B5D54]">{entry.organizationName || entry.setting || 'Organization not specified'}</div>
                      <div className="mt-1 text-xs text-[#A8998E]">{entry.supervisorName || 'Supervisor not specified'} • {entry.activityCategory}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-[#FAF8F6] px-2 py-1 text-[10px] font-bold text-[#6B5D54]">{entry.status}</span>
                        {entry.requiresReapproval && <span className="rounded-full bg-[#FFF3E0] px-2 py-1 text-[10px] font-bold text-[#B77722]">RE-APPROVAL REQUIRED</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="p-5 sm:p-6 max-h-[74vh] overflow-y-auto">
                {!draft || !original ? (
                  <div className="h-full min-h-[420px] flex items-center justify-center text-center">
                    <div className="max-w-md">
                      <Edit3 size={34} className="mx-auto text-[#E85D70] mb-3" />
                      <h3 className="font-serif text-2xl font-semibold text-[#332C28]">Choose an entry to edit</h3>
                      <p className="mt-2 text-sm text-[#A8998E]">Every correction keeps a revision trail. Previously approved hours cannot stay verified after their underlying data changes.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className={`rounded-2xl p-4 ${approvalSensitive ? 'bg-[#FFF8F3] border border-[#F2D4B8]' : 'bg-[#E8F5EE] border border-[#CFE7D9]'}`}>
                      <div className="flex items-start gap-2">
                        {approvalSensitive ? <AlertTriangle size={18} className="text-[#B36A2E] mt-0.5" /> : <CheckCircle2 size={18} className="text-[#4B8C69] mt-0.5" />}
                        <div>
                          <div className={`font-semibold text-sm ${approvalSensitive ? 'text-[#8A5D36]' : 'text-[#4B8C69]'}`}>{approvalSensitive ? 'This entry has approval history' : 'Not approved yet'}</div>
                          <p className="text-xs mt-1 text-[#6B5D54]">{approvalSensitive ? 'Saving a change will invalidate the prior approval, return the entry to Pending, create a new signed review link, and notify the assigned supervisor when notification delivery is configured.' : 'You can correct this entry now without triggering a supervisor notification.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Field label="Date"><input type="date" value={draft.date} onChange={(e) => updateDraft('date', e.target.value)} className="field-input" /></Field>
                      <Field label="Start time"><input type="time" value={draft.startTime || '00:00'} onChange={(e) => updateDraft('startTime', e.target.value)} className="field-input" /></Field>
                      <Field label="End time"><input type="time" value={draft.endTime || '00:00'} onChange={(e) => updateDraft('endTime', e.target.value)} className="field-input" /></Field>
                      <Field label="Hours"><input type="number" min="0.01" step="0.01" value={computedDuration} onChange={(e) => updateDraft('duration', Number(e.target.value))} disabled={draft.startTime !== '00:00' && draft.endTime !== '00:00' && hoursBetween(draft.startTime, draft.endTime) > 0} className="field-input disabled:opacity-60" /><span className="mt-1 block text-[10px] text-[#A8998E]">Valid start/end times automatically control the decimal.</span></Field>
                      <Field label="Organization"><input value={draft.organizationName || ''} onChange={(e) => updateDraft('organizationName', e.target.value)} className="field-input" placeholder="Melmark Carolinas" /></Field>
                      <Field label="Responsible supervisor"><input value={draft.supervisorName || ''} onChange={(e) => updateDraft('supervisorName', e.target.value)} className="field-input" placeholder="Carrie" /></Field>
                      <Field label="Category"><select value={draft.activityCategory} onChange={(e) => updateDraft('activityCategory', e.target.value as ActivityCategory)} className="field-input bg-white"><option value="UNRESTRICTED">Unrestricted</option><option value="RESTRICTED">Restricted</option><option value="UNKNOWN">Unknown / monthly summary</option></select></Field>
                      <Field label="Independent / supervised"><select value={draft.workPresence || 'INDEPENDENT'} onChange={(e) => updateDraft('workPresence', e.target.value as WorkPresence)} className="field-input bg-white"><option value="INDEPENDENT">Independent</option><option value="SUPERVISED">Supervised</option></select></Field>
                      <Field label="Setting / location"><input value={draft.setting || ''} onChange={(e) => updateDraft('setting', e.target.value)} className="field-input" placeholder="School, clinic, home…" /></Field>

                      {(draft.workPresence || 'INDEPENDENT') === 'SUPERVISED' && (
                        <>
                          <Field label="Supervision format"><select value={draft.supervisionFormat || 'INDIVIDUAL'} onChange={(e) => updateDraft('supervisionFormat', e.target.value as SupervisionFormat)} className="field-input bg-white"><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></select></Field>
                          <Field label="Supervision minutes"><input type="number" min="0" value={draft.supervisionMinutes || 0} onChange={(e) => updateDraft('supervisionMinutes', Number(e.target.value))} className="field-input" /></Field>
                          <Field label="Client observation minutes"><input type="number" min="0" value={draft.observationMinutes || 0} onChange={(e) => updateDraft('observationMinutes', Number(e.target.value))} className="field-input" /></Field>
                          {(draft.observationMinutes || 0) > 0 && (
                            <>
                              <Field label="Observation mode"><select value={draft.observationMode || 'IN_PERSON'} onChange={(e) => updateDraft('observationMode', e.target.value as ObservationMode)} className="field-input bg-white"><option value="IN_PERSON">In person</option><option value="ONLINE">Online / video</option><option value="PHONE">Phone</option></select></Field>
                              <Field label="Client initials / name"><input value={draft.clientInitials || ''} onChange={(e) => updateDraft('clientInitials', e.target.value)} className="field-input" /></Field>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <Field label="Activity description"><textarea rows={4} value={draft.notes || ''} onChange={(e) => updateDraft('notes', e.target.value)} className="field-input resize-none" /></Field>

                    {approvalSensitive && (
                      <div className="rounded-2xl border-2 border-[#E8C39F] bg-[#FFF8F3] p-4">
                        <Field label="Why did you change this approved entry? *"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="field-input resize-none" placeholder="Example: I entered the wrong end time; the session ended at 10:15 AM, not 10:30 AM." /></Field>
                        <div className="mt-3"><Field label="Supervisor email for re-approval *"><input type="email" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} className="field-input" placeholder="supervisor@email.com" /></Field></div>
                        <p className="mt-2 text-xs text-[#8A5D36]">The reason is included in the new signed review request so the supervisor can see exactly why the previously approved record changed.</p>
                      </div>
                    )}

                    {message && <div className={`rounded-xl px-4 py-3 text-sm ${message.startsWith('Changes saved') ? 'bg-[#E8F5EE] text-[#4B8C69]' : 'bg-[#FFF5F7] text-[#C9445A]'}`}>{message}</div>}
                    {manualReviewUrl && mailto && (
                      <div className="rounded-2xl border border-[#F2D4B8] bg-[#FFF8F3] p-4">
                        <div className="text-sm font-semibold text-[#8A5D36]">Supervisor notification needs manual delivery</div>
                        <p className="mt-1 text-xs text-[#A36F45]">The secure re-approval link is ready. Use the email button until automatic notification delivery is configured.</p>
                        <a href={mailto} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#E85D70] px-4 py-2.5 text-sm font-semibold text-white"><Mail size={15} /> Email supervisor</a>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-[#F2EDEA] pt-4">
                      <button onClick={cancelEdit} className="rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54]">Cancel</button>
                      <button onClick={() => void saveEdit()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#332C28] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : approvalSensitive ? 'Save & require re-approval' : 'Save changes'}</button>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#7B6B62]">{label}<div className="mt-1.5">{children}</div></label>;
}

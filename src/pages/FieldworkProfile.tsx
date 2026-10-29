import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { profileDocument, saveFieldworkSetup, completeSetup, ruleFor, yearsFor, trackLabel, TRANSITION_SOURCE } from '@/lib/fieldworkProfile';
import type { ApplicationTiming, FieldworkSetup, SavedOrganization, SavedSupervisor } from '@/lib/fieldworkProfile';
import type { FieldworkType } from '@/types';
const input = 'mt-1.5 w-full rounded-xl border border-[#E2DAD5] bg-white px-3 py-2.5 text-sm text-[#332C28] dark:border-white/15 dark:bg-[#171412] dark:text-white';
const panel = 'rounded-2xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A] sm:p-6';
const uid = (kind: string) => kind + '_' + crypto.randomUUID();
export default function FieldworkProfile() {
  const { user } = useAuth();
  return user?.email ? <ProfileEditor key={user.email.toLowerCase()} email={user.email.toLowerCase()} /> : <p className="p-6">Sign in to set up your fieldwork profile.</p>;
}
function ProfileEditor({ email }: { email: string }) {
  const navigate = useNavigate(), location = useLocation();
  const [loaded] = useState<{ document: Record<string, unknown>; error: string }>(() => { try { return { document: profileDocument(), error: '' }; } catch (e) { return { document: {}, error: e instanceof Error ? e.message : 'Your profile could not be read.' }; } });
  const initial = completeSetup(loaded.document.fieldworkSetup) ? loaded.document.fieldworkSetup : null;
  const [timing, setTiming] = useState<ApplicationTiming | ''>(initial?.applicationTiming || '');
  const [type, setType] = useState<FieldworkType | ''>(initial?.fieldworkType || '');
  const [organizations, setOrganizations] = useState<SavedOrganization[]>(initial?.organizations || [{ id: uid('org'), name: '', active: true }]);
  const [supervisors, setSupervisors] = useState<SavedSupervisor[]>(initial?.supervisors || [{ id: uid('supervisor'), name: '', email: '', bacbNumber: '', active: true }]);
  const [acknowledged, setAcknowledged] = useState(Boolean(initial?.applicationDateAcknowledged));
  const [error, setError] = useState(loaded.error), [busy, setBusy] = useState(false);
  const choices: Array<[ApplicationTiming, string]> = [
    ['BEFORE_2027', 'Before January 1, 2027'],
    ['FROM_2027', 'On or after January 1, 2027'],
    ['BOTH', 'I am not sure yet — show both sets of requirements'],
  ];
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || loaded.error) return;
    if (!timing || !type) { setError('Choose your application timing and fieldwork type.'); return; }
    if (!acknowledged) { setError('Confirm that the application date determines your requirements.'); return; }
    setError(''); setBusy(true);
    const now = new Date().toISOString();
    const setup: FieldworkSetup = { version: 1, applicationTiming: timing, fieldworkType: type,
      organizations: organizations.filter(o => o.active || o.name.trim()).map(o => ({ ...o, name: o.name.trim() })),
      supervisors: supervisors.filter(s => s.active || s.name.trim()).map(s => ({ ...s, name: s.name.trim(), email: s.email.trim().toLowerCase(), bacbNumber: s.bacbNumber.trim() })),
      applicationDateAcknowledged: true, completedAt: initial?.completedAt || now, updatedAt: now };
    try {
      await saveFieldworkSetup(setup, JSON.stringify(loaded.document), email);
      const requested = new URLSearchParams(location.search).get('return') || '/dashboard';
      // This is an internal destination, never an arbitrary URL from a query string.
      navigate(['/dashboard','/import','/import/ripley','/export','/settings'].includes(requested) ? requested : '/dashboard', { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Profile saving did not finish. Your entries have not been changed.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-[#FFFCF9] px-4 py-8 text-[#332C28] dark:bg-[#171412] dark:text-white"><div className="mx-auto max-w-3xl">
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-wider text-[#D94D62] dark:text-[#FF8EA0]">Your fieldwork profile</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">{initial ? 'Update your fieldwork profile' : 'Set up your profile before tracking hours'}</h1><p className="mt-3 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Choose your requirements, then add the organizations and supervisors you will select for each activity. Your existing hours, source documents, approvals and membership are not changed by this setup.</p></header>
    <form onSubmit={event => void save(event)} className="space-y-5">
      <fieldset disabled={busy} className={panel}><legend className="px-1 text-lg font-semibold">1. When do you plan to submit your BCBA certification application?</legend><p className="mb-4 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Use the application date, not the date you plan to take the exam. To use the current requirements, you must apply and meet them before January 1, 2027.</p><div className="space-y-3">{choices.map(([value,label]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2DAD5] p-3 text-sm dark:border-white/15"><input type="radio" name="application-timing" required checked={timing === value} onChange={() => setTiming(value)} className="mt-1" /><span>{label}</span></label>)}</div><label className="mt-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1.5" /><span>I understand that the certification application date, not the exam date, determines which requirements apply.</span></label></fieldset>
      <fieldset disabled={busy} className={panel}><legend className="px-1 text-lg font-semibold">2. Which type of fieldwork are you completing?</legend><div className="grid gap-3 sm:grid-cols-2">{(['SUPERVISED','CONCENTRATED'] as const).map(value => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2DAD5] p-4 text-sm dark:border-white/15"><input required name="fieldwork-track" type="radio" className="mt-1" checked={type === value} onChange={() => setType(value)} /><span><strong>{trackLabel(value)}</strong><span className="mt-1 block">{value === 'SUPERVISED' ? '2,000' : '1,500'} total hours</span></span></label>)}</div>
        {timing && type && <div className="mt-4 space-y-3" aria-live="polite">{yearsFor(timing).map(year => { const r = ruleFor(year,type); return <div key={year} className="rounded-xl bg-[#FAF8F6] p-4 text-sm leading-6 dark:bg-white/5"><strong>{year} requirements · {trackLabel(type)}</strong><p>{r.targetHours.toLocaleString()} total hours · {r.supervisionPercent}% supervision · {r.minimumMonthlyHours}–{r.maximumMonthlyHours} hours per month</p><p>Client observations: {r.observationCount !== null ? 'at least one per month' : `at least ${r.observationMinutes} minutes per month`}.</p></div>; })}{timing === 'BOTH' && <p className="text-sm leading-6">Both checklists will remain separate. Plan with your supervisor and retain both sets of verification forms; meeting one set does not automatically meet the other.</p>}</div>}
        <p className="mt-4 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">These are the fieldwork changes summarized in your BACB transition guide, not all certification requirements. Your supervisor and the BACB determine whether the work qualifies. <a href={TRANSITION_SOURCE} target="_blank" rel="noreferrer" className="underline">Read the official transition guide (updated January 2026)</a>.</p>
      </fieldset>
      <fieldset disabled={busy} className={panel}><legend className="px-1 text-lg font-semibold">3. Add your organizations</legend><p className="mb-4 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Add each workplace or organization separately. These names become choices when you log an activity.</p><div className="space-y-4">{organizations.map((org,index) => <div key={org.id} className="rounded-xl border border-[#E2DAD5] p-3 dark:border-white/15"><label className="block text-sm">Organization {index+1}<input required maxLength={200} value={org.name} disabled={!org.active} onChange={e => setOrganizations(items => items.map(o => o.id === org.id ? {...o,name:e.target.value} : o))} className={input} autoComplete="organization" /></label><button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => setOrganizations(items => items.map(o => o.id === org.id ? {...o,active:!o.active} : o))}>{org.active ? 'Archive from future choices' : 'Restore to dropdown'}</button>{!org.active && <p className="mt-1 text-xs">Archived. Historical entries keep their original organization.</p>}</div>)}</div><button type="button" disabled={organizations.length >= 200} onClick={() => setOrganizations(items => [...items,{id:uid('org'),name:'',active:true}])} className="mt-4 min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">Add another organization</button></fieldset>
      <fieldset disabled={busy} className={panel}><legend className="px-1 text-lg font-semibold">4. Add your supervisors</legend><p className="mb-4 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Add each supervisor separately. Choose the responsible supervisor on every entry. Saving a name here does not invite them, verify their credentials, or give them account access.</p><div className="space-y-4">{supervisors.map((s,index) => <div key={s.id} className="rounded-xl border border-[#E2DAD5] p-4 dark:border-white/15"><label className="block text-sm">Supervisor {index+1} name<input required maxLength={200} disabled={!s.active} value={s.name} onChange={e => setSupervisors(items => items.map(item => item.id === s.id ? {...item,name:e.target.value} : item))} className={input} /></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Email (optional)<input type="email" maxLength={254} disabled={!s.active} value={s.email} onChange={e => setSupervisors(items => items.map(item => item.id === s.id ? {...item,email:e.target.value} : item))} className={input} /></label><label className="text-sm">Certification number (optional)<input maxLength={100} disabled={!s.active} value={s.bacbNumber} onChange={e => setSupervisors(items => items.map(item => item.id === s.id ? {...item,bacbNumber:e.target.value} : item))} className={input} /></label></div><button type="button" className="mt-3 text-xs font-semibold underline" onClick={() => setSupervisors(items => items.map(item => item.id === s.id ? {...item,active:!item.active} : item))}>{s.active ? 'Archive from future choices' : 'Restore to dropdown'}</button>{!s.active && <p className="mt-1 text-xs">Archived. Historical entries and invitations remain unchanged.</p>}</div>)}</div><button type="button" disabled={supervisors.length >= 200} onClick={() => setSupervisors(items => [...items,{id:uid('supervisor'),name:'',email:'',bacbNumber:'',active:true}])} className="mt-4 min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">Add another supervisor</button></fieldset>
      {error && <p role="alert" className="rounded-xl border border-[#E85D70] p-4 text-sm">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4"><Link to="/settings" className="text-sm underline">Account settings</Link><button disabled={busy || Boolean(loaded.error)} type="submit" className="min-h-12 rounded-xl bg-[#E85D70] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving your profile…' : 'Save profile and continue'}</button></div><p className="pb-6 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Update these selections later in My Settings. Changing a name or requirement does not rewrite past entries or their original source evidence. Raw elapsed timer hours are retained exactly; displayed decimals are rounded only for readability.</p>
    </form>
  </div></div>;
}

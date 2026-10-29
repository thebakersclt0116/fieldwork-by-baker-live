from pathlib import Path
root=Path('.')
def patch(file,old,new):
 p=root/file;s=p.read_text()
 if old not in s:raise Exception('Source changed; review '+file+' before applying: '+old[:90])
 p.write_text(s.replace(old,new,1))
patch('src/App.tsx',"import ProtectedRoute from './components/ProtectedRoute';", "import ProtectedRoute from './components/ProtectedRoute';\nimport FieldworkProfileGate from './components/FieldworkProfileGate';\nconst FieldworkProfile = lazy(() => import('./pages/FieldworkProfile'));")
patch('src/App.tsx','        <Route path="/settings"','        <Route path="/fieldwork-profile" element={<ProtectedRoute><FieldworkProfile /></ProtectedRoute>} />\n        <Route path="/settings"')
for name in ['dashboard','import','import/ripley','export']:
 p=root/'src/App.tsx';lines=p.read_text().splitlines(True)
 for i,line in enumerate(lines):
  if 'path="/'+name+'"' in line:
   lines[i]=line.replace('<ProtectedRoute>','<ProtectedRoute><FieldworkProfileGate>',1).replace('</ProtectedRoute>','</FieldworkProfileGate></ProtectedRoute>',1);break
 else:raise Exception(name)
 p.write_text(''.join(lines))
patch('src/pages/AccountSettings.tsx','    <section id="account"', '    <section className="mt-6 rounded-2xl border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><h2 className="text-lg font-semibold">Fieldwork profile</h2><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Manage your application timing, fieldwork type, organizations and supervisors. Historical entries keep their original details.</p><Link to="/fieldwork-profile?return=%2Fsettings" className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 py-2 font-semibold">Edit fieldwork profile</Link></section>\n    <section id="account"')
patch('src/pages/ExportCenter.tsx',"import './ExportCenter.css';", "import './ExportCenter.css';\nimport { useFieldworkProfile } from '@/hooks/useFieldworkProfile';\nimport { TRANSITION_SOURCE } from '@/lib/fieldworkProfile';")
patch('src/pages/ExportCenter.tsx','  const { canExportOfficialForms, activeTrial } = useAuth();','  const { canExportOfficialForms, activeTrial } = useAuth();\n  const profile = useFieldworkProfile();')
patch('src/pages/ExportCenter.tsx',"const [requirements, setRequirements] = useState<'2022'|'2027'>('2027');", "const [requirements, setRequirements] = useState<'2022'|'2027'>(() => profile?.applicationTiming === 'BEFORE_2027' || profile?.applicationTiming === 'BOTH' ? '2022' : '2027');")
patch('src/pages/ExportCenter.tsx',"const [fieldworkType, setFieldworkType] = useState<'SUPERVISED'|'CONCENTRATED'>('SUPERVISED');", "const [fieldworkType, setFieldworkType] = useState<'SUPERVISED'|'CONCENTRATED'>(profile?.fieldworkType || 'SUPERVISED');")
patch('src/pages/ExportCenter.tsx','        {incompleteCount > 0 &&', '''        {profile && <p role="note" className="mb-5 rounded-xl border border-[#E2DAD5] p-4 text-sm leading-6 dark:border-white/15">Your profile uses {profile.applicationTiming === 'BOTH' ? 'both 2022 and 2027 requirements. Prepare and retain both versions separately with your supervisor; one form does not replace the other.' : profile.applicationTiming === 'BEFORE_2027' ? '2022 requirements for an application submitted, with requirements met, before January 1, 2027.' : '2027 requirements for an application submitted on or after January 1, 2027.'} The selector below remains available for historical documents; changing it does not change your profile or entries. <a href={TRANSITION_SOURCE} target="_blank" rel="noreferrer" className="underline">BACB transition guidance</a>.</p>}
        {incompleteCount > 0 &&''')
patch('src/pages/ExportCenter.tsx',"BACB&apos;s current 2027 forms require complete information, signatures, and retention.","Use the forms corresponding to your applicable requirements, with complete information, signatures, and retention.")
patch('src/types/index.ts','  organizationName?: string;\n  workPresence?: WorkPresence;', '''  organizationName?: string;
  organizationId?: string;
  requirementsSelection?: 'BEFORE_2027' | 'FROM_2027' | 'BOTH';
  fieldworkProfileUpdatedAt?: string;
  clientObservationCount?: number;
  workPresence?: WorkPresence;''')
patch('src/lib/fieldworkTimer.ts','export interface RunningTimer { id: string; startedAt: number }', "export interface RunningTimer { id: string; startedAt: number; fieldworkType?: FieldworkType; requirementsSelection?: 'BEFORE_2027' | 'FROM_2027' | 'BOTH' }")
patch('src/lib/fieldworkTimer.ts','  notes: string;\n  category:', '''  notes: string;
  organizationId?: string;
  supervisorId?: string;
  supervisorEmail?: string;
  requirementsSelection?: 'BEFORE_2027' | 'FROM_2027' | 'BOTH';
  fieldworkProfileUpdatedAt?: string;
  clientObservationCount?: number;
  category:''')
patch('src/lib/fieldworkTimer.ts','supervisionByEntry?: Record<string, { supervisionMinutes: number; observationMinutes: number }>;', 'supervisionByEntry?: Record<string, { supervisionMinutes: number; observationMinutes: number; clientObservationCount?: number }>;')
patch('src/lib/fieldworkTimer.ts','export function startTimerSession(email: string, now = Date.now()): RunningTimer {', "export function startTimerSession(email: string, now = Date.now(), plan?: { fieldworkType: FieldworkType; requirementsSelection: 'BEFORE_2027' | 'FROM_2027' | 'BOTH' }): RunningTimer {")
patch('src/lib/fieldworkTimer.ts',"const running = { id: newId('session'), startedAt: now };", "const running: RunningTimer = { id: newId('session'), startedAt: now, ...(plan || {}) };")
patch('src/lib/fieldworkTimer.ts',"fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN',", "fieldworkType: timer.fieldworkType || 'SUPERVISED', requirementsSelection: timer.requirementsSelection, activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN',")
patch('src/lib/fieldworkTimer.ts',"  const minutes = details.supervisionByEntry?.[entryId] || details;", "  const minutes = details.supervisionByEntry?.[entryId] || details;\n  if (minutes.clientObservationCount !== undefined && (!Number.isInteger(minutes.clientObservationCount) || minutes.clientObservationCount < 0 || (minutes.observationMinutes > 0 && minutes.clientObservationCount < 1))) throw new Error('Record the number of client observations; positive minutes need at least one observation.');")
patch('src/lib/fieldworkTimer.ts','supervisionMinutes: minutes.supervisionMinutes, observationMinutes: minutes.observationMinutes,','supervisionMinutes: minutes.supervisionMinutes, observationMinutes: minutes.observationMinutes, clientObservationCount: minutes.clientObservationCount,')
patch('src/lib/fieldworkTimer.ts',"supervisorId: `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,", "supervisorId: details.supervisorId || `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,\n    supervisorEmail: details.supervisorEmail, organizationId: details.organizationId, requirementsSelection: details.requirementsSelection, fieldworkProfileUpdatedAt: details.fieldworkProfileUpdatedAt,")
p='src/components/dashboard/LogHoursTab.tsx'
patch(p,"import { formatTime } from '@/lib/timeDisplay';", "import { formatTime } from '@/lib/timeDisplay';\nimport { Link } from 'react-router';\nimport { useFieldworkProfile } from '@/hooks/useFieldworkProfile';\nimport { loadFieldworkSetup } from '@/lib/fieldworkProfile';\nimport FieldworkRequirements from '@/components/FieldworkRequirements';")
patch(p,"function errorMessage(error: unknown)", "function recordedHours(hours: number) { return hours > 0 && hours < 0.01 ? '<0.01' : hours.toFixed(2); }\nfunction errorMessage(error: unknown)")
patch(p,"    try { await withTimerLock(email, () => startTimerSession(email)); refresh(); }", "    try { const profile = loadFieldworkSetup(); if (!profile) throw new Error('Complete your fieldwork profile before starting the timer.'); await withTimerLock(email, () => startTimerSession(email, Date.now(), { fieldworkType: profile.fieldworkType, requirementsSelection: profile.applicationTiming })); refresh(); }")
patch(p,"  const finishDetails = async (details: TimerDetails) => {", "  const finishDetails = async (details: TimerDetails) => {\n    if (!loadFieldworkSetup()) throw new Error('Complete your fieldwork profile before finishing this activity. Your stopped time is retained.');")
patch(p,'    const duration = hoursBetween(startTime, endTime);', "    if (!loadFieldworkSetup()) throw new Error('Complete your fieldwork profile before adding hours.');\n    const duration = hoursBetween(startTime, endTime);")
patch(p,"activityCategory: details.category, supervisorId: `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,", "activityCategory: details.category, supervisorId: details.supervisorId || `manual_${details.supervisor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,\n      supervisorEmail: details.supervisorEmail, organizationId: details.organizationId, requirementsSelection: details.requirementsSelection, fieldworkProfileUpdatedAt: details.fieldworkProfileUpdatedAt,")
patch(p,'    {message && <div role="status"', '    <FieldworkRequirements entries={entries} />\n    {message && <div role="status"')
patch(p,"{selected.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)} hours recorded", "{recordedHours(selected.reduce((sum, entry) => sum + entry.duration, 0))} hours recorded")
patch(p,'  const [details, setDetails] = useState<TimerDetails>', '  const profile = useFieldworkProfile();\n  const [details, setDetails] = useState<TimerDetails>')
patch(p,"fieldworkType: initial?.fieldworkType || 'SUPERVISED',", "fieldworkType: initial?.fieldworkType || profile?.fieldworkType || 'SUPERVISED',")
patch(p,"supervisionFormat: initial?.supervisionFormat || 'INDIVIDUAL', observationMode:", "clientObservationCount: initial?.clientObservationCount || 0, supervisionFormat: initial?.supervisionFormat || 'INDIVIDUAL', observationMode:")
patch(p,"observationMinutes: entry.observationMinutes || 0 }]))", "observationMinutes: entry.observationMinutes || 0, clientObservationCount: entry.clientObservationCount || 0 }]))")
patch(p,'  const [categoryConfirmed, setCategoryConfirmed]', "  const [organizationId, setOrganizationId] = useState(initial?.organizationId || profile?.organizations.find(o => o.active && o.name === initial?.organizationName)?.id || '');\n  const [supervisorId, setSupervisorId] = useState(profile?.supervisors.find(s => s.active && (s.id === initial?.supervisorId || s.name === initial?.supervisorName))?.id || '');\n  const [categoryConfirmed, setCategoryConfirmed]")
patch(p,"    if (!details.notes.trim() || !details.organization.trim() || !details.supervisor.trim())", "    const organization = profile?.organizations.find(o => o.id === organizationId && o.active);\n    const supervisor = profile?.supervisors.find(s => s.id === supervisorId && s.active);\n    if (!profile || !organization || !supervisor) { setError('Select an organization and responsible supervisor from your saved profile.'); return; }\n    if (!details.notes.trim() || !organization.name.trim() || !supervisor.name.trim())")
patch(p,'    try { await onSave(details, date, start, end); }', '    try { await onSave({ ...details, organization: organization.name, organizationId: organization.id, supervisor: supervisor.name, supervisorId: supervisor.id, supervisorEmail: supervisor.email || undefined, requirementsSelection: profile.applicationTiming, fieldworkProfileUpdatedAt: profile.updatedAt }, date, start, end); }')
patch(p,'    <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Activity description', '''    {!manual && segments.length > 0 && <div className="rounded-xl border border-[#E2DAD5] p-3 text-sm dark:border-white/10"><strong>Recorded time</strong>{segments.map(entry => <p key={entry.id}>{entry.date} · {formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {recordedHours(entry.duration)} hours ({(entry.duration * 3600).toFixed(0)} elapsed seconds)</p>)}<p className="mt-2 text-xs">Time is retained exactly. Add the description and details below before this activity is ready for review.</p></div>}
    {manual && start && end && <p role="status" className="text-sm">Calculated time: {recordedHours(hoursBetween(start,end))} hours</p>}
    <label className="block text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Activity description''')
patch(p,'Organization<input required value={details.organization} onChange={event => update(\'organization\', event.target.value)} className={inputClass} />', 'Organization<select required value={organizationId} onChange={event => setOrganizationId(event.target.value)} className={inputClass}><option value="" disabled>Select an organization</option>{profile?.organizations.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>')
patch(p,'Responsible supervisor<input required value={details.supervisor} onChange={event => update(\'supervisor\', event.target.value)} className={inputClass} />', 'Responsible supervisor<select required value={supervisorId} onChange={event => setSupervisorId(event.target.value)} className={inputClass}><option value="" disabled>Select a supervisor</option>{profile?.supervisors.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}{s.email ? ` · ${s.email}` : s.bacbNumber ? ` · ${s.bacbNumber}` : \'\'}</option>)}</select>')
patch(p,"    {details.presence === 'SUPERVISED'", '    <p className="text-xs text-[#6B5D54] dark:text-[#CFC4BE]">Need another choice? Finish later or cancel, then <Link to="/fieldwork-profile" className="underline">edit your fieldwork profile</Link>. Nothing is sent to a supervisor just by selecting their name.</p>\n    {details.presence === \'SUPERVISED\'')
patch(p,"values: { supervisionMinutes: number; observationMinutes: number }; maximum: number; onChange: (key: 'supervisionMinutes' | 'observationMinutes', value: number) => void", "values: { supervisionMinutes: number; observationMinutes: number; clientObservationCount?: number }; maximum: number; onChange: (key: 'supervisionMinutes' | 'observationMinutes' | 'clientObservationCount', value: number) => void")
patch(p,"value={values.observationMinutes} onChange={event => onChange('observationMinutes', Number(event.target.value))} className={inputClass} /></label></div>;", "value={values.observationMinutes} onChange={event => onChange('observationMinutes', Number(event.target.value))} className={inputClass} /></label><label className=\"text-sm text-[#6B5D54] dark:text-[#CFC4BE]\">Client observations (count)<input required type=\"number\" min={values.observationMinutes > 0 ? 1 : 0} step=\"1\" value={values.clientObservationCount ?? 0} onChange={event => onChange('clientObservationCount', Number(event.target.value))} className={inputClass} /></label></div>;")
p='api/workspace.ts'
patch(p,"import { getBearerToken }", "import { completeSetup, setupError } from '../shared/fieldwork-profile.js';\nimport { getBearerToken }")
patch(p,"   const next=await cloudRequest('/rest/v1/rpc/save_entries'", '''   const finalized = req.body.entries.filter((entry: any) => entry?.status !== 'DRAFT');
   if (finalized.length) {
    if (finalized.some((entry: any) => typeof entry?.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(entry.id))) throw new CloudError('INVALID_ENTRIES',400);
    const profileRows: any = await cloudRequest('/rest/v1/learning_records?owner_id=eq.'+encodeURIComponent(user.id)+'&kind=eq.profile&select=payload&limit=1',token);
    if (!completeSetup(profileRows?.[0]?.payload?.fieldworkSetup)) {
     // Existing entries may still be corrected or deleted; no one loses historical access because onboarding is new.
     const ids = finalized.map((entry: any) => entry.id);
     const known: any = await cloudRequest('/rest/v1/entries?owner_id=eq.'+encodeURIComponent(user.id)+'&deleted_at=is.null&select=id&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&limit=500',token);
     const existing = new Set(Array.isArray(known) ? known.map((entry: any) => entry.id) : []);
     if (ids.some((id: string) => !existing.has(id))) throw new CloudError('FIELDWORK_PROFILE_REQUIRED',409);
    }
   }
   const next=await cloudRequest('/rest/v1/rpc/save_entries' ''')
patch(p,"   const next=await cloudRequest('/rest/v1/rpc/save_learning'", '''   if (req.body.kind==='profile' && req.body.payload && typeof req.body.payload==='object' && 'fieldworkSetup' in req.body.payload) {
    const error=setupError((req.body.payload as {fieldworkSetup:unknown}).fieldworkSetup);
    if(error)throw new CloudError('INVALID_FIELDWORK_PROFILE',400);
   }
   const next=await cloudRequest('/rest/v1/rpc/save_learning' ''')
patch(p,"error:failure.code==='VERSION_CONFLICT'?", "error:failure.code==='FIELDWORK_PROFILE_REQUIRED'?'Complete your fieldwork profile before adding new hours. Existing records remain available.':failure.code==='INVALID_FIELDWORK_PROFILE'?'Complete the application timing, fieldwork type, organization and supervisor choices before saving.':failure.code==='VERSION_CONFLICT'?")
patch('api/health.ts',"    detailedMigrationVersion: 'entry-audit-v1',", "    detailedMigrationVersion: 'entry-audit-v1',\n    fieldworkProfileVersion: 'application-date-v1',")
patch('src/lib/fieldworkStore.ts',"import { managedEmail, cloudKey, queueEntries, queueLearning } from './cloudWorkspace.ts';", "import { managedEmail, cloudKey, queueEntries, queueLearning } from './cloudWorkspace.ts';\nimport { loadFieldworkSetup } from './fieldworkProfile.ts';")
patch('src/lib/fieldworkStore.ts',"""    const raw = localStorage.getItem(storageKey(email, 'supervisors'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSupervisor[]) : [];""", """    const raw = localStorage.getItem(storageKey(email, 'supervisors'));
    const parsed = raw ? JSON.parse(raw) : [];
    const legacy = Array.isArray(parsed) ? parsed as StoredSupervisor[] : [];
    // Profile choices are available in review selectors; saving them alone never creates an invitation.
    const setup = getCurrentUserEmail() === normalizeEmail(email) ? loadFieldworkSetup() : null;
    const saved = setup?.supervisors.filter(s => s.active).map(s => ({id:s.id,name:s.name,email:s.email || undefined,bacbNumber:s.bacbNumber || undefined})) || [];
    return [...saved,...legacy.filter(s => !saved.some(current => current.id === s.id || (current.name === s.name && current.email === s.email)))];""")
patch('src/pages/MyPathV2.tsx',"const save = () => { accountStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setEditing(false); };", "const save = () => { const latest = JSON.parse(accountStorage.getItem(PROFILE_KEY) || '{}'); accountStorage.setItem(PROFILE_KEY, JSON.stringify({ ...latest, ...profile, ...(latest.fieldworkSetup ? { fieldworkSetup: latest.fieldworkSetup } : {}) })); setEditing(false); };")
print('Reviewed profile integration applied; no user data or credentials were accessed.')

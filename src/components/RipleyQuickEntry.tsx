import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { CheckCircle2, Clock3, Plus, X } from 'lucide-react';
import type { ActivityCategory, ActivityType, HourEntry, ObservationMode, SupervisionFormat, WorkPresence } from '@/types';
import { addEntry, getCurrentUserEmail, hoursBetween, loadEntries, newId } from '@/lib/fieldworkStore';
import { useAuth } from '@/hooks/useAuth';

function minutesBetween(start:string,end:string){
  const [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
  if([sh,sm,eh,em].some(Number.isNaN)) return 0;
  return Math.max(0,(eh*60+em)-(sh*60+sm));
}
function typeFor(category:ActivityCategory,presence:WorkPresence):ActivityType{
  if(category==='RESTRICTED') return 'RESTRICTED_DIRECT';
  return presence==='SUPERVISED'?'UNRESTRICTED_SUPERVISION':'UNRESTRICTED_OTHER';
}
function labelize(v:string){return v.toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function unique(values:Array<string|undefined>){return Array.from(new Set(values.map(v=>String(v||'').trim()).filter(Boolean))).sort()}

export default function RipleyQuickEntry(){
  const location=useLocation();
  const {user,isAuthenticated,isOwner}=useAuth();
  const email=getCurrentUserEmail()||user?.email||'';
  const visible=location.pathname==='/dashboard'&&isAuthenticated&&!isOwner&&Boolean(email);
  const [open,setOpen]=useState(false);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [start,setStart]=useState('08:30');
  const [end,setEnd]=useState('09:30');
  const [category,setCategory]=useState<'RESTRICTED'|'UNRESTRICTED'>('UNRESTRICTED');
  const [presence,setPresence]=useState<WorkPresence>('INDEPENDENT');
  const [format,setFormat]=useState<SupervisionFormat>('INDIVIDUAL');
  const [organization,setOrganization]=useState('');
  const [supervisor,setSupervisor]=useState('');
  const [setting,setSetting]=useState('');
  const [description,setDescription]=useState('');
  const [supervisionMinutes,setSupervisionMinutes]=useState(0);
  const [observationMinutes,setObservationMinutes]=useState(0);
  const [observationMode,setObservationMode]=useState<ObservationMode>('IN_PERSON');
  const [clientInitials,setClientInitials]=useState('');
  const [message,setMessage]=useState('');

  const existing=useMemo(()=>visible?loadEntries(email):[],[visible,email,open]);
  const supervisors=useMemo(()=>unique(existing.map(e=>e.supervisorName).filter(n=>n!=='Not specified')),[existing]);
  const organizations=useMemo(()=>unique(existing.map(e=>e.organizationName)),[existing]);
  const totalMinutes=minutesBetween(start,end);
  const decimal=hoursBetween(start,end);
  const hourPart=Math.floor(totalMinutes/60), minutePart=totalMinutes%60;

  if(!visible) return null;

  const save=()=>{
    if(!date||decimal<=0){setMessage('Choose a valid start and end time.');return}
    if(!organization.trim()){setMessage('Organization is required for every entry.');return}
    if(!supervisor.trim()){setMessage('Responsible supervisor is required for every entry.');return}
    if(!description.trim()){setMessage('Add a short description of the activity.');return}
    const supervised=presence==='SUPERVISED';
    const sup=Math.min(totalMinutes,Math.max(0,Number(supervisionMinutes)||0));
    const obs=Math.min(totalMinutes,Math.max(0,Number(observationMinutes)||0));
    const now=new Date().toISOString();
    const entry:HourEntry={
      id:newId('quick'),userId:email,date,startTime:start,endTime:end,duration:decimal,fieldworkType:'SUPERVISED',
      activityType:typeFor(category,presence),activityCategory:category,
      supervisorId:`quick_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`,supervisorName:supervisor.trim(),
      organizationName:organization.trim(),workPresence:presence,supervisionFormat:supervised?format:undefined,
      observationMode:supervised&&obs>0?observationMode:undefined,setting:setting.trim()||organization.trim(),notes:description.trim(),
      status:'PENDING',createdAt:now,updatedAt:now,supervisionMinutes:supervised&&sup>0?sup:undefined,
      observationMinutes:supervised&&obs>0?obs:undefined,individualSupervisionMinutes:supervised&&format==='INDIVIDUAL'&&sup>0?sup:undefined,
      clientInitials:supervised&&obs>0?clientInitials.trim().toUpperCase()||undefined:undefined,
    };
    addEntry(entry,email);
    window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
    setDescription(''); setObservationMinutes(0); setClientInitials('');
    setMessage(`Saved ${decimal.toFixed(2)} ${category.toLowerCase()} hours as Pending.`);
  };

  return <>
    <button onClick={()=>{setOpen(true);setMessage('')}} className="fixed bottom-[76px] right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-[#E85D70] px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5"><Plus size={16}/> Log hours</button>
    {open&&<div className="fixed inset-0 z-[95] overflow-y-auto bg-black/45 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[30px] border border-[#E2DAD5] bg-[#FFFCF9] shadow-2xl dark:border-white/10 dark:bg-[#171412]">
        <div className="flex items-start justify-between border-b border-[#F2EDEA] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#211D1A]"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[#E85D70]">Quick fieldwork entry</div><h2 className="mt-1 font-serif text-2xl font-semibold text-[#332C28] dark:text-white">Log it the familiar way: time in, time out, exact decimal.</h2></div><button onClick={()=>setOpen(false)} className="rounded-xl border border-[#E2DAD5] p-2 text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]"><X size={18}/></button></div>
        <div className="space-y-6 p-5 sm:p-7">
          <section className="grid gap-3 sm:grid-cols-4">
            <Field label="Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="field-input"/></Field>
            <Field label="Start time"><input type="time" value={start} onChange={e=>setStart(e.target.value)} className="field-input"/></Field>
            <Field label="End time"><input type="time" value={end} onChange={e=>setEnd(e.target.value)} className="field-input"/></Field>
            <div className="rounded-2xl border-2 border-[#F0C8D0] bg-[#FFF4F6] p-4 dark:border-[#E85D70]/30 dark:bg-[#E85D70]/10"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#D94D62]"><Clock3 size={14}/> Decimal hours</div><div className="mt-1 font-mono text-3xl font-bold text-[#E85D70]">{decimal>0?decimal.toFixed(2):'0.00'}</div><div className="mt-1 text-xs text-[#8A756A] dark:text-[#CFC4BE]">{totalMinutes>0?`${hourPart}h ${minutePart}m → ${decimal.toFixed(2)} hours`:'Choose a valid time range'}</div></div>
          </section>

          <section><div className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#7B6B62] dark:text-[#CFC4BE]">How should these hours count?</div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={()=>setCategory('UNRESTRICTED')} className={`rounded-2xl border-2 p-5 text-left transition ${category==='UNRESTRICTED'?'border-[#5FA37E] bg-[#F1FAF5] shadow-sm dark:bg-[#5FA37E]/10':'border-[#E2DAD5] bg-white dark:border-white/10 dark:bg-[#211D1A]'}`}><div className={`text-lg font-bold ${category==='UNRESTRICTED'?'text-[#4B8C69]':'text-[#4D423C] dark:text-white'}`}>Unrestricted</div><div className="mt-1 text-xs text-[#8A7A70] dark:text-[#CFC4BE]">Tap once to classify the full {decimal.toFixed(2)}h entry as unrestricted.</div>{category==='UNRESTRICTED'&&<div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#4B8C69]"><CheckCircle2 size={14}/> Selected</div>}</button><button type="button" onClick={()=>setCategory('RESTRICTED')} className={`rounded-2xl border-2 p-5 text-left transition ${category==='RESTRICTED'?'border-[#D4A574] bg-[#FFF8EE] shadow-sm dark:bg-[#D4A574]/10':'border-[#E2DAD5] bg-white dark:border-white/10 dark:bg-[#211D1A]'}`}><div className={`text-lg font-bold ${category==='RESTRICTED'?'text-[#A96F31]':'text-[#4D423C] dark:text-white'}`}>Restricted</div><div className="mt-1 text-xs text-[#8A7A70] dark:text-[#CFC4BE]">Tap once to classify the full {decimal.toFixed(2)}h entry as restricted.</div>{category==='RESTRICTED'&&<div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#A96F31]"><CheckCircle2 size={14}/> Selected</div>}</button></div></section>

          <section className="grid gap-4 sm:grid-cols-2"><Field label="Organization *"><input list="quick-organizations" value={organization} onChange={e=>setOrganization(e.target.value)} placeholder="Melmark Carolinas" className="field-input"/><datalist id="quick-organizations">{organizations.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="Responsible supervisor *"><input list="quick-supervisors" value={supervisor} onChange={e=>setSupervisor(e.target.value)} placeholder="Carrie, Christina, Brad…" className="field-input"/><datalist id="quick-supervisors">{supervisors.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="Setting / location"><input value={setting} onChange={e=>setSetting(e.target.value)} placeholder="School, clinic, home…" className="field-input"/></Field><div><div className="mb-1.5 text-xs font-medium text-[#7B6B62] dark:text-[#CFC4BE]">Was the BCBA/supervisor present?</div><div className="grid grid-cols-2 gap-2"><button onClick={()=>setPresence('INDEPENDENT')} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${presence==='INDEPENDENT'?'border-[#E85D70] bg-[#FFF4F6] text-[#D94D62]':'border-[#E2DAD5] text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]'}`}>Independent</button><button onClick={()=>setPresence('SUPERVISED')} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${presence==='SUPERVISED'?'border-[#E85D70] bg-[#FFF4F6] text-[#D94D62]':'border-[#E2DAD5] text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]'}`}>Supervised</button></div></div></section>

          {presence==='SUPERVISED'&&<section className="rounded-2xl border border-[#F2EDEA] bg-white p-4 dark:border-white/10 dark:bg-[#211D1A]"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Individual / group"><select value={format} onChange={e=>setFormat(e.target.value as SupervisionFormat)} className="field-input bg-white"><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></select></Field><Field label="Supervision minutes"><input type="number" min="0" max={totalMinutes||undefined} value={supervisionMinutes} onChange={e=>setSupervisionMinutes(Number(e.target.value))} className="field-input"/></Field><Field label="Client observation minutes"><input type="number" min="0" max={totalMinutes||undefined} value={observationMinutes} onChange={e=>setObservationMinutes(Number(e.target.value))} className="field-input"/></Field>{observationMinutes>0&&<Field label="Observation mode"><select value={observationMode} onChange={e=>setObservationMode(e.target.value as ObservationMode)} className="field-input bg-white"><option value="IN_PERSON">In person</option><option value="ONLINE">Online / video</option><option value="PHONE">Phone</option></select></Field>}{observationMinutes>0&&<Field label="Client initials"><input value={clientInitials} onChange={e=>setClientInitials(e.target.value)} className="field-input" placeholder="AB"/></Field>}</div></section>}

          <Field label="Description of activity *"><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} className="field-input resize-none" placeholder="What did you do during this time?"/></Field>
          <div className="rounded-2xl bg-[#332C28] p-4 text-white dark:ring-1 dark:ring-white/10"><div className="text-xs uppercase tracking-[.14em] text-white/50">This entry will save as</div><div className="mt-1 font-serif text-xl font-semibold">{decimal.toFixed(2)} {category.toLowerCase()} hours • {labelize(presence)}</div><div className="mt-1 text-xs text-white/55">{start}–{end} • {organization||'Organization required'} • {supervisor||'Supervisor required'}</div></div>
          {message&&<div className={`rounded-xl px-4 py-3 text-sm ${message.startsWith('Saved')?'bg-[#E8F5EE] text-[#4B8C69]':'bg-[#FFF5F7] text-[#C9445A]'}`}>{message}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={()=>setOpen(false)} className="rounded-xl border border-[#E2DAD5] px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]">Cancel</button><button onClick={save} className="rounded-xl bg-[#E85D70] px-5 py-2.5 text-sm font-bold text-white"><CheckCircle2 size={16} className="mr-2 inline"/>Save {decimal.toFixed(2)} hours</button></div>
        </div>
      </div>
    </div>}
  </>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-xs font-medium text-[#7B6B62] dark:text-[#CFC4BE]">{label}<div className="mt-1.5">{children}</div></label>}

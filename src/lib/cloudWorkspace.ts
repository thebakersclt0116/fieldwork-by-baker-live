import type { HourEntry } from '@/types';

export type CloudState = 'loading' | 'saved' | 'saving' | 'blocked';
const listeners = new Set<() => void>();
let state: CloudState = 'loading';
let activeEmail = '';
let version = 0;
let serverIds = new Set<string>();
let generation = 0;
let running = false;
let initialized = false;
let loading:Promise<void>|null=null;
const learningVersions = new Map<string, number>();
const pendingLearning = new Map<string, unknown>();
let pendingEntries: HourEntry[] | null = null;
export const learningKinds: Record<string,string> = {
  'fieldworkByBaker:pathProfile:v1':'profile',
  'fieldworkByBaker:examLab:fullExam:v2':'exam-attempt',
  'fieldworkByBaker:examLab:lastResult:v2':'exam-result',
  'fieldworkByBaker:weakAreaPlan:v1':'weak-plan',
  'fieldworkByBaker:bakerBrainHistory:v1':'brain-history',
  'fieldworkByBaker:brainResources:v1':'brain-resources',
  'fieldworkByBaker:resourceSaves:v1':'resource-saves',
};
export function managedEmail(): string | null {
  try { const user=JSON.parse(localStorage.getItem('authUser')||'null');return user?.authProvider==='supabase'?String(user.email).trim().toLowerCase():null; } catch {return null;}
}
export function cloudKey(kind: string,email=managedEmail()||''): string {return `fieldwork:managed:${encodeURIComponent(email)}:${kind}`;}
function notify(next:CloudState) {state=next;for(const listener of listeners)listener();}
export function cloudState(){return state;}
export function subscribeCloud(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
async function request(body?:unknown,cursor?:string,owner=activeEmail):Promise<any>{
  if(managedEmail()!==owner||activeEmail!==owner)throw new Error('Account changed');
  const token=localStorage.getItem('bakerSessionToken');
  const response=await fetch('/api/workspace'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{
    method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.code||'CLOUD_UNAVAILABLE');
  if(managedEmail()!==owner||activeEmail!==owner)throw new Error('Account changed');
  return payload;
}
// Load every page at one workspace version. A simultaneous write requires another load.
async function readWorkspace(){
  const owner=activeEmail;
  let first:any;let cursor:string|undefined;const entries:HourEntry[]=[];const visited=new Set<string>();
  do {
    const page=await request(undefined,cursor,owner);
    if(!first)first=page;
    if(page.ownerId!==first.ownerId||page.version!==first.version||!Array.isArray(page.entries)||!Array.isArray(page.learning))throw new Error('Workspace changed while loading');
    entries.push(...page.entries.map((entry:any)=>({...entry.payload,revision:entry.revision})));
    cursor=page.nextCursor||undefined;
    if(cursor){if(visited.has(cursor))throw new Error('Invalid pagination');visited.add(cursor);}
  }while(cursor);
  return {...first,entries};
}
export function initializeCloud(email:string):Promise<void>{
  if(initialized&&activeEmail===email)return Promise.resolve();
  if(loading&&activeEmail===email)return loading;
  if(loading)return Promise.reject(new Error('Another account is still loading'));
  loading=loadCloud(email).finally(()=>{loading=null;});return loading;
}
async function loadCloud(email:string):Promise<void>{
  if(running)throw new Error('A save is still pending');
  activeEmail=email;initialized=false;notify('loading');
  try {
    // Unsaved data is kept for export/review; never replace it with a server snapshot.
    if(localStorage.getItem(cloudKey('pending',email)))throw new Error('Unsaved changes need review');
    const snapshot=await readWorkspace();
    localStorage.setItem(cloudKey('entries',email),JSON.stringify(snapshot.entries));
    version=snapshot.version;serverIds=new Set(snapshot.entries.map((entry:HourEntry)=>entry.id));
    learningVersions.clear();pendingLearning.clear();pendingEntries=null;
    const records=new Map<string,any>(snapshot.learning.map((record:any)=>[record.kind,record]));
    for(const [key,kind] of Object.entries(learningKinds)){
      const record=records.get(kind);learningVersions.set(kind,record?.version||0);
      if(record&&record.payload!==null)localStorage.setItem(cloudKey(key,email),JSON.stringify(record.payload));
      else localStorage.removeItem(cloudKey(key,email));
    }
    const supervisors=records.get('supervisors');learningVersions.set('supervisors',supervisors?.version||0);
    localStorage.setItem(cloudKey('supervisors',email),JSON.stringify(supervisors?.payload||[]));
    initialized=true;notify('saved');
  }catch(error){notify('blocked');throw error;}
}
function markPending(){localStorage.setItem(cloudKey('pending'),JSON.stringify({version,updatedAt:new Date().toISOString()}));notify('saving');}
export function queueEntries(entries:HourEntry[]){
  if(!initialized||state==='blocked'||managedEmail()!==activeEmail)throw new Error('Cloud saving is blocked. Export your backup before continuing.');
  localStorage.setItem(cloudKey('entries'),JSON.stringify(entries));
  pendingEntries=entries;generation++;markPending();void flush();
}
export function queueLearning(kind:string,payload:unknown){
  if(!initialized||state==='blocked'||managedEmail()!==activeEmail)throw new Error('Cloud saving is blocked. Export your backup before continuing.');
  pendingLearning.set(kind,payload);markPending();void flush();
}
async function flush(){
  if(running)return;running=true;
  try {
    while(pendingEntries||pendingLearning.size){
      if(pendingEntries){
        const desired=pendingEntries;const currentGeneration=generation;pendingEntries=null;
        const desiredIds=new Set(desired.map(entry=>entry.id));
        const deletions=[...serverIds].filter(id=>!desiredIds.has(id));
        // Individual transactions retain compare-and-swap even for larger imports.
        const count=Math.max(Math.ceil(desired.length/500),Math.ceil(deletions.length/500),1);
        for(let i=0;i<count;i++){
          const result=await request({action:'save-entries',entries:desired.slice(i*500,(i+1)*500),deleteIds:deletions.slice(i*500,(i+1)*500),expectedVersion:version});version=result.version;
        }
        const canonical=await readWorkspace();
        if(canonical.version!==version)throw new Error('Concurrent change requires review');
        serverIds=new Set(canonical.entries.map((entry:HourEntry)=>entry.id));
        if(generation===currentGeneration)localStorage.setItem(cloudKey('entries'),JSON.stringify(canonical.entries));
      }
      for(const [kind,payload] of [...pendingLearning]){
        pendingLearning.delete(kind);
        const result=await request({action:'save-learning',kind,payload,expectedVersion:learningVersions.get(kind)||0});learningVersions.set(kind,result.version);
      }
    }
    localStorage.removeItem(cloudKey('pending'));notify('saved');
  }catch{notify('blocked');}finally{running=false;}
}
export function exportCloudDraft(){
  const email=managedEmail();if(!email)return;
  const records:Record<string,unknown>={};
  const prefix=cloudKey('',email);
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix))records[key.slice(prefix.length)]=JSON.parse(localStorage.getItem(key)||'null');}
  const url=URL.createObjectURL(new Blob([JSON.stringify({email,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='fieldwork-unsaved-backup.json';link.click();URL.revokeObjectURL(url);
}

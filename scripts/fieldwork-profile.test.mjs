import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ruleFor, yearsFor, setupError, completeSetup, summarizeForPlan } from '../shared/fieldwork-profile.ts';
import { profileDocument, loadFieldworkSetup, saveFieldworkSetup, FIELDWORK_PROFILE_KEY } from '../src/lib/fieldworkProfile.ts';
import { accountStorage } from '../src/lib/accountStorage.ts';
import { startTimerSession, stopTimerSession, restoreTimerEntries, completeTimerDetails } from '../src/lib/fieldworkTimer.ts';
import { loadEntries, loadSupervisors } from '../src/lib/fieldworkStore.ts';
const email='fieldwork-profile-qa@example.invalid';
const setup=(patch={})=>({version:1,applicationTiming:'FROM_2027',fieldworkType:'SUPERVISED',organizations:[{id:'org_a',name:'Example Organization',active:true}],supervisors:[{id:'sup_a',name:'Example Supervisor',email:'supervisor@example.invalid',bacbNumber:'TEST-NOT-REAL',active:true}],applicationDateAcknowledged:true,completedAt:'2026-10-28T20:00:00.000Z',updatedAt:'2026-10-28T20:00:00.000Z',...patch});
let map;
beforeEach(()=>{map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};globalThis.window=new EventTarget();localStorage.setItem('authUser',JSON.stringify({email}));});
afterEach(()=>{delete globalThis.localStorage;delete globalThis.window;});
for(const [year,type,target,percentage,max,observations,minutes] of [
 ['2022','SUPERVISED',2000,5,130,1,null],['2022','CONCENTRATED',1500,10,130,1,null],
 ['2027','SUPERVISED',2000,5,160,null,60],['2027','CONCENTRATED',1500,7.5,160,null,90],
])test(`${year} ${type} matches the exact transition-guide values`,()=>{
 assert.deepEqual(ruleFor(year,type),{year,type,targetHours:target,supervisionPercent:percentage,minimumMonthlyHours:20,maximumMonthlyHours:max,observationCount:observations,observationMinutes:minutes});
});
test('January 1 is included in the new regime; both remains two separate checklists',()=>{
 assert.deepEqual(yearsFor('BEFORE_2027'),['2022']);assert.deepEqual(yearsFor('FROM_2027'),['2027']);assert.deepEqual(yearsFor('BOTH'),['2022','2027']);assert.throws(()=>yearsFor('exam-2027'));
});
test('profile choices have no exam-date or current-calendar auto-switch',()=>{
 const p=setup({applicationTiming:'BEFORE_2027',examDate:'2028-02-01'});assert.equal(completeSetup(p),true);assert.deepEqual(yearsFor(p.applicationTiming),['2022']);
});
test('incomplete profiles, false acknowledgements and malformed arrays fail closed without throwing',()=>{
 for(const value of [null,{},setup({applicationTiming:''}),setup({fieldworkType:''}),setup({applicationDateAcknowledged:false}),setup({organizations:[]}),setup({supervisors:[]}),setup({organizations:[null]}),setup({supervisors:[null]}),setup({completedAt:''})]){assert.equal(completeSetup(value),false);assert.equal(typeof setupError(value),'string');}
});
test('duplicate and archived-only rosters cannot pass onboarding',()=>{
 assert.equal(completeSetup(setup({organizations:[{id:'o1',name:'Clinic',active:true},{id:'o2',name:' clinic ',active:true}]})),false);
 assert.equal(completeSetup(setup({supervisors:[{id:'s1',name:'Supervisor',email:'',bacbNumber:'',active:false}]})),false);
 assert.equal(completeSetup(setup({organizations:[{id:'org_a',name:'Archived',active:false},{id:'org_b',name:'Current',active:true}]})),true);
});
test('bad supervisor emails and duplicate identifiers are rejected',()=>{
 assert.equal(completeSetup(setup({supervisors:[{id:'org_a',name:'Supervisor',email:'',bacbNumber:'',active:true}]})),false);
 assert.equal(completeSetup(setup({supervisors:[{id:'sup_a',name:'Supervisor',email:'invalid',bacbNumber:'',active:true}]})),false);
});
test('saving setup preserves study fields, entries, signatures and original-document storage',async()=>{
 accountStorage.setItem(FIELDWORK_PROFILE_KEY,JSON.stringify({program:'Example program',examDate:'2027-06-01',savedCustom:{keep:'exact'}}));
 localStorage.setItem(`fieldworkByBaker:v1:${email}:entries`,JSON.stringify([{id:'historic',status:'VERIFIED',duration:1.75,notes:'Exact original narrative',supervisorName:'Original Supervisor',revisionHistory:[{reason:'original'}]}]));
 localStorage.setItem('original-document-fixture','UNCHANGED');const before=localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`);
 await saveFieldworkSetup(setup(),JSON.stringify(profileDocument()),email);
 assert.equal(loadFieldworkSetup().applicationTiming,'FROM_2027');assert.equal(profileDocument().program,'Example program');assert.equal(profileDocument().savedCustom.keep,'exact');assert.equal(profileDocument().examDate,'2027-06-01');assert.equal(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`),before);assert.equal(localStorage.getItem('original-document-fixture'),'UNCHANGED');
});
test('a second browser account cannot read or write the first account profile',async()=>{
 await saveFieldworkSetup(setup(),JSON.stringify(profileDocument()),email);
 localStorage.setItem('authUser',JSON.stringify({email:'other@example.invalid'}));assert.equal(loadFieldworkSetup(),null);
 await assert.rejects(saveFieldworkSetup(setup(),'{}',email),/account changed/);
});
test('a stale tab never replaces newer profile edits',async()=>{
 const expected=JSON.stringify(profileDocument());accountStorage.setItem(FIELDWORK_PROFILE_KEY,JSON.stringify({program:'Newer edits'}));
 await assert.rejects(saveFieldworkSetup(setup(),expected,email),/another tab/);assert.equal(profileDocument().program,'Newer edits');
});
test('archiving a supervisor removes future selection but retains historical record snapshots',async()=>{
 const original=setup();await saveFieldworkSetup(original,JSON.stringify(profileDocument()),email);assert.equal(loadSupervisors()[0].id,'sup_a');
 await saveFieldworkSetup(setup({supervisors:[{...original.supervisors[0],active:false},{id:'sup_b',name:'Replacement',email:'',bacbNumber:'',active:true}]}),JSON.stringify(profileDocument()),email);
 assert.deepEqual(loadSupervisors().map(s=>s.id),['sup_b']);
});
test('timer records retain concentrated selection and exact elapsed time; details bind the saved IDs',()=>{
 const start=new Date(2026,9,28,8,30).getTime();startTimerSession(email,start,{fieldworkType:'CONCENTRATED',requirementsSelection:'BEFORE_2027'});
 const stopped=stopTimerSession(email,start+25*60000);assert.equal(stopped.entries[0].fieldworkType,'CONCENTRATED');assert.equal(stopped.entries[0].duration,25/60);restoreTimerEntries(email);
 completeTimerDetails(email,stopped.id,{notes:'Synthetic educational observation.',category:'UNRESTRICTED',fieldworkType:'CONCENTRATED',organization:'Example Organization',organizationId:'org_a',supervisor:'Example Supervisor',supervisorId:'sup_a',supervisorEmail:'supervisor@example.invalid',requirementsSelection:'BEFORE_2027',setting:'',presence:'SUPERVISED',supervisionMinutes:25,observationMinutes:25,clientObservationCount:1,supervisionFormat:'INDIVIDUAL',observationMode:'IN_PERSON'});
 const entry=loadEntries()[0];assert.equal(entry.duration,25/60);assert.equal(entry.supervisorId,'sup_a');assert.equal(entry.organizationId,'org_a');assert.equal(entry.clientObservationCount,1);assert.equal(entry.timerSession.detailsComplete,true);
});
const entry=(patch={})=>({id:'a',date:'2026-10-28',duration:20,fieldworkType:'SUPERVISED',activityCategory:'UNRESTRICTED',status:'PENDING',notes:'Original description',organizationName:'Example Organization',supervisorName:'Example Supervisor',supervisionMinutes:60,observationMinutes:60,clientObservationCount:1,...patch});
test('summary excludes draft/rejected/incomplete activities and does not mix fieldwork targets',()=>{
 const rows=[entry(),entry({id:'b',status:'DRAFT'}),entry({id:'c',status:'REJECTED'}),entry({id:'d',notes:''}),entry({id:'e',fieldworkType:'CONCENTRATED',duration:10})];
 const summary=summarizeForPlan(rows,setup(),'2026-10','Example Organization');assert.equal(summary.recordedSelectedHours,20);assert.equal(summary.otherTypeHours,10);assert.equal(summary.excludedEntries,3);assert.equal(summary.mixedMonth,true);assert.equal(summary.organizationTotalHours,30);
});
test('pre-2027 does not invent a 60-minute client-observation requirement',()=>{
 const summary=summarizeForPlan([entry({observationMinutes:5,clientObservationCount:1})],setup({applicationTiming:'BEFORE_2027'}),'2026-10','Example Organization');assert.equal(summary.observationCount,1);assert.equal(summary.rules[0].observationMinutes,null);
});
test('source splits never double-count a single client observation',()=>{
 const migration={sourceHash:'samehash',sourceRow:2,sourceId:'session'};
 const summary=summarizeForPlan([entry({id:'a',migration,duration:1,clientObservationCount:1}),entry({id:'b',migration,duration:1,clientObservationCount:1})],setup({applicationTiming:'BOTH'}),'2026-10','Example Organization');assert.equal(summary.observationCount,1);assert.equal(summary.rules.length,2);
});
test('legacy observations are explicitly marked inferred rather than silently certified',()=>{
 const summary=summarizeForPlan([entry({clientObservationCount:undefined})],setup(),'2026-10','Example Organization');assert.equal(summary.inferredObservationCounts,true);assert.equal(summary.observationCount,1);
});

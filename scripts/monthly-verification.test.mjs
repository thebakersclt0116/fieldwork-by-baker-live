import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'fieldwork-monthly-'));
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});});
await build({entryPoints:['api/monthly-verification.ts','src/lib/monthlyProgress.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {default:handler}=await import(pathToFileURL(join(dir,'api/monthly-verification.mjs')));
const {trackedMonthKeys,summarizeMonth,currentMonthKey}=await import(pathToFileURL(join(dir,'src/lib/monthlyProgress.mjs')));
process.env.SUPABASE_URL='https://synthetic-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_public_test_key';
const actor='11111111-1111-4111-8111-111111111111';
const identity={traineeName:'Fictional Example',bacbId:'EXAMPLE123',state:'North Carolina',country:'United States',supervisorName:'Fictional Supervisor',supervisorCertification:'EXAMPLE456'};
const input={...identity,month:'2026-01',organization:'Fictional Organization',structure:'organization',requirements:'2027',fieldworkType:'SUPERVISED'};
const entries=[{id:'one',date:'2026-01-14',organizationName:input.organization,supervisorName:identity.supervisorName,fieldworkType:'SUPERVISED',duration:62,supervisionMinutes:375,observationMinutes:60,activityCategory:'UNRESTRICTED',individualSupervisionMinutes:120},{id:'other-month',date:'2026-02-14',organizationName:input.organization,duration:10,supervisionMinutes:0,activityCategory:'RESTRICTED'},{id:'other-org',date:'2026-01-14',organizationName:'Another Organization',duration:10,supervisionMinutes:0,activityCategory:'RESTRICTED'}];
const response=()=>({code:0,headers:{},body:null,status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}});
const request=(body=input)=>({method:'POST',headers:{authorization:'Bearer synthetic-jwt'},body});
function mock(status='active',versionConflict=false){let versions=0;globalThis.fetch=async(url,options)=>{
 if(url.startsWith('https://api.resend.com'))return Response.json({id:'fictional-delivery-id'});
 assert.equal(options.headers.Authorization,'Bearer synthetic-jwt');
 if(url.endsWith('/auth/v1/user'))return Response.json({id:actor,email:'trainee@example.com',email_confirmed_at:'2026-01-01'});
 if(url.includes('/profiles?'))return Response.json([{display_name:identity.traineeName,subscription_status:status,subscription_tier:'individual'}]);
 if(url.includes('/workspaces?'))return Response.json([{version:versionConflict?++versions:7}]);
 if(url.includes('/entries?')){assert.ok(url.includes('owner_id=eq.'+actor));return Response.json(entries.map(payload=>({id:payload.id,payload})));}
 if(url.endsWith('/rpc/reserve_monthly_form_email'))return Response.json('22222222-2222-4222-8222-222222222222');
 throw Error('unexpected request '+url);
};}
test('six historical months do not become current-month hours',()=>{
 const imported=Array.from({length:6},(_,index)=>({...entries[0],date:`2026-${String(index+1).padStart(2,'0')}-14`,duration:10}));
 const now=new Date(2026,9,6);assert.equal(currentMonthKey(now),'2026-10');
 assert.equal(trackedMonthKeys(imported,now).length,7);assert.equal(summarizeMonth(imported,'2026-10').totalHours,0);
 assert.equal(summarizeMonth(imported,'2026-01').totalHours,10);
});
test('restricted, independent, and individual-supervision hours stay distinct',()=>{
 const summary=summarizeMonth(entries,'2026-01');assert.equal(summary.totalHours,72);assert.equal(summary.supervisedHours,6.25);assert.equal(summary.independentHours,65.75);assert.equal(summary.individualHours,2);assert.equal(summary.restrictedHours,10);assert.equal(summary.unrestrictedHours,62);
 const unknown=summarizeMonth([{...entries[0],individualSupervisionMinutes:undefined,supervisionFormat:undefined}],'2026-01');assert.equal(unknown.individualHours,0);assert.equal(unknown.unknownSupervisionHours,6.25);
});
test('missing authentication is denied before any record read',async()=>{let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected')};const res=response();await handler({method:'POST',body:input},res);assert.equal(res.code,401);assert.equal(calls,0);});
for(const status of ['none','trialing','canceled','past_due'])test(`${status} cannot generate or email a verification form even with a claimed paid role`,async()=>{mock(status);const res=response();await handler(request({...input,role:'paid',subscription:'professional',action:'email'}),res);assert.equal(res.code,403);assert.equal(res.body.code,'PAID_SUBSCRIPTION_REQUIRED');});
test('paid PDF uses only the selected month and organization, with blank signatures',async()=>{
 mock();const res=response();await handler(request({...input,entries:[{duration:9999}]}),res);assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'application/pdf');
 const pdf=await PDFDocument.load(res.body);const form=pdf.getForm();
 assert.equal(form.getTextField('TRAINEE_NAME').getText(),'Fictional Example');assert.equal(form.getTextField('Total_Fieldwork_Hours').getText(),'62');assert.equal(form.getTextField('Independent_Hours').getText(),'55');assert.equal(form.getTextField('Independent_Minutes').getText(),'45');assert.equal(form.getTextField('Supervised_Minutes').getText(),'15');
 assert.equal(form.getTextField('SUPERVISOR_SIGNATURE_DATE').getText(),undefined);assert.equal(form.getSignature('SUPERVISOR_SIGNATURE').acroField.dict.has((await import('pdf-lib')).PDFName.of('V')),false);
});
test('a concurrent workspace change stops the export',async()=>{mock('active',true);const res=response();await handler(request(),res);assert.equal(res.code,409);assert.equal(res.body.code,'VERSION_CONFLICT');});
test('email requires an explicitly typed address and sharing confirmation',async()=>{mock();const res=response();await handler(request({...input,action:'email'}),res);assert.equal(res.code,400);assert.equal(res.body.code,'SUPERVISOR_EMAIL_REQUIRED');});
test('email sends an unsigned attachment to exactly the typed supervisor, replying to the verified trainee',async()=>{
 process.env.RESEND_API_KEY='fictional-key';process.env.BAKER_NOTIFICATION_FROM='noreply@example.com';mock();const baseFetch=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{if(url.startsWith('https://api.resend.com')){sent=JSON.parse(options.body);assert.ok(options.headers['Idempotency-Key'].startsWith('monthly-form/'+actor+'/'));return Response.json({id:'fictional-delivery'});}return baseFetch(url,options);};
 const res=response();await handler(request({...input,action:'email',supervisorEmail:'supervisor@example.com',confirmSharing:true,requestId:'22222222-2222-4222-8222-222222222222',email:'attacker@example.com'}),res);
 assert.equal(res.code,200);assert.deepEqual(sent.to,['supervisor@example.com']);assert.equal(sent.reply_to,'trainee@example.com');assert.equal(sent.attachments.length,1);assert.equal(res.body.emailAccepted,true);
});

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'baker-funnel-test-'));
const originalFetch=globalThis.fetch;
globalThis.__funnelTasks=[];
const waitUntilMock={name:'test-background',setup(b){b.onResolve({filter:/^@vercel\/functions$/},()=>({path:'background',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function waitUntil(p){globalThis.__funnelTasks.push(p)}',loader:'js'}));}};
await build({entryPoints:['server/funnel-ledger.ts','server/funnel-events.ts','api/funnel.ts','api/account.ts','api/create-checkout-session.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},plugins:[waitUntilMock]});
const ledger=await import(pathToFileURL(join(dir,'server/funnel-ledger.mjs')));
const events=await import(pathToFileURL(join(dir,'server/funnel-events.mjs')));
const {default:route}=await import(pathToFileURL(join(dir,'api/funnel.mjs')));
const {default:account}=await import(pathToFileURL(join(dir,'api/account.mjs')));
const {default:checkout}=await import(pathToFileURL(join(dir,'api/create-checkout-session.mjs')));
const actor='11111111-1111-4111-8111-111111111111', flow='22222222-2222-4222-8222-222222222222';
const context={version:'funnel-v1',flowId:flow,variant:'signup',campaign:'120251729153710531',qa:false};
const choice={consent:'ads-v2',consentAt:Date.now(),visitorId:'33333333-3333-4333-8333-333333333333',fbc:`fb.1.${Date.now()}.TestClick12345`};
const response=()=>({code:0,body:null,setHeader(){return this;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
const request=body=>({method:'POST',headers:{origin:'https://www.fieldworkbybaker.com','content-type':'application/json','user-agent':'Fictional Browser'},body});
const drain=async()=>{await Promise.all(globalThis.__funnelTasks.splice(0));};
function configure(){process.env.VERCEL_ENV='production';process.env.SUPABASE_URL='https://synthetic-project.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fictional';process.env.SUPABASE_SECRET_KEY='sb_secret_fictional';process.env.BAKER_META_ADS_ENABLED='false';process.env.STRIPE_SECRET_KEY='sk_live_fictional';process.env.BAKER_BILLING_ENABLED='true';process.env.STRIPE_WEBHOOK_SECRET='whsec_fictional';delete process.env.RESEND_API_KEY;delete process.env.BAKER_STRIPE_SECRET_KEY;}
after(async()=>{await drain();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});});
test('context only retains known experiment fields, never source narratives or customer details',()=>{
 assert.deepEqual(ledger.normalizeFunnelContext({...context,email:'private@example.com',notes:'PRIVATE FIELDWORK',supervisor:'PRIVATE'}),context);
 assert.equal(ledger.normalizeFunnelContext({...context,flowId:'bad'}),null);
 assert.equal(ledger.normalizeFunnelContext({...context,campaign:'not-known'}).variant,'direct');
 assert.ok(!ledger.funnelKey('account_created',context).includes(flow));
});
test('QA markers and repeated delivery never inflate production report counts',()=>{
 const k=ledger.funnelKey('account_created',context),q=ledger.funnelKey('email_verified',{...context,qa:true});
 const out=ledger.summarizeFunnelRows([{event_id:k,processed_at:'2026-10-13'},{event_id:k,processed_at:'2026-10-13'},{event_id:q,processed_at:'2026-10-13'}]);
 assert.equal(out.groups[0].stages.account_created,1);assert.equal(out.qaEventsExcluded,1);
 assert.ok(out.note.includes('not a historical backfill'));
});
test('new Meta events require renewed ads-v2 consent and exclude QA identities',()=>{
 const args={stage:'email_verified',context,adMeasurement:choice,email:'member@fictional.invalid',userAgent:'Browser'};
 assert.equal(events.stageMetaEvent({...args,adMeasurement:{...choice,consent:'ads-v1'}}),null);
 assert.equal(events.stageMetaEvent({...args,context:{...context,qa:true}}),null);
 assert.equal(events.stageMetaEvent({...args,email:'qa@example.com'}),null);
 const event=events.stageMetaEvent(args);assert.equal(event.event_name,'CompleteRegistration');
 assert.ok(!JSON.stringify(event).includes('member@fictional.invalid'));assert.ok(!JSON.stringify(event).includes(flow));
 assert.deepEqual(Object.keys(event.custom_data).sort(),['content_name','funnel_version']);
});
test('public arrival has no hashed empty email and no query-string leakage',()=>{
 const event=events.stageMetaEvent({stage:'landing_page_loaded',context,adMeasurement:choice,userAgent:'Browser',path:'/signup',notes:'PRIVATE'});
 assert.equal(event.event_name,'ViewContent');assert.equal(event.user_data.em,undefined);
 assert.equal(event.event_source_url,'https://www.fieldworkbybaker.com/signup');assert.ok(!JSON.stringify(event).includes('PRIVATE'));
});
test('public endpoint cannot forge signup, verification, checkout or Purchase',async()=>{
 configure();globalThis.fetch=async()=>{throw Error('No database request expected');};
 for(const stage of ['account_created','email_verified','checkout_opened','first_paid_membership','Purchase']){const res=response();await route(request({stage,context,path:'/signup',adMeasurement:choice}),res);assert.equal(res.code,400);}
});
test('wrong origin, absent consent, old consent, and GPC do not create landing events',async()=>{
 configure();let writes=0;globalThis.fetch=async()=>{writes++;throw Error('No write allowed');};
 let res=response();await route({...request({stage:'landing_page_loaded',context,path:'/signup',adMeasurement:choice}),headers:{origin:'https://foreign.invalid','content-type':'application/json'}},res);assert.equal(res.code,403);
 for(const adMeasurement of [undefined,{...choice,consent:'ads-v1'}]){res=response();await route(request({stage:'landing_page_loaded',context,path:'/signup',adMeasurement}),res);assert.equal(res.body.recorded,false);}
 res=response();const req=request({stage:'landing_page_loaded',context,path:'/signup',adMeasurement:choice});req.headers['sec-gpc']='1';await route(req,res);assert.equal(res.body.recorded,false);assert.equal(writes,0);
});
test('real database readback path distinguishes recorded arrivals from delivery failure',async()=>{
 configure();const writes=[];globalThis.fetch=async(url,options)=>{assert.ok(url.endsWith('/billing_events'));writes.push(JSON.parse(options.body));return new Response(null,{status:201});};
 const res=response();await route(request({stage:'landing_page_loaded',context,path:'/signup',adMeasurement:choice}),res);
 assert.equal(res.code,200);assert.equal(res.body.recorded,true);assert.equal(writes.length,1);assert.equal(writes[0].event_id,ledger.funnelKey('landing_page_loaded',context));
 globalThis.fetch=async()=>new Response(null,{status:500});const bad=response();await route(request({stage:'landing_page_loaded',context,path:'/signup',adMeasurement:choice}),bad);assert.equal(bad.code,502);assert.equal(bad.body.recorded,false);
});
test('anonymous and ordinary members cannot read aggregate funnel reporting',async()=>{
 configure();const anonymous=response();await route({method:'GET',headers:{}},anonymous);assert.equal(anonymous.code,401);
 globalThis.fetch=async url=>url.endsWith('/auth/v1/user')?Response.json({id:actor,email:'member@fictional.invalid',email_confirmed_at:new Date().toISOString()}):Response.json([{role:'paid'}]);
 const member=response();await route({method:'GET',headers:{authorization:'Bearer fictional'},query:{}},member);assert.equal(member.code,403);
});
test('new managed signup produces AccountCreated only after Supabase confirms a new identity',async()=>{
 configure();const written=[];
 globalThis.fetch=async(url,options)=>{if(url.includes('/auth/v1/signup')){const body=JSON.parse(options.body);return Response.json({id:actor,created_at:new Date().toISOString(),identities:[{id:'identity'}],user_metadata:body.data});}if(url.endsWith('/billing_events')){written.push(JSON.parse(options.body));return new Response(null,{status:201});}throw Error('Unexpected request');};
 const res=response();await account(request({action:'signup',email:'member@fictional.invalid',password:'synthetic-password-only',name:'Sample Candidate',funnel:context}),res);await drain();
 assert.equal(res.code,202);assert.equal(res.body.token,undefined);assert.equal(written.length,1);assert.ok(written[0].event_id.includes('/account_created/'));assert.ok(!JSON.stringify(written).includes('member@'));
});
test('obfuscated existing signup and resend never add a new account conversion',async()=>{
 configure();let writes=0;globalThis.fetch=async url=>{if(url.includes('/auth/v1/signup'))return Response.json({id:actor,created_at:new Date().toISOString(),identities:[],user_metadata:{baker_funnel:context}});if(url.includes('/auth/v1/resend'))return Response.json({});writes++;throw Error('Unexpected write');};
 let res=response();await account(request({action:'signup',email:'member@fictional.invalid',password:'synthetic-password-only',name:'Sample Candidate',funnel:context}),res);await drain();assert.equal(res.code,202);
 res=response();await account(request({action:'resend-verification',email:'member@fictional.invalid'}),res);assert.equal(res.code,202);assert.equal(writes,0);
});
test('verified login is server-confirmed, refresh is not an additional verification event',async()=>{
 configure();const writes=[];
 globalThis.fetch=async(url,options)=>{if(url.includes('/auth/v1/token'))return Response.json({access_token:'fictional',refresh_token:'fictional-refresh',expires_at:Math.floor(Date.now()/1000)+3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:actor,email:'member@fictional.invalid',email_confirmed_at:new Date().toISOString(),user_metadata:{baker_funnel:context}});if(url.includes('/profiles?'))return Response.json([{display_name:'Sample',role:'free',subscription_tier:'none',subscription_status:'none'}]);if(url.endsWith('/billing_events')){writes.push(JSON.parse(options.body));return new Response(null,{status:201});}throw Error('Unexpected request');};
 let res=response();await account(request({action:'login',email:'member@fictional.invalid',password:'synthetic-password-only'}),res);await drain();assert.equal(res.code,200);assert.ok(writes[0].event_id.includes('/email_verified/'));
 res=response();await account(request({action:'refresh',refreshToken:'fictional-refresh'}),res);await drain();assert.equal(res.code,200);assert.equal(writes.length,1);
});
test('valid hosted Stripe creation records checkout; a failed session never reports success',async()=>{
 configure();const writes=[];let failed=false;
 globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:actor,email:'member@fictional.invalid',email_confirmed_at:'2026-10-01',user_metadata:{baker_funnel:context}});
 if(url.includes('/billing_customers?'))return Response.json([{customer_id:'cus_Fictional'}]);
 if(url.includes('/subscriptions?'))return Response.json({data:[],has_more:false});
 if(url.includes('/claim_billing_checkout'))return Response.json({id:'claim',origin:'https://www.fieldworkbybaker.com',expiresAt:Math.floor(Date.now()/1000)+2100});
 if(url.endsWith('/checkout/sessions')){const body=new URLSearchParams(options.body);assert.equal(body.get('subscription_data[metadata][baker_funnel_variant]'),'signup');return failed?Response.json({error:'failure'},{status:500}):Response.json({id:'cs_live_Fictional',livemode:true,url:'https://checkout.stripe.com/c/pay/fictional'});}
 if(url.endsWith('/billing_events')){writes.push(JSON.parse(options.body));return new Response(null,{status:201});}throw Error('Unexpected request '+url);};
 const req={...request({plan:'individual_monthly'}),headers:{authorization:'Bearer fictional'}};
 let res=response();await checkout(req,res);await drain();assert.equal(res.code,200);assert.equal(writes.length,1);assert.ok(writes[0].event_id.includes('/checkout_opened/'));
 failed=true;res=response();await checkout(req,res);await drain();assert.equal(res.code,502);assert.equal(writes.length,1);
});
test('only an authoritative first nonzero live membership invoice qualifies as paid',()=>{
 const invoice={id:'in_Fictional',livemode:true,status:'paid',paid:true,billing_reason:'subscription_create',amount_paid:1699,currency:'usd',customer:'cus_Fictional',subscription:'sub_Fictional'};
 const subscription={id:'sub_Fictional',livemode:true,customer:'cus_Fictional',metadata:{baker_mode:'live'},items:{data:[{quantity:1,price:{id:'price_1UNMr5AbMYqDEncBkDbWXXRX'}}]}};
 assert.equal(events.eligibleFirstMembership(invoice,subscription,[invoice]),true);
 const {paid:_legacyPaid,...modernInvoice}=invoice;
 assert.equal(events.eligibleFirstMembership(modernInvoice,subscription,[modernInvoice]),true);
 assert.equal(events.eligibleFirstMembership({...modernInvoice,status:'open'},subscription,[]),false);
 for(const patch of [{livemode:false},{amount_paid:0},{amount_paid:-1},{paid:false},{status:'open'},{billing_reason:'subscription_cycle'},{customer:'cus_Other'},{subscription:'sub_Other'}])assert.equal(events.eligibleFirstMembership({...invoice,...patch},subscription,[]),false);
 assert.equal(events.eligibleFirstMembership(invoice,subscription,[{...invoice,id:'in_Previous'}]),false);
 assert.equal(events.eligibleFirstMembership(invoice,{...subscription,items:{data:[{quantity:1,price:{id:'price_Unknown'}}]}},[]),false);
});
test('first membership stage uses provider invoice, stable journey, and original paid time',async()=>{
 configure();const writes=[];const at=Math.floor(Date.now()/1000)-60;
 const invoice={id:'in_Fictional',livemode:true,status:'paid',paid:true,billing_reason:'subscription_create',amount_paid:1699,currency:'usd',customer:'cus_Fictional',subscription:'sub_Fictional',status_transitions:{paid_at:at}};
 globalThis.fetch=async(url,options)=>{if(url.endsWith('/invoices/in_Fictional'))return Response.json(invoice);if(url.endsWith('/subscriptions/sub_Fictional'))return Response.json({id:'sub_Fictional',livemode:true,customer:'cus_Fictional',metadata:{baker_mode:'live',...events.subscriptionFunnelMetadata(context)},items:{data:[{quantity:1,price:{id:'price_1UNMr5AbMYqDEncBkDbWXXRX'}}]}});if(url.includes('/invoices?'))return Response.json({data:[invoice],has_more:false});if(url.endsWith('/billing_events')){writes.push(JSON.parse(options.body));return new Response(null,{status:201});}throw Error('Unexpected request');};
 assert.equal(await events.recordFirstPaidMembership('in_Fictional','sub_Fictional'),true);assert.equal(writes[0].event_id,ledger.funnelKey('first_paid_membership',context));assert.equal(writes[0].processed_at,new Date(at*1000).toISOString());
});
test('production code cannot manufacture paid analytics from the browser and has no workspace pixels',async()=>{
 const api=await readFile('api/funnel.ts','utf8');assert.ok(api.includes("stage !== 'landing_page_loaded'"));
 const tracking=await readFile('src/lib/acquisitionFunnel.ts','utf8');assert.ok(!tracking.includes('first_paid_membership'));assert.ok(!tracking.includes('fbq('));
 const sign=await readFile('src/pages/SignUp.tsx','utf8');assert.ok(sign.includes('ILLUSTRATION · FICTIONAL RECORDS'));assert.ok(!sign.includes('3-day'));
 const app=await readFile('src/App.tsx','utf8');assert.ok(app.includes('path="/start"'));assert.ok(app.includes('path="/admin/funnel"'));
});

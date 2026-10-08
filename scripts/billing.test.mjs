import {test,after} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {createHmac} from 'node:crypto';import {Readable} from 'node:stream';
const dir=await mkdtemp(join(tmpdir(),'baker-billing-'));const savedFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=savedFetch;await rm(dir,{recursive:true,force:true});});
await build({entryPoints:['server/billing.ts','server/billing-entitlement.ts','api/checkout-complete.ts','api/create-checkout-session.ts','api/billing-portal.ts','api/stripe-webhook.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {effectiveSubscription}=await import(pathToFileURL(join(dir,'server/billing-entitlement.mjs')));
const {verifyWebhook,billingMode,billingConfigured}=await import(pathToFileURL(join(dir,'server/billing.mjs')));
const {default:complete}=await import(pathToFileURL(join(dir,'api/checkout-complete.mjs')));
const {default:createCheckout}=await import(pathToFileURL(join(dir,'api/create-checkout-session.mjs')));
const {default:portal}=await import(pathToFileURL(join(dir,'api/billing-portal.mjs')));
const {default:webhook}=await import(pathToFileURL(join(dir,'api/stripe-webhook.mjs')));
const actor='11111111-1111-4111-8111-111111111111';const other='22222222-2222-4222-8222-222222222222';const customer='cus_Fictional';const subscription='sub_Fictional';const price='price_1UNMr5AbMYqDEncBkDbWXXRX';const secret='whsec_fictional';
process.env.SUPABASE_URL='https://synthetic-project.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fictional';process.env.SUPABASE_SECRET_KEY='sb_secret_fictional';process.env.STRIPE_SECRET_KEY='sk_live_fictional';process.env.STRIPE_WEBHOOK_SECRET=secret;process.env.BAKER_BILLING_ENABLED='true';process.env.VERCEL_ENV='production';
const res=()=>({code:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
const req=(body={})=>({method:'POST',headers:{authorization:'Bearer fictional-jwt'},body});
let writes=[];
function mock({checkoutOwner=actor,status='active',existing=false}={}){writes=[];globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/auth/v1/user')){assert.equal(options.headers.Authorization,'Bearer fictional-jwt');return Response.json({id:actor,email:'fictional@example.com',email_confirmed_at:'2026-01-01'});}
 if(url.includes('/rest/v1/billing_customers?')){assert.ok(url.includes('owner_id=eq.'+actor));assert.equal(options.headers.Authorization,'Bearer fictional-jwt');return Response.json([{customer_id:customer}]);}
 if(url.includes('/rest/v1/rpc/')){assert.equal(options.headers.apikey,'sb_secret_fictional');assert.equal(options.headers.Authorization,undefined);const body=JSON.parse(options.body);writes.push({url,body});if(url.endsWith('/claim_billing_checkout'))return Response.json({id:'33333333-3333-4333-8333-333333333333',origin:'https://www.fieldworkbybaker.com',expiresAt:Math.floor(Date.now()/1000)+2100});return Response.json({saved:true});}
 assert.ok(url.startsWith('https://api.stripe.com/'));assert.equal(options.headers.Authorization,'Bearer sk_live_fictional');
 if(url.endsWith('/checkout/sessions/cs_Fictional'))return Response.json({id:'cs_Fictional',livemode:true,mode:'subscription',status:'complete',payment_status:'paid',client_reference_id:checkoutOwner,customer,subscription,metadata:{baker_account_id:checkoutOwner,baker_mode:'live'}});
 if(url.endsWith('/subscriptions/'+subscription))return Response.json({id:subscription,livemode:true,customer,status,metadata:{baker_account_id:actor,baker_mode:'live'},items:{data:[{quantity:1,price:{id:price},current_period_end:1792000000}]},cancel_at_period_end:false});
 if(url.includes('/subscriptions?'))return Response.json({data:existing?[{status:'active'}]:[],has_more:false});
 if(url.endsWith('/checkout/sessions'))return Response.json({id:'cs_Fictional',livemode:true,url:'https://checkout.stripe.com/c/pay/fictional'});
 if(url.endsWith('/billing_portal/sessions')){assert.equal(new URLSearchParams(options.body).get('customer'),customer);return Response.json({url:'https://billing.stripe.com/p/session/fictional'});}
 throw Error('Unexpected request '+url);
};}
function signed(body,timestamp=Math.floor(Date.now()/1000)){const raw=Buffer.from(JSON.stringify(body));const sig=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');return {raw,signature:`t=${timestamp},v1=${sig}`};}
const event={id:'evt_Fictional',type:'customer.subscription.updated',created:1791200000,livemode:true,data:{object:{id:subscription,status:'active'}}};
test('modified payloads, stale timestamps and invalid signatures cannot pass webhook verification',()=>{
 const {raw,signature}=signed(event,1000);assert.equal(verifyWebhook(raw,signature,secret,1000).id,event.id);
 assert.throws(()=>verifyWebhook(Buffer.from(raw+' '),signature,secret,1000));assert.throws(()=>verifyWebhook(raw,signature,secret,1301));assert.throws(()=>verifyWebhook(raw,'t=1000,v1='+'0'.repeat(64),secret,1000));
});
test('test-mode keys cannot operate against production',()=>{process.env.STRIPE_SECRET_KEY='sk_test_fictional';assert.throws(()=>billingMode());process.env.STRIPE_SECRET_KEY='sk_live_fictional';});
test('restricted keys preserve live configuration and preview-only test boundaries',()=>{
 process.env.STRIPE_SECRET_KEY='rk_live_fictional';assert.equal(billingMode(),'live');assert.equal(billingConfigured(),true);
 process.env.STRIPE_SECRET_KEY='rk_test_fictional';process.env.BAKER_ALLOW_TEST_CHECKOUT='true';assert.throws(()=>billingMode());assert.equal(billingConfigured(),false);
 process.env.VERCEL_ENV='preview';assert.equal(billingMode(),'test');
 delete process.env.BAKER_ALLOW_TEST_CHECKOUT;assert.throws(()=>billingMode());
 process.env.VERCEL_ENV='production';process.env.STRIPE_SECRET_KEY='sk_live_fictional';
});
test('production ignores sandbox entitlements even when the testing flag is accidentally set',async()=>{
 process.env.BAKER_ALLOW_TEST_CHECKOUT='true';process.env.STRIPE_SECRET_KEY='sk_test_fictional';let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No sandbox read in production');};
 const result=await effectiveSubscription({subscription_tier:'none',subscription_status:'none'},actor,'fictional-jwt');assert.deepEqual(result,{tier:'none',status:'none',mode:'live'});assert.equal(calls,0);
 delete process.env.BAKER_ALLOW_TEST_CHECKOUT;process.env.STRIPE_SECRET_KEY='sk_live_fictional';
});
test('explicit preview testing reads only the verified owner’s test rows without writing live profiles',async()=>{
 process.env.VERCEL_ENV='preview';process.env.BAKER_ALLOW_TEST_CHECKOUT='true';process.env.STRIPE_SECRET_KEY='sk_test_fictional';
 globalThis.fetch=async(url,options)=>{assert.ok(url.includes('owner_id=eq.'+actor));assert.ok(url.includes('mode=eq.test'));assert.equal(options.headers.Authorization,'Bearer fictional-jwt');assert.ok(!options.method||options.method==='GET');return Response.json([{plan:'professional_monthly',status:'active'}]);};
 const result=await effectiveSubscription({subscription_tier:'none',subscription_status:'none'},actor,'fictional-jwt');assert.deepEqual(result,{tier:'professional',status:'active',mode:'test'});
 process.env.VERCEL_ENV='production';delete process.env.BAKER_ALLOW_TEST_CHECKOUT;process.env.STRIPE_SECRET_KEY='sk_live_fictional';
});
test('legacy role claims and missing authentication cannot open paid checkout',async()=>{let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No provider request expected');};const response=res();await createCheckout({method:'POST',body:{plan:'individual_monthly',role:'paid'}},response);assert.equal(response.code,401);assert.equal(calls,0);});
test('a checkout belonging to another account cannot alter entitlements',async()=>{mock({checkoutOwner:other});const response=res();await complete(req({sessionId:'cs_Fictional'}),response);assert.equal(response.code,403);assert.equal(writes.length,0);});
test('successful callback persists verified live state without issuing a long-lived paid token',async()=>{mock();const response=res();await complete(req({sessionId:'cs_Fictional',role:'professional'}),response);assert.equal(response.code,200);assert.equal(response.body.verified,true);assert.equal(response.body.token,undefined);assert.equal(writes.length,1);assert.equal(writes[0].body.p_owner,actor);assert.equal(writes[0].body.p_plan,'individual_monthly');assert.equal(writes[0].body.p_status,'active');});
for(const status of ['past_due','canceled','unpaid'])test(`${status} state is reconciled from Stripe, not trusted from an old active webhook body`,async()=>{mock({status});const {raw,signature}=signed(event);const request=Readable.from([raw]);request.method='POST';request.headers={'stripe-signature':signature};const response=res();await webhook(request,response);assert.equal(response.code,200);assert.equal(writes[0].body.p_status,status);});
test('invalid webhook signatures perform no Stripe or database requests',async()=>{let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No upstream expected');};const request=Readable.from([Buffer.from(JSON.stringify(event))]);request.method='POST';request.headers={'stripe-signature':'t=1,v1='+'0'.repeat(64)};const response=res();await webhook(request,response);assert.equal(response.code,400);assert.equal(calls,0);});
test('billing portal ignores a supplied customer ID and uses the verified owner link',async()=>{mock();const response=res();await portal(req({customerId:'cus_Attacker'}),response);assert.equal(response.code,200);assert.match(response.body.url,/^https:\/\/billing.stripe.com\//);});
test('existing subscriptions cannot create a duplicate paid checkout',async()=>{mock({existing:true});const response=res();await createCheckout(req({plan:'individual_monthly'}),response);assert.equal(response.code,409);assert.equal(writes.length,0);});
test('checkout is backed by an atomic claim and uses a stable provider idempotency key',async()=>{mock();const baseFetch=globalThis.fetch;let checkout;
 globalThis.fetch=async(url,options)=>{if(url.endsWith('/checkout/sessions')){checkout=new URLSearchParams(options.body);assert.ok(options.headers['Idempotency-Key'].endsWith('/33333333-3333-4333-8333-333333333333'));}return baseFetch(url,options);};
 const response=res();await createCheckout(req({plan:'individual_monthly',customer:'cus_Attacker',price:'price_Attacker',email:'attacker@example.com'}),response);assert.equal(response.code,200);assert.equal(checkout.get('customer'),customer);assert.equal(checkout.get('line_items[0][price]'),price);assert.equal(checkout.get('subscription_data[metadata][baker_account_id]'),actor);assert.equal(checkout.get('subscription_data[trial_period_days]'),null);
});

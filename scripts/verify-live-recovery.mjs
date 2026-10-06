import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const origin='https://fieldwork-by-baker-testing.vercel.app';
const report={checkedAt:new Date().toISOString(),origin,domain:{},deployment:null,ai:null,billing:null,browser:null};
await fs.mkdir('recovery-evidence',{recursive:true});
for(const type of ['NS','A']){try{report.domain[type]=await dns.resolve('fieldworkbybaker.com',type);}catch(e){report.domain[type]={error:e.code};}}
let health;
for(let attempt=0;attempt<48;attempt++){
  try{
    const r=await fetch(origin+'/api/health?recovery='+Date.now(),{signal:AbortSignal.timeout(15000)});const h=await r.json();
    if(r.ok && h.recoveryVersion==='launch-recovery-v1' && (!process.env.EXPECTED_COMMIT || h.deployedCommit===process.env.EXPECTED_COMMIT)){health=h;break;}
  }catch{}
  await new Promise(r=>setTimeout(r,5000));
}
if(!health)throw new Error('Expected recovery commit is not serving at the Vercel origin. No live tests performed.');
report.deployment={commit:health.deployedCommit,recoveryVersion:health.recoveryVersion,cloudStorageConnected:health.cloudStorageConnected,storageMode:health.storageMode,stripeMode:health.stripeMode,liveBillingEnabled:health.liveBillingEnabled,publicLaunchReady:health.publicLaunchReady};
try{const r=await fetch('https://www.fieldworkbybaker.com/api/health',{signal:AbortSignal.timeout(15000)});report.domain.httpsStatus=r.status;}catch(e){report.domain.httpsError=e.cause?.code||e.name;}
const email=`baker-recovery-qa-${randomUUID()}@example.com`;
const signup=await fetch(origin+'/api/free-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Baker Recovery QA',email,password:randomUUID()+randomUUID()}),signal:AbortSignal.timeout(15000)});
const account=await signup.json();
if(!signup.ok || typeof account.token!=='string')throw new Error('Normal public trial signup failed. No auth bypass attempted.');
const authorization='Bearer '+account.token;
const unauth=await fetch(origin+'/api/baker-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'bcba-brain',message:'What is latency?'})});
if(unauth.status!==401)throw new Error('Unauthenticated AI request was not rejected.');
let aiPayload;
try{
  const r=await fetch(origin+'/api/baker-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},signal:AbortSignal.timeout(65000),body:JSON.stringify({mode:'bcba-brain',message:'Explain duration versus latency in behavior measurement with one educational example of each. Do not use any real client information.',context:{diagnostic:true},history:[]})});
  aiPayload=await r.json();
  report.ai={status:r.status,liveModelResponded:aiPayload.liveModelResponded===true,provider:aiPayload.provider||null,transport:aiPayload.transport||null,code:aiPayload.code||null,upstreamStatus:aiPayload.upstreamStatus??null,answer:r.ok&&aiPayload.liveModelResponded===true?String(aiPayload.answer||'').slice(0,2200):null,error:typeof aiPayload.error==='string'?aiPayload.error:null,unauthenticatedStatus:unauth.status};
  if(r.ok && (!report.ai.liveModelResponded || !String(report.ai.provider).startsWith('openai/')))throw new Error('A fake successful fallback passed the production API.');
}catch(e){report.ai={...(report.ai||{}),requestError:e.name};}
const checkout=await fetch(origin+'/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify({plan:'individual_monthly'}),signal:AbortSignal.timeout(15000)});
const billing=await checkout.json();report.billing={status:checkout.status,code:billing.code||null,checkoutCreated:Boolean(billing.url)};
if(checkout.status!==503 || billing.url)throw new Error('Unsafe public payment flow was not paused.');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
  await page.addInitScript(({user,token})=>{localStorage.setItem('authUser',JSON.stringify({...user,initials:'QA'}));localStorage.setItem('bakerSessionToken',token);localStorage.setItem('theme','dark');},{user:account.user,token:account.token});
  await page.goto(origin+'/import',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByRole('heading',{name:'Bring every session. Pick up where you left off.'}).waitFor({timeout:15000});
  await page.getByText('Temporary recovery address.',{exact:true}).waitFor();
  const paths=[];
  for(const path of ['/audit-history','/baker-brain','/upgrade']){await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForTimeout(800);if(new URL(page.url()).origin!==origin)throw new Error('Recovery origin unexpectedly redirected.');paths.push(path);}
  await page.getByText('Paid checkout is temporarily paused.',{exact:true}).waitFor();
  await page.goto(origin+'/baker-brain');await page.getByRole('heading',{name:'Ask anything about your BCBA journey.'}).waitFor();
  await page.screenshot({path:'recovery-evidence/recovery-brain-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'recovery-evidence/recovery-brain-mobile.png',fullPage:false});
  report.browser={originRetained:new URL(page.url()).origin===origin,normalSignedTrial:true,routes:paths,errors,viewport:390};
}finally{await browser.close();}
await fs.writeFile('recovery-evidence/live-recovery-report.json',JSON.stringify(report,null,2));
// Deliberately print only safe operational fields. The account email, password, token and cookies remain in memory.
console.log(JSON.stringify(report,null,2));
if(report.browser.errors.length)throw new Error('Recovery browser reported runtime errors.');

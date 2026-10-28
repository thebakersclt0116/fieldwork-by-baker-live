import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const campaign='120251729153710531';
const signup='/signup?bf_campaign='+campaign+'&bf_experiment=signup-v1&bf_variant=signup&bf_qa=1';
test.beforeEach(async({page})=>{
 await page.route('**/api/ad-measurement-config',r=>r.fulfill({json:{enabled:true,serverSide:true,consentRequired:true,consentVersion:'ads-v2',funnelVersion:'funnel-v1'}}));
 await page.route('**/api/health*',r=>r.fulfill({json:{liveBillingEnabled:true,stripeMode:'live',stripeCheckoutConfigured:true}}));
 await page.route('**/api/funnel',r=>r.fulfill({json:{recorded:true,qa:true,metaAccepted:false}}));
});
test('mobile form is before the sales cards and never presents a nonexistent free trial',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(signup);
 await page.getByRole('button',{name:'Decline optional measurement'}).click();
 const first=page.getByLabel('First name',{exact:true});await expect(first).toBeVisible();
 const form=await first.boundingBox(),pitch=await page.getByRole('heading',{name:'Your fieldwork and exam prep, together.'}).boundingBox();
 expect(form.y).toBeLessThan(844);expect(form.y).toBeLessThan(pitch.y);
 await expect(page.getByText('Create account → verify email → choose membership. No card required on this form.')).toBeVisible();
 expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('3-day');
 await fs.mkdir('funnel-evidence',{recursive:true});await page.screenshot({path:'funnel-evidence/mobile-signup.png',fullPage:true});
});
test('page-loaded stage is sent once only after the visitor allows the expanded measurement',async({page})=>{
 const events=[];await page.route('**/api/funnel',r=>{events.push(r.request().postDataJSON());return r.fulfill({json:{recorded:true,qa:true,metaAccepted:false}});});
 await page.goto(signup);await page.waitForTimeout(250);expect(events).toHaveLength(0);
 await page.getByRole('button',{name:'Allow ad measurement'}).click();await expect.poll(()=>events.length).toBe(1);
 expect(events[0].stage).toBe('landing_page_loaded');expect(events[0].adMeasurement.consent).toBe('ads-v2');expect(events[0].context.qa).toBe(true);
 await page.reload();await page.waitForTimeout(300);expect(events).toHaveLength(1);
});
test('old allow choice must be renewed, whereas an earlier decline remains declined',async({browser})=>{
 for(const allowed of [true,false]){
 const context=await browser.newContext();const page=await context.newPage();let events=0;
 await page.addInitScript(allowed=>localStorage.setItem('baker-ad-measurement-v1',JSON.stringify({allowed,decidedAt:Date.now(),visitorId:'11111111-1111-4111-8111-111111111111'})),allowed);
 await page.route('**/api/ad-measurement-config',r=>r.fulfill({json:{enabled:true}}));await page.route('**/api/funnel',r=>{events++;return r.fulfill({json:{recorded:true}});});
 await page.goto('http://127.0.0.1:4173'+signup);await page.waitForTimeout(300);
 if(allowed)await expect(page.getByRole('button',{name:'Allow ad measurement'})).toBeVisible();else await expect(page.getByRole('button',{name:'Ad privacy',exact:true})).toBeVisible();
 expect(events).toBe(0);await context.close();
 }
});
test('server-confirmed signup opens email instructions, clears password, and resends without claiming verification',async({page})=>{
 const requests=[];await page.route('**/api/account',r=>{requests.push(r.request().postDataJSON());return r.fulfill({status:202,json:{verificationRequired:true}});});
 await page.goto(signup);await page.getByRole('button',{name:'Decline optional measurement'}).click();
 await page.getByLabel('First name',{exact:true}).fill('Synthetic');await page.getByLabel('Last name',{exact:true}).fill('Candidate');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.com');await page.getByLabel('Password',{exact:true}).fill('not-a-real-password-123');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Check your email to continue.'})).toBeVisible();await expect(page.getByText('No payment has been taken.',{exact:false})).toBeVisible();
 expect(requests[0].action).toBe('signup');expect(requests[0].funnel.campaign).toBe('direct');expect(requests[0].adMeasurement).toBeUndefined();expect(requests[0].funnel.qa).toBe(true);
 const link=page.getByRole('link',{name:'I verified my email — sign in'});const target=new URL(await link.getAttribute('href'),'https://fieldwork.invalid');expect(target.pathname).toBe('/login');expect(target.searchParams.get('return')).toBe('/upgrade');expect(target.searchParams.get('bf_campaign')).toBe(campaign);expect(target.searchParams.get('bf_qa')).toBe('1');
 await page.getByRole('button',{name:'Resend verification email'}).click();await expect(page.getByText('Please wait one minute before requesting another email.')).toBeVisible();expect(requests).toHaveLength(1);
 await page.getByRole('button',{name:'Correct your email'}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
});
test('failed account request retains the email and shows no fabricated verification success',async({page})=>{
 await page.route('**/api/account',r=>r.fulfill({status:502,json:{code:'CLOUD_REQUEST_FAILED'}}));await page.goto(signup);await page.getByRole('button',{name:'Decline optional measurement'}).click();
 await page.getByLabel('First name',{exact:true}).fill('Synthetic');await page.getByLabel('Last name',{exact:true}).fill('Candidate');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.com');await page.getByLabel('Password',{exact:true}).fill('not-a-real-password-123');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('could not create');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('synthetic@example.com');await expect(page.getByRole('heading',{name:'Check your email to continue.'})).toHaveCount(0);
});
for(const variant of ['home','signup'])test('destination experiment keeps '+variant+' assignment and forwards only attribution fields',async({page})=>{
 await page.addInitScript(variant=>sessionStorage.setItem('baker-signup-destination-test-v1',variant),variant);
 await page.goto('/start?utm_source=facebook&utm_campaign=test&fbclid=TestClick12345&private=must-not-forward&bf_qa=1');
 await expect.poll(()=>new URL(page.url()).pathname).toBe(variant==='home'?'/':'/signup');
 const url=new URL(page.url());expect(url.searchParams.get('bf_variant')).toBe(variant);expect(url.searchParams.get('utm_source')).toBe('facebook');expect(url.searchParams.get('private')).toBeNull();expect(url.searchParams.get('bf_qa')).toBe('1');
 await page.goto('/start?utm_source=facebook');await expect.poll(()=>new URL(page.url()).pathname).toBe(variant==='home'?'/':'/signup');
});
test('public pages never load a Meta tracking script or send fieldwork requests',async({page})=>{
 const external=[];page.on('request',r=>{if(/facebook\.com|facebook\.net|\/api\/(?:workspace|archive|supervisor)/.test(r.url()))external.push(r.url());});
 await page.goto(signup);await page.getByRole('button',{name:'Allow ad measurement'}).click();await page.waitForTimeout(300);expect(external).toHaveLength(0);
});
for(const viewport of [null,{width:390,height:844},{width:320,height:640}])test('open privacy choice leaves public navigation clickable before consent at '+(viewport?viewport.width+'x'+viewport.height:'default desktop'),async({page})=>{
 if(viewport)await page.setViewportSize(viewport);
 const optionalRequests=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/funnel'||url.pathname==='/api/ad-measurement'||/(^|\.)(facebook\.com|facebook\.net)$/.test(url.hostname))optionalRequests.push(url.pathname);});
 await page.addInitScript(()=>{
  window.__preconsentStorageWrites=[];window.__publicNavigationPointers=[];
  const optionalKey=key=>key==='baker-ad-measurement-v1'||key==='baker-acquisition-journey-v1'||key.startsWith('baker-landing-received:');
  const setItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(optionalKey(String(key)))window.__preconsentStorageWrites.push(String(key));return setItem.call(this,key,value);};
  document.addEventListener('pointerdown',event=>{
   const link=event.target instanceof Element?event.target.closest('a'):null;
   if(!link)return;
   const panel=document.querySelector('aside[aria-label="Optional ad measurement"]');
   const bounds=panel?.getBoundingClientRect();
   window.__publicNavigationPointers.push({path:new URL(link.href).pathname,consentOpen:Boolean(panel),insideConsentPanel:Boolean(bounds&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom),insideViewport:event.clientX>=0&&event.clientX<innerWidth&&event.clientY>=0&&event.clientY<innerHeight});
  },true);
 });
 await page.goto(signup+'&utm_source=facebook&utm_content=privacy-pointer-regression&fbclid=FictionalClick12345&private=do-not-forward');
 const banner=page.getByRole('complementary',{name:'Optional ad measurement',exact:true});
 const assertPreconsent=async path=>{
  await expect.poll(()=>new URL(page.url()).pathname).toBe(path);await expect(banner).toBeVisible();
  const target=new URL(page.url());for(const [key,value] of Object.entries({bf_campaign:campaign,bf_experiment:'signup-v1',bf_variant:'signup',bf_qa:'1',utm_source:'facebook',utm_content:'privacy-pointer-regression',fbclid:'FictionalClick12345'}))expect(target.searchParams.get(key),key+' on '+path).toBe(value);
  expect(target.searchParams.has('private')).toBe(false);
  const storage=await page.evaluate(()=>({writes:window.__preconsentStorageWrites,journey:sessionStorage.getItem('baker-acquisition-journey-v1'),choice:localStorage.getItem('baker-ad-measurement-v1'),receivedKeys:Object.keys(sessionStorage).filter(key=>key.startsWith('baker-landing-received:'))}));
  expect(storage).toEqual({writes:[],journey:null,choice:null,receivedKeys:[]});expect(optionalRequests).toHaveLength(0);
 };
 await expect(banner).toBeVisible();await page.getByRole('link',{name:'Privacy details',exact:true}).click();await assertPreconsent('/privacy');
 // Normal clicks must make these real page links reachable with the choice still open.
 // No forced click, manual scroll, banner hiding, or consent selection masks an overlay.
 await page.getByRole('link',{name:'FAQ',exact:true}).click();await assertPreconsent('/faq');
 await page.getByRole('link',{name:'Contact Fieldwork by Baker',exact:true}).click();await assertPreconsent('/contact');
 await page.getByRole('link',{name:'Create account',exact:true}).last().click();await assertPreconsent('/signup');
 const pointers=await page.evaluate(()=>window.__publicNavigationPointers);
 expect(pointers.map(pointer=>pointer.path)).toEqual(['/privacy','/faq','/contact','/signup']);
 expect(pointers[0]).toMatchObject({consentOpen:true,insideConsentPanel:true,insideViewport:true});
 for(const pointer of pointers.slice(1))expect(pointer).toMatchObject({consentOpen:true,insideConsentPanel:false,insideViewport:true});
 await page.waitForTimeout(200);await assertPreconsent('/signup');
});
test('home attribution survives pricing and fictional demo before signup consent without premature storage or events',async({page})=>{
 const events=[];await page.route('**/api/funnel',r=>{events.push(r.request().postDataJSON());return r.fulfill({json:{recorded:true,qa:true,metaAccepted:false}});});
 await page.goto('/?bf_campaign='+campaign+'&bf_experiment=signup-v1&bf_variant=home&bf_qa=1&fbclid=FictionalClick12345&private=do-not-forward');
 await page.getByRole('link',{name:'See memberships'}).click();
 await page.getByRole('link',{name:'Explore free demo',exact:true}).last().click();
 await expect(page.getByText('FREE DEMO · FICTIONAL RECORDS')).toBeVisible();
 await page.getByRole('link',{name:'Create account',exact:true}).last().click();
 await page.getByRole('link',{name:'Privacy details',exact:true}).click();
 await page.getByRole('link',{name:'FAQ',exact:true}).click();
 await page.getByRole('link',{name:'Contact Fieldwork by Baker',exact:true}).click();
 await page.getByRole('link',{name:'Create account',exact:true}).last().click();
 const target=new URL(page.url());expect(target.pathname).toBe('/signup');expect(target.searchParams.get('bf_variant')).toBe('home');expect(target.searchParams.get('fbclid')).toBe('FictionalClick12345');expect(target.searchParams.has('private')).toBe(false);
 expect(await page.evaluate(()=>sessionStorage.getItem('baker-acquisition-journey-v1'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('baker-ad-measurement-v1'))).toBeNull();expect(events).toHaveLength(0);
 await page.getByRole('button',{name:'Allow ad measurement'}).click();await expect.poll(()=>events.length).toBe(1);expect(events[0].context.variant).toBe('home');expect(events[0].context.campaign).toBe(campaign);expect(events[0].adMeasurement.fbc).toMatch(/\.FictionalClick12345$/);
 await page.reload();await page.waitForTimeout(300);expect(events).toHaveLength(1);
});
test('tagged direct signup replaces an earlier organic journey once',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('baker-acquisition-journey-v1',JSON.stringify({version:'funnel-v1',flowId:'11111111-1111-4111-8111-111111111111',campaign:'direct',variant:'direct',qa:false})));
 const events=[];await page.route('**/api/funnel',r=>{events.push(r.request().postDataJSON());return r.fulfill({json:{recorded:true,qa:true,metaAccepted:false}});});
 await page.goto(signup+'&fbclid=FictionalClick12345');await page.getByRole('button',{name:'Allow ad measurement'}).click();await expect.poll(()=>events.length).toBe(1);expect(events[0].context.variant).toBe('signup');expect(events[0].context.campaign).toBe(campaign);expect(events[0].context.flowId).not.toBe('11111111-1111-4111-8111-111111111111');expect(events[0].context.qa).toBe(true);
 await page.getByRole('link',{name:'Explore the free demo'}).click();await page.getByRole('link',{name:'Create account',exact:true}).last().click();await page.waitForTimeout(300);expect(events).toHaveLength(1);
});

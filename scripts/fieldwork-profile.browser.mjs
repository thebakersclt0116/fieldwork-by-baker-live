import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const email='profile-ui@example.invalid';
const timestamp='2026-10-28T20:00:00.000Z';
function completed(patch={}){return {version:1,applicationTiming:'FROM_2027',fieldworkType:'CONCENTRATED',organizations:[{id:'org_a',name:'Example Clinic',active:true},{id:'org_b',name:'Example School',active:true}],supervisors:[{id:'sup_a',name:'Alex Example',email:'alex@example.invalid',bacbNumber:'TEST',active:true},{id:'sup_b',name:'Sam Example',email:'sam@example.invalid',bacbNumber:'',active:true}],applicationDateAcknowledged:true,completedAt:timestamp,updatedAt:timestamp,...patch};}
async function mockCloud(page,setup=null,{entries=[],failProfileSave=false}={}){
 let profile={program:'Preserve my coursework',...(setup?{fieldworkSetup:setup}:{})};let profileVersion=1,version=0,records=entries;const writes=[];
 const user={authProvider:'supabase',name:'Synthetic Candidate',email,initials:'SC',role:'paid',subscription:'individual',subscriptionStatus:'active'};
 await page.addInitScript(user=>{
   localStorage.setItem('authUser',JSON.stringify(user));localStorage.setItem('bakerSessionToken','synthetic-not-a-live-token');localStorage.setItem('bakerManagedSession',JSON.stringify({refreshToken:'synthetic-refresh',expiresAt:Math.floor(Date.now()/1000)+3600}));
   localStorage.setItem('theme','dark');
 },user);
 await page.route('**/api/account',route=>route.fulfill({json:{user,token:'synthetic-not-a-live-token',refreshToken:'synthetic-refresh',expiresAt:Math.floor(Date.now()/1000)+3600}}));
 await page.route('**/api/health*',route=>route.fulfill({json:{liveBillingEnabled:true,stripeMode:'live'}}));
 await page.route('**/api/ad-measurement-config',route=>route.fulfill({json:{enabled:false}}));
 await page.route('**/api/feature-usage*',route=>route.fulfill({json:{recorded:false}}));
 await page.route('**/api/workspace*',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ownerId:'11111111-1111-4111-8111-111111111111',version,entries:records.map(e=>({id:e.id,revision:e.revision||1,payload:e})),learning:[{kind:'profile',version:profileVersion,payload:profile}],nextCursor:null}});
  const body=route.request().postDataJSON();writes.push(body);
  if(body.action==='save-learning'){
   if(failProfileSave)return route.fulfill({status:409,json:{code:'VERSION_CONFLICT'}});
   profile=body.payload;return route.fulfill({json:{version:++profileVersion}});
  }
  if(body.action==='save-entries'){records=body.entries;return route.fulfill({json:{version:++version}});}
  return route.fulfill({status:400,json:{code:'INVALID_ACTION'}});
 });
 return {writes,profile:()=>profile,records:()=>records};
}
async function fillSetup(page,timing='On or after January 1, 2027',track='Concentrated Supervised Fieldwork'){
 await page.getByRole('radio',{name:timing,exact:true}).check();
 await page.getByRole('checkbox',{name:'I understand that the certification application date',exact:false}).check();
 await page.getByRole('radio',{name:new RegExp('^'+track)}).check();
 await page.getByLabel('Organization 1',{exact:true}).fill('Example Clinic');
 await page.getByLabel('Supervisor 1 name',{exact:true}).fill('Alex Example');
}
test('first login requires explicit choices and profile save before tracking; saves to the existing cloud account',async({page})=>{
 const cloud=await mockCloud(page);await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Set up your profile before tracking hours'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start timer',exact:true})).toHaveCount(0);
 await expect(page.getByRole('radio',{checked:true})).toHaveCount(0);
 await fillSetup(page);
 await page.getByRole('button',{name:'Add another organization',exact:true}).click();await page.getByLabel('Organization 2',{exact:true}).fill('Example School');
 await page.getByRole('button',{name:'Add another supervisor',exact:true}).click();await page.getByLabel('Supervisor 2 name',{exact:true}).fill('Sam Example');
 await page.getByRole('button',{name:'Save profile and continue'}).click();
 await expect(page.getByRole('button',{name:'Start timer',exact:true})).toBeVisible();
 expect(cloud.profile().program).toBe('Preserve my coursework');expect(cloud.profile().fieldworkSetup.organizations.length).toBe(2);
 await page.reload();await expect(page.getByRole('button',{name:'Start timer',exact:true})).toBeVisible();
});
test('all four type/year previews use correct thresholds, without exam-date logic',async({page})=>{
 await mockCloud(page);await page.goto('/fieldwork-profile');
 for(const [timing,type,percentage,max,observations] of [
 ['Before January 1, 2027','Supervised Fieldwork','5','130','at least one per month'],
 ['Before January 1, 2027','Concentrated Supervised Fieldwork','10','130','at least one per month'],
 ['On or after January 1, 2027','Supervised Fieldwork','5','160','at least 60 minutes per month'],
 ['On or after January 1, 2027','Concentrated Supervised Fieldwork','7.5','160','at least 90 minutes per month'],
 ]){
  await page.getByRole('radio',{name:timing,exact:true}).check();await page.getByRole('radio',{name:new RegExp('^'+type)}).check();
  await expect(page.getByText(new RegExp(percentage.replace('.','\\.')+'% supervision · 20–'+max+' hours per month'))).toBeVisible();
  await expect(page.getByText('Client observations: '+observations+'.',{exact:true})).toBeVisible();
 }
 await page.getByRole('radio',{name:'I am not sure yet',exact:false}).check();
 await expect(page.getByText('2022 requirements · Concentrated Supervised Fieldwork',{exact:true})).toBeVisible();
 await expect(page.getByText('2027 requirements · Concentrated Supervised Fieldwork',{exact:true})).toBeVisible();
});
test('manual entry uses saved organization/supervisor dropdowns and profile fieldwork default',async({page})=>{
 await mockCloud(page,completed());await page.goto('/dashboard');await page.getByRole('button',{name:'Add hours manually',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Fieldwork type',{exact:true})).toHaveValue('CONCENTRATED');
 await expect(dialog.getByLabel('Organization',{exact:true})).toHaveValue('');await expect(dialog.getByLabel('Responsible supervisor',{exact:true})).toHaveValue('');
 expect(await dialog.getByLabel('Organization',{exact:true}).locator('option').allTextContents()).toEqual(['Select an organization','Example Clinic','Example School']);
 await dialog.getByLabel('Organization',{exact:true}).selectOption('org_b');await dialog.getByLabel('Responsible supervisor',{exact:true}).selectOption('sup_b');
 await expect(dialog.getByLabel('Responsible supervisor',{exact:true})).toHaveValue('sup_b');
});
test('stopping a timer preserves exact elapsed time and shows the description reminder with saved dropdowns',async({page})=>{
 const cloud=await mockCloud(page,completed());await page.goto('/dashboard');
 await page.getByRole('button',{name:'Start timer',exact:true}).click();
 await page.evaluate(email=>{const key='fieldworkByBaker:timer:v1:'+encodeURIComponent(email);const journal=JSON.parse(localStorage.getItem(key));journal.running.startedAt=Date.now()-25*60000;localStorage.setItem(key,JSON.stringify(journal));window.dispatchEvent(new Event('storage'));},email);
 await page.getByRole('button',{name:'Stop & log',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByText('Recorded time',{exact:true})).toBeVisible();await expect(dialog.getByLabel('Fieldwork type',{exact:true})).toHaveValue('CONCENTRATED');
 await dialog.getByLabel('Activity description',{exact:true}).fill('Reviewed de-identified sample data.');
 await dialog.getByLabel('Organization',{exact:true}).selectOption('org_a');await dialog.getByLabel('Responsible supervisor',{exact:true}).selectOption('sup_a');
 await dialog.getByLabel('Activity category',{exact:true}).selectOption('UNRESTRICTED');await dialog.getByLabel('Supervision during this activity',{exact:true}).selectOption('INDEPENDENT');
 await dialog.getByRole('button',{name:'Save activity',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(cloud.records().length).toBe(1);expect(cloud.records()[0].duration).toBeGreaterThanOrEqual(25/60);expect(cloud.records()[0].duration).toBeLessThan(26/60);
 expect(cloud.records()[0].supervisorId).toBe('sup_a');expect(cloud.records()[0].organizationId).toBe('org_a');expect(cloud.records()[0].requirementsSelection).toBe('FROM_2027');
});
test('historical records survive a requirement switch and archival directory change unchanged',async({page})=>{
 const historic={id:'historic',userId:email,date:'2026-10-01',startTime:'08:30',endTime:'10:15',duration:1.75,fieldworkType:'SUPERVISED',activityType:'UNRESTRICTED_OTHER',activityCategory:'UNRESTRICTED',supervisorId:'old',supervisorName:'Past Supervisor',organizationName:'Past Organization',setting:'',notes:'Preserve exact historical narrative',status:'VERIFIED',revision:3,createdAt:timestamp,updatedAt:timestamp};
 const cloud=await mockCloud(page,completed(),{entries:[historic]});await page.goto('/fieldwork-profile');
 await page.getByRole('radio',{name:'Before January 1, 2027',exact:true}).check();await page.getByRole('button',{name:'Archive from future choices',exact:true}).nth(0).click();
 await page.getByRole('button',{name:'Save profile and continue'}).click();await expect(page.getByRole('button',{name:'Start timer',exact:true})).toBeVisible();
 expect(cloud.records()).toEqual([historic]);expect(cloud.writes.filter(x=>x.action==='save-entries')).toHaveLength(0);
});
test('profile save failure does not unlock tracking or discard the local draft',async({page})=>{
 await mockCloud(page,null,{failProfileSave:true});await page.goto('/fieldwork-profile');await fillSetup(page);
 await page.getByRole('button',{name:'Save profile and continue'}).click();await expect(page.getByRole('heading',{name:'Your changes need review'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start timer',exact:true})).toHaveCount(0);
 const local=await page.evaluate(email=>JSON.parse(localStorage.getItem('fieldwork:managed:'+encodeURIComponent(email)+':fieldworkByBaker:pathProfile:v1')),email);expect(local.fieldworkSetup.organizations[0].name).toBe('Example Clinic');
});
test('forms default to the profile requirements and explain dual-document retention',async({page})=>{
 await mockCloud(page,completed({applicationTiming:'BOTH'}));await page.goto('/export');
 await expect(page.getByLabel('Applicable requirements',{exact:true})).toHaveValue('2022');
 await expect(page.getByText('Your profile uses both 2022 and 2027 requirements.',{exact:false})).toBeVisible();
});
test('archived product navigation stays hidden and profile setup works on a narrow screen',async({page})=>{
 await mockCloud(page);await page.setViewportSize({width:390,height:844});await page.goto('/fieldwork-profile');
 await fillSetup(page,'I am not sure yet — show both sets of requirements');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await fs.mkdir('profile-evidence',{recursive:true});await page.screenshot({path:'profile-evidence/profile-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'profile-evidence/profile-desktop.png',fullPage:true});
 await expect(page.getByRole('link',{name:'My Path',exact:true})).toHaveCount(0);
});

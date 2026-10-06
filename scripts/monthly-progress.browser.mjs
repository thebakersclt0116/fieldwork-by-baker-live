import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const email='fictional-monthly-qa@example.com';
const historical=Array.from({length:6},(_,index)=>({id:`month-${index}`,date:`2026-${String(index+1).padStart(2,'0')}-14`,startTime:'08:30',endTime:'10:30',duration:2,activityType:'UNRESTRICTED_OTHER',activityCategory:index%2?'RESTRICTED':'UNRESTRICTED',fieldworkType:'SUPERVISED',supervisorName:'Fictional Supervisor',organizationName:'Fictional Organization',setting:'Fictional Organization',notes:'Fictional monthly acceptance session',status:'PENDING',supervisionMinutes:30,individualSupervisionMinutes:15,observationMinutes:10,createdAt:'2026-01-01',updatedAt:'2026-01-01'}));
test.beforeEach(async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-06T16:00:00Z'));
 await page.addInitScript(({email,historical})=>{localStorage.setItem('authUser',JSON.stringify({name:'Fictional Candidate',email,role:'free',initials:'FC',trialEndsAt:1791388800,subscription:'none'}));localStorage.setItem('bakerSessionToken','isolated-monthly-fixture');localStorage.setItem(`fieldworkByBaker:v1:${email}:entries`,JSON.stringify(historical));localStorage.setItem('theme','light');},{email,historical});
});
test('six imported months remain historical, with a zero-hour current month and month-specific entries',async({page})=>{
 await page.goto('/dashboard');
 await expect(page.getByRole('tab',{name:/October 2026/})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('tabpanel')).toContainText('No hours recorded for this month');
 await expect(page.getByRole('tab')).toHaveCount(7);
 await page.getByRole('tab',{name:/January 2026/}).click();
 await expect(page.getByRole('tabpanel')).toContainText('2.00h');
 await expect(page.getByRole('tabpanel')).toContainText('1.50h');
 await expect(page.getByRole('tabpanel')).toContainText('0.25h');
 await expect(page.getByRole('heading',{name:'Entries · January 2026'})).toBeVisible();
 await expect(page.locator('article').filter({hasText:'Fictional monthly acceptance session'})).toHaveCount(1);
 await expect(page.locator('article').filter({hasText:'Fictional monthly acceptance session'})).toContainText('2026-01-14');
 await page.getByRole('tab',{name:/January 2026/}).press('Home');
 await expect(page.getByRole('tab',{name:/October 2026/})).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await fs.mkdir('monthly-test-artifacts',{recursive:true});await page.screenshot({path:'monthly-test-artifacts/month-tabs-mobile.png',fullPage:true});
});
test('My Path reports this month separately from historical totals',async({page})=>{
 await page.goto('/my-path');await expect(page.getByRole('link',{name:/Fieldwork progress/})).toContainText('0.00h this month');
 await expect(page.getByRole('tab',{name:/June 2026/})).toBeVisible();
 await page.getByRole('tab',{name:/June 2026/}).click();await expect(page.getByRole('tabpanel')).toContainText('2.00h');
});
test('trial users see a paid-only verification gate, including direct export navigation',async({page})=>{
 await page.goto('/export');await expect(page.getByRole('heading',{name:'Monthly verification is a paid feature.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Download monthly verification PDF'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Email form to supervisor'})).toHaveCount(0);
});
test('forgot password link submits the email to recovery and shows a generic confirmation',async({page})=>{
 await page.addInitScript(()=>{localStorage.removeItem('authUser');localStorage.removeItem('bakerSessionToken');});
 await page.route('**/api/account',async route=>{const body=route.request().postDataJSON();expect(body).toEqual({action:'recover',email});await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({message:'If an account exists, a recovery email will be sent.'})});});
 await page.goto('/login');await page.getByRole('link',{name:'Forgot your password?'}).click();
 await page.getByLabel('Account email').fill(email);await page.getByRole('button',{name:'Send recovery email'}).click();await expect(page.getByRole('status')).toContainText('If an account exists');
});

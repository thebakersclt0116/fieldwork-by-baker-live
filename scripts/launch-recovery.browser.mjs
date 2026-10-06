import {test,expect} from '@playwright/test';
const question='Explain duration versus latency with one example.';
const answer={answer:'Synthetic UI fixture: duration measures how long behavior lasts; latency measures time until it starts.',mode:'TEACH',actions:[{label:'Open audit history',href:'/audit-history',reason:'Review original records.'}],followUps:[],citations:[],artifact:{title:'Synthetic measurement lesson',type:'Lesson',topic:'Measurement',summary:'A test lesson, not a live model claim.',sections:['Duration: onset to offset.','Latency: antecedent to onset.']},provider:'openai/gpt-5.6-sol',liveModelResponded:true};
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('authUser',JSON.stringify({name:'Synthetic Candidate',email:'recovery-ui-fixture@example.com',initials:'QA',role:'free',subscription:'none',trialEndsAt:Math.floor(Date.now()/1000)+86400}));
    localStorage.setItem('bakerSessionToken','isolated-ui-fixture-not-a-production-token');localStorage.setItem('theme','dark');
  });
  await page.route('**/api/health*',r=>r.fulfill({json:{stripeMode:'test',stripeCheckoutConfigured:true,liveBillingEnabled:false,cloudStorageConnected:false}}));
});
test('a provider failure retains the question, exposes retry, and does not save a fake answer',async({page})=>{
  let requests=0;
  await page.route('**/api/baker-ai',r=>{requests++;return r.fulfill(requests===1?{status:503,json:{error:'AI service credits must be configured.',code:'AI_BILLING_REQUIRED',liveModelResponded:false,provider:'unavailable'}}:{json:answer});});
  await page.goto('/baker-brain');
  const input=page.getByPlaceholder('Ask Baker Brain anything BCBA-related…');await input.fill(question);await input.press('Enter');
  await expect(page.getByRole('button',{name:'Retry question',exact:true})).toBeVisible();await expect(input).toHaveValue(question);
  await expect(page.getByText('AI service credits must be configured.',{exact:true})).toBeVisible();
  await expect(page.getByText('LIVE MODEL RESPONDED',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Retry question',exact:true}).click();
  await expect(page.getByText(answer.answer,{exact:true})).toBeVisible();
  await expect(page.getByText('LIVE MODEL RESPONDED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save to Resource Vault',exact:true}).first().click();
  await page.goto('/resources');await page.getByRole('heading',{name:'Synthetic measurement lesson',exact:true}).click();
  await expect(page.getByText('Duration: onset to offset.',{exact:true})).toBeVisible();expect(requests).toBe(2);
});
test('HTTP 200 safe-fallback can never pass as live AI in the UI',async({page})=>{
  await page.route('**/api/baker-ai',r=>r.fulfill({json:{...answer,answer:'This would be a fake fallback answer.',provider:'safe-fallback',liveModelResponded:false}}));
  await page.goto('/baker-brain');const input=page.getByPlaceholder('Ask Baker Brain anything BCBA-related…');await input.fill(question);await input.press('Enter');
  await expect(page.getByRole('button',{name:'Retry question',exact:true})).toBeVisible();
  await expect(page.getByText('This would be a fake fallback answer.',{exact:true})).toHaveCount(0);
});
test('billing screen preserves approved prices but cannot initiate checkout during maintenance',async({page})=>{
  let paymentCalls=0;await page.route('**/api/create-checkout-session',r=>{paymentCalls++;return r.fulfill({status:503,json:{error:'must not be invoked'}});});
  await page.goto('/upgrade');await expect(page.getByText('Paid checkout is temporarily paused.',{exact:true})).toBeVisible();
  await expect(page.getByText('$16.99',{exact:true})).toBeVisible();await expect(page.getByText('$34.99',{exact:true})).toBeVisible();await expect(page.getByText('$349',{exact:true})).toBeVisible();
  const buttons=page.getByRole('button',{name:'Checkout reopening soon',exact:true});await expect(buttons).toHaveCount(3);
  for(let i=0;i<3;i++)await expect(buttons.nth(i)).toBeDisabled();expect(paymentCalls).toBe(0);
  await page.getByRole('link',{name:'Your existing local audit records and downloads remain accessible.'}).click();
  await expect(page.getByRole('heading',{name:'Entry-by-entry audit ledger'})).toBeVisible();
});

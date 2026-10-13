import fs from 'node:fs';
function replace(path,before,after){const text=fs.readFileSync(path,'utf8');if(text.includes(after))return;if(!text.includes(before))throw new Error('Review fixture changed: '+path);fs.writeFileSync(path,text.replace(before,after));}
replace('scripts/cloud-boundary.test.mjs',"signup sends only name metadata and requires confirmation rather than granting client roles","signup permits only name and normalized non-authorizing journey metadata and requires confirmation");
replace('scripts/cloud-boundary.test.mjs',"assert.deepEqual(sent,{email:'a@example.com',password:'synthetic-password',data:{name:'Example User'}})","assert.deepEqual(Object.keys(sent).sort(),['data','email','password']);assert.equal(sent.email,'a@example.com');assert.equal(sent.password,'synthetic-password');assert.deepEqual(Object.keys(sent.data).sort(),['baker_funnel','name']);assert.equal(sent.data.name,'Example User');assert.deepEqual(Object.keys(sent.data.baker_funnel).sort(),['campaign','flowId','qa','variant','version']);assert.equal(sent.data.baker_funnel.version,'funnel-v1');assert.equal(sent.data.baker_funnel.campaign,'direct');assert.equal(sent.data.baker_funnel.variant,'direct');assert.equal(sent.data.baker_funnel.qa,true);assert.match(sent.data.baker_funnel.flowId,/^[a-f0-9-]{36}$/i);assert.equal(sent.data.role,undefined);assert.equal(sent.data.subscription,undefined)");
const path='scripts/launch-recovery.test.mjs';let source=fs.readFileSync(path,'utf8');
const start=source.indexOf("test('production blocks both test payments and unsafe live entitlement grants'");const end=source.indexOf("test('verified live catalog",start);
if(start<0||end<start)throw new Error('Expected pre-cloud billing test changed.');
source=source.slice(0,start)+`test('production billing requires verified identity and matching live payment rather than legacy local entitlements',()=>{
  const start=read('api/create-checkout-session.ts'), complete=read('api/checkout-complete.ts'), billing=read('server/billing.ts');
  assert.ok(start.includes('billingIdentity(req)'));assert.ok(start.includes('claim_billing_checkout'));assert.ok(start.includes('priceFor(plan,mode)'));
  assert.ok(complete.includes('billingIdentity(req)'));assert.ok(complete.includes("checkout.payment_status!=='paid'"));assert.ok(complete.includes('reconcileSubscription'));
  assert.ok(billing.includes("key.startsWith('sk_live_')||key.startsWith('rk_live_')"));assert.ok(billing.includes("env.VERCEL_ENV==='preview'"));
});
`+source.slice(end);fs.writeFileSync(path,source);
console.log('Identity/role protection retained; legacy paused-billing assertion replaced with live-billing verification checks.');

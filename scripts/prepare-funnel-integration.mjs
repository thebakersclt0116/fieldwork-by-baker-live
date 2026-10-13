import fs from 'node:fs';
const path='scripts/integrate-measured-funnel.mjs';
let script=fs.readFileSync(path,'utf8');
const old="replaceAll(legal,'first-payment details','signup and checkout stages plus first-payment details');";
const next="change(legal,'When you start checkout, a hashed email, hashed browser identifier, browser type and ad click identifier may be attached to that checkout.', 'With fresh consent, Meta may receive public-page visits, account creation, verified-email and checkout-start events with hashed email when available, a hashed browser identifier, browser type and ad click identifier. When you start checkout, these permitted identifiers may be attached to that checkout.');\nchange(legal,'Use Ad privacy on public pages to change your choice for future checkouts;', 'Minimal first-party account and transaction stage counters use pseudonymous journey IDs to operate and diagnose the signup flow. Page-visit measurement and transmission to Meta require your optional consent. Use Ad privacy on public pages to change your choice for future transmissions;');";
if(!script.includes(old))throw new Error('Privacy patch source changed.');
script=script.replace(old,next);fs.writeFileSync(path,script);
// These checks predated the deployed paid-only launch and currently require a trial that no longer exists.
// Replace them with stronger assertions for the current published offer and verified-account boundary.
const regression='scripts/fieldwork-regression-check.mjs';
let checks=fs.readFileSync(regression,'utf8');
const changes=[
 ["assert(pricing.includes(\"3-Day Free Trial\"), 'Pricing does not advertise the 3-day trial');", "assert(!pricing.includes('3-Day Free Trial'), 'Paid-only launch must not advertise an unavailable trial');"],
 ["assert(signupPage.includes('Start 3-Day Free Trial'), 'Signup is not framed as the 3-day trial');", "assert(signupPage.includes('Create your account') && signupPage.includes('paid plan'), 'Signup must explain the paid membership requirement');"],
 ["assert(signupApi.includes('THREE_DAYS_SECONDS'), 'Signup API does not issue a 3-day trial');", "assert(read('api/account.ts').includes('EMAIL_CONFIRMATION_NOT_CONFIGURED'), 'Managed signup must require verified email');"],
 ["assert(pricing.includes('3 days free'), 'Pricing does not show the 3-day trial');", "assert(pricing.includes('/demo'), 'Pricing must provide the promised free demo');"],
 ["assert(loginPage.includes('Start your 3-day free trial'), 'Login does not offer a clear path to self-serve signup');", "assert(loginPage.includes('/signup'), 'Login must link to self-serve signup');"],
 ["assert(upgradePage.includes(\"Choose this plan now\"), 'Trial users cannot choose a paid plan before trial ends');", "assert(upgradePage.includes('Continue to Stripe'), 'Paid upgrade must use the real Stripe flow');"],
];
for(const [before,after] of changes){if(!checks.includes(before))throw new Error('Expected legacy regression changed: '+before);checks=checks.replace(before,after);}
fs.writeFileSync(regression,checks);
console.log('Paid-only offer and consent disclosure review applied. No trial or billing policy changed.');

# Fieldwork acquisition funnel — October 2026

## Current offer and scope
Paid-only memberships remain Individual $16.99/month, Professional $34.99/month, Professional Annual $349/year. The free demo contains fictional records; no unavailable free trial is advertised. This release does not change prices, entitlements, saved fieldwork records, or Stripe subscriptions.

## Instrumented stages
1. `landing_page_loaded`: public React page mounted and optional ads-v2 consent is present. A unique browsing journey is recorded; this is NOT total visitors or the Meta Landing Page Views metric. Browsers without consent are absent from this stage.
2. `account_created`: Supabase confirms a newly created identity, not an existing-account obfuscated response, button click, or resend. Counts use a verified provider identity, not merely browser storage.
3. `email_verified`: Supabase confirms email ownership at successful sign-in. The confirmation timestamp is retained. Delayed first sign-in is a measurement limitation.
4. `checkout_opened`: Stripe returns a valid live hosted Checkout session. This proves session creation; only a browser test/customer session can prove the hosted page fully rendered.
5. `first_paid_membership`: an authoritative nonzero paid live first subscription invoice matches an approved Fieldwork price and has no earlier paid invoice for that customer. Renewals, zero-dollar tests, and sandbox transactions are not new memberships.

Owner report: `/admin/funnel`. Its API requires a provider-verified owner role, not a localStorage label. Signed-in users can inspect only their own limited stage booleans through `/api/funnel?view=self`; no caller-selected identity is accepted. Source-of-truth accounts remain in Supabase and payments in Stripe.

## Measurement privacy and limitations
The first-party ledger stores stage, experiment arm, time and hashed identity/journey IDs in the existing server-only billing_events table. It never stores fieldwork narratives, files, supervisor information, payment credentials, or raw email. Signup/transaction diagnostics are separate from optional ad transmission. Existing ad refusals remain refused. Prior first-payment-only consent must be renewed before expanded ads-v2 events are sent. GPC is respected. No Meta JavaScript loads in the private workspace.

Optional Meta events map to ViewContent, AccountCreated, CompleteRegistration (verified sign-in), InitiateCheckout and the existing authoritative Purchase integration. ViewContent is not PageView and not proof of a Meta Landing Page View. QA journeys are separated in the local ledger and never sent as production ad conversions. Existing Purchase optimization remains unchanged.

Counts are not retroactively backfilled. The report shows period event totals, not a same-start-date cohort or a statistically significant winner. The 20,000-row safety cap is disclosed. Some ad delivery errors can occur after the application transaction succeeds; analytics must not interrupt signup or payment. Monitor actual accepted events and provider results before scaling.

## Signup and email flow
`/signup` places the form before benefit cards on mobile. Copy explains the real offer and the supported detailed-PDF migration. After signup, the page explains email verification, supports a rate-limited resend request, and links to `/login?return=%2Fupgrade`. Email confirmation returns to the canonical login page; URL fragment credentials are discarded rather than forwarded to analytics. Paid access is still granted only by the existing verified subscription flow.

## Controlled destination test
`/start` assigns homepage or signup 50/50 within a browsing session, retains the same arm on repeat clicks, and forwards only whitelisted attribution fields. Both arms use the SAME campaign, audience, placements, creative and budget. Session-level assignment is not a person-level randomized trial; cross-device visits, consent and small samples limit inference.

## Approved ad relaunch specification — not a claim of publication
Account 1831906937994399; campaign 120251729153710531; ad set 120251766968210531; ad 120251766968220531.
Preserve daily budget 2000 cents, lifetime campaign spend cap 28000 cents including already spent amounts, and original end time 2026-10-22 08:00 America/New_York. Do not create another spending campaign or restart its cap.
After website deployment and verification, pause the old ad, remove Audience Network, use Facebook/Instagram feeds, Stories and Reels, retain the current US BCBA-candidate audience and Purchase objective, update the message/headline/destination, verify readback, then enable. Current connector write permission may block ALL those actions, including pause. Never claim an ad was paused, changed or relaunched without successful mutation/readback.

Proposed destination: https://www.fieldworkbybaker.com/start
CTA: SIGN_UP
Headline: Bring your Ripley hours. Keep every session.
Primary text:
BCBA fieldwork candidates: don't start your tracker from scratch.

Import supported detailed Ripley monthly PDFs in bulk. Review individual sessions and original activity notes, then pick up where you left off.

Fieldwork tracking, monthly progress, Baker Brain and study tools—one connected workspace.

Memberships from $16.99/month. Create your account, verify your email and choose your plan. Free demo available.

Remove the old “iOS and Android apps coming soon” line. Inspect the retained media/placement previews for any unavailable free-trial or coming-soon claim embedded in the asset before enabling. Do not use private fieldwork records as ad creative.

## Acceptance and manual proof still required
Run `node --test scripts/acquisition-funnel.test.mjs`, the existing suite and production build, plus `playwright test --config=scripts/acquisition-playwright.config.mjs`. These use synthetic identities and simulated provider responses. They do not by themselves prove actual email delivery, Stripe hosted rendering, paid conversion or Meta receipt on production.
A final live check requires an authorized test account in a real inbox: create account, open its real confirmation email, sign in, open Stripe, verify the advertised price, and confirm the relevant stages in the owner report. Do not submit a real card or count a fake purchase merely to make the funnel appear green. Validate payment completion using an authorized sandbox or a genuine paid customer and Stripe webhook evidence. Preserve the distinction between configured, simulated, observed-live, and not yet verified.

# Owner business dashboard

Local implementation based on commit `576b083a79681ebb10ca630d46259a2af5b6f376`.

## Sources and definitions

`GET /api/owner-metrics` verifies the bearer token with Supabase Auth, then reads the caller's protected profile using that same JWT. Only a managed `profiles.role = 'owner'` permits subsequent privileged reads. Email, browser role labels and legacy beta sessions do not authorize the endpoint. Responses are private/no-store and vary by Authorization. The read path performs no provider or database writes and adds no RLS policies or credentials.

The existing server Supabase secret reads the paginated Auth user directory and profile IDs/trial expiries. The existing Stripe request boundary reads fully paginated live subscriptions and invoices. Registered accounts include unverified signups; verified accounts count existing cloud profiles, not all attempted signups. QA email patterns and account funnel QA metadata are excluded. Manual professional/owner access never proves payment.

Only recognized positive-priced Fieldwork catalog subscriptions qualify for billing metrics. A historical positive, provider-paid, in-band invoice is required for paid counts. A current credited/$0 invoice therefore does not erase prior payment history. A genuinely free subscription or canceled $0 test does not create a payer. Test mode and QA subscription/customer metadata are excluded. Account groups may overlap for accounts with multiple subscriptions. Account metadata links subscriptions to registered accounts; missing links are counted explicitly and fall back to unique Stripe customers, not guessed email matches.

- Active paid accounts: unique account/customer identities with an active qualifying subscription and paid invoice history.
- Active paid subscriptions: qualifying subscription count, distinct from account count.
- Unique historical payers: unique identities with positive paid invoice history, including canceled subscriptions.
- Past due/unpaid and canceled: distinct historically paying identities in those provider states.
- Scheduled cancellation: still-active paid accounts with a future cancellation; counted as active until Stripe changes status.
- Stripe trials: current trialing catalog accounts; legacy profile access trials are separate.
- Free verified accounts: profiles without qualifying paid billing history/current Stripe trial or a current legacy access trial. This includes manual access, and does not mean all free users have identical entitlements.
- MRR: active historically paid subscriptions' current recurring prices/quantities, with supported current discounts, normalized by recurring interval count; annual amounts are divided by 12. Trials and past-due subscriptions are excluded. Product-restricted/unexpanded discounts, partial subscription items, and ambiguous fixed discounts across multiple items fail closed instead of guessing. Currency totals remain separate; the current catalog is USD.
- Collected invoice revenue: all-time positive paid invoice amounts, including tax, before refunds. Not net revenue, profit, cash settlement, or MRR. Out-of-band marked-paid invoices are excluded. Mixed/unrecognized or truncated invoice lines cause the report to become unavailable rather than attributing the whole invoice to Fieldwork.

All provider pagination must finish; provider/format/safety-limit errors fail the report closed. The provider reads are a snapshot taken over a time interval, not a cross-provider atomic transaction. `startedAt` and `checkedAt` bound that interval. Refresh is manual; the UI marks snapshots stale after five minutes or a failed refresh. No unavailable count is synthesized as zero.

## Directory

Owner responses contain only account name/email, registration time, verification state, last sign-in time, catalog plan/status and cancellation scheduling. Directory pages contain at most 50 users and support all/active/canceled/trialing/past_due/unpaid filters. Last sign-in is Auth activity, not feature activity. No fieldwork records, client/student information, AI conversation contents, full provider records, tokens or payment credentials are returned.

## Feature engagement and privacy

The original dashboard release showed feature history unavailable. Justin subsequently approved optional first-party feature measurement. The follow-up adds an explicit default-off account-scoped usage choice, allowlisted events and owner-only aggregates; see [feature-usage.md](feature-usage.md) for exact fields, retention/deletion timing, exclusions, definitions and validation. There is no earlier history to backfill. This remains separate from advertising measurement and never reads private fieldwork content to infer activity.

## Validation and release

Run `node --test scripts/owner-metrics.test.mjs`, existing `scripts/*.test.mjs`, `tsc -b`, and `vite build`. The server files also need an explicit TypeScript check because the repository build only includes src and vite.config.ts.

`npm ci` currently fails because the existing package/lockfile omit required canvas dependency entries. Local verification used `npm install --ignore-scripts --package-lock=false --no-audit --no-fund`; this patch does not change dependency manifests.

Deployment approval was supplied by Justin for the owner dashboard. The connected API previously returned a team-scope 403. After Justin signed into Safari, the Vercel UI verified authorized access to team `fieldwork-by-baker`, project `fieldwork-by-baker-testing`, the production custom domain `www.fieldworkbybaker.com`, and production commit `576b083a79681ebb10ca630d46259a2af5b6f376`. Use this verified existing project and its Git integration; do not assume the similarly named `fieldwork-by-baker-live` project serves production. The current Safari Fieldwork session is legacy/local: the existing managed-owner funnel page rejects it, so live data acceptance requires a managed cloud owner sign-in. Do not use the legacy README password. No contact validation change is included.

Before release, recheck live Stripe using authorized read-only access (the earlier 1-payer/$16.99 observation is a cross-check, never a fixture in application code), and verify the existing Supabase secret can read the required Auth admin endpoint without broader credentials. Deploy to a preview of the verified existing project first. Test real owner success, unauthenticated/ordinary-user denial, directory pagination/filtering, failure/staleness and member hour-tracking regression. Then promote only this reviewed dashboard change via the authorized production project and repeat owner/nonowner checks. Only explicitly consenting managed members contribute to the approved optional feature tracking; confirm default-off behavior after release. Roll back to the verified prior deployment if authorization or counts disagree.

## Cloud owner sign-in diagnostics

The public sign-in flow tries managed authentication and then may fall back to legacy access. A successful-looking legacy sign-in cannot authorize this dashboard. Use `/login?mode=cloud-owner&return=%2Fdashboard` for owner data acceptance; this flow does not fall back to legacy access. It cannot create or grant an owner role. A verified cloud profile with a blank display name is valid: the client uses an email-prefix display fallback while preserving the server-supplied role. A failed cloud-only sign-in keeps the report unavailable and displays a clear credential/verification error. Do not assume the legacy and managed account passwords are the same, and do not use any exposed legacy credential.

On October 16, a user-reported sign-in still produced a legacy/local session after a fresh Safari reload. This establishes the current session type, not the specific cause of the managed login failure. The blank-name acceptance and cloud-only entry are covered by isolated auth tests; actual cloud-owner authentication and protected directory readback remain pending the user's normal managed sign-in. No profile role or password was changed.

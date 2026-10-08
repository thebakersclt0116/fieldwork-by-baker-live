# Fieldwork launch status

Status: public paid launch remains blocked pending end-to-end acceptance.

Live domain: https://www.fieldworkbybaker.com
Vercel project: Fieldwork By Baker / fieldwork-by-baker-testing.
Production currently includes the iOS and Android apps coming soon announcement. Account/backend changes remain on the launch-readiness-hardening preview branch.

## Service setup verified

Vercel Pro is active. The approved $5 AI credit is funded with auto-reload off. Supabase Free project hfsngrpvxhrjahziwrdq is healthy. Stable session signing and Supabase connection values are saved in Production and Preview. Resend Free is connected; its sender domain, DKIM and SPF records are all verified. Supabase custom SMTP is enabled with a stored password, sender noreply@fieldworkbybaker.com, smtp.resend.com:465 and user resend. Supabase site URL is https://www.fieldworkbybaker.com and the sole recovery redirect is its /reset-password route.

Managed account UI is enabled only in Preview for acceptance. Production signup has not been switched to managed accounts. Real test email destination: thebakersclt@gmail.com. No passwords are stored in this document.

## Implemented

Managed signup requires delivered email confirmation; login and renewal verify the provider identity and derive permissions from protected profiles. Password recovery uses the fixed canonical destination, removes the recovery token from the address bar, and requests refresh-session revocation after reset. Concurrent renewals share one rotating refresh token; a logout/account change cannot silently restore the old session. Existing beta key login and browser records remain separate.

Managed workspaces hydrate before member pages open. Entries use workspace compare-and-swap, learning records use record versions, and paged reads reject concurrent changes. Unknown save outcomes retain local drafts and block further writes. Explicit recovery preserves a separate draft copy before loading cloud records. Successful saves reconcile server revisions and approval state. Legacy shared learning records are never silently assigned to an account.

Private originals use immutable owner paths, 25 MB file limits, bounded upload reservations, a 150 MB account archive cap and a 750 MB project archive cap to preserve free-tier headroom. Successful archives verify actual stored bytes against SHA-256. Downloads require owner access and expire after 60 seconds. Original metadata and import-journal events cannot be overwritten by clients. Imports preserve their prepared snapshot and wait for cloud entry saving before recording completion. Full audit ZIP export retrieves and checks originals, journals, records and account learning caches; it must be saved independently of Fieldwork.

Exact elapsed-minute fractions are retained before aggregation. Supervisor snapshot feedback cannot target unassigned entries. Authentication/review responses are private and not cached. Build credentials are never generated into tracked code. The dependency lock uses the official npm registry and CI installs with npm ci. AI acceptance requires a real model response.

## Actual verification

Production frontend build passes. Focused account, cloud persistence, archive boundary, authorization and precision checks pass. All four CI workflows passed on the preceding recovery commit; the current archive/session update is being checked separately. The first private schema and entry-write transactions passed account isolation, protected-role, forged-approval, stale-write and immutable-history database checks.

The private archive migration is installed in Supabase. Its rollback-only fictional database test passed upload reservation/retry, missing-file rejection, immutable import history and cross-account original/journal isolation. No actual file bytes or historical records were uploaded in that database check.

The private source fixture was validated locally only: 35 sessions, 62 hours, 19.75 restricted / 42.25 unrestricted, 55.75 independent / 6.25 supervised, 60 observation minutes, full narratives, a page continuation and four overlaps. No original bytes, narratives or personal details are published in this repository or CI.

## Remaining acceptance and implementation

- Real delivered verification/recovery emails, independent-device sign-in, session renewal and full cloud save/download/restore tests.
- Durable assigned-supervisor review of the exact current entry revision, immutable approval history and truthful email notification state.
- Live AI conversation/resource checks and durable per-account/project generation budgets.
- Live Stripe prices, verified customers, signed raw-body webhooks, idempotency/order reconciliation and portal; paid permissions must come from durable state. Live billing remains disabled. No real-money test is authorized.
- Independent backup retention and a recorded restore drill; monitoring, meaningful budget alerts and hosting overage choice.
- Mobile, keyboard, contrast, meaningful-control and adverse PDF/network regression on the exact final production commit.

Six high audit findings remain in the build-time braces/Tailwind dependency chain; the registry did not provide the reported patched braces version at verification. A forced Tailwind major migration was not attempted. The postcss-selector-parser override resolves its reported advisory and builds successfully.

Do not declare publicLaunchReady or enable paid public rollout merely because safe-failure unit tests pass. No compliance certification is asserted; identifiable client/health-data scope and any required provider agreements remain to be resolved before accepting that data.

# Launch status

Status: NOT READY FOR PAID PUBLIC LAUNCH.

Baseline production commit: `4a7ac89d6a96f7698ec6662a427bda537f5ccce8`.
Live domain: https://www.fieldworkbybaker.com
Hosting project: Fieldwork by Baker / fieldwork-by-baker-testing.

## Verified in this launch review

The public health endpoint still reports browser-local storage, disconnected cloud storage, test Stripe credentials, disabled live billing and false publicLaunchReady. The Vercel connector returns 403 for the team; an existing Safari dashboard session can view the project. Project storage has no connected database. AI Gateway shows onboarding and $0 credit. The configured openai/gpt-5.6-sol model appears in the public gateway model catalog; listing is not proof of account access or successful generation.

The private source fixture was validated locally only. It recovered 35 sessions, 62 hours, 19.75 restricted and 42.25 unrestricted hours, 55.75 independent and 6.25 supervised hours, 60 observation minutes, all narratives present, a page continuation, and four overlaps. No original bytes, narratives or personal details are included in this repository or CI.

## This change

- Quick Log retains exact elapsed minute fractions and formats two decimals for display.
- Supervisor feedback cannot target an entry outside the invitation snapshot.
- Authentication and review responses use private/no-store caching.
- Learning profiles, exam attempts/results, Brain history, plans and saved resources use account-specific browser keys. Legacy shared keys are retained untouched and are not automatically assigned to an account. This is browser isolation, not server authorization or cloud persistence.
- Build no longer writes a random signing credential into a tracked source file. BAKER_SESSION_SECRET must be configured as a stable server environment secret before rolling out this branch. Beta key-based login remains unchanged; public signup/invitations fail closed when the stable secret is missing.
- Dependency lock is repaired and uses the official npm registry; CI uses npm ci. Old workflow steps that rewrote feature branches are removed. AI release acceptance requires liveModelResponded, not merely an answer string.

## Validation on this branch

54 automated data, transport, authorization and precision checks pass; existing workflow regressions pass. TypeScript/Vite production build passes; all 12 API routes bundle successfully. npm ci succeeds against the repaired lock. Audit retains six high findings in the build-time braces/chokidar/fast-glob/micromatch/Tailwind dependency chain. The reported patched braces version is not available from the official registry at verification time; forced Tailwind major migration was not performed. A postcss-selector-parser override resolves its reported advisory and the application builds successfully.

Local Chromium execution is blocked by the macOS sandbox (MachPortRendezvousServer permission denied). Browser acceptance must run in GitHub CI or the authorized browser; it is not counted as passed here.

## Remaining launch blockers

1. Durable verified identity: public signup currently does not store users/passwords; ordinary sign-in handles only two beta accounts. Replace this with managed identity, email verification, recovery, expiring/revocable sessions and authoritative account state.
2. Central database and private source storage: implement owner/supervisor relationships, entries/revisions/approvals, import jobs and dedupe, learning records and resource persistence. Test independent accounts and devices. Current localStorage and IndexedDB are the only record stores.
3. Backup-first migration: explicit export and verification of counts, hours, categories, narratives and original hashes; conflict-safe migration without silent overwrite. Never upload private historical data without owner-confirmed scope. Existing beta browser records must survive rollout.
4. Actual AI: initialize the team gateway with approved credits/access; verify real signed-user conversations and all generated resource flows. Add durable per-user quotas, request-size limits and total usage budgets. Never count unavailable/fallback as live success.
5. Billing: connect approved existing live prices, verified customers, raw-body signed webhooks, idempotency/order reconciliation and portal. Derive paid permissions from durable state. Keep public billing blocked until these checks pass. No real-money test without specific authorization.
6. Review and notification backend: durable current-revision checks and immutable history; assigned supervisor scope; real transactional email with truthful delivery state. Existing signed links remain browser snapshots and cannot establish durable approval.
7. Backup retention, independent copies, restore drill, monitoring and budget alerts; record actual restored results.
8. Final regression: representative candidate/supervisor/paid-user workflows, every meaningful control, adverse PDF and network cases, mobile/keyboard/contrast, exact production commit and custom-domain checks.
9. Hosting cost/data scope: spending authorization and whether client-identifiable/health information is permitted are pending. Select providers and required agreements accordingly; no compliance certification is asserted.

These are implementation and service prerequisites, not merely missing environment variable names. Do not enable billing or change publicLaunchReady based on green safe-failure tests.

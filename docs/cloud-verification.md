# DigitalOcean integration verification

Verified locally on **2026-10-06**, against the proposed `codex/fieldwork-digitalocean-cloud` source changes. The combined source includes the PDF import improvements from main through `4a7ac89d6a96f7698ec6662a427bda537f5ccce8`. No DigitalOcean resource, production database, real email, Stripe charge, or live user migration was created by these checks.

## Completed checks

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run build` | Passed | Frontend TypeScript and Vite production bundle compile. |
| `npm run cloud:build` | Passed | Node cloud runtime and file-based SQL compile without production credentials. |
| Vercel API/server TypeScript check | Passed | The asynchronous account/session and checkout forwarding handlers type-check under NodeNext. |
| `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | Passed | The merged PDF, cloud, and browser-test dependency manifests agree with the committed lockfile. |
| `npm run test:cloud` | **100 passed, 0 failed, 0 skipped** | Durable auth, SQL storage/constraints, billing transitions, request ownership, transport retries, device journals, archive integrity, and routing configuration. |
| Import/source tests | **35 passed, 0 failed, 0 skipped** | Original IDs, narratives, extra source fields, row selection, exact totals, and revision/source fidelity are preserved. |
| Launch recovery tests | **16 passed, 0 failed, 0 skipped** | Mocked AI gateway failures, safe retry behavior, live-payment guards, and existing catalog consistency. |
| Existing Fieldwork regression script | Passed | Required workflows and source-level integration contracts remain present; this is not a live end-to-end browser test. |
| Targeted ESLint and `git diff --check` | Passed | Changed account, sync, root storage, routing, and relevant interface code pass the reviewed style checks. |
| App spec parse and assertions | Passed | One 1-GiB API instance, private managed database binding, no auto deployment/migration job, and closed signup/billing gates. |
| [GitHub release workflow](https://github.com/thebakersclt0116/fieldwork-by-baker-live/actions/runs/37416382942) on `4baf1052` | Passed | Independently installs the committed lockfile, runs cloud/source checks and both builds, bundles API routes, and exercises actual PDF upload/worker acceptance in isolated Chromium. |

Import/source command:

```sh
node --import tsx --test scripts/detailed-migration.test.mjs scripts/source-fidelity.test.mjs scripts/import-integrity.test.mjs
```

The cloud driver always starts a new in-memory PGlite PostgreSQL engine and loopback wire adapter, removes inherited application credentials/endpoints, runs test files serially, and closes its temporary database. Stripe and email operations are test substitutes. PostgreSQL storage tests execute the real schema, constraints, triggers, and application queries. Auth tests execute Better Auth password hashing, verification, recovery, cookies, session invalidation, and persisted rate limits.

The build reports a main frontend chunk of approximately 537 kB before gzip, a separately loaded PDF reader of approximately 496 kB and worker of 1.32 MB, an older Browserslist data set, and a dynamic import that is also loaded statically. These are build warnings, not failed compilation. No unsupported performance claim is inferred from a successful build.

## Remaining deployment checks

The managed database and App Platform service have **not been provisioned**. The DigitalOcean dashboard was unavailable in this session, and the installed connector does not expose those resource APIs. The prepared resource baseline is **$25.15/month**, subject to the actual account estimate, taxes, and additional usage; see [digitalocean-launch.md](digitalocean-launch.md).

Before enabling public signup and live checkout:

1. Obtain the authorized account connection, review the resource estimate, and provision the dedicated private VPC/database/app configuration.
2. Build the actual container. Docker was unavailable in the local environment; the Dockerfile has not been executed here.
3. Verify native DigitalOcean PostgreSQL TLS, private routing, restricted trusted sources, migrations, and cookie behavior through the existing public domain.
4. Verify real inbox delivery and account recovery. Preserve the reserved users' workspace IDs and permanent entitlements; recovery retires their old beta credential path.
5. From each source browser, preserve an independent backup, review the exact account/counts/totals, and verify full record and original-file readback. No real Emily/Justin device data was present in this environment or migrated by the tests.
6. Exercise two real browser tabs and a separate browser/device. The lifetime editor lock and recovery journal have controlled tests, but their actual browser behavior still needs verification. Close older already-open versions before migration.
7. Confirm an actual managed database backup and practice restoration into a separate reviewed restore resource. Temporary restore resources incur charges.
8. Run the representative 50-user workload with synthetic data and record throughput, errors, latency, memory, database connections, and integrity results. PGlite and source checks do not establish production capacity or native PostgreSQL multi-session scheduling.
9. Resolve and test live AI authorization. No successful live AI response was obtained by this change.
10. Configure and verify signed Stripe lifecycle events and the customer portal, then enable the explicit live-sales gate. Source tests made no real purchases.

The cloud scope is accounts, fieldwork entries, supervisors, originals, import history, and billing. Saved AI material, exam/study progress, and some personalization remain device-only. They must be preserved separately; this change is not proof that every feature has cross-device persistence.

Keep the existing production deployment until the connected release is verified. The generated routing configuration requires the actual DigitalOcean hostname and matching encrypted origin secrets, so `vercel.json` still contains its existing routing in this draft. Do not merge or deploy this frontend alone while `/api/cloud/*` is unavailable.

## PDF release integration

The existing PDF browser acceptance script retains real browser file uploads, the bundled worker, exact original-byte export checks, duplicate checks, missing-page rejection, and complete-batch rejection. Its local-only fixture now mocks the verified-session API instead of creating a trusted profile in localStorage. Its live mode requires an explicitly designated, verified QA account and exact workspace through secure CI inputs; it does not create a trial account or send signup email. Live records must be confirmed in cloud storage. The workflow installs the committed lockfile with Node 24 and `npm ci`.

The adapted browser script passed isolated Chromium acceptance in the GitHub workflow linked above. That fixture mocks the session and health responses only on its loopback origin; the PDF bytes, parser, bundled worker, original-file export, and incomplete-batch checks are real. No production-domain QA run has occurred. Real cloud cookies, device migration, and production PDF readback remain deployment checks.

The merged PDF evidence comparison uses canonical JSON: object key ordering after cloud readback cannot produce a false duplicate conflict, while changed source values and array order still require review. New original-file captures have independent IDs. Equal-byte legacy archive ID collisions retain both primary records and preserve the distinct metadata in verified, deterministic linked copies; they never replace original evidence.

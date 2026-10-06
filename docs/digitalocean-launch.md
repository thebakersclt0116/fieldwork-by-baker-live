# Fieldwork DigitalOcean launch

This guide prepares Fieldwork's account, records, original-file, and billing API for DigitalOcean App Platform with Managed PostgreSQL. The existing website and AI stay on Vercel. Only `/api/cloud/*` is externally rewritten to DigitalOcean. The existing Vercel checkout URLs remain compatible by forwarding authenticated requests to fixed cloud billing endpoints; signed Stripe lifecycle webhooks are handled by the cloud API.

**Status:** deployment materials only. No DigitalOcean app, database, subscription, or production connection is created by committing these files. The app spec contains explicit placeholders and keeps public signup disabled. The former Constellations Droplet is not part of this deployment.

## Launch budget and availability

Prices below were checked against official documentation on **2026-10-06**. Confirm the selected resources and final estimate in the account before creating them.

| Resource | Launch candidate | Monthly baseline |
| --- | --- | ---: |
| Node API | `apps-s-1vcpu-1gb-fixed`, one shared vCPU, 1 GiB, fixed one instance | $10.00 |
| PostgreSQL | Standard, Regular/Basic shared CPU, one vCPU, 1 GiB RAM, 10 GiB storage, one node, no standby | $15.15 |
| Private network | Same VPC and datacenter | No charge for same-VPC traffic |
| **Incremental DigitalOcean total** | API plus database | **$25.15/month** |

The API tier includes 100 GiB outbound transfer; excess transfer is $0.02/GiB. This total excludes existing Vercel, email, and AI charges, taxes, additional database storage, temporary restore resources, and any optional deployment-job runtime. There is no always-running migration job, dedicated egress IP, NAT gateway, or extra Droplet in this plan. [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/) · [Database pricing](https://www.digitalocean.com/pricing/managed-databases) · [VPC pricing](https://docs.digitalocean.com/products/networking/vpc/details/pricing/)

This is a **single API instance and single database node, with no database standby or high availability**. DigitalOcean describes single-node clusters primarily for development/testing. Using one for a small live launch requires accepting downtime during failures and some maintenance. Backups provide recovery; they do not provide a second serving node. [Database availability and pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/)

The prepared launch candidate uses 1 GiB for more memory room during password hashing and record/archive processing. That is an engineering starting point, not a measured capacity guarantee. The smaller `apps-s-1vcpu-0.5gb` service costs $5/month, includes 50 GiB outbound, and would reduce the baseline to **$20.15/month** if workload testing supports it. Neither fixed tier supports horizontal scaling. The 50-user workload described below remains a deployment verification task.

New Standard PostgreSQL clusters are subject to announced plan changes starting October 15, 2026 for accounts without prior PostgreSQL/MySQL clusters, and November 30 for all accounts. Existing clusters created before the applicable cutoff retain their documented upgrade paths. Check this before choosing a later expansion plan. [Official plan-change notice](https://docs.digitalocean.com/release-notes/upcoming/dbaas-plan-changes/)

## Files and build contract

| File or command | Purpose |
| --- | --- |
| `.do/fieldwork-app.yaml` | App Platform template attaching an already-created managed database. |
| `cloud/Dockerfile` | Node 24 multi-stage image; compiles once and runs as the unprivileged `node` user. |
| `.dockerignore` | Restricts the build context to the lockfile, cloud compiler/build script, `cloud/`, `shared/`, and their imported `src/types/index.ts` declarations. |
| `npm run cloud:build` | Compiles `tsconfig.cloud.json` into `dist-cloud`; must not connect to a database or require runtime credentials. |
| `npm run cloud:start` | Executes `node dist-cloud/cloud/server.js`. The image uses that Node command directly. |
| `npm run cloud:migrate` | Executes the compiled migration entry point, `dist-cloud/cloud/migrate.js`, only after explicit runtime confirmation. |
| `npm run test:cloud` | Starts an isolated temporary PostgreSQL engine and executes the account, billing, storage, transport, and browser-state tests with no production credentials. |
| `npm run cloud:route -- https://ACTUAL.ondigitalocean.app` | Previews the Vercel routing change for an observed API origin. Add `--write` only when that origin and both encrypted proxy-secret settings are ready. |

`express`, `better-auth`, and `pg` must be production dependencies in the committed npm lockfile. The mail implementation uses native `fetch`, so this deployment does not require the Resend npm package. TypeScript and type declarations can remain development dependencies. Runtime scripts must not depend on development-only `tsx` or TypeScript execution.

The Docker build uses `npm ci` and removes development dependencies after compilation. It copies every `cloud/**/*.sql` file to the corresponding location under `dist-cloud/cloud`, preserving any file-based schemas. The runtime image contains compiled cloud/shared code and production dependencies, not browser archives or the Vercel generated runtime-secret source. The `node:24-bookworm-slim` tag receives patch updates; its npm dependency graph is locked, but the base image is not immutable unless a verified digest is pinned for a release.

Build locally, when Docker is available, from the repository root:

```sh
docker build --platform linux/amd64 -f cloud/Dockerfile -t fieldwork-cloud:review .
```

No runtime secret or database connection should be necessary for that build. App Platform currently supports Linux AMD64 images. Its container filesystem is temporary and must never be the authoritative location for records or uploaded originals. [App Platform limits](https://docs.digitalocean.com/products/app-platform/details/limits/)

## Account values to establish

Do not submit the tracked template unchanged. Replace account placeholders in an untracked deployment copy or the DigitalOcean UI, and enter real secrets through encrypted runtime variables. Do not commit them or print complete database URLs in logs.

| Setting | Required observed value |
| --- | --- |
| App name | Proposed `fieldwork-cloud-api`; confirm it is available in the selected team. |
| Git source | Observed repository `thebakersclt0116/fieldwork-by-baker-live`, branch `codex/fieldwork-digitalocean-cloud`. Verify the intended reviewed commit is on that branch before connecting it. |
| VPC | Actual UUID of a VPC in `nyc1`; verify the database belongs to it. |
| Database | Actual managed cluster name, Fieldwork database name, and dedicated database user. |
| API hostname | The actual HTTPS `.ondigitalocean.app` hostname assigned after creating the app. |
| `FIELDWORK_APP_ORIGIN` | The exact existing public Fieldwork HTTPS origin, with no path; verify it from the current production project. |
| `BETTER_AUTH_SECRET` | A durable private random value of at least 32 characters, stored as an encrypted runtime variable. |
| `RESEND_API_KEY` | An authorized key for the email account used by Fieldwork, stored as an encrypted runtime variable. |
| `FIELDWORK_AUTH_FROM` | A sender address/domain verified in that email account. |
| `FIELDWORK_SIGNUP_ENABLED` | Keep the literal string `false` until the launch checks pass. Only the literal string `true` enables public signup. |
| `FIELDWORK_ORIGIN_SECRET` | Optional private value shared by Vercel and DO for proxy-origin verification; leave it unconfigured until the matching header transform is ready. |

The current installed DigitalOcean connector exposes Droplet/account tools, not App Platform, Managed PostgreSQL, VPC, or database-firewall provisioning. The dashboard returned "Site Unavailable" in the current browser, including after one retry. Provisioning therefore needs an accessible authorized DigitalOcean dashboard or official API/CLI session. Connecting a repository or submitting an app spec deploys resources and can incur charges; this document does not perform those actions.

### Billing and Vercel runtime configuration

On **DigitalOcean**, add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as encrypted runtime secrets. Use the existing reviewed live catalog in `config/stripe-live-catalog.json`; the billing module includes its observed live IDs and checks price amount, currency, product, interval, and mode with Stripe before creating checkout. Optional environment overrides are `STRIPE_PRICE_INDIVIDUAL_MONTHLY`, `STRIPE_PRICE_PROFESSIONAL_MONTHLY`, and `STRIPE_PRICE_PROFESSIONAL_ANNUAL`. The webhook endpoint is `/api/cloud/billing/webhook`; configure and verify its signed subscription/checkout/invoice lifecycle events before setting `FIELDWORK_STRIPE_WEBHOOK_VERIFIED=true`. Keep `FIELDWORK_LIVE_BILLING_ENABLED=false` until paid access and cancellation handling have been checked. Existing reconciliation and the customer portal remain available when new sales are paused.

The test-billing gate is separate: `FIELDWORK_TEST_BILLING_ENABLED=true` requires a nonproduction origin, test key, and explicit test price IDs. The public Fieldwork domains cannot use test payments to unlock access. Tests in this repository mock Stripe operations and send no charges.

On **Vercel**, configure server-only `FIELDWORK_CLOUD_API_ORIGIN` with the actual DO HTTPS origin and a matching encrypted `FIELDWORK_ORIGIN_SECRET` before routing cloud requests. Provide a stable `BAKER_SESSION_SECRET` for existing signed supervisor links; the generated per-build fallback is not suitable for durable links across releases. Keep `FIELDWORK_LIVE_AI_VERIFIED` and `FIELDWORK_LAUNCH_VERIFIED` unset until the corresponding actual deployment checks have passed. `/api/health` queries the live cloud readiness endpoint, but an available credential or HTTP 200 liveness response does not prove a successful AI request, restored backup, or migrated source device.

The current test harness uses PGlite through both its PostgreSQL engine API and a loopback PostgreSQL wire adapter. This verifies SQL constraints, state transitions, authentication, and controlled races. It does not reproduce native PostgreSQL multi-connection scheduling, DigitalOcean TLS/VPC, Docker/cgroup memory, browser Web Locks, or production network capacity. Those are the remaining runtime verification boundaries.

## Private database and first deployment

1. **Choose the database and VPC.** In DigitalOcean Databases, select Managed PostgreSQL, Standard, Regular/Basic shared CPU, 1 GiB, 10 GiB, one node, and `nyc1`. Confirm the estimate and supported PostgreSQL version in the current account. The documented size candidate is `db-s-1vcpu-1gb`; the official database-options endpoint is the source of truth for current availability. Create a dedicated Fieldwork database and user with the schema privileges required by the migration, rather than sharing a different application's data or credentials. [Create a PostgreSQL cluster](https://docs.digitalocean.com/products/databases/postgresql/how-to/create/)

2. **Attach the app to the same VPC.** Use app region `nyc`, which maps to VPC datacenter `nyc1`. The template uses a Node web service because App Platform Function components do not support VPC networking. It attaches the existing database using `production: true` and the actual `cluster_name`; it does not request the separate $7 development database. Keep `deploy_on_push: false` during launch. [App VPC setup](https://docs.digitalocean.com/products/app-platform/how-to/enable-vpc/) · [App spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)

3. **Configure runtime values and deploy the API.** The build only compiles code. `/api/cloud/health` is a liveness endpoint that can return HTTP 200 with `databaseReady: false` and `accountsReady: false` before configuration/migration. `/api/cloud/ready` must remain HTTP 503 until the required state is ready. Liveness alone is not permission to open signup or migrate user records.

4. **Restrict database access.** Observe the app's VPC egress private IP in DigitalOcean and add that IP to the database's trusted sources. Confirm the restricted rule remains in place. Never add `0.0.0.0/0`, disable trusted sources, buy public egress, or use a public database binding to make a failed private connection appear to work. The app and database must actually share the VPC. [Private networking and trusted sources](https://docs.digitalocean.com/products/app-platform/how-to/enable-vpc/)

5. **Use private TLS connections.** The template binds `DATABASE_URL` to `${fieldwork-db.DATABASE_PRIVATE_URL}` and `DATABASE_CA_CERT` to `${fieldwork-db.CA_CERT}`. Plain `${fieldwork-db.DATABASE_URL}` defaults to the public endpoint. Keep certificate and hostname verification enabled. The database helper removes URL SSL query settings before providing the CA-backed SSL object, so the URI cannot replace that verified configuration. [DO bindable variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/) · [DO database security](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/) · [node-postgres SSL behavior](https://node-postgres.com/features/ssl)

6. **Run the first migration explicitly.** After the private connection is allowed, open the app's Console and run:

   ```sh
   FIELDWORK_MIGRATION_CONFIRM=apply npm run cloud:migrate
   ```

   This is a database mutation and must run against the verified Fieldwork database. Inspect its result, then check `/api/cloud/ready` and `/api/cloud/session`. Do not invoke it from `npm run cloud:build`, a Docker `RUN`, or an ordinary health request. DigitalOcean builds cannot connect to trusted-source managed databases. [Build limitation](https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/)

The API's PostgreSQL pool defaults to **5** direct connections. The 1 GiB database has **22** usable backend connections, so leave capacity for migrations, administration, and overlapping deployments. Billing and migrations use advisory locks; do not substitute transaction pooling without reviewing those semantics. Migration requires a pool of at least **2** connections so its schema lock cannot block its own migration work. [PostgreSQL limits](https://docs.digitalocean.com/products/databases/postgresql/details/limits/) · [DO connection pools](https://docs.digitalocean.com/products/databases/postgresql/how-to/manage-connection-pools/)

## Forward only the cloud API through Vercel

After the DO API is ready, add this specific external rewrite before the existing SPA catchall, substituting the actual observed API origin:

```json
{
  "source": "/api/cloud/:path*",
  "destination": "https://<OBSERVED-DO-API-HOST>/api/cloud/:path*"
}
```

Keep the `/api/cloud` prefix intact on both sides. Retain all existing AI, Stripe, and unrelated API routes on Vercel. Filesystem routes can take precedence over ordinary rewrites; verify no local `/api/cloud/*` handler intercepts the new route. Confirm the deployed request reaches DO rather than the SPA HTML response. [Vercel rewrites](https://vercel.com/docs/routing/rewrites) · [Routing order](https://vercel.com/docs/routing#routing-order)

Return `Cache-Control: private, no-store` on session, account, and record responses. Merge a route-specific `x-vercel-enable-rewrite-caching: 0` header for `/api/cloud/:path*` into the existing Vercel configuration. Current external rewrites can honor upstream caching headers; the app spec also disables DO edge caching for this API. [External rewrite caching](https://vercel.com/docs/routing/rewrites#caching-rewrites-to-external-origins)

Test cookies through the original Fieldwork domain, including login, verified email/recovery, logout, and a new browser session. Verify that the auth origin is the public Fieldwork origin and that redirects do not send users to the DO hostname. Server authentication and ownership checks remain mandatory on every record endpoint.

### Optional proxy-origin secret

If enabled, use the same encrypted `FIELDWORK_ORIGIN_SECRET` in Vercel and DO. Vercel must **set/replace**, not append, `x-fieldwork-origin-secret`; the API rejects nonmatching requests except its `/api/cloud/health` probe. Keep the secret out of browser JavaScript. This control supplements session authentication and never changes database trusted sources.

The current documented Vercel low-level route transform has this shape:

```json
{
  "src": "^/api/cloud/(.*)$",
  "dest": "https://<OBSERVED-DO-API-HOST>/api/cloud/$1",
  "transforms": [
    {
      "type": "request.headers",
      "op": "set",
      "target": { "key": "x-fieldwork-origin-secret" },
      "args": "$FIELDWORK_ORIGIN_SECRET",
      "env": ["FIELDWORK_ORIGIN_SECRET"]
    }
  ]
}
```

This is a low-level `routes` entry. The repository's routing script emits a single consistent route list preserving security headers, filesystem/API dispatch, asset caching, and the SPA fallback. It also prevents an unknown API URL from returning frontend HTML. Current Vercel documentation permits some mixed configurations, but the script rejects unreviewed routing rules instead of guessing how to combine them. Configure the secret in both services and verify the deployed request-header behavior before release. [Vercel origin restriction pattern](https://vercel.com/docs/routing/rewrites#restricting-your-origin-to-vercel-traffic) · [Route configuration](https://vercel.com/docs/project-configuration/vercel-json#routes)

### Payloads and deadlines

Vercel documents a **120-second external proxy timeout**. Its **4.5 MB Function** request/response limit applies when a Function handles the request, and its **4 MB Routing Middleware** request limit applies when that middleware processes it. The current external-rewrite documentation does not state an independent numeric body cap; that is not a promise of unlimited uploads. [Proxy timeout](https://vercel.com/docs/limits#proxied-request-timeout) · [Function limits](https://vercel.com/docs/functions/limitations#request-body-size) · [Middleware limits](https://vercel.com/docs/routing-middleware#limits-on-requests)

Keep archive binary chunks at or below **1 MiB (1,048,576 bytes)** and validate the complete serialized HTTP body through the deployed Vercel path. Base64 expands binary data by roughly one third before JSON overhead. Large record snapshots and journal JSON also need a measured, bounded request size; a chunked archive implementation does not automatically make an unbounded records JSON request safe. Preserve resumable/idempotent uploads and verify each completed original's byte length and SHA-256. Oversize requests must fail clearly without marking a partial upload or migration successful.

## Preserve Emily's data before switching storage

Keep public signup disabled and preserve the browser that currently holds Emily's data. Capture a recoverable local export before changing storage behavior. Never clear localStorage, IndexedDB, unsynced drafts, or an existing cloud snapshot to make a new-account view appear empty.

The implemented cloud migration includes exact entry objects and IDs, timestamps, statuses, notes and revisions; supervisors; every original file and its metadata; and migration journals and before/after records. It does not re-run saved entries through the import parser. Saved AI resources/history, exam/study progress, and some personalization remain device-only in this change. Preserve those separately and review legacy global keys before attaching them to an account; do not claim this branch moves every feature's state into the cloud.

Close other Fieldwork tabs and reopen the current release before initial migration. The new release permits one editing tab per account in each browser, with other current-release tabs read-only. Older already-open releases do not participate in the new lock. Browsers without Web Locks retain readable/exportable data but cannot edit or synchronize core records. Full checkpoints and recovery journals use IndexedDB; an interrupted local cache application is recovered before another edit. Corrupt browser JSON is preserved and stops synchronization instead of becoming a cloud deletion.

For each migrated account:

1. Capture source counts, exact serialized records, original byte lengths/hashes, and meaningful totals by month and organization. Preserve the source snapshot even if a current loader would treat malformed data as empty.
2. Upload through an authenticated session and use idempotent operations. Ownership must come from that session, not a submitted email address. A failed request or revision conflict must retain the local copy and remain visibly incomplete.
3. Read records back from the server and compare their full content, identifiers, counts, and totals. Download every original and recompute its hash; metadata alone is insufficient.
4. Sign in from a separate browser/profile, confirm the same records and original-file downloads, then restart/redeploy the API and repeat a sample readback. Confirm a second test account cannot list, read, change, or download the first account's records.
5. Mark migration complete only after those comparisons succeed. Keep the original browser/export until a separate restore test has passed. A missing remote response must never overwrite existing records with an empty array.

## Restore and 50-user verification before public signup

Managed PostgreSQL includes daily full backups and WAL-based recovery for the previous **seven days**. Verify that a successful backup exists in the actual account; creating a cluster is not evidence that a backup has completed. Practice recovery into a **separate restore cluster**, then verify representative account records, journal data, and original-file hashes against the captured source. Record the restore time and the actual recovered point in time. Restored resources incur their own charges; review and remove the temporary resources after their verified use without touching the live database. [Backups and recovery features](https://docs.digitalocean.com/products/databases/postgresql/details/features/) · [Restore a cluster](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/)

Run a staged workload with **50 distinct test users/sessions** through the real Fieldwork domain, using synthetic records rather than Emily's data. Include sign-in/session reads, record listing/editing, conflict/retry behavior, and bounded archive uploads/downloads. Exercise the largest supported records/journal payload and a full 1 MiB binary chunk with the actual serialization and authentication. Avoid generating bulk verification emails or paid AI/Stripe activity as incidental load traffic.

Record workload duration, request rate, successful operations, error/timeout/conflict counts, response-time percentiles, API RSS/CPU, database CPU/memory/connections, and whether any records were lost, duplicated, or crossed accounts. Stop and investigate sustained overload, OOM restarts, pool exhaustion, missing data, or cross-account access. Repeat the relevant workload after a sizing or implementation change. Fifty simultaneous idle sessions are not equivalent to fifty active users performing this workload.

Public signup may be changed to `true` only after the account/email flow, Emily's exact browser readback, persistent records, access isolation, backup restore, and representative 50-user workload have documented results. The live email sender and signup/recovery rate limits must also be verified. Otherwise keep the gate closed and report the specific remaining issue; a green liveness probe is insufficient.

## Optional deployment migration job

The default spec has **no automatic migration job**. After the initial migration and VPC access are verified, a reviewed release can opt into this `jobs` component. It inherits the template's runtime database/auth variables and runs only during a deliberate deployment because source auto-deploy remains disabled:

```yaml
jobs:
  - name: cloud-migrate
    kind: PRE_DEPLOY
    github:
      repo: thebakersclt0116/fieldwork-by-baker-live
      branch: codex/fieldwork-digitalocean-cloud
      deploy_on_push: false
    source_dir: /
    dockerfile_path: cloud/Dockerfile
    instance_count: 1
    instance_size_slug: apps-s-1vcpu-0.5gb
    run_command: npm run cloud:migrate
    envs:
      - key: FIELDWORK_MIGRATION_CONFIRM
        scope: RUN_TIME
        type: GENERAL
        value: apply
      - key: PG_POOL_MAX
        scope: RUN_TIME
        type: GENERAL
        value: "2"
```

Review each migration for compatibility with the currently serving release; a pre-deploy job can change the database before new API instances replace old ones. Maintain a tested application rollback path and use additive schema changes where possible. Rolling back the Vercel proxy or an API image does not roll back a database migration. Jobs add prorated runtime charges. [App Platform deployment jobs](https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/)

## Dedicated PDF release account

The existing `Ripley PDF Release` workflow now verifies the committed dependency lock, cloud tests, and local PDF browser acceptance on pull requests. A main-branch release additionally requires an existing, email-verified account named **Fieldwork PDF QA**, using a dedicated `pdf-release-qa` mailbox (the script permits a `+`, `-`, or `.` suffix before the domain), its actual `workspace-...` ID, and an active import entitlement. It must contain synthetic QA records only. Never use Justin, Emily, an owner, or a customer account.

Configure the repository variable `BAKER_PDF_QA_DEDICATED=true`, then encrypted GitHub Actions secrets `BAKER_PDF_QA_EMAIL`, `BAKER_PDF_QA_PASSWORD`, and `BAKER_PDF_QA_WORKSPACE_ID`. The test uses the normal cookie sign-in and independently verifies email, account name, workspace, and existing QA records before importing. It creates no signup or paid subscription and does not reset passwords or extend trial access. The account must already be verified: the normal authentication service can send verification mail if an unverified account attempts to sign in.

Live acceptance waits for the exact deployed commit, verifies the real PDF worker, uploads only fictional PDFs, reads their actual cloud records back, checks existing QA records remain unchanged, and signs out. Repeated runs use distinct fictional organizations and retain earlier QA data. Missing account configuration blocks this release check instead of bypassing authentication. These credentials and the live checks have not been configured or run in this session.

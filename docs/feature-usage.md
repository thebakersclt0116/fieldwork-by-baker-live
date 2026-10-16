# Optional first-party feature usage

Introduced October 16, 2026. This release follows Justin's explicit approval for privacy-disclosed tab and feature usage. It adds no third-party analytics provider, new credentials, RLS grants, database schema, automatic opt-ins, or change to Terms of Service. The Privacy Policy and Cookie & Storage Notice disclose the actual collection and deletion timing. The consent panel links those disclosures before opt-in.

## Collection and consent

All accounts start off. Only a verified managed member may opt in. The server stores an account-scoped consent marker for 30 days; it applies across browsers, expires automatically, and can be revoked in Account settings. There is no new persistent browser analytics cookie or identifier. No consent is inherited from advertising preferences. GPC blocks optional collection. Owner accounts, QA/email-test identities, legacy/local sessions and preview deployments do not contribute events.

The endpoint rejects unknown payload keys and unknown feature/action values. Clients can send only `{type: 'event', consent: 'usage-v1', feature, action}`. It derives the identity from the verified bearer token and checks the protected profile; supplied identity, time, URLs, strings or content are not accepted. The server also verifies its current consent marker before and after storing an event.

Stored event fields in the existing protected Supabase `billing_events` ledger are:

- `mode = live` (namespace isolation; preview writes are suppressed).
- `event_id = usage-v1/<allowlisted feature>/<allowlisted action>/<HMAC-SHA256 pseudonym>/<30-minute UTC bucket>`.
- `processed_at` equal to the server's UTC bucket start, rounded down to 30 minutes.

The pseudonym is derived using a purpose-specific HMAC with the already-configured server session secret (or the existing server-only Supabase secret when no session secret is configured) and the verified account UUID. Raw UUID, name/email, IP, browser/device fingerprint, location, arbitrary URL/query string, file/document name, fieldwork entry, student/client detail, message/AI conversation, form input and payment credentials are not stored in these usage records. Existing hosting/security request logs are separate and may process normal HTTP metadata.

Consent markers contain only `mode`, `event_id = usage-v1-consent/<same pseudonym>` and the server opt-in timestamp. No opt-out marker is retained after revocation. Managed members can read only their consent state, not event records. Only `profiles.role = owner`, checked through the verified user's JWT, may read aggregates. The owner API never returns pseudonyms or per-user feature timelines, and the directory is not joined to usage.

## Allowlist and definitions

Features/routes: Fieldwork (`/dashboard`), My Path, BCBA Roadmap, Baker Commons, Baker Brain, Exam Lab, Resource Vault, Forms Export, Import (`/import`, `/import/ripley`), Audit history, Baker AI, Account settings. Routes are mapped to fixed codes and are not sent as URLs. Supervisor/feedback token links and all query strings are excluded. Route markers mount inside the existing access/loading guards, so denied navigation or a loading placeholder does not count as an opened tab.

Every feature supports `tab_open`. Additional selected controls support only:

- Fieldwork: `manual_form_open` (opening the manual entry form, not saving an entry).
- Baker Brain: `quick_start_request` (clicking a predefined quick-start control; no prompt text).
- Exam Lab: `simulation_start_request` (requesting full simulation; not completion/results).
- Account settings: `billing_portal_request` (requesting the portal; not proof it opened).

A visit/action window is at most one event per account/feature/action/30-minute UTC bucket. Both browser memory and the database primary key deduplicate repeated requests; the database key prevents additional windows even across devices or server instances. This measures deduplicated tab opens/control requests, not raw clicks, sessions, time-on-page or successful outcomes. Unique visitors/users are distinct pseudonyms within the selected window. They are not the sum of row-level counts or a count of every registered member.

The endpoint also enforces 30 optional event/opt-in requests per verified identity per minute per server instance, with a bounded 5,000-key map; it is not a global distributed rate limiter. Deterministic bucket IDs independently bound stored counts across instances. Opt-out remains available after rate limiting.

## Retention and reporting

Owner reports use rolling 24-hour, 7-day or 30-day UTC-duration windows, clipped at October 16, 2026. Only retained, valid usage namespaces are included. The UI displays checked/since times, the earliest retained event within the selected window, manual refresh and five-minute staleness. No activity predating instrumentation is invented. An empty report means no recorded consenting activity in that window, not that nobody used Fieldwork. Provider or pagination failures return unavailable instead of zero; 20,000 records is a fail-closed safety limit.

Reports exclude events older than 30 days. On each consented event or opt-in, a narrowly filtered server cleanup deletes usage events and consent markers older than 30 days. There is no scheduled background sweeper: if collection is idle, physical deletion is delayed until the next such request. Turning off first deletes the account consent marker and then all retained event rows for its pseudonym, and stops later collection across browsers. An in-flight event rechecks consent and removes itself if consent was revoked. Storage-provider backups may follow their separate backup lifecycle. Billing and acquisition-funnel rows are never purged by this code. Owner report GETs do not mutate provider state.

## Verification and release

`node --test scripts/feature-usage.test.mjs` tests no-consent defaults, missing/invalid/legacy auth, owner-only aggregation including a nonowner with the admin email, extra payload/content rejection, same-origin checks, QA/owner/preview/GPC exclusion, duplicate/concurrent posts, bounded rates, opt-out after rate limiting, revocation racing a write, 30-day expiry and namespaced purge safety, pagination, provider errors, no raw identifiers and rendered-route guards. Run the full regression suite, explicit server TypeScript check, app TypeScript, changed-component lint and production build.

Reuse the approved owner-dashboard branch and the verified Vercel team/project `fieldwork-by-baker/fieldwork-by-baker-testing`, serving `www.fieldworkbybaker.com`. Create the preview, verify the exact tree, then use the authorized Safari production promotion. Managed owner sign-in is required for live directory/aggregate acceptance. Do not use legacy credentials or grant new database permissions for this check.

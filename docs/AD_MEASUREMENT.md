# Fieldwork ad measurement

Purchase optimization uses Meta Conversions API from the signed Stripe invoice webhook. No Meta JavaScript is loaded in the private workspace. Measurement is off until the visitor explicitly opts in, and off at the server until configuration is complete.

Required server configuration:

- `META_DATASET_ID`: dedicated Fieldwork dataset ID, Config.
- `META_CAPI_ACCESS_TOKEN`: dataset event-sending credential, Secret; entered directly in Vercel, never in source or chat.
- `BAKER_META_ADS_ENABLED=true`: Config, Production only after verification.
- Preview testing additionally requires `BAKER_META_TESTING=true` and `META_TEST_EVENT_CODE`; Preview sends only to Meta Test Events. Production rejects this synthetic test endpoint.

The existing server-only `billing_events` ledger stores a hashed event marker after successful Meta delivery. Stable Meta event IDs deduplicate concurrent delivery. Neither fieldwork records nor Meta payloads are stored in that ledger.

Only an authoritative live Stripe invoice that is paid, nonzero, USD, and the initial subscription invoice can qualify. Previously paid customers, renewals, unpaid sessions, $0 launch tests, and sandbox payments are excluded. Browser identifiers, ad click ID, hashed email and browser type are captured only after opt-in. Purchase transmission contains time, currency and actual paid amount, with a fixed source URL that excludes checkout tokens.

Acceptance before advertising: connect the dedicated dataset to the ad account; enter the server credential; verify a fictional purchase appears in Meta Test Events; verify ordinary members and Production cannot invoke the synthetic test endpoint; verify Production reports measurement enabled and renders equal-choice Allow/Decline controls; verify live checkout permissions can read invoices and the event ledger; select the dataset and Purchase event in the ad set; apply the $280 total cap and 14-day schedule; review creative, identity and placement previews; publish only the Fieldwork items and confirm review/delivery status.

Local validation: `node --test scripts/ad-measurement.test.mjs scripts/billing.test.mjs`, plus the production build. Do not activate tracking or publish ads merely because local checks pass.

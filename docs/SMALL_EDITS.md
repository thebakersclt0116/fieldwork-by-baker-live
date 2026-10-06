# Small edits

GitHub repository thebakersclt0116/fieldwork-by-baker-live is the source of truth. Work on a small branch/PR from current main, preserve existing UI style and dark mode, and coordinate with active edits.

Page copy lives in src/pages; shared navigation/layout in src/components; styling in src/index.css, src/App.css and src/dark-mode.css. Data import/provenance logic lives in src/lib/detailedMigration.ts, ripleyPdfLayout.ts, ripleyPdfImport.ts and migrationArchive.ts. API routes live in api; server AI logic lives in server.

For simple copy/style changes run npm ci and npm run build; inspect desktop/mobile/dark/keyboard behavior in the changed flow. For logging/import edits run the relevant migration and fidelity tests plus the synthetic PDF browser test. For authorization/review/time changes run launch-hardening.test.mjs and the API bundle check. For AI changes run launch-recovery.test.mjs and a real signed-user request in the authorized preview environment.

CI must use the committed package-lock.json, not delete it. Update dependencies deliberately, inspect audit findings, and avoid forced major upgrades. Never commit dist output, generated secrets, private source documents, test tokens or runtime debug endpoints. Keep future cloud schema and billing changes reviewable and covered by integration tests.

Legacy shared learning records remain in old browser keys after the account-isolation repair. They require explicit owner-confirmed recovery; do not assign them automatically to the next account signing in. Browser storage is a local cache and current record store, not a durable backup or access-control boundary.

Deploy small edits through the GitHub/Vercel flow and verify the exact production commit on the usual domain. Availability of deployment tools and metered provider usage depends on the session and configured accounts.

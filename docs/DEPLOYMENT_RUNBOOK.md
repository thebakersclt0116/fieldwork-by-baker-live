# Deployment runbook

## Safe baseline and preconditions

Current rollback target is production commit `4a7ac89d6a96f7698ec6662a427bda537f5ccce8`. Preserve existing beta browser data and originals before changes. Custom domain and Vercel recovery origin hold separate local records.

Before deploying the launch-hardening branch, configure a stable, high-entropy BAKER_SESSION_SECRET in the provider's server environment. Do not enter credentials in chat, commit them, or expose them through VITE_ variables. The build intentionally no longer manufactures a source-file secret. Missing signing configuration blocks public signup and signed invitation creation.

The current free-signup implementation is an ephemeral trial session, not a durable account system. Do not open paid public launch until LAUNCH_STATUS.md blockers are resolved and tested.

## Validation

Use Node 22 or later and the committed lock file:

```sh
npm ci
node --experimental-strip-types --test scripts/launch-hardening.test.mjs scripts/launch-recovery.test.mjs scripts/detailed-migration.test.mjs scripts/source-fidelity.test.mjs scripts/import-integrity.test.mjs
node scripts/fieldwork-regression-check.mjs
npm run build
```

Bundle all non-underscore API routes with esbuild, platform node, format esm and target node22. Run the synthetic real-PDF browser check with isolated Playwright/pdf-lib tools as configured in .github/workflows/ripley-pdf-release.yml. Never put a private fixture into CI artifacts.

A passing recovery workflow proves safe errors and billing blocks, not working billing, durable data or AI. Full launch acceptance must include a real model answer, cross-device records/originals, account isolation, durable current-revision approval, billing lifecycle and actual backup restore.

## Rollout

1. Create a reviewed branch/PR from current main. Use a guarded merge against its current head; coordinate with other maintainers.
2. Confirm preview configuration and all prerequisite services. Complete preview acceptance before merging.
3. Confirm the resulting production deployment is Ready and /api/health on the custom domain returns the exact merged commit.
4. Run ordinary authenticated user workflows on that deployment and record safe evidence. Do not infer readiness from preview status.
5. Enable paid public launch only after authoritative subscription handling, storage, identity and operational checks pass.

## Rollback

Use Vercel's existing production deployment for the baseline commit or redeploy that verified Git commit. Confirm its Ready state and custom-domain alias, then re-read /api/health and retest import/export. Never rollback by overwriting source with an older ZIP.

Once cloud schemas exist, pair every release with explicit schema compatibility and restore instructions; a frontend rollback must not overwrite newer cloud data. No restore drill has yet been performed.

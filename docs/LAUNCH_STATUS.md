# Fieldwork launch acceptance — October 8, 2026

Live domain: https://www.fieldworkbybaker.com
Vercel team/project: Fieldwork By Baker / fieldwork-by-baker-testing.

Production includes managed verified accounts, protected cloud workspaces and private originals, password recovery, paid membership guards, monthly PDF forms, shared Commons, account-wide profile photos, Suggestions, and mobile-app previews. Public trials have been removed. Visitors can explore a read-only demo; membership is required for paid features. Sample community discussions are clearly identified as fictional examples.

## Verified service and feature checks

- Vercel Pro hosting, Supabase Free database/private storage, verified Resend sender and custom signup/recovery SMTP.
- Password recovery completed by the account holder; updated password opened the live dashboard.
- Fictional private original uploaded and downloaded with an exact hash match; foreign account access denied by protected database/storage rules.
- Assigned verified supervisor read and saved a review in the browser. The saved review persisted after reload. Database checks confirmed direct foreign reads are denied, duplicate review requests are idempotent, and edited revisions invalidate invitations.
- Deployed 2022 and 2027 organization monthly forms downloaded. Names, month/year, hours and supervision allocations matched the fictional records. Both signatures and dates remained blank and editable. PDFs were rendered and visually inspected.
- Sandbox accounts can download PDFs for testing but cannot email forms. The deployed server rejected an attempted sandbox form email.
- Stripe sandbox Individual monthly, Professional monthly and Professional annual purchases completed using fictional cards. Signed checkout, subscription and invoice events returned HTTP 200; sandbox payments did not modify live permissions. Cancellation and portal return to the isolated preview were verified.
- Account-wide photo upload and persistence, country/activity opt-in defaults, shared Commons protections and Suggestions email delivery verified.
- Main-page regular-phone and Duo-inspired previews verified in light and dark themes. Monthly form dark-mode contrast fixed and deployed.
- Funded AI returned a fictional classroom explanation and saved it to the account. AI spending limit is $5; auto-reload is off.

## Live acceptance completed

The approved private $0 Professional test activated through Stripe's signed live webhooks. The subscription and invoice events both returned HTTP 200. Fieldwork's protected database showed active Professional access. The signup and selected-plan notifications were delivered to both owner inboxes. The paid account sent its monthly verification email to the authorized test recipient; Resend confirmed delivery with the unsigned PDF attached and the trainee's reply address.

The temporary live subscription was canceled after testing. The cancellation reached the protected billing database and removed paid access. Fictional entries were soft-deleted, their invitation revoked, and review history retained. No payment method or future charge was created.

Production public billing and the recorded launch verification marker are enabled for the final deployment. Final production health and public checkout opening are checked after release.

## Form and review behavior

A monthly verification email sends an unsigned official PDF to the supervisor address entered by the member. The supervisor reviews the values, signs and dates using print or an acceptable desktop PDF application, then returns it by replying to the trainee. Sending the form is not an approval or certification. The separate entry-review flow saves an assigned supervisor's decision against the current revision. Supervisor AI is disabled.

## Validation and operating limits

Latest focused billing/review/monthly tests: 34 passed. Launch health tests: 3 passed. Production build passed. Provider acceptance and real browser/database checks are recorded separately from unit tests.

Private originals currently have 25 MB per-file, 150 MB per-account and 750 MB project archive caps. Independent exports should be retained. No identifiable client records were used in launch testing. No regulatory compliance certification is asserted. Six previously recorded build dependency audit findings remain; a forced Tailwind major migration was not attempted.

No passwords, private keys or webhook signing secrets are included in this document.

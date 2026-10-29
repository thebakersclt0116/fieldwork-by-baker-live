# Required fieldwork profile

Source of the rule values: BACB, Guidance for Meeting the BCBA Requirements During the 2027 Transition, updated January 2026, pages 1–4: https://www.bacb.com/wp-content/uploads/2025/06/BCBA-2027-Requirements-Transition-260130-a.pdf

The profile asks when the candidate plans to submit the certification application, not sit the exam. Choices: before January 1, 2027; on or after that date; or unsure (retain separate 2022 and 2027 checklists). The guide requires both applying and meeting the current requirements before the cutoff. The system does not automatically change an existing selection on January 1 or determine eligibility.

| Requirements | Type | Total | Supervision | Monthly hours | Client observation |
| --- | --- | --- | --- | --- | --- |
| 2022 | Supervised | 2000 | 5% | 20–130 | One per month |
| 2022 | Concentrated | 1500 | 10% | 20–130 | One per month |
| 2027 | Supervised | 2000 | 5% | 20–160 | 60 minutes/month |
| 2027 | Concentrated | 1500 | 7.5% | 20–160 | 90 minutes/month |

These are the changes summarized by the supplied guide, not the entire BCBA eligibility/fieldwork standard. The UI explicitly says this is not a complete certification audit. Recorded progress excludes draft/rejected/incomplete activities, separates other fieldwork types, and does not use an unsupported mixed-type conversion factor. Both observation counts and minutes are retained; counts inferred from older records are flagged for confirmation. The page does not certify whether a supervision arrangement qualifies. Multiple-supervisor, mixed-type, unrestricted-balance, coursework and other requirements still need the applicable official guidance and supervisor review.

Private persistence uses the existing account-scoped `profile` learning record, nested as `fieldworkSetup`, with compare-and-swap and confirmed cloud saving. No new database migration or admin privilege is required. Existing study fields are preserved. Organizations and supervisors have stable IDs, optional supervisor email/certification, and an archive flag. Saving a supervisor never sends an invitation or grants access. Invitations remain in the existing signed review flow.

The profile gate protects My Hours, detailed imports and monthly forms after authentication/cloud hydration. A running legacy timer can still stop safely into a recoverable draft. New finalized hours are also checked server-side against the verified user's stored profile. Existing entries may still be edited/deleted even if onboarding is incomplete. Audit downloads, settings, membership and exam prep are not blocked by the new profile gate. Existing records and approvals are not rewritten by profile changes.

The timer stays first in My Hours, defaults to the selected fieldwork type, preserves exact elapsed hours, and displays recorded start/end times plus seconds in the details dialog. Organization and supervisor are explicit dropdown selections. Users may still choose a different fieldwork type for an actual historical session; it will remain separate from their selected target. Monthly forms default to the profile year/type but keep explicit historical-year selection. Unsure users are reminded to prepare and retain both versions separately, not a merged official form.

Tests use fictional local/provider fixtures only. The release test does not impersonate Emily, edit her actual hours, or send supervisors any email. Existing permission and paid-workspace enforcement remains in the established database RPCs.

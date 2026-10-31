# QA review — 31 October 2026

Scope: code inspection and synthetic expense calculations. No customer records, production Drive files or provider mutations were used. This is not a complete browser or integration review.

| Finding | Outcome |
| --- | --- |
| QA-01 | Dashboard previously summed paid and due together. Paid now drives the budget bar, category and monthly charts. Due, combined total and other statuses are separate. The schema has no partial-payment allocations; unsupported statuses remain unclassified. Two synthetic unit tests pass; integration retest remains outstanding. Existing export/list totals are combined records and were not changed. |
| QA-02 | Historical failures and duplication are not reproduced. The agent performs writes through model-generated SQL and has no durable idempotency mechanism; an uncertain response must not be treated as proof of failure. Needs isolated retry, response-loss and mutation testing and a designed confirmation/idempotency workflow. |
| QA-03 | Category allocations are stored as independent numbers and no overlap rule is enforced. Settings now displays their sum and difference and explicitly notes possible overlap; values are not changed automatically. Browser retest outstanding. |
| QA-04 | A valid `APP_PASSWORD_HASH` overrides the database hash. Settings now hides the ineffective password input and the server rejects password changes while the environment hash is active. Synthetic authentication and route tests remain outstanding. |
| QA-05 | `vercel.json` schedules `30 14 * * 0` (Sunday 20:00 IST). The app records last successful backup only after upload; it does not persist scheduler failures. UI now says this explicitly. Execution logs, Drive contents and isolated restore remain unverified. |
| QA-06 | Work logs accept user-entered text. The review did not establish who wrote the historical content. No historical record was modified. AI draft provenance and placeholder review remain unverified. |
| QA-07 | Active empty state now distinguishes no active tasks from no tasks at all. Browser retest outstanding. |
| QA-08 | Contact edit/delete icon buttons now have names containing the action and contact name. Accessibility-tree and keyboard retest outstanding. |
| QA-09 | Quotation records did not expose unit, rate/total, tax or transport fields. Existing entries now display unknown when unset; new fields are optional and no values were inferred. Mixed-unit browser retest outstanding. |
| QA-10 | Document filtering and revision-status investigation remains open. No migration or Drive permission change was made. |
| QA-11 | Dashboard no longer calls a project “On track” merely because there are no overdue tasks. |
| QA-12 | Navigation research and mobile testing remain open. |

No isolated Postgres/Drive test environment was verified, so write, upload, delete, backup/restore, agent mutation and end-to-end tests were not run. No deployment was made. Before release, establish an isolated environment, complete these tests, verify a restorable production backup, and review the release and rollback plan.

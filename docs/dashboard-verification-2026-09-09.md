# Dashboard verification — 9 September 2026

## Scope

Redesigned the meeting overview and history for a growing workspace. This verification uses isolated `conclavia_e2e_*` databases, simulated meeting-provider behavior and disabled meeting AI. It does not create an external Teams participant or establish real meeting audio/video quality. Existing user records and `.env.local` were not changed.

## Behavior

- Overview contains at most four active meetings, three expandable issues, five upcoming appointments and five history entries. Each section links to its complete list when needed.
- Admissions, stale output connections and uncertain participants require attention. Finished summaries, old inactive failures and missed appointments belong in history. An unresolved external participant remains visible even for an old appointment.
- History and series use 20-item server-side pages. Filters are kept in the URL; date filters use the meeting's local calendar day, including both endpoints. Invalid dates are ignored and reversed bounds are normalized.
- The dashboard projection excludes transcripts, command histories, meeting links and bot access tokens. Overview text is capped at 240 code points. Series appointment counts and next dates are aggregated in MongoDB rather than loading every appointment into the browser.
- Archiving is reversible and retains the original status, URL, agenda and memory. Atomic guards reject active or uncertain participants. A stale entry request cannot create a bot after another request archives the meeting.
- Rescheduling prepopulates a new form but requires a new date. Saving creates a new appointment without modifying the source record. Automatic entry is initially off for the copied appointment.
- Completed meeting details present summary, decisions and actions before the agenda and assistant tools. Editing and the full transcript are optional expansions.

## Targeted checks

All nine dashboard scenarios passed, covering classification, pagination, filtering, archive/undo, rescheduling, series aggregation and desktop/mobile rendering. The separate concurrent archive/entry regression also passed.

The complete application suite passed **77/77 scenarios in 6.1 minutes**. This includes the existing browser speech, gesture, command, memory, debug and lifecycle regressions; it is not 77 real Teams calls. Browser voice checks passed with both the default execution path and CPU-only execution. Local `/meetings` also returned HTTP 200 on the existing development server.

After the final archived-detail label adjustment, all three targeted archive/concurrent-entry/mobile regressions passed again. Final ESLint and the production build, including TypeScript, passed. The build used `.next-build-verify` so the existing development server was not restarted or overwritten.

The pagination fixture contains **250 completed meetings**, each with 20 substantial transcript segments and an oversized overview. Checks verify 20 rows per page, no repeated IDs across the first two pages for this fixed dataset, preserved filters, last-page clamping and a serialized dashboard result below 20,000 characters. This measures the data projection, not the entire HTML/JavaScript network transfer or a production load-test percentile.

The series fixture contains **100 appointments**: 99 completed and one future appointment. The result contains their aggregate counts and next date, not their transcript/history arrays.

Successful English desktop and 390-pixel mobile screenshots were inspected. The README dashboard screenshot is captured from fictional demo records in the isolated database. It is not a real company meeting screenshot.

## Reproduce

```bash
npx playwright test tests/e2e/meeting-dashboard.spec.ts
npx playwright test tests/e2e/meeting-entry.spec.ts --grep 'archiviazione concorrente'
```

To explicitly refresh the English dashboard screenshot:

```bash
CONCLAVIA_CAPTURE_DOCS=1 npx playwright test tests/e2e/meeting-dashboard.spec.ts
```

Test records are removed by exact fixture IDs with an additional title or generated meeting-URL guard. No user database is used.

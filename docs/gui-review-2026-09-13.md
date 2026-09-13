# GUI review — 13 September 2026

## Scope

Simplify three everyday workflows: create/manage a meeting, find its useful outcomes, and configure/test the avatar. Keep the Italian/English interface, existing features and saved data. This review does not change provider integrations, caption recognition or received Teams audio/video quality.

## Changes

| Area | Result |
| --- | --- |
| Navigation | One global New meeting action, hidden on the creation form itself. Smaller mobile logo. |
| Create meeting | Single-meeting Teams link first, language visible with basic details, schedule next, optional collapsed agenda. Existing agenda opens when rescheduling. Switching single/series mode and collapsing the agenda preserve entered values. |
| Save safety | Pending form controls are disabled and a synchronous guard rejects repeated submissions. Failed saves keep the form and enable retry. This is a per-view guard, not new server-wide idempotency. |
| Avatar | Shorter headings/help, smaller mobile previews, explicit Inworld origin and billing notice. Detailed voice/rate/model controls remain under Advanced; preview, save/discard and male/female voice pairing are retained. |
| Assistant | Answer is the default. Summary/Agenda are immediate actions that preserve an unfinished question. Other commands use the input. Requests show progress, reject overlaps and preserve text on failure. Refreshed history merges with acknowledged responses without duplicates. |
| Agenda | Manual completion refreshes server data. New server snapshots supersede the local acknowledged agenda. Concurrent clicks are blocked while an update is pending. |
| Memory | Search now also matches decisions, action descriptions and open questions, including terms absent from the overview. Search input remains regex-escaped; results remain paginated. |

## Verification

- Full automated regression: **223 passed in 3.3 minutes**.
- Five new GUI tests cover Italian/English navigation, desktop and 320px layouts, single/series forms, optional agenda persistence, duplicate submissions, failed-save retry, assistant defaults/quick actions, refreshed history and memory search.
- An initial targeted check exposed the missing refresh after manual agenda completion. That behavior was fixed; the new GUI suite then passed **5/5**, followed by the full regression above.
- TypeScript and ESLint passed. A production build was not repeated in this review.
- Browser inspection covered desktop and small mobile layouts. The full suite also covers existing 390px and larger avatar layouts. Inspected local pages had no page exceptions; the automated run can still emit development/framework warnings.
- English screenshots for the avatar studio and new-meeting form were refreshed using unsaved demonstration inputs. Saved avatar settings were compared before/after capture and remained unchanged.

Automated meeting fixtures use a uniquely named `conclavia_e2e_…` database, preview providers and no paid speech synthesis. Cleanup is restricted to test-owned records. No real meeting was created, joined or left, and no real history or environment settings were changed. This does **not** establish received Teams voice naturalness, lip sync or live response latency; those acceptance checks remain separate.

# Assistant context verification — 13 September 2026

## Delivered

- General context at `/context`, inherited by every meeting in this installation.
- Series context on series details, dynamically inherited by existing and future linked appointments.
- Meeting context on appointment details; optional collapsed notes during creation and preserved when rescheduling.
- One editor pattern with explicit save/discard, bounded text, inherited-source previews and revision conflicts that preserve the user's draft. Source-edit links open separately so following them does not discard the current draft.
- Simpler navigation and detail-page shortcuts; optional context and continuity stay out of the main action flow.
- Shared, scoped background in all AI answer/check/summary, proactive intervention and final-memory prompts. Meeting-specific background refines series and general background; actual transcript evidence and recorded outcomes remain separate.

The instruction/input separation follows the official [OpenAI prompt guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#message-roles-and-instruction-following). Background can supply terminology and working preferences, but cannot replace application rules or invent meeting decisions. Changes apply on the next generation; already prepared or playing responses are not regenerated.

## Checks

| Check | Result |
| --- | --- |
| Complete Playwright regression suite | 240 passed in 3.7 minutes |
| Context GUI/API suite | Final rerun: 10 passed in 18.3 seconds; persistence, inherited scopes, isolation, legacy records, conflicts, failed saves, creation and public-access boundaries |
| Prompt plumbing suite | 5 tests execute the actual orchestration with model/database boundaries replaced and inspect the request inputs/rules |
| Added contextual-turn regressions | Exact arithmetic statement then “Ehi Riccardo, dimmi”; pending correction released, transcript unchanged; punctuation-only requests rejected |
| TypeScript / ESLint | Passed |
| Production build | Passed with isolated `.next-build-verify` output, test database, preview provider and AI disabled |
| Local management routes | Health, `/context` and `/api/context` returned HTTP 200; read-only checks |
| Visual inspection | General-context page at 1440 px and 320 px, without horizontal overflow |

The context tests use a database restricted to the `conclavia_e2e_` prefix and clean up their own fixtures. The production build does not replace the running development output. Temporary build-generated TypeScript path changes were restored afterward. No actual meeting context, voice profile, original transcript, environment value or live participant was modified for these checks.

## Boundaries

- Prompt tests prove consistent context delivery and scope isolation, not that a real model always reasons correctly. No new paid model/speech call or admitted Teams conversation was performed.
- The “Ciao Riccardo” → “Charlie cardo” speech-recognition report remains separate and unresolved. The parser correction is not speech-to-text acceptance; see [recognition evidence](caption-recognition-2026-09-13.md).
- Receiver-side audio naturalness, latency and lip sync have not been newly validated here.
- Context is limited to 8,000 characters per scope; longer prompts consume more input and can affect latency. There is no upload, automatic context generation or retrieval index in this change.
- This remains one shared workspace. General context is not tenant-isolated; company deployment needs authenticated ownership and tenant-scoped data access. Context is blocked from the public tunnel's management routes and excluded from the avatar-rendering response.
- Deterministic greetings, presence checks, agenda actions, explicit fact storage, elementary arithmetic and release of a prepared intervention do not invoke a model or accept custom prompt overrides.

## Repeat locally

```sh
npm run typecheck
npm run lint
npm run test:e2e
npm run test:e2e -- tests/e2e/assistant-context.spec.ts tests/e2e/context-prompts.spec.ts
```

Use the existing isolated test configuration, not the live meeting database. See the [README](guide.md#assistant-context) for usage and [Cloudflare setup](guide.md#public-connection-for-a-local-teams-test) for real meeting connectivity.

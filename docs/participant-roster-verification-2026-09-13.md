# Participant presence and matching names — 13 September 2026

## Scope

Detect a human sharing the avatar's invocation name, even when that human was already in the call when the bot entered. Keep initial synchronization distinct from later join/leave events. Do not rename the avatar or start additional participants automatically.

The implementation adds an attempt-scoped roster, ID/timestamp-based merges with compare-and-swap persistence, bounded paginated recovery, a 30-second leased poll, and a compact bilingual management-GUI panel. Initial unknown, synchronized and stale states are distinct. Detected name collisions suspend transcript commands; explicit management controls remain available. Provider failures keep previously detected collisions. Unknown alone is not a blanket voice block.

Raw captions and historical participants are not deleted or rewritten. Participant IDs disambiguate human speakers; echo quarantine still uses playback evidence. Roster IDs and provider credentials are not exposed by the new management endpoint or public avatar state.

## Evidence

- The first focused suite passed **26/26 tests in 22.0 seconds**. It covers identity, name boundaries/variants, late and duplicate events, initial history, safe pagination, failed synchronization, concurrent persistence, stale attempts, webhook ingress, collision gating, GUI command fallback, duplicate-name speakers and Italian/English desktop/mobile UI.
- A read of the existing local live meeting returned a synchronized roster containing **Vincenzo Giacchina**, with no matching name detected. No bot was created, no voice synthesis requested, and the existing tunnel was left running. This proves recovery of an already-active call's participant history, not a live two-human namesake test.
- The final complete regression passed **318/318 tests in 4.3 minutes**, with no retries or skips. This includes **29 participant-roster cases**, adding monitor-only recovery of a missing leave callback and races against stop/replacement/concurrent webhook delivery.
- TypeScript and ESLint passed; **23/23 tunnel-launcher tests** passed. Production build passed with isolated `.next-build-verify` output and a `conclavia_e2e_` database, preview provider, AI disabled and no Inworld key. Build-generated TypeScript paths were restored afterward.
- A browser check on the existing live meeting confirmed the Italian status panel and expandable participant name in the actual GUI. It made no speech request and did not recreate or remove the live bot. Automated browser tests separately cover a namesake warning and its removal, including a 390px English viewport.

## Limits kept explicit

The roster is reconstructed from Attendee events, not an authoritative completeness guarantee. Display-name changes without events, delayed/missing data and ambiguous spoken addressees can still occur. A real call with two humans sharing the invocation name has not been performed during this change.

The earlier merged-caption prefix defect (“Sì, Riccardo, dimmi”) and contextual selection between multiple unrelated statements are **not fixed by this change**. Do not confuse roster verification with semantic intent classification, microphone-to-caption accuracy, or audible Teams voice/video verification.

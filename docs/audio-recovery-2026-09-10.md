# Audio recovery, 10 September 2026

## Reproduced and corrected

- A browser fixture streams two 500 ms PCM blocks, with the second arriving after 620 ms. The previous 40 ms scheduling policy inserted a measured 17.33 ms gap in the baseline run. With the new 180 ms cushion the same test schedules contiguous audio. This demonstrates a player defect, not the sole cause of every reported Teams glitch.
- On-time blocks are no longer moved forward merely because they are inside the old 40 ms scheduling margin. Actual underruns increase the cushion by 100 ms, capped at 500 ms; they are counted rather than hidden.
- Lip animation and completion follow `getOutputTimestamp()` with a latency-based fallback. This accounts for browser output latency, not downstream Teams video/audio synchronization.
- The configured Dennis voice was identified as English by Inworld's read-only voice catalog. Gianni is listed as an Italian male voice. Italian requests now use `INWORLD_VOICE_ID_IT` (default Gianni); English retains `INWORLD_VOICE_ID` (default Dennis). No existing credential or `.env.local` was modified.
- Preview shows the effective voice and local buffer/animation metrics. The model selector is correctly labelled as a model, not a voice.

## Real provider samples

Known phrase only: “Ciao, sono Riccardo. Ti sento, dimmi pure.” Three Dennis samples and three Gianni samples used the real local preview API and Chrome; no Teams participant was created.

| Voice | Model | Browser audio start | Buffer underruns | Max animation interval |
| --- | --- | --- | --- | --- |
| Dennis | Flash, first | 1.51 s | 0 | 33.5 ms |
| Dennis | Flash, repeat | 0.48 s | 0 | 33.4 ms |
| Dennis | TTS-2 | 0.66 s | 0 | 33.4 ms |
| Gianni | Flash, first | 1.31 s | 0 | 33.5 ms |
| Gianni | Flash, repeat | 0.76 s | 0 | 33.4 ms |
| Gianni | TTS-2 | 0.68 s | 0 | 33.5 ms |

All streams completed, contained non-silent PCM and produced mouth-shape changes. Provider phoneme times progressed cumulatively with audio duration in these samples; no per-chunk timestamp reset was observed. These are six observations, not statistically significant model comparisons or a latency SLA. Callback intervals are not encoded video FPS. Naturalness was not established by automated measurements.

## Verification boundary

Final regression: **166 passed in 6.6 minutes**, including memory, agenda, wake/permission fixtures, entry/exit state, streaming authorization, jitter absorption, measured underrun, output clock, Italian/English voice routing, stop/replay and legacy local speech compatibility. ESLint, TypeScript (also without incremental writes) and `git diff --check` passed. No new production build was run in this repair. The initial focused run had one stale test selector after the UI label changed from voice to model; its selector was corrected and the final full run passed.

Public tunnel health returned 200; public management `/meetings` and `/api/avatar/speech` returned 404 as intended. The local preview returned 200 and included the Italian Gianni configuration. These are reachability/isolation checks, not real meeting acceptance.

The previous real bot already reported `left` and the meeting was completed when checked. No new real admission or receiving-side recording was performed during this repair. A local preview does not test Cloudflare, Attendee capture, Teams resampling/encoding, or a receiver's network/device.

The next real acceptance test must record received audio and video together, measure end-of-question to audible response, check uninterrupted Italian speech and compare visible mouth movements with the received sound. Recognition of microphone input is a separate gate; the earlier merged-greeting trigger issue is not fixed by this audio change.

Run `node scripts/verify-streaming-voice.mjs --compare` for the paid local provider smoke test. Default Playwright tests use isolated fixtures and do not call the paid provider.

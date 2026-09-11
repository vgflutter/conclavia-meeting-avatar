# Streaming voice verification — 10 September 2026

Later update: the [audio recovery report](audio-recovery-2026-09-10.md) records a reproduced buffering defect, output-clock correction, separate Italian Gianni voice and six additional real provider samples. The Dennis setup and measurements below describe the earlier implementation.

## Implemented

- Inworld TTS-2 Flash, with TTS-2 available for comparison in the avatar test page.
- Server-side credentials; streamed 24 kHz PCM, without downloading a speech model in the output browser.
- Playback starts while subsequent audio is still arriving. Phoneme timings and a PCM silence gate drive the mouth on the audio playback clock.
- Stop cancels network streaming and scheduled audio. An interrupted answer is not automatically repeated or marked complete.
- Meeting speech accepts an existing command ID and active meeting attempt, not client-supplied text. Stopped attempts, unknown commands and the currently completed command are rejected.
- Per-process concurrency and request limits. Shared production quotas and authenticated ingress remain deployment requirements.
- Preview latency measures click-to-first-non-silent-audio in that browser, not microphone-to-speaker latency in Teams.

## Checks performed

| Check | Result |
| --- | --- |
| Production build | Passed, including TypeScript and route generation |
| TypeScript without incremental writes | Passed |
| ESLint | Passed |
| Whitespace check | Passed |
| Focused regression run | 21 passed, 34.7 seconds |
| Initial full regression run | 99 passed, 2 failed, approximately 7.7 minutes |
| Isolated legacy CPU rerun, unchanged timeout | Passed, approximately 1.9 minutes |

The focused run includes 20 streaming tests and the corrected single-meeting workflow test. It covers incremental delivery, fragmented NDJSON, PCM decoding, phoneme/silence alignment, upstream cancellation, provider errors, missing configuration, admission limits, active-attempt authorization, browser playback, stop/replay, model selection, truncated audio and English mobile layout. Provider responses were controlled test streams: **this is not a live Inworld audition**.

The initial full-run failures were:

1. An existing API response-shape assertion expected only `status`. It was updated for the new sanitized `voice` metadata and passed in the focused rerun.
2. The legacy Supertonic CPU-only test did not prepare an intervention within its 180-second assertion window. An isolated rerun passed without changing the code or increasing the timeout: three playback completions were observed, synthesis took 5.26 and 4.20 seconds, and the permission-to-playback interval for an already-prepared correction was 1.33 seconds. The initial failure remains a cold-start/flakiness concern; its precise cause was not established, and these local measurements do not establish Inworld or Teams latency.

Both initially failing cases subsequently passed in targeted reruns. The complete suite was not rerun as a single final batch.

The E2E runner uses a separate database, a preview meeting provider, disabled AI calls and an empty Inworld credential. No paid voice requests or Teams participants were created by these tests. The existing `.env.local` was not replaced or edited.

## Live Inworld preview — after credential setup

The user subsequently configured the credential in the existing `.env.local`. An opt-in live preview used the real provider and the actual browser playback path, with the Italian phrase `Ciao, sono Riccardo. Ti sento, dimmi pure.` No meeting was created or joined.

| Trial | Model | Request to first PCM frame | Browser audio start |
| --- | --- | --- | --- |
| First successful request | TTS-2 Flash | 621 ms | 0.95 s |
| New preview page | TTS-2 Flash | 380 ms | 0.71 s |
| Repeated request on the same page | TTS-2 Flash | 240 ms | 0.30 s |
| Comparison on the same page | TTS-2 | 488 ms | 0.60 s |

Each request returned HTTP 200, eight or nine PCM frames and 40 phonemes. All scheduled buffers completed, non-silent PCM was measured, and the avatar changed among consonant, vowel, closed-mouth and resting shapes. These four short samples are observations, not a latency SLA or a statistical model comparison. They do not measure Teams captioning, reasoning or remote receiver delay, and do not establish perceived naturalness.

The first real GUI attempt exposed a 403 before any provider request: Next normalized `request.url` to `localhost` while the browser used `127.0.0.1`. The origin guard now compares against the actual Host header and does not trust a supplied forwarded host. A regression checks real browser requests, loopback/LAN hosts, protocol mismatches, cross-site requests and forged forwarded headers. After the fix, 21 streaming/security regressions passed in 16.8 seconds; lint, TypeScript and production build passed again.

Reproduce the paid smoke test explicitly against the running local server:

```sh
node scripts/verify-streaming-voice.mjs
# Three short requests: two Flash, one TTS-2.
node scripts/verify-streaming-voice.mjs --compare
```

These scripts incur provider usage, print only diagnostic metrics, and never read or print the credential. They do not create Teams participants. Default E2E tests continue to disable paid provider calls.

## Remaining live acceptance checks

1. Listen to Flash and TTS-2 with the same Italian phrases. Choose the voice after listening; `Dennis` is only the documented starter voice.
2. Extend latency measurements to factual answers, multi-sentence summaries and English responses.
3. Restore the existing bot's output page, without creating a duplicate participant. Test its audio from a receiving Teams participant, not only the debug transcript.
4. Verify mouth closure during silence, phoneme timing during speech, interruption/stop, hand-raise permission and queued replies in Teams.
5. Measure the complete question-to-audible-response interval. Teams caption delay is still upstream of synthesis and is not removed by changing TTS.

The integration is ready for these checks; production readiness and a sub-second or other end-to-end latency target are not claimed.

# Playback and documentation review — 13 September 2026

## Delivered fixes

- **Voice accent:** the streaming request previously forced `en-US` even for the British catalog voices Alistair, Olivia and Eleanor. It now uses `en-GB` for those voices, `en-US` for US voices, `it-IT` for Italian speech, and neutral `en` for an unknown custom English voice. Explicit preview overrides and configured defaults use the same mapping. Saved appearance/voice/rate preferences are not changed. [Inworld multilingual documentation](https://docs.inworld.ai/tts/capabilities/multilingual) explains regional language codes and native accents. This fixes a request mismatch, not the subjective naturalness of every voice.
- **Late echo evidence:** `source: participant` was stored on receipt and then trusted forever, even after a playback acknowledgement became available. It is now reconsidered against the original speech timestamp and confirmed playback window. Confirmed avatar/suspected-echo classifications remain preserved after history trimming. Short/additional human speech and out-of-window matches remain eligible. Original caption text and speaker names are never rewritten.
- **Meeting audio diagnostics:** the renderer previously discarded the metrics already available in local voice previews. Completed meeting commands now retain bounded numeric browser metrics, with current-attempt/command validation and idempotent writes. Optional debug reveals them in collapsed details without adding controls to the normal meeting flow.
- **Documentation:** the short README covers startup, safe shutdown/costs, capabilities and known limits. The extended guide preserves all figures, configuration, architecture, Cloudflare recovery, company-deployment requirements and detailed checks. Existing report deep links now target the guide.

## Real Inworld preview probes

Three sequential, explicitly paid short syntheses used the saved Italian voice **Cuoco** (`community-kvd4dbkrdpds`) in Chrome. No saved preference was changed; no Attendee bot was created. Phrase: “Ciao, sono Riccardo. Ti sento, dimmi pure.”

| Run | Model | First audio in browser | Buffer underruns / gap | Longest animation gap |
| --- | --- | --- | --- | --- |
| 1 | TTS-2 Flash | 1,080.5 ms | 0 / 0 ms | 33.4 ms |
| 2 | TTS-2 Flash | 580.7 ms | 0 / 0 ms | 33.5 ms |
| 3 | TTS-2 | 664.7 ms | 0 / 0 ms | 33.5 ms |

All three returned HTTP 200, completed streaming and browser playback, produced non-silent PCM and supplied phoneme alignment. Each contained nine audio frames and 40 phones; mouth shapes changed during playback. The tiny sample is not a model ranking or a latency percentile. Naturalness was not certified by listening, and these timings exclude input recognition, response generation, queueing and the remote Teams receiver.

## Regression checks

The new provisional-attribution and regional-accent cases reproduced failures before their fixes. The corrected source/streaming/browser suites passed **48 tests**. The final complete repeat passed **269/269 tests in 3.5 minutes**, including the renderer-to-database-to-debug path, late-acknowledgement attribution, named/contextual turns, male/female rigs and permission-gated audio queues. The **23/23 tunnel-launcher tests**, TypeScript, ESLint and isolated production build also passed. A local documentation check validated **85 file/anchor/image references across 19 Markdown files**.

The new browser-to-debug test initially clicked the zero-height `body` of the fixed-position video layout, then incorrectly spread a Mongoose subdocument into an HTTP fixture. Both were test-fixture mistakes, not relaxed application checks: it now clicks the visible video surface and serializes the stored metrics as JSON. The endpoint continues rejecting malformed, extra, out-of-range, wrong-attempt and wrong-command reports.

The first full run passed 268 of 269 cases: one pre-existing routing assertion expected `en-US` for Eleanor, the request mismatch being corrected here. That assertion now requires `en-GB`, consistent with the British catalog voice and the new provider-payload cases. No latency threshold or speech-permission check was weakened.

## Still requires live evidence

- **“Ciao Riccardo” → “Charlie cardo”: unresolved.** The current backend reads Teams captions. Attendee documents that platform captions lack automatic language detection; an API acknowledgement does not prove the language actually applied in Teams. Compare the actual Teams spoken-language setting, a spoken sample and the original provider caption. No alias, fabricated response, transcription substitution or additional paid STT provider was introduced. [Attendee transcription](https://docs.attendee.dev/guides/transcription), [recognition investigation](caption-recognition-2026-09-13.md).
- **Receiver-side quality and sync:** a healthy public page and browser metrics cannot certify what another participant hears/sees. Need a current meeting, admission and receiver observation; none was supplied during this review. [Attendee voice-agent architecture](https://docs.attendee.dev/guides/voiceagents).
- **Echo:** reconsideration protects subsequent context/summary generation but cannot undo an already executed command or retrospectively regenerate historical summaries. A genuine human repetition during playback can still be ambiguous.
- **Company deployment / native hand:** stable hosting and company authentication remain outside this local PoC. The hand is an avatar animation, not the native Teams hand control.

## Local runtime

The existing authorized app and Cloudflare Quick Tunnel were restored. A later connection check caught loss of reachability; the launcher-owned processes were stopped and restarted after checking that the app had no active meetings. The regenerated public address is stored only in the local environment, not hardcoded in documentation. Keep the launcher terminal open and the Mac awake; use `npm run tunnel:check`, or restart the launcher with `npm run tunnel` after stopping its old instance. Closing the tunnel does not terminate remote bots.

The final token-free check passed public health and management-route isolation. An additional public avatar/JavaScript preflight using an existing meeting capability was blocked by the execution safety reviewer because it would send that capability to the tunnel. It was not retried or bypassed; specific approval was requested. This review therefore does not claim that that extra public avatar check was executed.

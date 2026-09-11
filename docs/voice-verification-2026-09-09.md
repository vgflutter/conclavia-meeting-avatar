# Voice and lip-sync verification — 9 September 2026

## Result and scope

All **85 E2E tests passed in 7.0 minutes** on the final source, using the isolated test database and preview meeting provider. Lint, TypeScript, diff whitespace checks and the separate production build also passed. A separate Chrome run verified real speech and complete playback from that production build on port 3102; the temporary server was stopped afterward.

These checks did not join Teams, capture a microphone, change the saved voice profile, enable cloud TTS, or modify the user's meeting history or environment file. They establish browser behavior, not what a remote participant hears. **Perceived naturalness is not considered resolved or independently listening-validated.** The existing Supertonic 3 model, voice presets and eight generation steps remain unchanged.

## Corrections

- Model inference runs in a dedicated Web Worker, including the single-threaded WASM fallback. UI animation no longer shares the inference thread. ONNX's proxy option remains disabled; see its [worker and execution-provider guidance](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
- Both preview and meeting playback sample the actual media clock against a 10 ms PCM envelope. Silence closes the mouth, amplitude adjusts opening, and CSS transitions no longer add delay to audio-driven mouth shapes.
- Short replies, including greetings, are synthesized together instead of restarting prosody after every short sentence. Longer replies prefer sentence and clause boundaries within 280-character chunks.
- Each vocoder phrase is trimmed before concatenation. Padding no longer accumulates between phrases or causes the final phrase to be cut short. Duration derives from the exact PCM sample count.

Text still supplies approximate visemes over voiced time. This is **not phoneme alignment**: there are no model-provided word/phoneme timestamps, and a change to the mouth envelope is not a change to the synthesized timbre.

## Measurements

| Check | Final observation |
| --- | --- |
| Prepared correction, permission webhook to browser playback | 828 ms WebGPU; 827 ms CPU |
| UI frame interval during generation, p95 | 16.7 ms WebGPU; 16.8 ms CPU |
| Ordered output | Three complete, unmuted playbacks on each backend; two generated clips because identical confirmations reuse the cache |
| Generated waveform | 44,100 Hz; non-silent PCM; duration consistent with sample count |
| Separate production run | One 4.476-second clip completed; RMS 0.0553; zero page JavaScript errors |
| Production cold start through first playback | 120,647 ms, including first-use loading; not a warm-response measurement |

The CPU denoising/vocoder intervals observed through generation progress were about 4.2–5.8 seconds for the tested clips. They exclude loading and initial encoder/duration prediction, and are not microphone-to-response latency. The worker removes UI blocking; it does not make CPU inference faster or eliminate cold startup. Local WebGPU availability must not be assumed for Attendee's hosted browser.

## Regression coverage

Added eight cases: silence and media-clock sampling at four sample rates; empty/quiet input; short-reply grouping and numeric preservation; per-phrase padding/tail integrity; and browser playback using a controlled PCM fixture, including an internal silence, completion, stop and replay. The real Italian/English preview and both ordered-output tests now also observe actual audio, generated samples and UI frame intervals. The controlled PCM case is explicitly synthetic and is not counted as real TTS quality evidence.

An intermediate development run was interrupted by live recompilation while a production build updated TypeScript configuration. Another new assertion incorrectly expected three inferences for three playbacks despite the speech cache; it was corrected to verify three completed audio elements. The final 85-test run occurred without source/build changes and passed in full.

The production browser screenshot is a local test artifact at `/private/tmp/conclavia-voice-production-speaking.png`. Runtime-generated test artifacts remain outside Git. The attempted private-management check through the real tunnel was blocked by the safety reviewer; no workaround was used. Public-route isolation passed against synthetic local test requests, which is not a fresh external-tunnel verification.

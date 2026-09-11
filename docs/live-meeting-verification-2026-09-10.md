# New Teams meeting verification — 10 September 2026

## Latest result: fourth attempt admitted, received audio confirmed

The fourth sequential attempt was admitted and began listening at **08:31:09 UTC (10:31:09 Rome)**. The organizer confirmed admission, then explicitly confirmed hearing “Ciao Vincenzo, sono Riccardo. Questa è una prova audio.” This establishes real received Teams audio for that response. It does **not** yet establish reliable microphone-triggered conversation or acceptable perceived lip sync/video quality.

No fifth participant was created. The successful entry used the normal deadline; no diagnostic extension was applied. A provider acknowledgement of a playback command is kept separate from the organizer's confirmation below.

### Live findings and fixes

- The renderer reported fresh heartbeats, voice readiness and completed speech. The direct audio test command took 2,723 ms to return; its stored timestamp was 08:34:23.595, renderer speaking acknowledgement 08:34:27.527 and completion 08:34:31.928 UTC. These timestamps include transport/acknowledgement delays, not a receiver-side audio-onset measurement.
- Initial captions were clearly misrecognizing Italian as English-like text, despite `teams_language: it-it` in the create request. On the same bot, two supported language-update calls (English at 08:37:36, Italian at 08:37:38 UTC) forced a change back to Italian. Subsequent captions were Italian. This was a one-off live recovery, not the automatic behavior shipped in the app.
- Published Attendee code skips a same-value caption update. Its startup fallback can enable captions without applying the requested language. This is a plausible explanation for the observed discrepancy, not proof of the exact hosted-provider execution path. New entries now defer the language PATCH until listening is confirmed, use a persisted three-attempt limit, report failure visibly, and never temporarily switch to another language. **That new startup strategy still needs a fresh real-admission test.**
- A merged caption ending in a new sentence, “Guarda, è così? Ciao Riccardo.”, was ignored. The wake parser now recognizes a new direct-address sentence after a sentence boundary; reported speech and quotations still do not grant commands or speaking permission. Ambiguous comma-only narration remains conservative rather than treating every mention of Riccardo as an instruction.
- “Ok tre per tre fa 12.” missed the cheap arithmetic detector. It now tolerates a short introductory filler while still rejecting negations, quotations, questions and decimals. An incorrect assertion proposes an intervention; it does not grant itself permission to speak.

### Commands sent from Conclavia to the live participant

Each command was sent only after the preceding renderer playback completed. These exercise real AI/voice where applicable and the live output transport, **not the user's microphone or wake-word path**.

| Check | Command HTTP time | First observed speaking acknowledgement | Completed |
| --- | ---: | ---: | ---: |
| Presence / “Mi senti?” | 26 ms | 3,019 ms | 6,034 ms |
| Save test budget: €42,000 | 21 ms | 3,016 ms | 6,065 ms |
| Retrieve that budget | 974 ms | 3,014 ms | 7,012 ms |
| Read next agenda item | 30 ms | 1,854 ms | 8,941 ms |
| Check contradictory €41,000 claim | 955 ms | 3,402 ms | 9,962 ms |
| Meeting summary | 1,851 ms | 4,014 ms | 27,059 ms |

Speaking/completion columns are polling observations from the start of each request and are not precise audible latency. All six commands completed on the renderer. The summary preserved the budget and remaining agenda. The verification response cited the correct stored €42,000 but began with “Non verificabile”; its wording is not a clean definitive contradiction verdict. The test budget remains in this test appointment intentionally. Unrelated conversation is not reproduced in this report.

### Regression verification after the live findings

- The new merged-sentence trigger cases reproduced the previous failure: two failed and the quotation-protection case passed before the fix.
- Trigger/lifecycle/output suite after the trigger fixes: **84 passed in 34.5 seconds**.
- Same suite with deferred-language adapter, persistence, retries, concurrency, stale-attempt and GUI-warning coverage: **93 passed in 42.7 seconds**.
- ESLint and TypeScript checks passed after the language changes.
- Complete suite after all code changes: **160 passed in 6.7 minutes**, with no failed cases. These runs use isolated data and simulated provider calls; local voice tests synthesize and play real audio. Prepared correction-to-audio was **830 ms on GPU / 816 ms on CPU**, after voice preparation and permission. All three checked playbacks in each backend completed unmuted with non-silent output. These are local-browser metrics, not Teams receiver-side latency. ESLint, TypeScript and `git diff --check` passed again.
- The local server was restarted with the system-CA launcher to load the updated background monitor. The same public tunnel and existing participant were retained. At 08:56:21 UTC, public health was 200, public management 404, Attendee reported `joined_recording`, and the renderer again confirmed a fresh heartbeat and voice readiness. No new participant or language change was sent to the already-recovered session during this restart.

## Earlier result: first three attempts failed

**The real Teams conversation did not pass acceptance.** Three sequential external Riccardo participants were tested in the user-provided new meeting. Each subsequent attempt was created only after the provider confirmed termination of the previous one. None received joined/recording or waiting-room state before the application's two-minute deadline. The watchdog requested departure; Attendee confirmed `left_meeting` and then `ended` for all three. No transcript, renderer heartbeat, or speech playback was received. The organizer reported seeing and accepting the latest admission request, then seeing Riccardo disappear. The precise admission time is unknown.

The new test meeting remains in local history as failed, not falsely live. There were no overlapping non-terminal sessions according to Attendee, nor automatic retry loops. However, the organizer's screenshot showed two Riccardo entries marked as leaving in Teams. Provider termination does not prove immediate disappearance from the Teams participant list. No Teams admission policy was bypassed.

## Findings and recovery

1. Public health returned 200; public management `/api/meetings` returned 404.
2. The initial request could not establish verified TLS to Attendee: Node reported `SELF_SIGNED_CERT_IN_CHAIN`. The running development server had been restarted without the previously documented system-CA preload. Loading the operating system's existing authorities restored verified HTTPS (an unauthenticated request returned the expected 401).
3. The application incorrectly classified this pre-request TLS failure as uncertain bot creation, retaining a room claim. Two authenticated read-only queries to Attendee returned an empty, unpaginated bot list for this test's deduplication key. Only this newly created test record was recovered after these checks. Credentials and other meeting history were preserved.
4. The server was restarted with the existing system-CA preload. No certificate was installed, downloaded or blindly trusted; TLS verification remained enabled. The existing Cloudflare tunnel and `.env.local` were retained.
5. The subsequent create call succeeded. Provider events, in UTC:
   - 07:31:36: `join_requested`.
   - 07:33:34: `leave_requested`, after the application's deadline.
   - 07:33:41: `left_meeting`.
   - 07:33:43: `post_processing_completed` / `ended`.
6. A controlled retry used the same local appointment after the first bot was confirmed ended. Its UTC events were `join_requested` at 07:49:21, deadline-triggered `leave_requested` at 07:51:24, `left_meeting` at 07:51:31 and `ended` at 07:51:33. It produced no transcript or media-ready confirmation either.
7. At the organizer's request, a third attempt began at 07:58:59 UTC. The application requested exit at 08:01:04.641; Attendee recorded `leave_requested` at 08:01:05.106 (10:01:05 in Rome), `left_meeting` at 08:01:10 and `ended` at 08:01:14. The `user_requested` subtype refers to the application's leave API request, not evidence that the organizer rejected admission. The organizer subsequently confirmed admitting Riccardo. Attendee never reported that admission; without its exact time, acceptance during an already-running departure cannot be ruled out. A later, organizer-requested fourth attempt succeeded as recorded above.

The provider's ordinary bot-detail API did not return a more specific joining error or a debug screenshot. A separate, non-participating Chrome check loaded the public Teams invitation page but did not establish meeting access. It is not evidence of admission or media availability on Attendee's infrastructure.

## Permanent corrections

- Recognize specific certificate-validation failures as definite non-creation: show a meaningful HTTPS error, release the room claim and allow a retry after trust is restored.
- Continue to treat connection resets and timeouts as ambiguous. They must not trigger duplicate POSTs.
- Disallow provider redirects so a TLS failure cannot refer to a second endpoint reached after the original POST.
- Add `npm run dev:system-ca`, an explicit launcher that loads existing system authorities and propagates the preload to Next's child processes. Use this command for subsequent restarts on this managed Mac. Plain `npm run dev` retains normal Node trust behavior.
- Fix a separately reproduced admission/deadline race: an admission confirmed near the initial deadline now gets a bounded 60-second listening-startup grace. The old deadline is never shortened; repeated polls do not extend the grace, an already-requested exit still wins, and missing admission confirmation still times out. This does **not** establish that the third real attempt is fixed: its provider admission event was absent.
- Distinguish confirmed admission from listening startup in the GUI. A timeout message now states that the service did not confirm entry and the application requested departure, instead of implying that the organizer necessarily failed to admit the bot.

## Verification

- Admission grace regression: both new cases failed against the previous implementation (premature departure / failed instead of live). After the correction, the complete lifecycle/output suite passed **47 tests in 37.6 seconds**, including replayed state events, late startup success, bounded startup failure, explicit-stop precedence and duplicate protection. These use isolated fixtures and a simulated provider, not a new Teams participant.
- Targeted lifecycle/output suite: **45 passed in 27.9 seconds**, including three certificate failures and an ambiguous-reset regression.
- ESLint and TypeScript: passed.
- Launcher help smoke test: passed without starting a second server.
- Full suite: **144 passed / 1 failed in 7.8 minutes**. The failed local-voice test started its 90-second intervention lifetime before downloading the cold speech models. Trace evidence shows the two largest downloads took **46.1 and 37.4 seconds**, in addition to earlier model downloads and initialization; the proposal expired before preparation finished. The CPU case passed.
- Corrected the test to exercise the actual meeting renderer's voice warmup and wait for operational readiness before proposing a correction, with real microphone access disabled. The application's 90-second intervention expiry remains unchanged. The full reliability file then passed **10 tests in 3.6 minutes**, including GPU and CPU playback, queue ordering and permission gating. Prepared correction-to-audio was **815 / 822 ms** in the local browser. The entire 145-case suite was not rerun after this test-only correction.

### Real voice provider, local browser

One Inworld Flash request passed: first PCM **721.5 ms**, first browser audio **1.08 s**, nine audio frames, 40 phoneme alignments, non-silent output and completed playback. Mouth shapes followed phonemes. These are local-browser measurements, **not Teams receiver-side latency or a subjective voice-quality assessment**.

### Real AI and memory, temporary fixtures

Nine command checks passed: presence, storing a fact, reading/completing the agenda, retrieving owner and delivery date from a previous linked meeting, English response, unknown fact, and a summary preserving budget/date/responsibility. Temporary fixtures were removed afterward; they did not create external meeting participants.

Observed command HTTP times: memory/agenda **19–31 ms**, known owner **3,336 ms**, delivery **1,032 ms**, English answer **999 ms**, unknown fact **1,138 ms**, summary **2,291 ms**. The initial deterministic presence command took **1,263 ms** including initial route loading. These measurements were taken while the isolated regression suite was running and are not a clean production latency benchmark.

Two real-AI proactive checks with **synthetic transcript callbacks** passed: correction of a conflicting stored budget and a relevant assigned test-owner reminder. Proposals took **2,987 / 2,995 ms**; permission-to-stored-response took **31 / 498 ms**. Both waited for permission. This does not certify microphone transcription or native Teams hand raising.

## Remaining acceptance gate

Admission and the received test voice are now confirmed. Still required: fresh microphone-triggered question/answer and memory/agenda flows after the fixes, received video and lip-sync quality, measured receiver-side latency, permissioned proactive contributions, and clean exit/reentry with the new deferred-language startup. The user was asked for fresh spoken presence and budget questions; no new matching voice phrases had arrived at the last check. Local/synthetic tests and API-command playback do not substitute for those acceptance steps.

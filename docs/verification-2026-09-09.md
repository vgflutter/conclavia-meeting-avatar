# Meeting assistant verification — 9 September 2026

## Result and scope

Two real Attendee join attempts were made sequentially against the Teams room supplied for this test. Departure was confirmed for both, including automatic cleanup of the second stalled attempt. Neither attempt reached listening readiness or delivered a transcript. **A working Teams conversation, audible remote voice, and remote avatar quality are not verified by this run.**

Application tests, real AI checks, and real local speech checks passed separately. All work ran from `conclavia-meeting-avatar`; the historical backup, credentials, and existing user meeting history were preserved. No simultaneous replacement bot was created. Only temporary test meeting records were cleaned up.

## Real Teams lifecycle

One temporary local meeting was reused for both attempts. Times below are UTC, from observed provider state and application records.

| Check | Observation |
| --- | --- |
| First entry, approximately 07:58:44 | The provider accepted creation; state remained `joining:join_requested`. |
| Repeated entry request during that attempt | HTTP 409; no second participant was created. |
| Explicit exit, approximately 08:00:17 | The application accepted the request in 395 ms. This acknowledgement was not treated as departure. |
| First confirmed departure | `left_meeting` at 08:00:26.501; terminal processing completion was observed 15.6 seconds after requesting exit. |
| Re-entry after terminal confirmation | HTTP 200 in 688 ms; a new provider bot and attempt were created for the same local meeting. |
| Second attempt | Remained `joining:join_requested`, with zero transcript segments and no listening readiness. |
| Automatic timeout cleanup | Exit requested at 08:03:26.039 with `join_timeout`; departure confirmed at 08:03:33.102. Terminal completion was observed approximately 140 seconds after starting the attempt. |
| Final GUI state | Confirmed-exit message visible; retry and delete available; no indefinite “exit in progress” message. |

The two-minute entry deadline is checked by a periodic monitor; provider departure takes additional time. It is not a promise of complete departure at exactly 120 seconds.

No accessible authenticated organizer session was available to admit the participant. The provider state alone does not establish whether the remaining problem was admission, Teams UI recognition, or media initialization. The test did not bypass the lobby or change the meeting's access policy. Further repeated paid attempts under the same conditions would not verify speech or transcription.

## Bugs reproduced and corrected

### Retry inherited the previous attempt's provider state

The real re-entry response initially combined a new `joining` state with the preceding bot's terminal provider status. Atomic entry claims now also clear the previous provider status, output URL, and schedule. A lost creation response must not restore or expose those previous-attempt values.

Two targeted regression tests failed before this correction. Afterward all 19 entry scenarios passed three consecutive times, including the new ambiguous-creation retry case.

### A spoken summary omitted the current action owner

One real AI run omitted **Marco Bianchi**, although his testing assignment had been remembered during the current meeting. Budget and delivery date were retained, so checking only those details would have missed the defect.

Summary instructions now prioritize current commitments and their named owners, confirmed decisions, amounts, and dates. A separate current-commitment context is bounded to 1,200 characters, and explicitly recorded open questions to 800 characters. Pending agenda items are not treated as evidence of unanswered questions. Spoken summaries use natural sentences rather than internal English category labels. The existing model and 180-token output limit were preserved; this adds no extra model call per command.

Five successive live checks passed after prioritizing commitments. After the final language and open-question refinement, another three fresh checks passed: all retained the current action owner, approved budget, and known delivery date. This is regression evidence, not a guarantee of perfect summaries on arbitrary meetings. Explicit instructions, relevant bounded context, and repeated evaluation follow the official [OpenAI prompt engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).

## Automated application checks

| Run | Result |
| --- | --- |
| Full application suite repeated twice | 88/88 passed in 7.7 minutes: 44 scenarios executed twice. |
| Updated entry lifecycle suite repeated three times | 57/57 passed in 24.6 seconds: 19 scenarios executed three times. |
| Updated full application suite | 45/45 passed in 3.7 minutes. |
| Final ESLint and production build, including TypeScript | Passed. |

That is **190 successful application scenario executions**, not 190 distinct features or real Teams calls. The two expected pre-fix regression failures are not counted as successes. The complete application suite uses an isolated database, disabled meeting AI, and simulated provider behavior. The later summary-prompt refinements were checked with real AI separately.

Coverage includes desktop and mobile navigation; meeting and series history; summary and cross-meeting memory; agenda progress; dynamic wake phrases; correction and permission handling; facial moods and hand raise; ordered speech; optional live transcript debug; callback parsing; duplicate suppression; uncertain creation; timeout recovery; late callbacks; confirmed exit; and public-route isolation.

## Real AI and browser audio

Each `npm run test:live` creates two temporary linked meetings, exercises nine commands, and deletes its records. It uses the application's configured real AI but never sends a participant into Teams. Checks include presence, remembered facts, agenda progress, cross-meeting ownership and date retrieval, English replies, an unknown-answer case, and a summary retaining budget, date, and the current action owner.

The audio variant additionally generated real speech and inspected actual PCM samples and completed browser playback. Four WAV chunks were produced at 44,100 Hz, with non-zero signal: observed RMS approximately 0.041–0.054 and peak approximately 0.344–0.362. All four audio chunks started and finished playback unmuted at full element volume, without probe errors. This establishes non-silent audio generation and browser playback, **not what a remote Teams participant heard**.

| Measurement | Observed result |
| --- | --- |
| Presence, remember, and agenda endpoints, final three AI runs | 12–32 ms |
| AI answer and summary endpoints, final three AI runs | 738–1,668 ms |
| Prepared correction to browser audio, updated full suite | 821 ms |
| Stored transcript to visible optional debug, updated full suite | 797 ms |
| Italian question through real AI to audio, warmed voice | 2,285 ms |
| English question through real AI to audio, warmed voice | 1,494 ms |
| Fresh browser voice initialization through first utterance completion | 81,013 ms |

These are local observations, not production percentiles. The cold voice startup remains a significant limitation. The warm response measurements exclude Teams transcription and media transport, so they must not be presented as complete meeting response latency. Debug timing begins after transcript persistence, not at the speaker's microphone.

Reproduce the checks against the configured running app with:

```bash
npm run test:live
npm run test:live -- --audio
```

These opt-in checks use real AI calls and their normal usage charges. The default browser suite does not create external participants.

## Public connectivity and remaining work

The authorized temporary Cloudflare tunnel was active. Public health, the capability-protected output page, and its state endpoint returned HTTP 200, and the output browser showed the configured name without console errors. Public management pages and APIs returned 404; invalid capabilities returned 404 and a malformed webhook returned 400. Local management remained available on port 3000.

Cloudflare supplies temporary HTTPS reachability for this local test, not Teams admission. The application and tunnel must remain running. A company deployment needs a persistent hosted application/worker and HTTPS origin with the access controls described in the [runtime architecture](../README.md#runtime-architecture), not a laptop-dependent quick tunnel.

Still required in an admitted real Teams call: microphone-to-caption delivery, Italian/English audible replies, actual response latency, perceived voice and video quality, lip sync, hand raise and permission, and a final summary based on real conversation. Unattended admission requires an appropriately configured test meeting or an accessible organizer session; the application cannot grant itself admission.

## Afternoon follow-up: unreachable avatar despite Teams admission

The user's `kickoff prodotto` meeting reached `joined_recording` at 13:43:37 UTC, but the video showed a browser DNS error. Both Cloudflare and Google DNS returned NXDOMAIN for its saved Quick Tunnel hostname. The local application remained reachable. This establishes an output-page connectivity failure, not an admission failure.

The replacement tunnel initially served the HTML. Later, macOS power logs recorded **Low Power Sleep at 16:02:56 Europe/Rome with 1% battery**, and wake from hibernation at **17:16:59**. Application tests were interrupted during this interval and the replacement tunnel also became unreachable. One audio test timed out in the interrupted run; that run is not counted as a clean pass.

Corrections in this follow-up:

- A public preflight checks avatar HTML, state, and executable script assets before Attendee participant creation or scheduling. Failures are definite local rejections, not uncertain provider creation; no room claim is left blocking retry.
- The mounted meeting renderer reports attempt-scoped readiness every five seconds. The GUI separately indicates missing renderer confirmation, voice preparation, and voice readiness; a heartbeat older than 20 seconds is not ready. Previews and old/stopped attempts cannot confirm an active renderer.
- A disconnected output page drops its active indicator rather than indefinitely retaining the last successful state.
- Same-bot output recovery uses `PATCH /bots/{id}/voice_agent_settings`, with a new reload URL to prevent an identical-settings no-op. It checks the remote bot state first and does not create a replacement participant. The provider's [documented voice-agent behavior](https://docs.attendee.dev/guides/voiceagents) and [API implementation](https://github.com/attendee-labs/attendee/blob/main/bots/bots_api_views.py) were checked. Recovery of the output URL does not migrate existing webhook URLs.
- Joined participants remain in periodic provider reconciliation even after their entry deadline is removed. This fixes a stale-live bug when the public callback address disappears after successful admission.

The live recovery request was initially accepted, but no remote renderer heartbeat was received before the interruption. On the later recovery check, Attendee reported that the bot had ended. Reconciliation confirmed departure at **14:05:13.523 UTC**, and the app now shows the meeting completed rather than live. Existing meeting data was preserved; no replacement bot was created.

The final replacement public page was checked in a separate Chrome browser: HTML and JavaScript loaded, nine state polls succeeded, and no page or HTTP errors were observed. This probe deliberately omitted the attempt parameter, so it did not impersonate the hosted renderer or mark the Teams bot ready. Actual remote video and spoken responses remained unverified for that session.

Verification after recovery: **59/59 application tests passed in 4.2 minutes**, including actual local browser speech (prepared correction to audio: 1,341 ms; stored transcript to debug: 794 ms). After adding the joined-bot reconciliation regression, **34/34 entry/output checks passed in 24.1 seconds**. These include the production Attendee adapter with injected HTTP responses, not real participant creation. ESLint, TypeScript, and the production build passed. The current suite contains 60 scenarios. The earlier power-interrupted audio failure was repeated successfully; it was not hidden or counted as a pass.

## Evening autonomous run: admitted Riccardo and missed greeting

The user left an admitted test meeting running. No replacement Attendee participant was created or deliberately disconnected in this run. A separate, clearly named technical listener reached the Teams lobby but could not be admitted: organizer browser scripting and macOS UI automation were unavailable. Its admission request was cancelled. No meeting access policy or macOS automation permission was changed.

### Findings and corrections

- The current meeting was saved as `auto`, so Attendee received no explicit Teams caption language. Native captions do not support automatic language detection. Actual incoming Italian speech was transcribed as “Chao Chao, Ricardo.” and “Charlie cardo.” This is not an AI-answer problem. New Attendee meetings in the GUI now select Italian or English explicitly, defaulting to the interface language; tests verify `it-it` and `en-us` in the provider request. The running meeting's existing caption language was **not** remotely changed.
- A greeting ending at the invocation name had no remaining command text and was ignored even when the name was recognized. It now receives a short deterministic greeting. The name remains dynamic; doubled-letter variants are tolerated, but unrelated phrases such as “Charlie cardo” are not silently converted to the name. Regression coverage exercises the incoming webhook, duplicate delivery, a name/question split across captions, and suppression of the bot's own voice.
- Playback confirmations now carry the command ID and active attempt. Unknown commands, stopped attempts and old attempts cannot acknowledge playback; duplicate completion does not advance its timestamp. The optional debug panel distinguishes response text from the latest browser playback acknowledgement. This still does not certify sound at a remote listener's speakers.
- A cached greeting began audio in 492 ms, but uncached short phrases took about 12–20 seconds on the hosted browser. Experimental proxy/multi-thread WASM configurations failed the CPU-only speech test and were **removed**, not shipped as a successful optimization. The reliable single-thread fallback and eight synthesis steps remain. The greeting is now prepared before the renderer declares its voice ready. Arbitrary uncached speech latency remains unresolved.

### Actual commands sent to the admitted bot

These were real management commands in the user's test meeting, not forged incoming speech. A harmless memory item was explicitly labelled synthetic: verification code ZAFFIRO 482, not business data. Existing records were preserved.

| Case | Text/API time | Hosted browser audio start | Completed playback |
| --- | --- | --- | --- |
| Cached Italian greeting | 27 ms | 492 ms | 6,028 ms |
| Presence question | 23 ms | 12,080 ms | 15,109 ms |
| English greeting | 20 ms | 11,959 ms | 21,033 ms |
| Remember synthetic test fact | 26 ms | 15,090 ms | 18,107 ms |
| Retrieve synthetic code | 1,930 ms | 20,068 ms | 26,599 ms |
| Next agenda item | 23 ms | 15,149 ms | 21,184 ms |
| Meeting summary | 1,930 ms | 31,837 ms | 91,186 ms |

Times run from the command request and include polling uncertainty. The summary's last column includes speaking the entire response. A deliberately unknown customer order question returned an explicit unknown answer in 1,885 ms; its playback measurement was interrupted by a development server restart and is not counted as completed.

Native Teams captions also contained utterances attributed to **Riccardo** matching the bot's greetings, though incorrectly transcribed. Together with the hosted playback acknowledgements, this is evidence that audio reached the Teams caption path. It is not a recording or quality measurement from an independently admitted receiver. Microphone-to-answer recognition, remote video sharpness and complete receiver-perceived latency are not certified.

### Managed-network TLS interruption

Later recovery calls failed with `SELF_SIGNED_CERT_IN_CHAIN`. Curl validated the same endpoint with a certificate issued by **Microsoft Global Secure Access Intermediate CA2**. Node's system CA list contained the installed **Microsoft Entra TLS Inspection Root CA**, but the active client trust list did not use it successfully. Adding the existing system authorities to Node's default CA list restored validated HTTPS: the unauthenticated diagnostic returned the expected HTTP 401, and the application's same-bot output refresh subsequently returned HTTP 200.

An opt-in `scripts/system-ca.mjs` preload uses the documented Node TLS API and is explained in the README. The local server was restarted with this preload, preserving `.env.local`, the public tunnel and the bot. No new certificate was installed, no private key was read, and TLS verification was never disabled. A successful refresh request is not itself proof that the remote renderer has reconnected.

### Final live-call state and recovery limitation

The hosted renderer's last observed heartbeat was **16:20:46 UTC**. Subsequent same-bot URL refreshes, including a stop/start of voice output, returned HTTP 200 but did **not** restore a fresh heartbeat. At **16:51 UTC**, the existing participant still reported `joined_recording`, and incoming captions continued, but neither video readiness nor new voice playback was confirmed. A post-recovery greeting returned text in 1,015 ms without a playback acknowledgement within 90 seconds. This is a failed media recovery, not a successful end-to-end test.

The public page still loaded in a separate diagnostic browser and polled its state. That probe omitted the attempt parameter and therefore did not manufacture hosted readiness. Its first minute remained in voice preparation. The provider's [webpage streamer implementation](https://github.com/attendee-labs/attendee/blob/main/bots/bot_controller/webpage_streamer_manager.py) changes the page URL and media output; stopping and restarting output is **not** a guaranteed restart of a crashed or stalled remote browser process. The available evidence does not establish the internal cause of this hosted failure. No new participant was sent to work around it without an organizer available for admission.

The debug feed now also hides a stale `speaking` acknowledgement after the renderer heartbeat expires, rather than showing audio as playing indefinitely. Historical completed/error acknowledgements remain visible as historical evidence.

At the final check, **16:56:15 UTC**, Attendee reported `ended:post_processing_completed`; the application correctly reconciled the meeting to **completed**, with 163 transcript entries preserved. No leave command was issued for this participant during this run. The final event confirms termination but does not by itself establish the reason. The local app remained healthy (HTTP 200); a fresh admitted attempt is required for further live media testing.

### Additional real AI and local audio check

A final `npm run test:live -- --audio` passed against the configured AI. It created and cleaned up only its two temporary, non-joining test records. Cross-meeting owner/date/budget retrieval, the current action owner, agenda completion, an English answer, an explicit unknown answer and a summary all passed. Local command endpoints took 13–24 ms; AI responses took 855–1,525 ms. Cold voice initialization through the first utterance took 79,961 ms; subsequent Italian and English questions began audio in 2,731 ms and 1,880 ms respectively.

Four actual PCM WAV chunks at 44,100 Hz contained non-silent samples (RMS 0.0404–0.0597, peak 0.3155–0.4034). All four played to completion, unmuted at element volume 1, without probe errors. This remains **local browser audio evidence**, separate from the failed late hosted-media recovery.

### Final application verification

- **66/66 E2E scenarios passed in 5.8 minutes**, including separate real CPU-only and normal browser speech tests, ordered replies, hand raise/permission, webhook greeting, transcript debug, lifecycle reconciliation and duplicate suppression.
- Focused webhook plus real GPU/CPU speech checks: **3/3 passed in 3.6 minutes** after removing the unstable thread configuration.
- Prepared correction to local audio in the final suite: 1,323 ms normal browser and 82 ms CPU-only. Preparation time is excluded; these are not cold-start or Teams end-to-end timings.
- TypeScript, ESLint and production build passed. The production build used `.next-build-verify` to avoid overwriting the running development server's output; this generated directory is ignored by Git.
- After the final playback-staleness and media stop/start changes, **45/45 targeted lifecycle, debug and output checks passed in 50 seconds**; TypeScript, ESLint and the separate-output production build passed again. Provider calls in those application regressions are injected test responses, not additional real Teams runs.

The earlier failed/interrupted optimization runs are not counted as passes. The result is **not yet an acceptance sign-off for deployment**: the running call's caption language, uncached hosted speech latency and independent remote audio/video verification remain outstanding.

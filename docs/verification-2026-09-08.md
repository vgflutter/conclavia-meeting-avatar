# Meeting assistant verification — 8 September 2026

## Scope

All work and checks ran from `conclavia-meeting-avatar`. The existing development server was preserved. Automated test records were uniquely named and removed after each run; the eight existing user meetings were preserved. The later authorized Teams attempt has its own retained meeting record. Only the temporary public URL was updated in the local environment; credentials were not changed or printed.

The checks use two separate levels of verification:

- Automated application tests: Chrome, MongoDB, local speech, and simulated provider callbacks. External meeting entry and AI are disabled for this suite.
- Opt-in live intelligence checks: real OpenAI responses through the running application, with an optional real Chrome audio output. These use temporary local meeting records, not a Teams call.

## Reproduced and corrected

1. Commands arriving between output polls were lost because only the latest command was returned. Cursor-based delivery now returns every unseen command.
2. A new reply interrupted the previous audio. One ordered player now finishes each reply, prepares short speech chunks ahead, and retries transient failures.
3. An elementary arithmetic correction could be suppressed by the previous semantic-check cooldown. Deterministic corrections no longer wait for that cooldown.
4. A refusal such as “Riccardo, non puoi parlare adesso” could match the positive permission pattern. Refusals now take precedence.
5. Asking for a mid-meeting summary prevented end-of-meeting finalization. Completion is now guarded by terminal meeting status, not by the existence of an earlier summary.
6. Relevant series facts were discarded when they appeared after the first memory entries. Questions, summaries, and proposed interventions now rank candidates before applying the context limit; previous overviews are included.
7. English questions could receive Italian answers when the stored notes were Italian. Response language is now explicit in the instruction, and speech selects its pronunciation language from the response.
8. The output page now refreshes the displayed name from the meeting state. Facial moods, hand raise, and audio-driven lip sync remain active.

## Checks

Run the static checks and browser suite with:

```bash
npm run verify
```

The suite includes single meetings, linked appointments, shared memory, agenda completion, summaries, dashboard growth, overdue appointments, mobile layout, dynamic wake phrases, permission handling, real speech ordering, and protected output routes. The four initial reliability regressions failed before the fixes and passed afterward.

ESLint, TypeScript and the production build passed. After the public-route security fix, the complete suite was repeated: **20/20 Playwright tests passed in 3.4 minutes**. The avatar test generated real Italian and English audio, and the meeting-output regression measured a prepared correction starting in **823 ms** after permission. The earlier full run passed 19/19 tests in 3.2 minutes before the security scenario was added.

For opt-in real intelligence and audio:

```bash
npm run test:live
npm run test:live -- --audio
```

Three consecutive intelligence runs passed after the final language correction. Each run checked nine commands, including a known responsible person and delivery date from a previous meeting, an unknown answer, agenda progress, an explicit remembered fact, and a summary retaining the approved budget, date, and current action owner. All three English answers remained in English despite Italian source notes.

## Timing observations

These are local development observations, not production guarantees or percentile benchmarks. Model, network, device, browser cache, and meeting-provider conditions affect them.

| Measurement | Observed result |
| --- | --- |
| Presence, remember, and agenda endpoints, last three runs | 17–33 ms |
| AI answer and summary endpoints, last three runs | 685–1,834 ms |
| Earlier AI outlier | 5,622 ms |
| Prepared correction: permission callback to browser audio | 816–1,322 ms; latest full-suite run 823 ms |
| Final Italian question through real AI to browser audio, warm voice | 2,415 ms |
| Final English question through real AI to browser audio, warm voice | 2,042 ms |
| Fresh browser voice initialization through first utterance completion | 80,140 ms and 88,760 ms |

The final audio run passed with an Italian spoken answer to the Italian question and an English spoken answer to the English question. An earlier run measured 1,605 ms and 1,626 ms but exposed the language bug; those faster figures are not the final bilingual result. The speech warm-up measurement includes the first utterance and is not a warm response latency. A fresh meeting browser can still take significant time to load the model: do not promise immediate speech on first startup.

Short prompts, bounded relevant context, and precomputation follow the official [OpenAI latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization). Explicit response-language instructions follow the [instruction hierarchy guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#message-roles-and-instruction-following). The model and voice-quality settings were not downgraded.

## External verification still pending

The initial verification did not complete a new real Teams call. The previously configured public HTTPS tunnel was no longer reachable. Automatic approval initially rejected reopening a Cloudflare tunnel because it would expose meeting-output and webhook endpoints outside the device; no workaround was attempted.

In the subsequent authorized retry, the user explicitly approved the temporary tunnel. A public access check reproduced a forwarded-host bypass of the management-route filter. The tunnel was stopped, the filter was changed to inspect all host sources without allowing a forwarded value to override the actual host, and a dedicated regression passed. ESLint, TypeScript and the production build also passed. A new tunnel was then opened: health and voice assets returned 200, while management pages and APIs returned 404 both normally and with the forged forwarded host. The complete 20-scenario suite subsequently passed. No new Teams bot was created during these access checks.

### Authorized Teams attempt

One bot was then created for the current user-supplied Teams link, under the saved name **Riccardo**. No second bot was created. The meeting-output URL responded with HTTP 200 and the correct name. The join-request webhook reached the application, confirming the callback path worked.

- Local record: `6a9fe06b39298bda638bd0ea` (`Prova Riccardo · 8 settembre`).
- Provider bot: `bot_qZYD6BBnnsQbDGdT`.
- 10:16:20 UTC: Attendee accepted the join request.
- For approximately 15 minutes, direct provider polling reported only `joining` / `join_requested`, with transcription `not_started`. There was no lobby or joined event, no participant delivered to the application, and no transcript. The API supplied no specific failure reason.
- 10:31:33 UTC: the stalled attempt was explicitly asked to leave.
- 10:31:39 UTC: Attendee confirmed `left_meeting`; `post_processing_completed` followed at 10:32:07 UTC, and direct polling confirmed `ended`. The final callback completed the local record with no transcript. This is cleanup/finalization, not evidence of a successful conversation test.

The user subsequently supplied a screenshot listing **Riccardo (Unverified)** among participants, with a muted microphone and no avatar video. The organizer's view and Attendee's reported state disagreed. Being listed there did not establish that the bot browser had completed admission; the later debug snapshot below showed its lobby/prejoin screen.

The actual Teams conversation test remains **blocked before working media and transcription**. The root cause is not established. Attendee's public [Teams UI adapter](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_ui_methods.py) turns media inputs off before joining, then navigates meeting controls and captions before invoking `ready_to_show_bot_image()`. Admission or recognition of the meeting UI may have stalled, but the hosted worker's private logs and deployed version were not available to confirm the exact failing step. No microphone-to-caption-to-answer measurement or perceived video/audio quality check was possible in this attempt. Existing user history remained intact, and all temporary automated-test records were removed.

Still verify in Teams itself: lobby admission, native caption delivery, wake phrase, English/Italian audio, actual perceived lip sync and voice quality, hand raise and permission, video resolution, provider/network latency, and a final summary based on real conversation. Local tests do not certify those external behaviors, long-meeting performance, or a multi-container production deployment.

### Debug snapshot and entry-lifecycle correction

The subsequently supplied Chrome MHTML snapshot was inspected as data, without executing its scripts. At 10:31:33 UTC it contained `calling-lobby-screen` in the Teams light-meeting flow, the message that someone would admit Riccardo when the meeting started, camera and microphone off, and a disabled join button. This is more specific evidence than the organizer's participant list: the bot browser was still showing the lobby/prejoin UI. The snapshot does not establish why admission or the provider's UI detection stalled. Successful state-change webhook deliveries establish delivery, not working media or a successful conversation.

The application-side corrections now include:

- A persisted 120-second entry deadline and a ten-second Node server monitor, independent of the GUI. Provider host/lobby timeout settings were reduced from 900 to 120 seconds.
- Provider polling to recover missed state callbacks and a MongoDB lease to coordinate concurrent monitors.
- Atomic immediate-entry claims, including a canonical-room unique index, plus attempt metadata to correlate a lost creation response without creating a replacement.
- A distinct exit-request state. Neither a leave acknowledgement nor `leaving` is treated as confirmed departure; retry waits for terminal provider state, not only `post_processing`.
- Readiness only after `joined_recording`. Other joined states retain an entry deadline. Late events cannot cancel an exit or reactivate a terminated attempt.
- Failed attempts do not generate an empty completed-meeting summary. Completing or deleting an attempt before confirmed departure is rejected.
- Customer-facing entry/exit messages and inactive video indicators. Voice preparation must also finish before the output badge becomes active.

Lifecycle regression tests use an injected fake Attendee adapter and an isolated per-run MongoDB database shared with the browser test server. No new real Teams bot, provider spend, or modification of existing user meeting records is involved. The existing development server continued responding on port 3000, and `.env.local` was not changed during this correction.

Verification results: the full **36/36** application suite passed in **3.4 minutes**, including real browser speech; the prepared correction began playing in **837 ms** after permission. After the final UI guards, **17/17** affected scenarios were repeated successfully. The final atomic claim also guards against a request using stale data reopening a completed meeting: all **16/16** entry lifecycle scenarios passed again in **11.2 seconds**. ESLint, TypeScript, `git diff --check`, and the final production build passed. These timings do not include Teams transport latency.

These changes address unbounded waiting, misleading state, and unsafe retries. They do **not** patch the hosted Attendee worker or prove that the Teams light-meeting admission problem is resolved. A fresh real Teams test is still required to verify admission, media, transcription, and spoken responses together.

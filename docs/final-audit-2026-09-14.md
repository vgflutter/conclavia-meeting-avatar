# Final application review - 14 September 2026

This review covers the active `conclavia-meeting-avatar` repository, including
the accumulated entry, transcript, voice, conversation, queue and GUI changes.
It does not declare the live Teams PoC accepted on the strength of fixture tests.

## Final verification results

| Check | Result |
| --- | --- |
| Initial full application baseline | 445 passed |
| Final full application suite after fixes | **456 passed in 4.8 minutes**, no failures |
| Targeted lifecycle/queue/semantic-race rerun | 35 passed |
| Script tests | **36 passed** |
| ESLint and TypeScript | Passed |
| Production build | Passed using separate `.next-build-verify` output |
| Documentation links and figures | 107 local references across 29 Markdown documents checked; no broken targets |
| Live read-only connectivity | Local health 200, public tunnel health 200, public diagnostics 404 |
| Last meeting status | Completed; provider reports ended, with confirmed departure |

All regression runs used an isolated E2E database with paid bot, AI and synthesis
integrations disabled or intercepted. No new Attendee bot, real AI request or voice
preview was started during this review. Existing local configuration and meeting
history were preserved. Build-generated TypeScript paths were removed afterward.
The pre-push file scan found no unreviewed credential patterns: its single match
was an explicitly fictional database URI in the diagnostic-redaction test.
Local environment files, runtime logs and test artifacts remain excluded from Git.

## Additional defects reproduced and fixed

1. **Stale raised hand after departure or policy changes.** Management serialization,
   server-rendered output and polling now share the same visibility check: a live
   meeting, enabled corrections, no stop/departure and an unexpired contribution.
   The mounted avatar also resets its hand, mouth and speaking indicator on a
   terminal state. Original contribution evidence remains stored; nothing speaks
   or deletes history as a side effect of reading the state.
2. **Late playback evidence during semantic analysis.** An input initially classified
   as a participant could become a suspected avatar echo when a delayed playback
   acknowledgement arrived. The named-turn and proactive paths previously checked
   lifecycle/new event IDs, but not this change to an existing event. Both now
   reclassify their source before acting. A stale named grant is rejected; a changed
   proactive batch is requeued and the echo is excluded on the next check. These
   checks use the already loaded state, with no additional AI request.
3. **Incomplete default verification command.** `npm run verify` now includes
   all 36 script tests through `npm run test:scripts`, including caption and
   diagnostic safety tests, not only the tunnel-launcher subset.

Four focused tests reproduced the original failures before the fixes (stale
management hand, mounted hand after exit, delayed echo-triggered hand and delayed
echo-triggered permission). All 35 targeted tests then passed, including the
eight inactive/disabled/expired hand states and existing concurrency safeguards.

## Objective-based acceptance

| Objective | Application evidence | Remaining boundary |
| --- | --- | --- |
| Speak only when addressed | Named Italian/English turns, mentions/quotes/refusals, namesakes, semantic races and explicit GUI floor control | Real STT can still corrupt an invocation; ambiguous phrasing is not exhaustively proven |
| Recover context | General + series + meeting context, recent human/assistant dialogue and bounded older-point retrieval | Bounded selection is not full-history recall or a long-meeting load certification |
| Contribute without interrupting | Fixed 2.5-second collection, durable captions, one worker, delayed-result guards and silent hand until permission | Continuous new context can defer a contribution; recognition/model/network time adds to collection time |
| Keep named replies responsive | Tests hold proactive model IO unresolved while named replies and media state complete | Shared CPU, database and provider quotas can still affect live latency |
| Natural avatar | Male/female, expressions, movement, hand and synthetic streaming/audio-clock regressions | Naturalness, received Teams audio, end-to-end delay and lip sync need receiver-side acceptance |
| Safe entry and exit | Preflight, attempt-scoped state, bounded admission, missed callbacks, diagnostics and recovery tests | Provider admission/exit conditions require actual event evidence |
| Simple GUI and repeatable operation | Desktop/mobile workflows, compact history, voice studio and tunnel recovery tests | Company authentication, stable hosting and multi-tenant deployment are not implemented |

## Open points, not silently marked resolved

- **Recognition:** the historical “Ciao Riccardo” to “Charlie cardo” failure remains
  open without repeatable microphone-to-caption evidence. An acknowledged language
  request is not proof that Teams applied it. No caption rewriting, wake alias or
  STT provider replacement was introduced in this review.
- **Received media:** local playback acknowledgement and synthetic PCM tests do
  not establish what another Teams participant hears or sees. Repeat the receiver
  check with both appearances and the client's selected voice.
- **Attendee 30-minute departure:** the last inspected provider timeline reports
  `auto_leave_silence`, exactly 30 minutes after joining (20:28:45 to 20:58:45 UTC
  on 14 September). This identifies the provider's reason, not proof that the human
  meeting was silent. As requested, the policy is unchanged and investigation is
  deferred until tomorrow. Turning off the local app does not stop remote bots.
- **Already prepared contributions:** new context is checked before a hand is
  raised. The current pending-hand path is not a continuous semantic reviewer of
  every subsequent unnamed self-correction. Refusal, expiry, departure and feature
  settings are guarded; arbitrary topic drift after preparation needs additional
  evaluation before promising automatic withdrawal in every case.
- **Scope:** the hand is inside the avatar image, not the native Teams toolbar.
  The application is a shared-workspace PoC, not an authenticated tenant-isolated
  production service. Those boundaries are not safe overnight deployment changes.

The short [README](../README.md) remains the starting point; the
[extended guide](guide.md) contains setup, Cloudflare, configuration and figures.
The [queue report](hand-raise-diagnostics-2026-09-14.md) records payload/frequency
bounds and earlier real-model evidence separately from this automated review.

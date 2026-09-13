# Named speaking turns — 13 September 2026

## Requirement and changes

After “Secondo me tre per tre fa 12” and “Ehi Riccardo, dimmi”, the assistant must refer to the statement and correct it, but must not speak uninvited.

The earlier commit already recognized “dimmi”, the “secondo me” arithmetic prefix and punctuation-only requests. This follow-up closes the remaining unnamed audio-check/generic-alias exceptions, retrieves the recent point without relying on a previously prepared intervention, and tightens permission boundaries.

- Deterministic correction: “Sì, 3 per 3 fa 9, non 12.” Only the named call releases speech.
- Italian/English invocation, name before/after floor controls, same-speaker split captions, and combined statement/call captions.
- Unnamed, other-person, quoted and conditional permissions cannot release prepared speech. Explicit refusals produce no reply.
- A valid prepared intervention is reused without another model call. Otherwise, a bounded same-meeting participant reference is passed as `follow_up_statement`; no empty or punctuation-only question is fabricated.
- Refused, expired, answered and explicitly changed topics do not get automatically resurrected. Unresolved references ask “A quale punto ti riferisci?”. A new explicit statement in the named call supersedes an older prepared correction.
- The answer setting still gates contextual fallback. Proactive contributions can be off while explicit questions/follow-ups remain enabled.
- Original caption text, speaker attribution, saved voices, environment configuration and live participants are not modified by this fix.

The [official OpenAI documentation](https://developers.openai.com/api/docs/guides/prompt-engineering#message-roles-and-instruction-following) informed separating the referenced statement from application instructions. Speaking authorization remains deterministic code, outside the model.

## Verification

The first focused run passed all **56 tests** in **18.2 seconds**, after TypeScript and ESLint passed. Two further regression cases cover a newer explicit statement superseding a prepared correction and a non-arithmetic topic retrieving known memory. The final full regression passed **252/252 tests in 3.6 minutes**, including those additional cases; TypeScript and ESLint passed again before that run.

The production build also passed with isolated `.next-build-verify` output, a test database, preview bot provider and AI disabled. Temporary generated TypeScript path changes were restored afterward; the development server was not restarted.

The tests cover actual transcript-ingress processing using database-only provider fixtures, parser boundaries, the original two-turn sequence with and without a raised hand, disabled features, stale/dismissed points, attribution/echo exclusions, and the AI request input through a mocked provider boundary. Automated fixtures use an isolated `conclavia_e2e_` database with AI disabled and no paid synthesis.

These checks are not an admitted live Teams conversation. The recurring “Ciao Riccardo” → “Charlie cardo” recognition defect remains separate; see [recognition evidence](caption-recognition-2026-09-13.md). No new microphone-to-caption or receiver-side audio/lip-sync acceptance is claimed.

## Follow-up regression: deferred permission

The requested repeat run reproduced an additional parser defect: “Riccardo, dimmi pure quando te lo dico” returned an immediate `ask` command with the prompt “pure quando te lo dico.” The new regression failed before the fix.

The permission parser now distinguishes a deferred invitation from a grant or refusal. A deferred invitation stays silent, keeps a still-valid prepared contribution, and is skipped rather than mistaken for the topic during bounded follow-up lookup. “Dimmi ma non ora” is a refusal; actual questions such as “dimmi quando consegniamo” and “dimmi solo se il budget basta” remain questions. No caption text is rewritten.

After the fix, all **53 trigger-audit tests passed in 11.2 seconds**. Two additional cases exercise the actual asynchronous Attendee webhook endpoint with database-only bots: the named contextual correction with proactive contributions enabled/disabled, silence before permission, and idempotent callback replay. They are not real Teams participants.

The first complete rerun passed **254/255** tests and failed the simulated male speech latency assertion: **4354 ms** against a **3000 ms** limit. The trace showed the speech fixture response reaching the browser about 710 ms after the grant, but did not contain a first-audible-sample timestamp, so it cannot prove the cause of that one outlier. There were no matching unhandled/Attendee automation errors in the isolated development log.

Five diagnostic repeats all passed (**46.6 seconds** total): browser-observed starts were **1157, 984, 966, 983 and 1006 ms**; the old assertion measured **1404, 1311, 1316, 1315 and 1309 ms** respectively. The test now records the first audio-driven `data-speaking` transition with a browser observer and reads that persistent timestamp, instead of timing how long Playwright takes to notice a transient state. The **3000 ms limit is unchanged**; this improves the measurement and does not claim to fix production audio latency. Full rerun results follow below.

## Final repeat-run result

- **255/255 Playwright tests passed in 3.5 minutes**, without retries or skipped tests. This includes both new asynchronous webhook scenarios and the amended audio-start measurement.
- The four simulated meeting-output scenarios (male/female, with/without GPU capability) recorded browser audio-state starts of **988, 731, 732 and 705 ms**. All three queued responses completed in each scenario, in order.
- **23/23 tunnel-launcher tests passed**; TypeScript and ESLint passed again before the final full suite.
- **Production build passed** using `.next-build-verify`, a `conclavia_e2e_` database, preview provider and AI disabled. Build-generated TypeScript include/import changes were restored afterward.
- `npm run tunnel:check` confirmed the existing public health endpoint and blocked management routes. It reused the existing app/tunnel without changing the hostname, `.env.local`, or processes. This is a reachability/security check, not a full avatar or Teams media check.
- No live participant was created/admitted, no paid voice request was made, and the real history and saved avatar settings were untouched. Correct real microphone recognition and receiver-side Teams voice/video/lip-sync remain pending.

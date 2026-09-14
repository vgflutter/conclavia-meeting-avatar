# Conversation and speaking intent — 14 September 2026

## Scope and authorization

The user explicitly authorized sending recent dialogue, original avatar responses, a prepared contribution and essential runtime observations to **OpenAI** for contextual answers and speaking-turn interpretation. This implements the extension previously blocked in the [13 September report](speaking-turn-verification-2026-09-13.md).

The existing Responses integration, configured model and `store: false` remain unchanged. No environment values, stored user captions, meeting history or saved avatar settings were replaced. No Attendee participant or Inworld synthesis was started for these checks.

## Implemented

- Answers, verification, spoken summaries and proactive contribution generation share a bounded human/assistant conversation view. Original generated responses come from command history; re-transcribed avatar speech and known echoes are not inserted again as new human statements. Known human namesakes remain human.
- Recent selection considers the latest 36 human turns and eight assistant responses, ordered by timestamp before selection and capped at 7,000 serialized characters. It reserves the latest human turn and own answer. Individual long turns are explicitly truncated. Up to four older locally keyword-matched turns fit within a separate 4,000-character section; coverage counts disclose omitted turns.
- General, series and meeting background remain separate from observed facts and outcomes. Previous assistant text helps resolve a follow-up but does not prove that its claims are correct or agreed by participants.
- Runtime input is an allowlist of reported lifecycle state and renderer readiness, not a provider presence probe. Playback is labelled generated, started, completed or failed; receiver-side reception remains unknown. A prepared contribution is labelled **not spoken** and cannot authorize itself. Capability URLs, bot/attempt identifiers and credential configuration are not included in these runtime fields.
- Clear named commands/refusals keep the local fast path. Only unresolved named utterances call the structured intent classifier when meeting AI is enabled. It distinguishes mentions, immediate grants, refusals, conditional deferrals and new requests. A new request must be copied from the current utterance, not invented by the classifier.
- The semantic provider request is limited to three seconds, with no automatic retry. Invalid/uncertain output or failure leaves the avatar silent. The classifier cannot override a missing name, detected namesake, locally recognized refusal or quoted speech.
- After model work, transcript automation rechecks lifecycle, entry attempt, feature settings, namesakes, newer turns and the pending ID. A late refusal cannot discard a replacement contribution. Prepared responses are consumed atomically once; a replayed caption does not repeat them.
- Bare contextual floor grants retain the existing same-meeting, eight-caption/90-second lookup and refusal/topic boundaries. Broader answer context is not permission to resurrect a dismissed contribution.

User-controlled question/dialogue fields are escaped JSON in separate prompt blocks. Strict structured output follows the [official schema requirements](https://developers.openai.com/api/docs/guides/structured-outputs#all-fields-must-be-required); runtime validation is still applied after parsing.

## Verification

### Isolated application checks

- Initial targeted regression: **130/130 passed** (19.7 seconds).
- Asynchronous turn-race suite: **8/8 passed** after correcting a fixture to establish an Attendee-provider roster context. No application guard was relaxed. Cases cover departure, re-entry, namesake arrival, newer request/refusal, replaced/expired contributions, late decline and duplicate delivery.
- First full regression: **411/412 passed** (4.5 minutes). The only failure was a male-avatar simulated start at **4148 ms**, exceeding the unchanged **3000 ms** threshold. The trace showed the synthetic speech HTTP response approximately 0.77 seconds after the named-grant webhook, before the later speaking-state transition; it does not establish the root cause of the remaining delay.
- Repeated audio check: **12/12 passed** (1.6 minutes), covering male/female appearances with/without GPU over three repeats. Grant-to-browser-speaking-state ranged **682–1230 ms**, and all three queued synthetic responses completed in each case. No media code or latency threshold was changed to make this rerun pass. The earlier outlier is not a proven latency fix.
- Final full regression, including the late-storage-order case: **413/413 passed** (4.3 minutes), with no retries or skips. Simulated starts were **2690 / 697 / 719 / 730 ms** for male/GPU, male/CPU, female/GPU and female/CPU. The first case remained noticeably slower; this pass does not erase the earlier outlier.
- Tunnel launcher tests: **23/23 passed**. The initial sandboxed attempt could not bind the loopback lock-test port; the authorized run passed without changing the test or starting a real tunnel.
- ESLint, TypeScript and an isolated production build passed. Generated build/test type-path changes were restored. Documentation file links and `git diff --check` also passed. The existing server on port 3000 was confirmed in the active repository and returned a healthy response; it was not restarted.

The regular suite uses a separate `conclavia_e2e_…` database and port 3101. AI, external bot creation and paid synthesis are disabled; classifier tests use controlled responses. Synthetic PCM tests exercise the actual browser queue, not microphone recognition or received Teams media. Overlapping suites/repeats are not additional unique tests.

### Real OpenAI text check

The opt-in probe executes the actual semantic resolver and answer orchestration with fictional meeting data, mocked context storage and the configured real OpenAI provider. It has no database, Attendee or TTS access. A result is counted as passed only if the provider call itself succeeded; a local fallback cannot count as a model pass.

An initial TLS trust failure was resolved by using the project's existing `system-ca.mjs` preloader, which combines Node's normal authorities with the already trusted system certificates. TLS verification was not disabled.

The first successful-network run exposed a refusal/deferral distinction: “ti chiedo di aspettare” retained the pending contribution instead of withdrawing it. The semantic instructions now distinguish present stop/wait requests from explicit future authorization. A separate third-person statement about speaking later is correctly treated as a mention, not a deferral addressed to the avatar.

Final recorded probe: **12/12 passed**, all with successful OpenAI calls.

| Fictional case | Observed result |
| --- | --- |
| “Riccardo ci sta ascoltando.”, also with preceding chatter/question mark | Ignore the mention |
| “Before we continue, Riccardo, what did you want to add?” | Grant the pending turn |
| “Ok, prima di continuare, Riccardo, cosa volevi dire?” | Grant the pending turn |
| “Prima però Riccardo ti chiedo di aspettare” | Decline; withdraw current contribution |
| “Se ci servirà, Riccardo potrà parlare dopo” | Ignore third-person mention |
| “Riccardo, potrai intervenire solamente quando ti chiamerò” with preceding chatter | Defer; no present speech |
| Named question about the budget | A new request, not release of the old correction |
| Origin of fictional project Aurora in configured background | “A Lione, in Francia.” |
| Explanation of its own preceding mathematics-book joke | Recovers the joke and explains the double meaning |
| Responsible person/deadline outside the latest 36 captions | “Il responsabile è Marco e la consegna è venerdì.” |
| Unknown personal detail in the fictional fixture | “Non lo so.” |

The eight classification checks took **586–1445 ms**; the four answer checks **726–1256 ms**. These are individual text-probe observations, not production percentiles or microphone-to-audio latency. No tested answer used a routine transcript/“no explicit confirmation” preamble. Twelve passing examples do not establish universal semantic accuracy.

To repeat, with the existing meeting AI configuration enabled:

```bash
node --import=./scripts/system-ca.mjs scripts/verify-conversation.mjs --run
```

Up to 12 paid OpenAI text calls; fictional data only. Without `--run`, usage is printed and no request is made.

## Live acceptance still required

No new real Teams run was performed for this delivery. In particular, this does **not** fix or certify:

- microphone transcription of “Ciao Riccardo” instead of “Charlie cardo”; no wrong-caption alias or transcript rewrite was added;
- received voice quality, lip sync, video quality or end-to-end latency;
- exhaustive long-meeting memory: retrieval is local keyword matching, not a progressive summary or complete transcript in every request;
- perfect classification of every multilingual paraphrase; an unclear result stays silent;
- the occasional simulated audio-start outlier noted above.

These are backend changes. With the active development server on the updated source, no new meeting record or avatar re-entry is required to use them; refresh the management page to inspect debug. A production server needs a new build/restart. This does not restore an already ended bot or a broken tunnel automatically.

For the next live check, enable debug in the current meeting: make a plain third-person mention (no reply), ask a direct question using the configured name, then ask about its own reply. With a prepared hand raise, give a freely worded named invitation and check that it answers once. Finally test a named refusal followed by a bare acknowledgement; the refused contribution must not replay. Compare original received captions, turn decision and actual heard audio separately.

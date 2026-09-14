# Stateful speaking turns — 13 September 2026

Historical report. The additional OpenAI use described below was subsequently explicitly authorized and implemented; see [14 September conversation verification](conversation-verification-2026-09-14.md) for the current state. The blocked/unimplemented statements below describe this earlier delivery, not the current code.

## Incident and scope

The recorded utterance “Sì, Riccardo.” arrived at 22:06:15 Europe/Rome while a prepared correction was still valid. The old parser found the name but returned neither permission nor a command. Attendee requested departure at 22:06:40 with `auto_leave_max_uptime_exceeded`; this later automatic exit was a separate issue. The configured 75-minute limit (60 planned + 15 margin) has **not** been removed or extended by this change.

## Implemented locally

- A named acknowledgement grants a turn only when a contribution is actually pending. Without one it does not resurrect a dismissed, expired or delivered point.
- Prepared text is reused directly. The original “Tre per tre fa 13” → intervening chatter → “Sì, Riccardo” sequence produces the stored correction, not a new punctuation-only question.
- The existing fast path recognizes named yes/go/please/listen invitations and Italian/English controls. Affirmative prefixes no longer invalidate “Sì, Riccardo, dimmi”. Sentence-prefix chatter does not overwrite the prepared contribution.
- Refusal, deferral, namesake protection, configured feature switches and participant/echo attribution remain enforced. Original transcript text is not rewritten.
- Automation claims each stored caption once. Publishing the prepared answer and consuming its pending ID use one atomic database update, shared with the new management control. Concurrent grants cannot publish that contribution twice.
- Lifecycle, attempt, expiry and participant ambiguity are rechecked before speech. A newer named turn/topic boundary supersedes an older callback.
- The existing hand-raised card contains **Dai la parola / Give the floor**. The private endpoint accepts only the pending ID, never caller-supplied speech, rejects cross-origin browser requests, and is blocked on the public quick tunnel. Stale/double clicks return 409.
- Debug rows retain a small decision code and timestamp separately from playback acknowledgements. A recognized grant is not proof that another Teams participant heard the output.

## At this delivery: general semantic interpretation not yet implemented

The proposed OpenAI-backed interpretation of arbitrary multilingual invitations was blocked by automatic review because it would send the utterance, prepared contribution and recent/configured context to an external provider for a new purpose. Confirmation was requested; **no such classifier or new external data transfer is connected in this delivery**. A later proposal to add human/assistant dialogue and essential runtime observations to answer-generation requests was also blocked pending explicit destination/payload approval. The answer-generation data selection is unchanged; its speech-style instructions were updated locally.

Consequently, the local fast path must not be presented as understanding every paraphrase. For example, a freely worded “Ok, prima di continuare, Riccardo, cosa volevi dire?” may remain unresolved until that part is authorized and implemented. The debug view states that no answer was started. The GUI floor control is available without a semantic service.

## Follow-up: mentions and natural speech

- Removed the fallback that classified any prose after the configured name as a question. The local parser now accepts supported direct request syntax; unsupported phrasing remains unresolved. “Riccardo ci sta ascoltando” (also with a question mark or after another sentence) no longer starts an answer. This is a conservative safeguard, **not** the proposed general semantic classifier, and may leave legitimate unfamiliar phrasings unanswered.
- Direct questions, greetings, named grants, refusal, deferral and existing explicit commands remain covered. The original caption is preserved. A mention must not consume a prepared correction.
- Shared speech-style instructions for answers and prepared contributions request a direct, natural answer without routine references to transcripts, prompts or missing explicit confirmation. Uncertainty and genuine source conflicts must still be disclosed. No claim is made that prompt inspection proves actual model output quality.
- Wider dialogue memory, original assistant-response history, older-point retrieval and operational-state input have **not** been connected. The existing 36-human-caption/7000-character answer window still applies. No additional data was sent to OpenAI and no paid model, voice or meeting test was performed in this follow-up.
- Follow-up verification: **115/115 tests passed** (57.4 seconds) across context-prompt orchestration, assistant features, local routing and transcript ingress; then the additional mention → pending correction → named grant integration case passed separately (**1/1**, 4.5 seconds). ESLint and TypeScript passed. These checks use fixtures/mocked AI and do not evaluate a live model's wording, microphone recognition or Teams reception.

## Verification

- Initial focused suite: **114/114 passed**, covering routing, actual transcript/webhook ingress, participant ambiguity and debug UI.
- Expanded run: **89/92 passed**. Two fixtures were still `scheduled` while expecting speech; they were corrected to establish the admitted/live provider state first, without relaxing the application lifecycle guard. One male-avatar simulated start took **4260 ms**, exceeding the unchanged 3000 ms threshold. Its trace showed the fixture speech response before the later speaking-state transition; this does not establish a production latency cause.
- Clean full regression after those fixture corrections: **343/343 passed**, with no retries or skips, in 4.2 minutes. Named consent to browser speaking-state measurements were **1123 ms** (male/GPU), **708 ms** (male/CPU), **728 ms** (female/GPU) and **668 ms** (female/CPU). All three queued answers completed in every avatar variant. The earlier 4260 ms outlier did not recur in this run; this is not a proven production-latency fix.
- Final targeted regression after tightening deferred/negative invitations, follow-up boundaries and the GUI endpoint's origin check: **109/109 passed**. This overlaps the full suite and is not an additional 109 unique tests.
- Tunnel launcher tests: **23/23 passed**, using mocks, without opening or replacing a real tunnel.
- ESLint, the isolated production build and the standalone TypeScript check passed. Generated configuration changes from the build were restored before the final standalone check. `git diff --check` also passed.

Tests use an isolated `conclavia_e2e_` database, preview provider, AI disabled and no paid voice credential. The audio probe supplies synthetic PCM and exercises the real browser output/gesture queue. These tests do **not** establish live microphone recognition, subjective voice quality, receiver-side Teams audio/video, or semantic-model accuracy. No real participant is created and no Attendee/Inworld credit is used.

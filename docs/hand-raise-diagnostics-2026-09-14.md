# Contextual hand-raise queue and diagnostics

The management-only debug conversation records `interventionDecision` on the
original caption: queued, checking, raised, none, skipped or error. Reasons distinguish
waiting for the next check, disabled corrections, a pending contribution,
an excluded caption, ambiguous recipients, unavailable AI, failed assessment,
negative semantic assessment and a prepared correction. Model explanations are
sanitized and limited to 500 characters. They are diagnostic text, never speech.

## Consent and behavior

On 2026-09-14 the user explicitly approved sending small batches of queued
meeting statements, including potentially confidential text, to the existing
OpenAI analysis provider and asked not to repeat that consent request. This
scope is recorded in `AGENTS.md`; it does not authorize unrelated data/providers.

- The original caption stores the durable job. A fixed **2.5-second collection
  window** replaces the previous 30-second semantic cooldown. Later arrivals do
  not postpone the first check. Whole arithmetic claims also wait for this window
  so a following self-correction can be considered before raising the hand.
- Ingress only persists queued work: it never waits for proactive model IO.
  The avatar's existing state polling starts work after the media-state response,
  even without another human utterance. A restart can
  reclaim a job after its 45-second database lease expires. Polling must resume
  for deferred work to run; no new independent worker or bot is deployed.
- At most one proactive assessment runs per meeting. Remaining work waits another
  2.5-second window after an assessment completes; no immediate catch-up loop.
  No new captions means no new model calls. The theoretical upper bound is 24
  proactive calls/minute with continuous eligible input (lower once model IO and
  polling are included), so a busy meeting can cost more than the old cooldown.
  Complete arithmetic claims retain the local zero-cost path after collection;
  arithmetic embedded in a longer caption uses contextual assessment.
- Each batch contains up to eight complete captions within 4,000 serialized
  characters, plus up to 3,000 characters of recent dialogue. It replaces the
  larger recent/retrieved transcript window, not adds to it. Configured context,
  objective and selected memory still have their existing separate bounds.
- Overflow remains queued. Captions older than 90 seconds, superseded points,
  earlier attempts, ambiguous recipients and individual captions exceeding the
  batch budget are explicitly skipped and logged. The queue does not promise
  exhaustive recall or an immediate response during continuous conversation.
- A delayed assessment rechecks departure, policy, invocation name, namesakes,
  pending hand and newer dialogue before preparing anything. Changed dialogue
  requeues the batch; refusal/topic changes prevent reviving an obsolete point.
- Only a silent hand is prepared. Speaking still requires a named grant (or an
  explicit GUI floor control). Voice, STT and bot entry configuration are unchanged.
- Named requests do not wait on the collection window, proactive lease or model
  result. The worker makes no synchronous provider call on the media response
  path. The 2.5 seconds are **not** end-to-end latency: renderer polling, model IO,
  transcription and network time remain additional. Shared CPU/database/provider
  quotas also mean zero latency impact cannot be guaranteed by architecture alone.
- Eligibility scans inspect recent human captions once per batch and precompute
  topic/name boundaries, rather than rescanning the entire transcript per job.

The prompt assesses the speaker's currently endorsed claim, not words taken
out of context. Quotations, negation, correct decimals and self-corrections must
not generate a redundant contribution. Instruction/data separation follows
[OpenAI's prompt engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#message-formatting-with-markdown-and-xml).

## Verification

Final short-window regression run: **127 tests passed** across `context-prompts`,
`meeting-debug`, `meeting-intervention-queue`, `meeting-trigger-audit` and
`semantic-turn-race`, plus `meeting-reliability`. Typecheck, targeted ESLint and
`git diff --check` passed. Local health returned 200; public management diagnostics
returned 404 using the project's system CA setup. No new bot was started, and no
real AI or voice calls were made for this timing change. The earlier consent and
prompt verification had 111 passing tests before the cadence update.

New tests hold proactive model IO unresolved while a named request completes,
return media state before starting the worker, keep a fixed first-caption deadline,
include a subsequent arithmetic self-correction, prevent competing polls from
duplicating work and re-evaluate a batch invalidated by new context. These establish
that there is no application-level wait on the proactive lane; they do not measure
provider contention or certify live Teams latency. The unchanged reliability suite
also exercises the actual polling/collection window and simulated streaming for
both avatar appearances with and without GPU.

Automated tests use an isolated database with mocked/disabled AI and no bot or
voice credits. The queue suite covers batching, overflow, lease recovery,
concurrent polls, new captions during IO, namesakes, departure, refusal,
disabled corrections, replaced attempts/hands, invalid source references and
provider errors. The state-poll test verifies draining without a new caption.

The opt-in real-model command is:

```sh
node --import=./scripts/system-ca.mjs scripts/verify-conversation.mjs --run --interventions
```

It makes six OpenAI calls with fictional data, no database access and no audio.
The first run found one false positive on an already-corrected quotation (5/6).
After making the unresolved-error criterion explicit, all six passed: embedded
Italian/English assertions, negation, corrected quotation, correct decimals and
a later self-correction. Twelve provider calls total across the two runs;
second-run assessment times were approximately 0.9–1.25 seconds, excluding
queue wait, STT and media. This is a bounded real-model check, not a guarantee
for arbitrary dialogue or a live Teams microphone/video acceptance test.

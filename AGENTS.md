<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working directory

- This repository, `conclavia-meeting-avatar`, is the single working copy of the meeting assistant. Run development, tests, builds, and Git operations from this repository.
- `../conclavia-frontend` is a historical local backup, not a source or mirror. Do not synchronize changes back to it.
- The local runtime configuration is `.env.local` at this repository root. Preserve it when updating or installing dependencies. This checkout does not include `.env.example`; fresh-installation guidance is in `docs/guide.md`.
- Meetings, series, memory, and the avatar profile remain in the MongoDB database configured by the local environment. Do not create an empty replacement database during setup.
- Regression and documentation captures use temporary MongoDB at `mongodb://127.0.0.1:27018` with a `conclavia_e2e_*` database. Pass this URI explicitly; a separate database name alone does not isolate the real SSH-connected MongoDB server. Never use the real database for fixtures or test saves.
- Keep the existing app on port 3000 running during verification. Playwright owns port 3101 and `.next-e2e`; do not run regression and screenshot capture concurrently. Use `.next-build-avatar` or `.next-build-verify` for a separate production build.

# Authorized local test recovery

- The user has authorized restoring this existing local test server and its temporary HTTPS tunnel without asking for confirmation again. Validate the exact processes before restarting them, preserve all unrelated `.env.local` settings, and verify both public avatar reachability and blocked public management routes afterward.
- This permission is limited to the same local test environment. It does not authorize a new paid deployment, bypassing Teams admission, or creating duplicate meeting participants. Report what was restored and distinguish connectivity checks from a successful real Teams conversation.

# Speech recognition acceptance: recurring user report

- The user says "Ciao Riccardo" but Teams/Attendee repeatedly delivers "Charlie cardo.". Their requirement is **correct speech-to-text**, not a response triggered by that wrong caption.
- Do not solve this report by adding "Charlie cardo" as a wake alias, fabricating a greeting, or rewriting the displayed original transcript. Preserve the input as evidence and investigate the transcription source and actual spoken-language setting.
- `captionLanguageRequestedAt` proves only API acknowledgement. The stored transcript `language` is populated from the meeting preference; neither establishes the spoken language actually used in Teams.
- Parser/webhook fixtures, healthy tunnels, generated answers and renderer audio acknowledgements do not pass microphone-to-transcript acceptance. Keep these verification stages separate in reports.
- Read `docs/caption-recognition-2026-09-13.md` before revisiting this failure. It remains unresolved without real recognition evidence; do not present it as fixed based on unrelated regression counts.

# Assistant context invariants

- General context is edited at `/context`; series and appointment notes are edited on their detail pages. Keep background separate from the objective, transcript and confirmed outcomes.
- Resolve general + series + meeting context for every AI task, including proactive interventions and final memory extraction. Series context is inherited dynamically by `seriesId`, not copied to each appointment.
- Use `assistant-context.ts` for scope precedence and prompt boundaries. Custom background must not become fabricated meeting decisions or replacement application instructions.
- Preserve explicit saves, stale-version conflict protection and scope-specific clearing. Context edits must not change bot lifecycle, voices or existing history.
- Do not expose context through the public avatar rendering capability. This PoC is a single shared workspace, not a tenant-isolated company deployment.

# Named speaking turns

- On 2026-09-14 the user explicitly authorized automatic contextual assessment of small batches of queued meeting transcript statements (including potentially confidential text) by OpenAI, the project's existing analysis provider, and asked not to be prompted for that same consent again. Keep payload/frequency bounded and diagnostics private. This consent does not cover unrelated data, new providers, extra meeting participants or unlimited paid runs.
- Proactive hand checks collect captions in a fixed 2.5-second window, separately from named answers. Ingress only queues work; media-state polling drains it after the response with one worker per meeting. Preserve arriving captions and revalidate newer context before raising a hand; never make named replies wait on this queue or restore the former 30-second cooldown.

- Require the configured invocation name for transcript-driven speech. Do not restore unnamed audio-check shortcuts or generic assistant aliases. A mention or quoted/conditional permission is not a direct speaking turn.
- Keep prepared hand-raise contributions silent until a named grant. A bare named “dimmi” must recover a recent point, not become a punctuation-only question; this also applies without a prepared contribution when answers are enabled.
- Deferred permission (“dimmi pure quando te lo dico”) stays silent until a later named grant; do not treat it as a question. Preserve actual questions such as “dimmi quando consegniamo”.
- Keep fallback references within the same meeting, eight prior caption segments and 90 seconds. Ignore avatar/known echoes and do not resurrect dismissed or already answered points. Preserve explicit refusal, topic changes, feature settings and split-caption speaker/time boundaries.
- Test speech permission separately from contextual retrieval and speech recognition. See `docs/named-turn-verification-2026-09-13.md`; correct injected transcripts do not validate live Teams recognition/audio.

# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.

# Daily synthetic voice alignment consent

- On 2026-10-20 the user answered “sempre” to the explicit request to send the updated synthetic Alex recording and public Daily script to OpenAI for word timestamps. This authorizes subsequent revisions of the same synthetic Alex/public Daily copy in this alignment workflow without asking again. Keep calls bounded and cached; this does not authorize unrelated files, personal recordings, account data, or publication.

# Shared avatar ownership

- Structure reusable capabilities as owned features with documented public APIs and tests. Avatar, performance and speech implementations live in the kit's `src/features` and are consumed through its feature entry points; preserve legacy re-exports during migration. Other shared application capabilities need an appropriate owning module/package rather than copies or business logic inside the avatar kit.
- Renderer, animation, asset, voice-catalog and playback implementations belong to `../conclavia-avatar-kit`, used by both Conclavia applications. Preserve the consumer compatibility re-exports; do not introduce local copies.
- After shared changes, run `npm run check:avatar-kit` with both consumers installed, then the relevant avatar/player regressions and both consumer builds. Keep the three Git checkouts side by side and publish kit changes before dependent consumer changes.

# CDaily video continuity

- For Daily scheduling, autonomous production or publishing, start with `docs/tg/cdaily-agent-runbook.md`. It is the durable handoff when chat context is missing. Preserve the approved date greeting, A/B text gates, semantic acting, Alex 2 identity, closing pointer, both formats and per-edition social summary/rundown. Do not confuse a loaded local production timer with a saved ChatGPT Work task or an operational end-to-end video pipeline.

- Start every new Daily or pilot with `docs/tg/cdaily-production-standard.md`. The user approved `avatar-refined-presence-20261023` (media `12c91abdf743`) on 23 October as the style to reuse. Preserve the sculpted light hybrid, anatomical hands, connected standing performance, approved studio/brand/font and Alex 2 voice. Use a dated dossier; do not rebuild the look from historical pilots or silently replace the voice when credits are unavailable.

- For subsequent Daily videos or avatar refinements, read `docs/tg/cdaily-video-guide.md`. Reuse `dailyVideoIdentity` and the canonical kit rather than reconstructing the approved look. `node scripts/tg/check-video-identity.mjs` verifies the saved artwork/font/setting fingerprints; examples and the visual lock accompany the guide. Deliberate requested art-direction revisions should update those references coherently.
- For every Daily edition, also read `docs/tg/cdaily-editorial-line.md` and `docs/tg/editorial-workflow.md`. Keep a dated Markdown dossier for its editorial choices, evidence, nonexpert context, timing, moods and reused visual identity. The common line supersedes historical pilot wording; factual support alone is not editorial approval. A recurring AI-opinion closing remains a proposal, not an enabled format decision.
- Every Daily also requires a standalone social summary in its edition language, covering each spoken news item. Store it in `TgScript.description`, include it in the dated dossier and fact audit, and reuse the reviewed copy for social publication without generating new claims at posting time.

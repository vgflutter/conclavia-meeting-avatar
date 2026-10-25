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

# Provider credentials and runtime configuration

- Conclavia Daily uses the existing backend configuration for its providers. AWS is not part of the current project and is not a prerequisite for ElevenLabs or other provider integrations.
- Keep provider credentials server-only, in the existing private runtime configuration (`.env.local` for local development and the existing private environment files managed by `../conclavia-deploy` for releases). Do not add secret-manager services or mandatory skills unrelated to the configured infrastructure.
- Never print or copy API keys, tokens, passwords or private SSH keys into chat, logs, Git, public assets or browser bundles. Inspect configuration programmatically and report only presence booleans or redacted errors.
- Preserve unrelated environment values, provider settings, SSH access and database configuration. Change only the values needed for the authorized integration; do not create credentials, rotate keys, change plans or purchase credits as an incidental step.
- Use synthetic credentials and mocked providers in regression tests. Real generation must stay bounded, cached and within the user's authorized scope.

# Daily synthetic voice alignment consent

- On 2026-10-20 the user answered “sempre” to the explicit request to send the updated synthetic Alex recording and public Daily script to OpenAI for word timestamps. This authorizes subsequent revisions of the same synthetic Alex/public Daily copy in this alignment workflow without asking again. Keep calls bounded and cached; this does not authorize unrelated files, personal recordings, account data, or publication.

# Shared avatar ownership

- Structure reusable capabilities as owned features with documented public APIs and tests. Avatar, performance and speech implementations live in the kit's `src/features` and are consumed through its feature entry points; preserve legacy re-exports during migration. Other shared application capabilities need an appropriate owning module/package rather than copies or business logic inside the avatar kit.
- Renderer, animation, asset, voice-catalog and playback implementations belong to `../conclavia-avatar-kit`, used by both Conclavia applications. Preserve the consumer compatibility re-exports; do not introduce local copies.
- After shared changes, run `npm run check:avatar-kit` with both consumers installed, then the relevant avatar/player regressions and both consumer builds. Keep the three Git checkouts side by side and publish kit changes before dependent consumer changes.

# CDaily video continuity

- For routine text-only Daily work, start with `docs/tg/cdaily-quick-start.md` and `npm run daily:context` (offline, no provider calls). Read the referenced long documents or source modules only for the relevant stage, changed policy or a specific failure. Do not reconstruct the project from the full chat or reread historical pilots on every run. Never turn this compact handoff into a substitute for fresh news evidence or required editorial checks.

- Latest editorial decision (25 October): the canonical detailed reference is `docs/tg/cdaily-editorial-standard-20261025.md`; the routine entry is the quick start above. The Mac starts at 07:30 Europe/Rome. The full pipeline now has an optional user gate: `productionMode: full`, `textReviewMode: manual` (currently enabled). Prepare the complete spoken text, sources, A/B reports, social summary and semantic acting score, then wait for the user’s explicit confirmation of that exact version before media. Setting `textReviewMode: ai` or omitting it skips only this additional user gate for new editions; AI A/B, the writing/acting format and final media review remain mandatory. `productionMode: editorial` is a separate technical stop, regardless of this flag. Never fabricate a confirmation or reinterpret a configuration change as approval of a frozen edition. New editions use `editorialProfile: italia-morning-v2`: target 5–7 minutes, minimum six stories (normally 6–8, maximum nine), measured master at least 4:30 and strictly below 10:00; seek a reserve pool before final selection. If fewer than six survive, the same job automatically supplements the retained candidates in a second, then third bounded round; persist `coverageRecovery` counters/verdicts and never restart or override rejected evidence merely to reach the count. A result below six is a collection/selection anomaly: inspect `coverageRecovery.collection` and the discarded-candidate reports, never infer a news shortage. The expanded 31-feed/21-origin Italy catalog and endpoint audit are documented in `docs/tg/cdaily-source-expansion-20261025.md`. Provider/quota failures are technical blocks, not permission to fabricate coverage. See `docs/tg/cdaily-selection-policy-20261025.md` for scope and explicit rejection criteria. Frozen legacy snapshots retain their old bounds. Italy focus with documented major-world exceptions and at most one qualified shared-knowledge science item; do not inherit the old fixed five-minute/five-story clock. Never fabricate a human approval receipt or erase failed editorial revisions.

- The Daily producer is this user's always-on Mac, at 07:30 Europe/Rome, installed through `npm run daily:mac -- install`. The target after explicit text confirmation runs Alex 2, approved native portrait/landscape rendering, final review and verified upload to the site; the current manual-review profile stops after the written dossier. The VPS editorial producer is disabled; keep the website receiver/publisher only. Work distributes from the site at 08:15. See `docs/tg/cdaily-mac-producer.md` for portable installation and migration; never move production back to the VPS implicitly or treat a saved Work task as a video generator.

- The user confirms database-backed written editions in the private newsroom's `Testi verificati` tab using `Conferma testo e avvia produzione`. This explicit action creates the exact-version text receipt and queues the same job for the next Mac tick; it neither resets counters nor approves media. The controller prepares text without starting the renderer while confirmation is missing. Private text-workshop sessions remain separate; never import or approve one implicitly. Readiness handoff for the first scheduled run: `docs/tg/cdaily-readiness-20261026.md`.

- Internal Daily voice, lip-sync, gesture and editorial trials are private. Do not publish them in the public site, catalogue or release URLs. The approved project presentation and released news editions are the public material; never relabel a technical trial as an edition or presentation to hide its nature.

- A same-day end-to-end rehearsal uses `daily:editorial -- --rehearsal=NAME`, with file-only state and artifacts under `.tg-artifacts/rehearsals/DATE/NAME`. It reads published history without inserting or modifying database jobs, never releases to the public site and never marks its stories as aired. Keep the exact-text user gate for its separate `daily:rehearsal-media` command. Do not repurpose the real failed job or change tomorrow's schedule for a trial; see `docs/tg/cdaily-private-rehearsal.md`.

- For first setup, migration or troubleshooting Daily scheduling, autonomous production or publishing, read `docs/tg/cdaily-agent-runbook.md`; routine text runs use the quick start. It is the durable handoff when chat context is missing. Preserve the approved date greeting, A/B text gates, semantic acting, Alex 2 identity, closing pointer, both formats and per-edition social summary/rundown. Do not confuse a loaded local production timer with a saved ChatGPT Work task or an operational end-to-end video pipeline.

- For Daily media production or a visual pilot, read `docs/tg/cdaily-production-standard.md`; text-only work retains its approved identity without reopening media design. The user approved `avatar-refined-presence-20261023` (media `12c91abdf743`) on 23 October as the style to reuse. Preserve the sculpted light hybrid, anatomical hands, connected standing performance, approved studio/brand/font and Alex 2 voice. Use a dated dossier; do not rebuild the look from historical pilots or silently replace the voice when credits are unavailable.

- For subsequent Daily videos or avatar refinements, read `docs/tg/cdaily-video-guide.md`. Reuse `dailyVideoIdentity` and the canonical kit rather than reconstructing the approved look. `node scripts/tg/check-video-identity.mjs` verifies the saved artwork/font/setting fingerprints; examples and the visual lock accompany the guide. Deliberate requested art-direction revisions should update those references coherently.
- The expanded editorial references are `docs/tg/cdaily-editorial-line.md` and `docs/tg/editorial-workflow.md`; consult them when the policy changes or a specific question needs them, using the quick-start contract for routine text runs. Keep a dated Markdown dossier for its editorial choices, evidence, nonexpert context, timing, moods and reused visual identity. The common line supersedes historical pilot wording; factual support alone is not editorial approval. A recurring AI-opinion closing remains a proposal, not an enabled format decision.
- Every Daily also requires a standalone social summary in its edition language, covering each spoken news item. Store it in `TgScript.description`, include it in the dated dossier and fact audit, and reuse the reviewed copy for social publication without generating new claims at posting time.

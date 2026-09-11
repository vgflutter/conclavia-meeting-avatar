# Objective-based PoC audit — 11 September 2026

## Scope

Review the current application against the original meeting-colleague objectives, verify production compilation and automated behavior, and prepare the accumulated implementation for publication. The active repository is `conclavia-meeting-avatar`; the historical frontend backup is not used.

No new Teams participant, paid voice synthesis or real-AI request was started for this audit. The application regression suite uses a unique E2E database, deterministic audio and simulated provider callbacks. Earlier real-provider measurements remain dated evidence, not fresh live-call certification.

## Objective review

- **Identity and direct interaction:** configurable invocation name, Italian/English greetings/questions, explicit commands, conservative handling of quoted or wrong addressees. Caption errors such as unrelated words cannot reliably be repaired by guessing a wake name.
- **Meeting assistance:** required agenda items, safe explicit completion, memory storage versus recall, contextual questions, summaries and important statement checks. Feature switches and permission/decline/expiry behavior have regression coverage.
- **Continuity:** summaries and selected knowledge flow into linked appointments. The current selector considers five preceding completed appointments. It is neither unrestricted global search nor an unlimited-memory guarantee.
- **Proactive contribution:** arithmetic/contextual corrections and relevant information can create a pending proposal. The visual avatar raises its hand; named permission releases prepared speech. Native Teams toolbar hand control is not implemented.
- **Voice and animation:** only Inworld streaming is active. Italian and English voices are separately chosen, speaking rate is shared, preview is separate from save, and appearance does not change voice/name. Female rig coverage includes 64 expression/mouth/hand combinations and CPU-only simulated meeting playback.
- **UI at scale:** summary-first history, 20-row pagination, text/date/status filters, reversible archive, optional debug and collapsed transcript. The 250-record test is a functional data-volume check, not a concurrent-user benchmark.
- **Reliability:** public output/script preflight, lifecycle attempt identity, persisted deadlines, missed-callback reconciliation, stale-renderer warnings, and confirmed exit before retry. None of these bypass lobby admission or guarantee immediate external-provider recovery.
- **Latency:** deterministic shortcuts, bounded transcript/memory selection, prepared interventions and streaming audio reduce stages on the response path. Real microphone-to-received-audio latency remains unproven; a speech-rate slider changes pace, not response time.

## Important limits made explicit in the README

1. Native Teams captions, not an independent always-accurate speech recognizer or Teams text-chat feed.
2. At most 4,000 stored transcript segments; no unlimited verbatim transcript archive.
3. Bounded continuity and prompt sections; normal answers cap output at 120 tokens, spoken summaries at 180. Context section caps are not a complete request-token bound.
4. Browser sync/PCM measurements do not establish Teams receiver sync, sharpness, naturalness or a response-time SLA.
5. The local app requires its computer and tunnel to remain running. Cloudflare is only a temporary HTTPS bridge, not the meeting bot or voice engine. Stable company HTTPS can replace it.
6. Company SSO, gateway access policy, data retention/approval and always-on hosting require deployment work. This is a private single-workspace PoC, not a ready multi-tenant service.

## Checks

Fresh results: **199 tests passed in 2.7 minutes**; TypeScript, ESLint and the production build all completed successfully. The female controlled sync scenario measured approximately 27–36 ms mouth-shape onset drift, zero underruns and zero inserted gaps in this run. These are fixture/browser measurements, not received Teams metrics.

The verification commands are:

```bash
npm run typecheck
npm run lint
NEXT_DIST_DIR=.next-build-verify npm run build
npm run test:e2e
```

The build uses a separate ignored output directory, leaving the active development server's `.next` directory untouched. Next's generated additions for the verification-only type directory were removed from `tsconfig.json` afterward.

Before publication, tracked and untracked source candidates were scanned for common credential patterns, private keys, database credentials and meeting capability/invite URLs without printing matching values. The four findings were reviewed: three fictional test URLs/capabilities and the placeholder MongoDB credentials in `.env.example`. `.env.local`, logs, `.conclavia`, generated output and Playwright artifacts remain ignored. This pattern scan is a precaution, not a comprehensive security audit.

## Remaining live acceptance

A fresh admitted Teams session must demonstrate: spoken greeting and specific question; memory and agenda; appropriate raised-hand proposal and permission; received summary; confirmed exit and one clean re-entry. Record the receiving participant's audio/video and measure from the end of the human's utterance to the first audible answer, separately from browser preparation metrics. Confirm Italian/English voice preference, lip sync and sustained video clarity there.

See the [female/browser verification](female-avatar-verification-2026-09-11.md), [previous real-AI/provider checks](poc-audit-2026-09-10.md), [live Teams evidence](live-meeting-verification-2026-09-10.md), and [README objective matrix](../README.md#poc-objectives-and-acceptance). Passing local tests must not be presented as completion of this remaining acceptance gate.

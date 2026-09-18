<p align="center">
  <img src="public/conclavia-logo.png" alt="Conclavia" width="420" />
</p>

# Conclavia Meeting Avatar

A digital colleague for Microsoft Teams: follows the agenda, responds when called by name, and preserves summaries and decisions between appointments.

**Start here.** Architecture, configuration, all screenshots and detailed checks are in the [extended guide](docs/guide.md).

## Start a local Teams test

From the active working directory:

```bash
cd /Users/vincenzo/work/conclavia-meeting-avatar
npm run tunnel
```

Open [Meetings](http://localhost:3000/meetings). The command restores or reuses this project's app on port 3000 and its Cloudflare tunnel, updates only the public URL in `.env.local`, and checks that public management pages remain blocked. Do not start a second server.

1. Choose the avatar and its Italian/English **Inworld** voices; listen and save.
2. Create a meeting with the Teams link, spoken language and objective. Add an agenda or context if needed.
3. Send the colleague from the meeting page. The organizer must admit it if Teams requires approval.
4. Call it by its configured name: “Riccardo, …”. Optional **Debug mode** shows captions, responses and expandable browser audio timings.

Keep the terminal open and the Mac awake. Use `npm run tunnel:check` for a read-only connection check.

If entry stalls, use `npm run diagnose:entry -- <meeting-id>` to read the current attempt's diagnostics. New attempts subscribe to Attendee diagnostic logs; the tunnel launcher keeps bounded, redacted local logs in `.conclavia/logs/`. [What these logs prove, privacy and limits](docs/entry-diagnostics-2026-09-14.md).

If the avatar check fails **before a bot is sent**, restore the connection and retry the same meeting; there is no need to recreate it. The GUI identifies page, state or JavaScript failures. See [entry checks and recovery](docs/guide.md#bounded-entry-and-safe-recovery).

**Stopping costs:** make the colleague leave from the GUI and wait for confirmed departure. Cancel any scheduled bots before stopping the app/tunnel with `Ctrl+C`. Closing the tunnel or the Mac **does not stop a remote Attendee bot**.

For GUI-only work, without a tunnel: `npm run dev:system-ca`. Real voice previews still use Inworld credit. For a fresh installation, see [local setup](docs/guide.md#local-setup). Never overwrite an existing `.env.local`.

## What it does

- **Meetings:** compact overview with five recent meetings, clickable history rows, search/filters and linked series. Full summaries stay in the details.
- **Memory:** summaries, decisions, actions and open questions first; transcripts remain optional.
- **Context:** general background + series notes + meeting-specific notes, with explicit saves.
- **Avatar:** choose editorial 2D, **3D character · Animated** or the 2.5D portrait trial, then male/female appearance. The 3D pair has skinned bodies, articulated arms/fingers and audio-driven facial shapes, not photo crossfades. Changes preserve voices and require an explicit save. [Previews, animation and limits](docs/avatar-rigged-3d.md) · [Other styles](docs/avatar-styles.md).
- **Interaction:** answers, memory, agenda and summaries. Spoken turns require the configured name; “Sì, Riccardo” releases a prepared contribution, while “Riccardo, dimmi” can recover the recent point. Freely worded invitations use an OpenAI fallback when AI is enabled; the hand-raised card also has **Give the floor**. [Turn handling and verification](docs/conversation-verification-2026-09-14.md).
- **Hand raise:** a fixed 2.5-second window batches captions for background checks, separate from named replies and media delivery. New captions stay queued; obsolete results are rechecked before raising the hand. It stays silent until granted the floor. [Limits and verification](docs/hand-raise-diagnostics-2026-09-14.md).
- **Matching names:** current participant tracking, including initial presence and departures. A detected namesake pauses voice commands with a GUI warning; explicit page controls remain available. [Details and limits](docs/guide.md#participant-presence-and-matching-names).

![Meetings overview with fictional demonstration data](docs/images/meetings.png)

## Why Cloudflare?

The app runs on your Mac; Attendee runs remotely and needs HTTPS access to the avatar page and callbacks. Cloudflare supplies that temporary connection. It is **not** the voice engine or the meeting bot.

For a company pilot, replace the temporary connection with stable HTTPS and an always-on application. Protect management pages with company authentication; this PoC is a single shared workspace, not a production multi-tenant service.

[Local tunnel, recovery and troubleshooting](docs/guide.md#public-connection-for-a-local-teams-test) · [Architecture](docs/guide.md#runtime-architecture) · [Company deployment](docs/guide.md#production-deployment)

## Status and known limits

The automated checks cover application behavior, including named contextual turns, permission boundaries, lifecycle recovery and isolated audio fixtures. **They do not certify received Teams audio/video.**

The [14 September final review](docs/final-audit-2026-09-14.md) records **456 application tests + 36 script tests passed**, a successful build, additional stale-hand/late-echo fixes and remaining acceptance work. The last inspected 30-minute exit was reported as `auto_leave_silence` by Attendee; its policy is unchanged pending the agreed follow-up.

Still open: “Ciao Riccardo” sometimes arrives as “Charlie cardo”; received voice quality, response delay and lip sync need a successful live test. Echo classification is a safeguard, not acoustic echo cancellation. The raised hand is rendered by the avatar, not the Teams toolbar button.

Teams supports spoken-language selection. An Attendee acknowledgement does **not** confirm it was applied; the GUI now keeps that distinction visible. A read-only [native-caption diagnostic](docs/teams-language-verification-2026-09-14.md) confirmed the latest wrong captions were already present at Attendee. No STT provider was changed.

Answers now use recent human/assistant dialogue and locally retrieved older relevant points, alongside configured background and memory. This is bounded context, not exhaustive recall. Ambiguous named turns use a structured OpenAI interpretation with a 3-second request limit; uncertainty or failure leaves the avatar silent. [Scope, real-model checks and remaining limits](docs/conversation-verification-2026-09-14.md).

[Current acceptance checklist](docs/guide.md#poc-objectives-and-acceptance) · [Recognition investigation](docs/caption-recognition-2026-09-13.md) · [Latest fixes and voice measurements](docs/playback-review-2026-09-13.md)

## Developer commands

```bash
npm run typecheck
npm run lint
npm run test:e2e
npm run test:scripts
npm run docs:screenshots
```

Tests use an isolated database and port 3101, with external bots, AI and paid synthesis disabled. Screenshot capture is separate from normal regressions and uses fictional records. Do not run both workflows simultaneously.

[Full verification and opt-in paid probes](docs/guide.md#verification) · [Regenerate the screenshots](docs/guide.md#refreshing-the-readme-screenshots)

## More documentation

- [Extended guide: setup, architecture, voices, screenshots and deployment](docs/guide.md)
- [GUI review](docs/gui-review-2026-09-13.md)
- [Layered context verification](docs/assistant-context-verification-2026-09-13.md)
- [Named invocation and contextual follow-ups](docs/named-turn-verification-2026-09-13.md)
- [Inworld voice catalog](docs/inworld-voice-catalog-2026-09-13.md)

Stack: Next.js · React · TypeScript · MongoDB · Attendee · Inworld.

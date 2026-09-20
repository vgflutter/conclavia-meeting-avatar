<p align="center">
  <img src="public/conclavia-logo.png" alt="Conclavia" width="420" />
</p>

# Conclavia Meeting Avatar

A digital colleague for Microsoft Teams: follows the agenda, responds when called by name, and preserves summaries and decisions between appointments.

**Start here.** Architecture, configuration, all screenshots and detailed checks are in the [extended guide](docs/guide.md).

## Avatar appearance and movement

Open [Voice & movement](http://localhost:3000/avatar/test) (**Voce e movimenti**) to choose **Editorial comic · 2D**, **3D character** or **Portrait 2.5D**, with male/female appearances. **Play animation / Avvia animazione** runs a nine-second silent sequence with connected lip shapes, a hand gesture and a return to rest. It needs no meeting, tunnel or voice credit. **Listen to voice** is the separate Inworld playback action and can consume credit. Preview changes apply to meetings only after an explicit save.

The [2D shoulder revision](docs/avatar-editorial-2d.md#shoulder-proportions-correction-20-september-2026) reshapes the shoulder line, narrows the jacket and straightens the sleeves in both appearances. The first symmetric correction was insufficient; the current browser comparison and regression check the volume below the shoulders as well.

The current renderers use discrete waiting actions with pauses and a stable torso. The 2.5D portrait coordinates both original lips and the jaw, bounds O/U narrowing and closes on silence/stop. The 2D illustration has articulated lip contours and an arm resting at the side. The 3D character has relaxed fingers, an oblique palm and revised skin, hair, clothing and glasses. [Styles and controls](docs/avatar-styles.md) · [Before/after, six final recordings and verification](docs/avatar-refinement-2026-09-19.md).

![Three avatar styles before and after the visual revision, with both appearances](docs/images/avatar-refinement/gesture-before-after.png)

## Start a local Teams test

From the active working directory:

```bash
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
- **Avatar:** three visual styles, two appearances, shared draft settings, independent invocation name and compatible Italian/English voices. Silent animation and voice playback are separate controls; saving is explicit. [2D illustration](docs/avatar-editorial-2d.md) · [3D rig](docs/avatar-rigged-3d.md) · [2.5D portrait](docs/avatar-portrait-2-5d.md).
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

The [19–20 September avatar review](docs/avatar-refinement-2026-09-19.md) records coordinated lip/jaw motion, stable waiting poses, revised artwork/materials, desktop/mobile production checks and actual browser recordings. The 2.5D texture rig and original 3D meshes retain their documented anatomical limits; passing tests does not establish visual acceptance.

The [20 September pre-commit check](docs/verification-2026-09-20.md) covers 120 application cases in the changed files, 36 script tests, the screenshot workflow, lint, TypeScript and the production build. It records the corrected legacy assertion and successful rerun.

The [14 September final review](docs/final-audit-2026-09-14.md) records **456 application tests + 36 script tests passed**, a successful build, additional stale-hand/late-echo fixes and remaining acceptance work. The last inspected 30-minute exit was reported as `auto_leave_silence` by Attendee; its policy is unchanged pending the agreed follow-up.

Still open: “Ciao Riccardo” sometimes arrives as “Charlie cardo”; received voice quality, response delay and lip sync need a successful live test. Echo classification is a safeguard, not acoustic echo cancellation. The raised hand is rendered by the avatar, not the Teams toolbar button.

Teams supports spoken-language selection. An Attendee acknowledgement does **not** confirm it was applied; the GUI now keeps that distinction visible. A read-only [native-caption diagnostic](docs/teams-language-verification-2026-09-14.md) confirmed the latest wrong captions were already present at Attendee. No STT provider was changed.

Answers now use recent human/assistant dialogue and locally retrieved older relevant points, alongside configured background and memory. This is bounded context, not exhaustive recall. Ambiguous named turns use a structured OpenAI interpretation with a 3-second request limit; uncertainty or failure leaves the avatar silent. [Scope, real-model checks and remaining limits](docs/conversation-verification-2026-09-14.md).

[Current acceptance checklist](docs/guide.md#poc-objectives-and-acceptance) · [Recognition investigation](docs/caption-recognition-2026-09-13.md) · [Latest fixes and voice measurements](docs/playback-review-2026-09-13.md)

## Developer commands

```bash
npm run typecheck
npm run lint
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run test:e2e
npm run test:scripts
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run docs:screenshots
```

Start a temporary MongoDB on port **27018** before these database checks. Tests use a `conclavia_e2e_*` database and app port **3101**, with external bots, AI and paid synthesis disabled. Do not use the application's SSH-connected MongoDB for tests. Screenshot capture is separate from normal regressions and uses fictional records; do not run both workflows simultaneously. Keep `.env.local` and the existing port-3000 app intact. Build verification uses a separate Next output directory; see the command in the guide.

[Full verification and opt-in paid probes](docs/guide.md#verification) · [Regenerate the screenshots](docs/guide.md#refreshing-the-readme-screenshots)

## More documentation

- [Extended guide: setup, architecture, voices, screenshots and deployment](docs/guide.md)
- [Avatar styles, current controls and visual evidence](docs/avatar-styles.md)
- [Latest avatar refinement and visual evidence](docs/avatar-refinement-2026-09-19.md)
- [20 September pre-commit verification](docs/verification-2026-09-20.md)
- [GUI review](docs/gui-review-2026-09-13.md)
- [Layered context verification](docs/assistant-context-verification-2026-09-13.md)
- [Named invocation and contextual follow-ups](docs/named-turn-verification-2026-09-13.md)
- [Inworld voice catalog](docs/inworld-voice-catalog-2026-09-13.md)

Stack: Next.js · React · TypeScript · MongoDB · Attendee · Inworld.

## Shared avatar workspace

Renderers, animation, models, portrait artwork, voice catalogs and playback live in [conclavia-avatar-kit](https://github.com/vgflutter/conclavia-avatar-kit). Meeting and [Onboarding](https://github.com/vgflutter/conclavia-onboarding-avatar) both use `@conclavia/avatar-kit` through `file:../conclavia-avatar-kit`. Edit the kit once; the consumer files are compatibility re-exports. The latest 2D shoulder correction is already shared.

Use Node.js **22.21.1+** and clone the kit beside this repository before installing Meeting. The kit repository is private and requires an authorized GitHub account.

```sh
# From the common parent directory, for a new checkout:
git clone https://github.com/vgflutter/conclavia-avatar-kit.git
git clone https://github.com/vgflutter/conclavia-meeting-avatar.git
npm --prefix conclavia-avatar-kit ci
npm --prefix conclavia-meeting-avatar ci
```

With both consumer repositories installed, `npm run check:avatar-kit` verifies the shared directory, compatibility exports and absence of duplicated assets. Follow the [coordinated update instructions](https://github.com/vgflutter/conclavia-avatar-kit#aggiornamento-coordinato); preserve each application's local environment and Mongo data. Settings remain application-specific, and a deployed application needs a rebuild to receive kit changes.

The standalone output includes shared GLBs. Docker builds require `--build-context avatar-kit=../conclavia-avatar-kit`; see [deployment](docs/guide.md#production-deployment). [Workspace alignment and verification](https://github.com/vgflutter/conclavia-onboarding-avatar/blob/main/docs/workspace-alignment.md).

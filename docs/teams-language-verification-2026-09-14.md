# Native Teams language investigation — 14 September 2026

Status: **recognition remains unresolved**. No STT migration, transcript rewriting, wake-name aliases, remote language change, new recording or new bot was introduced during this work.

## What was verified

- The reported attempt acknowledged an Italian request at **08:47:10.656 UTC**. Its two participant captions arrived at **08:51:17.547** and **08:51:25.680 UTC**.
- A read-only comparison of `GET /bots/{id}/transcript` with the stored local segments found **2/2 identical texts**, matching speaker and provider timestamp. Thus the wrong texts were already present in Attendee's transcript; Conclavia did not introduce those words. Normal ingestion trims whitespace and caps a segment at 10,000 characters.
- By this investigation the bot was ended; local confirmed departure was **09:17:12.164 UTC**. No replacement was created.
- Neither the public bot-details response nor the transcript establishes the actual Teams spoken language or the bot's permission to change it. Microphone recognition and the bot's UI language could not be observed on an ended attempt.

## Native configuration, not an extra speech service

[Microsoft documents spoken-language selection](https://support.microsoft.com/en-us/teams/meetings/use-live-captions-in-microsoft-teams-meetings), including Italian, under caption language settings. This is separate from the application UI language and translated captions. With transcription active, access is restricted to specified meeting roles. Teams can detect a language mismatch and offer a change: detection is not proof the change occurred. Prior blanket claims that Teams cannot detect spoken language should not be used as a product limitation.

The test links use `teams.live.com`. [Teams Free documentation](https://support.microsoft.com/en-us/teams/free/meetings/live-captions-in-microsoft-teams-free) confirms Microsoft-generated captions but does not describe the same complete language-change workflow. Verify the actual Free/guest experience instead of assuming the enterprise menu and permissions apply unchanged.

Attendee exposes `meeting_closed_captions.teams_language`, with `it-it` accepted. Its [schema](https://github.com/attendee-labs/attendee/blob/main/bots/serializers.py) says this affects everyone in the meeting. The [settings endpoint](https://github.com/attendee-labs/attendee/blob/main/bots/bots_api_views.py) acknowledges dispatch, not observed application.

## Provider boundary and requested corrective work

The following are findings in published source, **not confirmation of the hosted deployment version or the exact cause of this incident**:

- [Teams adapter](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_bot_adapter.py): `update_closed_captions_language` skips same-value requests and stores the desired value before invoking the browser operation. A failed application can therefore suppress a later retry.
- [UI setup](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_ui_methods.py): the fallback path enables captions through UI controls without applying the selected language.
- [Browser integration](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_chromedriver_payload.js): `getClosedCaptionsLanguage()` is used to detect mismatches. It logs `closedCaptionsLanguageMismatch`, retries initial application and optionally enforces a desired language within a configured window. The published default enforcement window is zero. Conclavia cannot set that provider-process variable through its local environment.
- [Public API routes](https://github.com/attendee-labs/attendee/blob/main/bots/bots_api_urls.py) and bot serializer expose neither this browser read-back nor the mismatch log through a documented bot-language GET endpoint.

Prepare a support request to Attendee with the private bot ID from the diagnostic output, timestamps above and these questions. **This document has not been sent externally.**

1. Which hosted adapter revision handled the attempt? What did `getClosedCaptionsLanguage()` report at the two caption timestamps?
2. Did the language synchronization reach the Teams browser? Did the UI fallback run, and were there `closedCaptionsLanguageMismatch` events or permission failures?
3. Can they expose actual language, observation time and application/permission failure separately from desired configuration?
4. Can they make same-value retries conditional on actual state, retry failed application within bounded limits, and confirm the setting after the UI fallback? Do not silently switch the entire meeting to an unrelated language to force an update.

These corrections belong in the hosted Teams adapter if those paths are responsible. There is no claimed remote fix in this repository and no fabricated read-back endpoint.

## Changes in Conclavia

- Active Attendee sessions keep an explicit **unverified listening language** notice even after HTTP acknowledgement. Pending, exhausted, acknowledged and unconfigured states remain distinct.
- The notice contains a collapsible Microsoft-language guide and explains the bot-session/organizer distinction. It disappears when the bot has left or is stopping, not when an unverified request succeeds.
- Creation copy says the selected language is requested, not guaranteed applied.
- Lifecycle behavior is unchanged: no endless PATCH, extra participant, forced departure, implicit language toggle or changed speaking trigger.

## Reusable read-only diagnostic

From this repository, with the existing local app running:

```bash
npm run diagnose:captions -- <meeting-id>
```

The meeting ID is the final part of its Conclavia detail-page URL, not the Teams invitation code. The command uses the existing runtime configuration without printing credentials. It only performs GET requests to the loopback app and configured HTTPS Attendee domain, refuses redirects, bounds response size and detects an attempt replacement during collection. It does not print names, conversation text, context, invitation links or renderer tokens. Keep the resulting bot ID private to authorized support.

On a managed machine requiring its already trusted system certificates (Node 22.19+ or 24.5+):

```bash
node --import ./scripts/system-ca.mjs scripts/diagnose-captions.mjs <meeting-id>
```

Never disable TLS. The ordinary launcher on this machine failed certificate validation; the existing system-CA loader completed the two-endpoint provider check successfully.

The result deliberately says `observedTeamsLanguage: unavailable` and `microphoneAcceptance: not_tested`. An `identical` comparison is an ingestion check, not a recognition pass. A `different`, missing or ambiguous result requires inspection; provider revisions may differ from previously delivered webhook segments. No comparison is claimed for segments outside the current attempt or without usable timing.

## Acceptance still needed

1. On a live admitted bot, observe actual spoken language and relevant role/permission before and after configuration. An organizer-side screenshot is useful but alone does not verify the bot's session.
2. Speak an Italian greeting and a short ordinary Italian question. Compare Teams captions, original provider transcript and local text without correcting any of them.
3. Repeat across host arrival, caption startup and a new admitted attempt; verify English separately in an English test meeting. No silent global language fight with the organizer.
4. Separately validate named-turn behavior and receiver-side audio. Passing those layers does not close recognition acceptance.

Automated checks for this change cover only diagnostics, privacy guards, request lifecycle and visible unverified state. They are not microphone or hosted-Teams acceptance.

Verification on 14 September: `npm run test:captions` **8/8**, isolated `meeting-entry.spec.ts --grep lingua` **9/9**, `npm run typecheck -- --incremental false` and lint passed. Disabling incremental output avoids writing the compiler cache in the restricted shell; an earlier incremental rerun hit a cache-file permission error. The provider comparison above was a separate real, read-only probe, not one of those synthetic tests.

# Recurring caption recognition failure — 13 September 2026

Status: **unresolved speech-to-text acceptance failure**. No alias, transcript substitution, artificial greeting or live language change was applied during this investigation.

Update, 14 September: the [native Teams language investigation](teams-language-verification-2026-09-14.md) documents Microsoft's language-setting support, confirms two new erroneous captions were already identical at Attendee, and fixes the GUI's acknowledgement-only warning suppression. Actual Teams language and microphone recognition remain unverified.

## User requirement

The participant said **"Ciao Riccardo"**. Debug displayed **"Charlie cardo."**. The user explicitly clarified that the defect is incorrect transcription, not merely the absence of a greeting response. Making the wrong text trigger a response would not fix this defect.

## Confirmed evidence

- The local meeting was live, with invocation name Riccardo and preferred language `it`.
- Attendee's read-only bot endpoint reported `joined_recording` and transcription `in_progress`.
- Conclavia recorded one request to set caption language to `it-it`, acknowledged at **10:22:22 UTC / 12:22:22 Rome**.
- The original participant caption **"Charlie cardo."** was stored at **10:22:32.621 UTC / 12:22:32.621 Rome**.
- The adapter requests `meeting_closed_captions`, rather than an independent audio transcription engine. Its webhook handler stores the provider's text. The handler fills `language` from the meeting preference: that field is not observed recognition-language evidence.
- The provider's bot-details response exposed lifecycle/transcription state, but not the actual Teams caption-language setting. No inference of successful language application should be made from that response.

## Why earlier tests were insufficient

`meeting-assistant.spec.ts` intentionally expects the parser to ignore "Charlie cardo." when the name is Riccardo. That guard protects against treating unrelated text as a command; it is **not a recognition test** and does not prove spoken "Ciao Riccardo" will be transcribed correctly. The initial proposed recovery of this caption as a greeting was withdrawn after the user's clarification; no such code was added.

## Provider boundary

Attendee documents [platform-caption transcription](https://docs.attendee.dev/guides/transcription) and [transcript webhook payloads](https://docs.attendee.dev/guides/webhooks). Its published [transcription-settings API implementation](https://github.com/attendee-labs/attendee/blob/main/bots/bots_api_views.py) acknowledges dispatch of a settings synchronization command; it does not return observed Teams language.

The published [Teams adapter](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_bot_adapter.py) can skip a same-value update. Its [browser implementation](https://github.com/attendee-labs/attendee/blob/main/bots/teams_bot_adapter/teams_chromedriver_payload.js) includes retries and mismatch detection because Teams can reset caption language. This shows a possible failure mechanism, **not proof that it caused this specific caption or that the hosted deployment runs that exact revision**.

## Next decisive check

Observe the actual spoken language in the affected Teams session/provider diagnostics and compare the platform caption with the original webhook text for a short spoken sample. If language is correct and the platform still misrecognizes speech, evaluate the incoming audio and transcription engine. Do not silently switch provider, enable additional recording or incur new transcription costs. A passing result requires the spoken words to arrive correctly, not a hardcoded answer or a repaired display string.

# Transcript attribution verification — 11 September 2026

## Observed defect

The provider attributed a fragment of the avatar's joke to the human participant. Its timestamp overlapped the last confirmed reply playback. This establishes a suspicious text/time match, not whether microphone echo or provider speaker attribution caused it.

## Changes

- Preserve the original speaker and text; persist `participant`, `avatar`, or `suspected_echo` classification.
- Match only substantial complete fragments inside acknowledged playback windows. Keep short replies, additional human content and later repetitions eligible for processing.
- Exclude avatar/suspected echoes before automation, question context and final summary/memory extraction.
- Bind asynchronous automation to an immutable transcript segment ID, not the latest speaker. Use the same ID for UI keys.
- Keep per-command playback start/end acknowledgments; repeated readiness reports cannot move the timestamps.
- Display uncertain attribution explicitly in live debug and expanded history, without silently renaming the human speaker.

## Checks performed

- TypeScript and ESLint passed.
- 100 targeted Playwright tests passed in 54.5 seconds: classifier boundaries, Recall and Attendee ingress, command/memory exclusion, debug UI, dynamic names, permissions, lifecycle and playback acknowledgments. Tests used an isolated database and no paid bot or TTS calls.
- Opened the actual meeting detail in a local browser: the reported fragment displays “Possibile eco dell’avatar” and retains the original provider attribution in its explanation.
- Annotated seven self-attributed avatar captions and one suspected echo in the reported meeting only. No text, speaker name, summary, memory, response or audio was deleted or rewritten. The maintenance script defaults to dry-run and requires an explicit meeting ID; `--apply` writes classification metadata only.
- Existing meeting runtime reported live/joined, voice ready, and a fresh renderer heartbeat. No new bot, voice change or meeting restart was performed.

## Limits

This is not acoustic echo cancellation and does not improve voice timbre or lip synchronization. An identical human repetition during playback is ambiguous and can be quarantined; the raw evidence remains visible. No fresh receiver-side Teams audio test was performed for this change. Earlier summaries are not automatically regenerated. Legacy captions can only be retrospectively classified when matching playback evidence is still available.

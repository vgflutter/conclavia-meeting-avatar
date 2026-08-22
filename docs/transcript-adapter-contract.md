# Transcript adapter contract

The companion accepts finalized, speaker-attributed captions from Microsoft Teams, Google Meet, or another conferencing adapter. This is the preferred input for dialogue and floor control in meetings with several participants.

## Inbound segment

`POST http://127.0.0.1:4310/api/transcript/segments`

```json
{
  "platform": "teams",
  "meetingId": "19:meeting-thread-id",
  "segmentId": "caption-1700000000000",
  "speakerId": "8:orgid:stable-participant-id",
  "speakerName": "Vincenzo",
  "text": "Mary, what are the two main risks?",
  "capturedAt": "2026-08-22T18:00:00.000Z",
  "isFinal": true
}
```

`platform` is `teams`, `google-meet`, or `generic`. The tuple `platform + meetingId + segmentId` is the idempotency key. `speakerId` must be stable within the meeting and must not be derived from the caption text. The display name may change without transferring the speaker's dialogue lease.

Partial captions may be sent with `isFinal: false`; they are never retained and do not activate the avatar. Send the finalized segment with the same `segmentId` and `isFinal: true` when it is ready.

## Floor-control guarantee

An explicit invocation opens a short lease for the exact `speakerId`. Only that participant's next two relevant questions may omit the avatar name. Another participant is always treated as an observer unless they explicitly invoke the avatar. Unattributed mixed audio is retained as meeting context but deliberately cannot open or inherit a natural follow-up lease.

This boundary is enforced by the companion rather than delegated to the LLM. Observer-mode output can request the floor, but it cannot start voice playback directly.

## Adapter requirements

An adapter must:

1. emit only visible, human-authored captions;
2. preserve a stable meeting, segment, and participant identifier;
3. finalize a caption only after the platform marks it complete or after a conservative local debounce;
4. avoid forwarding the avatar's own virtual-audio captions;
5. disclose transcription and AI processing to meeting participants;
6. run platform-specific DOM or SDK logic outside the companion core.

The companion binds to loopback by default. Do not expose this endpoint directly to the public internet.

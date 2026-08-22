import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { dialogueParticipantKey } from "./participant-identity.js";

function segment(overrides: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: "segment-1",
    speakerName: "Vincenzo",
    text: "Mary, che ne pensi?",
    isFinal: true,
    capturedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

await test("uses platform participant ids across display-name changes", () => {
  const first = dialogueParticipantKey(segment({
    source: "speech",
    platform: "teams",
    meetingId: "meeting-1",
    speakerId: "user-42",
  }));
  const renamed = dialogueParticipantKey(segment({
    source: "speech",
    platform: "teams",
    meetingId: "meeting-1",
    speakerId: "user-42",
    speakerName: "Vincenzo G.",
  }));
  assert.equal(first, renamed);
});

await test("never treats two platform participants as the same speaker", () => {
  assert.notEqual(
    dialogueParticipantKey(segment({
      source: "speech",
      platform: "google-meet",
      meetingId: "meeting-1",
      speakerId: "participant-1",
    })),
    dialogueParticipantKey(segment({
      source: "speech",
      platform: "google-meet",
      meetingId: "meeting-1",
      speakerId: "participant-2",
    })),
  );
});

await test("keeps the test room and chat backwards compatible", () => {
  assert.equal(
    dialogueParticipantKey(segment({ source: "manual" })),
    "manual:local:vincenzo",
  );
  assert.equal(
    dialogueParticipantKey(segment({
      source: "chat",
      platform: "teams",
      meetingId: "meeting-1",
    })),
    "teams:meeting-1:display:vincenzo",
  );
});

await test("does not invent identity for unattributed mixed meeting audio", () => {
  assert.equal(dialogueParticipantKey(segment({ source: "speech" })), null);
  assert.equal(dialogueParticipantKey(segment({})), null);
});

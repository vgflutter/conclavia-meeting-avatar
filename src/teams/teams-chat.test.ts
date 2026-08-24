import assert from "node:assert/strict";
import test from "node:test";

import { teamsActivityToChatMessage, visibleTeamsMessageText } from "./teams-chat.js";

void test("converts Teams rich message text into the visible command", () => {
  assert.equal(
    visibleTeamsMessageText("<p><at id=\"0\">Mary</at>, alza la mano<br>per favore &amp; sorridi</p>"),
    "Mary, alza la mano per favore & sorridi",
  );
});

void test("maps a Teams message activity to the canonical chat contract", () => {
  assert.deepEqual(
    teamsActivityToChatMessage({
      id: "activity-42",
      timestamp: "2026-08-24T12:00:00.000Z",
      text: "Mary, riassumi in chat",
      conversation: { id: "meeting-thread" },
      from: { id: "participant-1", name: "Vincenzo" },
      recipient: { id: "conclavia-agent" },
    }),
    {
      platform: "teams",
      meetingId: "meeting-thread",
      messageId: "activity-42",
      speakerId: "participant-1",
      speakerName: "Vincenzo",
      text: "Mary, riassumi in chat",
      capturedAt: "2026-08-24T12:00:00.000Z",
      senderIsAvatar: false,
    },
  );
});

void test("marks agent-authored Teams messages so they cannot loop", () => {
  const message = teamsActivityToChatMessage({
    id: "activity-agent",
    text: "Ecco il riepilogo.",
    conversation: { id: "meeting-thread" },
    from: { id: "conclavia-agent", name: "Mary" },
    recipient: { id: "conclavia-agent" },
  });

  assert.equal(message?.senderIsAvatar, true);
});

void test("rejects incomplete Teams activities", () => {
  assert.equal(teamsActivityToChatMessage({ id: "message-without-conversation", text: "Mary" }), null);
  assert.equal(teamsActivityToChatMessage({
    id: "message-without-text",
    conversation: { id: "meeting-thread" },
  }), null);
});

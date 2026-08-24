import assert from "node:assert/strict";
import test from "node:test";

import type { OutboundChatMessage } from "../domain/protocol.js";
import { OutboundChatQueue } from "./outbound-chat-queue.js";

function message(id: string): OutboundChatMessage {
  return {
    id,
    platform: "teams",
    meetingId: "meeting-1",
    replyToMessageId: "agenda-1",
    speakerName: "Mary",
    text: `[01:00] ${id}`,
    createdAt: "2026-08-24T10:01:00.000Z",
  };
}

await test("leases timed chat messages until the bridge acknowledges delivery", () => {
  const queue = new OutboundChatQueue();
  queue.enqueue(message("one"));
  assert.deepEqual(queue.lease("teams", "meeting-1", 1_000).map(({ id }) => id), ["one"]);
  assert.deepEqual(queue.lease("teams", "meeting-1", 2_000), []);
  assert.deepEqual(queue.lease("teams", "meeting-1", 16_001).map(({ id }) => id), ["one"]);
  assert.equal(queue.acknowledge("teams", "meeting-1", ["one"]), 1);
  assert.deepEqual(queue.lease("teams", "meeting-1", 32_000), []);
});

await test("isolates queues belonging to different meetings", () => {
  const queue = new OutboundChatQueue();
  queue.enqueue(message("one"));
  queue.enqueue({ ...message("two"), meetingId: "meeting-2" });
  assert.deepEqual(queue.lease("teams", "meeting-2", 1_000).map(({ id }) => id), ["two"]);
});

await test("keeps only the newest agenda reminder while a chat panel is unavailable", () => {
  const queue = new OutboundChatQueue();
  queue.enqueue(message("warning"));
  queue.enqueue(message("transition"));
  assert.deepEqual(
    queue.lease("teams", "meeting-1", 1_000).map(({ id }) => id),
    ["transition"],
  );
});

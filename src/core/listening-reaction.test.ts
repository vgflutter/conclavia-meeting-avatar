import assert from "node:assert/strict";
import test from "node:test";

import { ListeningReactionStabilizer } from "./listening-reaction.js";
import type { AvatarListeningReaction } from "../domain/protocol.js";

function reaction(
  mood: AvatarListeningReaction["mood"],
  level: AvatarListeningReaction["level"],
): AvatarListeningReaction {
  return {
    mood,
    level,
    sourceSegmentId: "segment-1",
    observedSpeakerName: "Vincenzo",
    createdAt: "2026-08-22T10:00:00.000Z",
  };
}

await test("holds an ordinary listening mood long enough to read naturally", () => {
  const stabilizer = new ListeningReactionStabilizer();
  const first = stabilizer.consider(reaction("curious", 2), 1_000);

  assert.equal(first?.mood, "curious");
  assert.equal(first?.holdMs, 6_000);
  assert.equal(stabilizer.consider(reaction("empathetic", 2), 3_000), null);
  assert.equal(stabilizer.consider(reaction("empathetic", 2), 7_100)?.mood, "empathetic");
});

await test("allows a clearly stronger reaction to replace a held mood", () => {
  const stabilizer = new ListeningReactionStabilizer();
  stabilizer.consider(reaction("attentive", 1), 1_000);

  assert.equal(stabilizer.consider(reaction("surprised", 4), 1_500)?.mood, "surprised");
});

await test("deduplicates repeated mood updates", () => {
  const stabilizer = new ListeningReactionStabilizer();
  assert.ok(stabilizer.consider(reaction("concerned", 3), 1_000));
  assert.equal(stabilizer.consider(reaction("concerned", 3), 2_000), null);
  assert.ok(stabilizer.consider(reaction("concerned", 3), 4_100));
});

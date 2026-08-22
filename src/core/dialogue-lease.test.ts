import assert from "node:assert/strict";
import test from "node:test";

import { DialogueLease } from "./dialogue-lease.js";

await test("keeps follow-ups scoped to the participant who invoked Mary", () => {
  const lease = new DialogueLease(45_000, 2);
  lease.open("teams:meeting-1:user-vincenzo", "Vincenzo", 1_000);

  assert.equal(lease.isActiveFor("teams:meeting-1:user-vincenzo", 2_000), true);
  assert.equal(lease.isActiveFor("teams:meeting-1:user-laura", 2_000), false);
  assert.deepEqual(lease.snapshot(2_000), {
    active: true,
    speakerName: "Vincenzo",
    activeUntil: new Date(46_000).toISOString(),
    remainingFollowUps: 2,
    maxFollowUps: 2,
  });
});

await test("closes after the configured number of natural follow-ups", () => {
  const lease = new DialogueLease(45_000, 2);
  lease.open("participant-1", "Vincenzo", 1_000);

  assert.equal(lease.consumeFollowUp("participant-1", 2_000), true);
  assert.equal(lease.snapshot(2_000).remainingFollowUps, 1);
  assert.equal(lease.consumeFollowUp("participant-1", 3_000), true);
  assert.equal(lease.snapshot(3_000).active, false);
  assert.equal(lease.consumeFollowUp("participant-1", 4_000), false);
});

await test("expires and can transfer to a different participant", () => {
  const lease = new DialogueLease(10_000, 2);
  lease.open("participant-1", "Vincenzo", 1_000);
  assert.equal(lease.isActiveFor("participant-1", 11_000), false);

  lease.open("participant-2", "Léa", 12_000);
  assert.equal(lease.isActiveFor("participant-2", 12_500), true);
  assert.equal(lease.snapshot(12_500).speakerName, "Léa");
});

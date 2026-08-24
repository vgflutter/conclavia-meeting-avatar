import assert from "node:assert/strict";
import test from "node:test";

import {
  autonomousInterventionCooldownMs,
  characterInstructions,
  defaultCharacterTraits,
  moodLevelGuidance,
  replyWordLimit,
} from "./avatar-character.js";

await test("concision materially shortens the spoken response budget", () => {
  assert.ok(
    replyWordLimit({ ...defaultCharacterTraits, concision: 90 }) <
      replyWordLimit({ ...defaultCharacterTraits, concision: 10 }),
  );
});

await test("calm characters wait longer while impulsive characters request sooner", () => {
  const measured = autonomousInterventionCooldownMs({
    ...defaultCharacterTraits,
    calmness: 90,
    impulsiveness: 10,
  });
  const impulsive = autonomousInterventionCooldownMs({
    ...defaultCharacterTraits,
    calmness: 20,
    impulsiveness: 90,
  });
  assert.ok(measured > impulsive);
  assert.ok(impulsive >= 45_000);
});

await test("the prompt carries all six explicit character dimensions", () => {
  const prompt = characterInstructions(defaultCharacterTraits);
  for (const label of [
    "calma",
    "assertività",
    "irruenza",
    "empatia",
    "sintesi",
    "espressività",
  ]) {
    assert.match(prompt, new RegExp(label, "u"));
  }
  assert.match(moodLevelGuidance(defaultCharacterTraits), /level/u);
});

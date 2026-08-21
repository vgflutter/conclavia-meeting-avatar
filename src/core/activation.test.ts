import assert from "node:assert/strict";
import test from "node:test";

import { decideActivation, isDialogueDismissal } from "./activation.js";
import type { TranscriptSegment } from "../domain/protocol.js";

function segment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: "segment-1",
    speakerName: "Vincenzo",
    text: "Mary, cosa ne pensi?",
    isFinal: true,
    capturedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

await test("activates only on a final segment containing the wake word", () => {
  const decision = decideActivation(segment(), "Mary");

  assert.equal(decision.ingested, true);
  assert.equal(decision.activated, true);
  assert.equal(decision.reason, "wake-word");
  assert.equal(decision.cue?.addressedTo, "Vincenzo");
  assert.equal(decision.cue?.provider, "diagnostic");
  assert.equal(decision.cue?.sentences[0]?.mood, "curious");
});

await test("ignores partial transcription", () => {
  const decision = decideActivation(segment({ isFinal: false }), "Mary");

  assert.deepEqual(decision, {
    ingested: false,
    activated: false,
    reason: "not-final",
  });
});

await test("ingests conversation not addressed to the avatar without responding", () => {
  const decision = decideActivation(
    segment({ text: "Secondo me dobbiamo cambiare argomento." }),
    "Mary",
  );

  assert.deepEqual(decision, {
    ingested: true,
    activated: false,
    reason: "not-addressed",
  });
});

await test("keeps responding to natural follow-up turns while dialogue is active", () => {
  const decision = decideActivation(
    segment({ text: "E secondo te quale opzione conviene?" }),
    "Mary",
    true,
  );

  assert.equal(decision.ingested, true);
  assert.equal(decision.activated, true);
  assert.equal(decision.reason, "conversation-follow-up");
});

await test("recognizes explicit dialogue dismissal phrases", () => {
  assert.equal(isDialogueDismissal("Grazie Mary, basta così.", "Mary"), true);
  assert.equal(isDialogueDismissal("Mary, puoi smettere di rispondere.", "Mary"), true);
  assert.equal(isDialogueDismissal("Grazie per il contributo.", "Mary"), false);
});

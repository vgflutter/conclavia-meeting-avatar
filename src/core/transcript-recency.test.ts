import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { isCurrentReactionSegment } from "./transcript-recency.js";

function segment(id: string, text: string, capturedAt: string, speakerName = "Vincenzo"): TranscriptSegment {
  return { id, speakerName, text, capturedAt, isFinal: true, source: "speech" };
}

await test("keeps old captions in memory without letting them drive a reaction", () => {
  const old = segment("old", "Un punto di cinque minuti fa.", "2026-08-26T12:00:00.000Z");
  assert.equal(
    isCurrentReactionSegment(old, [], "Mary", Date.parse("2026-08-26T12:05:00.000Z")),
    false,
  );
});

await test("rejects an out-of-order participant turn after a newer phrase", () => {
  const latest = segment("latest", "Questa è la frase corrente.", "2026-08-26T12:04:58.000Z");
  const delayed = segment("delayed", "Una frase precedente.", "2026-08-26T12:04:50.000Z");
  assert.equal(
    isCurrentReactionSegment(
      delayed,
      [latest],
      "Mary",
      Date.parse("2026-08-26T12:05:00.000Z"),
    ),
    false,
  );
});

await test("accepts the latest fresh participant phrase", () => {
  const prior = segment("prior", "Prima frase.", "2026-08-26T12:04:55.000Z");
  const latest = segment("latest", "Ultima frase.", "2026-08-26T12:04:59.000Z");
  assert.equal(
    isCurrentReactionSegment(
      latest,
      [prior, segment("mary", "Risposta.", "2026-08-26T12:05:00.000Z", "Mary")],
      "Mary",
      Date.parse("2026-08-26T12:05:00.000Z"),
    ),
    true,
  );
});

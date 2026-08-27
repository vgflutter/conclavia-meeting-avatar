import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { immediateResponseFor } from "./immediate-response.js";

function segment(text: string): TranscriptSegment {
  return {
    id: "segment-1",
    speakerName: "Vincenzo",
    text,
    isFinal: true,
    capturedAt: "2026-08-25T10:00:00.000Z",
  };
}

await test("answers a basic listening check without the LLM", () => {
  const cue = immediateResponseFor(segment("Mary, mi ascolti?"), "Mary");
  assert.equal(cue?.provider, "system");
  assert.equal(cue?.sentences[0]?.text, "Sì, ti ascolto.");
  assert.equal(cue?.sentences[0]?.mood, "attentive");
  assert.equal(cue?.sentences[0]?.level, 2);
});

await test("accepts a natural greeting before the avatar name", () => {
  assert.equal(
    immediateResponseFor(segment("Ciao Mary, mi senti bene?"), "Mary")
      ?.sentences[0]?.text,
    "Sì, ti sento.",
  );
  assert.equal(
    immediateResponseFor(segment("Ciao ciao Mary"), "Mary")
      ?.sentences[0]?.text,
    "Ciao! Sono qui.",
  );
});

await test("answers presence and greeting checks locally", () => {
  assert.equal(
    immediateResponseFor(segment("Mary, ci sei?"), "Mary")?.sentences[0]?.text,
    "Sì, sono qui e sono pronta.",
  );
  assert.equal(
    immediateResponseFor(segment("Buongiorno Mary"), "Mary")?.sentences[0]?.text,
    "Ciao! Sono qui.",
  );
});

await test("describes real meeting capabilities locally and with sentence moods", () => {
  const cue = immediateResponseFor(
    segment("Ciao Mary, puoi elencare le tue funzionalità?"),
    "Mary",
  );

  assert.equal(cue?.provider, "system");
  assert.equal(cue?.sentences.length, 3);
  assert.match(cue?.sentences[0]?.text ?? "", /contesto della riunione/u);
  assert.match(cue?.sentences[1]?.text ?? "", /alzare o abbassare la mano/u);
  assert.match(cue?.sentences[2]?.text ?? "", /scaletta con i tempi/u);
  assert.deepEqual(
    cue?.sentences.map(({ mood }) => mood),
    ["confident", "assertive", "amused"],
  );
});

await test("accepts concise variants of the capabilities question", () => {
  assert.ok(immediateResponseFor(segment("Mary, cosa sai fare?"), "Mary"));
  assert.ok(immediateResponseFor(segment("Mary, quali sono le tue capacità?"), "Mary"));
  assert.ok(immediateResponseFor(segment("Mary, descrivi le tue funzioni"), "Mary"));
});

await test("never shortcuts a substantive request", () => {
  assert.equal(
    immediateResponseFor(
      segment("Mary, mi ascolti e poi riassumi la discussione?"),
      "Mary",
    ),
    null,
  );
  assert.equal(
    immediateResponseFor(segment("Vincenzo, mi ascolti?"), "Mary"),
    null,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { parseMaryReply } from "./meeting-intelligence.js";

await test("parses sentence-level moods from Mary JSON", () => {
  assert.deepEqual(
    parseMaryReply(
      '{"sentences":[{"text":"Sono d’accordo.","mood":"confident"},{"text":"Verifichiamo i rischi.","mood":"concerned"}]}',
    ),
    [
      { text: "Sono d’accordo.", mood: "confident" },
      { text: "Verifichiamo i rischi.", mood: "concerned" },
    ],
  );
});

await test("accepts fenced JSON and normalizes an unknown mood", () => {
  assert.deepEqual(
    parseMaryReply('```json\n{"sentences":[{"text":"Eccomi.","mood":"felice"}]}\n```'),
    [{ text: "Eccomi.", mood: "neutral" }],
  );
});

await test("keeps a plain text response usable", () => {
  assert.deepEqual(parseMaryReply("Posso aiutarvi."), [
    { text: "Posso aiutarvi.", mood: "neutral" },
  ]);
});

await test("accepts a deliberate no-response participation decision", () => {
  assert.deepEqual(parseMaryReply('{"respond":false,"sentences":[]}'), []);
});

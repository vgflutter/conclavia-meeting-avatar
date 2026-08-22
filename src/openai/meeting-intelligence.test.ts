import assert from "node:assert/strict";
import test from "node:test";

import { parseMaryReply, parseMaryTurn } from "./meeting-intelligence.js";

await test("parses sentence-level moods from Mary JSON", () => {
  assert.deepEqual(
    parseMaryReply(
      '{"sentences":[{"text":"Sono d’accordo.","mood":"confident","level":3},{"text":"Verifichiamo i rischi.","mood":"concerned","level":4}]}',
    ),
    [
      { text: "Sono d’accordo.", mood: "confident", level: 3, language: "it-IT" },
      { text: "Verifichiamo i rischi.", mood: "concerned", level: 4, language: "it-IT" },
    ],
  );
});

await test("accepts fenced JSON and normalizes an unknown mood", () => {
  assert.deepEqual(
    parseMaryReply('```json\n{"sentences":[{"text":"Eccomi.","mood":"felice","level":9}]}\n```'),
    [{ text: "Eccomi.", mood: "neutral", level: 5, language: "it-IT" }],
  );
});

await test("keeps a plain text response usable", () => {
  assert.deepEqual(parseMaryReply("Posso aiutarvi."), [
    { text: "Posso aiutarvi.", mood: "neutral", level: 2, language: "it-IT" },
  ]);
});

await test("accepts a deliberate no-response participation decision", () => {
  assert.deepEqual(parseMaryReply('{"respond":false,"sentences":[]}'), []);
});

await test("turns an observer response into a request instead of autonomous speech", () => {
  assert.deepEqual(
    parseMaryTurn(
      '{"action":"speak","reason":"Ho un dato utile.","sentences":[{"text":"Posso aggiungere un dato.","mood":"attentive","level":2}]}',
      "observer",
    ),
    {
      action: "request-to-speak",
      reason: "Ho un dato utile.",
      listeningMood: "attentive",
      listeningLevel: 2,
      sentences: [{
        text: "Posso aggiungere un dato.",
        mood: "attentive",
        level: 2,
        language: "it-IT",
      }],
    },
  );
});

await test("parses the social reaction to what Mary heard even when she stays silent", () => {
  assert.deepEqual(
    parseMaryTurn(
      '{"action":"silence","reason":"Sto ascoltando.","listeningMood":"empathetic","listeningLevel":3,"sentences":[]}',
      "observer",
    ),
    {
      action: "silence",
      reason: "Sto ascoltando.",
      listeningMood: "empathetic",
      listeningLevel: 3,
      sentences: [],
    },
  );
});

await test("never lets malformed observer output speak", () => {
  assert.equal(parseMaryTurn("Vorrei intervenire.", "observer").action, "silence");
});

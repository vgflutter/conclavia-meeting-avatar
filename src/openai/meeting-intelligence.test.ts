import assert from "node:assert/strict";
import test from "node:test";

import {
  maxOutputTokensForLane,
  parseMaryReply,
  parseMaryTurn,
  participationLane,
  qualifiesAutonomousIntervention,
} from "./meeting-intelligence.js";

await test("uses a compact LLM lane when Mary only needs to react while listening", () => {
  assert.equal(participationLane("direct", false), "direct");
  assert.equal(participationLane("observer", false), "observer-listening");
  assert.equal(participationLane("observer", true), "observer-autonomy");
  assert.ok(
    maxOutputTokensForLane("observer-listening") < maxOutputTokensForLane("direct"),
  );
  assert.ok(
    maxOutputTokensForLane("direct") < maxOutputTokensForLane("observer-autonomy"),
  );
});

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
      '{"action":"speak","reason":"Manca un vincolo decisivo.","interventionType":"critical-omission","importance":5,"confidence":4,"sentences":[{"text":"Posso aggiungere un vincolo importante.","mood":"concerned","level":3}]}',
      "observer",
    ),
    {
      action: "request-to-speak",
      reason: "Manca un vincolo decisivo.",
      interventionType: "critical-omission",
      importance: 5,
      confidence: 4,
      listeningMood: "attentive",
      listeningLevel: 2,
      sentences: [{
        text: "Posso aggiungere un vincolo importante.",
        mood: "concerned",
        level: 3,
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
      interventionType: "none",
      importance: 1,
      confidence: 1,
      listeningMood: "empathetic",
      listeningLevel: 3,
      sentences: [],
    },
  );
});

await test("never lets malformed observer output speak", () => {
  assert.equal(parseMaryTurn("Vorrei intervenire.", "observer").action, "silence");
});

await test("requires material importance and confidence before an autonomous request", () => {
  const materialCorrection = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Il dato è materialmente errato.","interventionType":"factual-correction","importance":4,"confidence":5,"sentences":[{"text":"Il dato corretto cambia la conclusione.","mood":"assertive","level":3}]}',
    "observer",
  );
  const marginalAddition = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Potrei aggiungere un dettaglio.","interventionType":"material-addition","importance":3,"confidence":5,"sentences":[{"text":"Aggiungerei un dettaglio.","mood":"attentive","level":2}]}',
    "observer",
  );
  const uncertainCorrection = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Forse il dato è errato.","interventionType":"factual-correction","importance":5,"confidence":3,"sentences":[{"text":"Forse il dato non è corretto.","mood":"skeptical","level":2}]}',
    "observer",
  );

  assert.equal(qualifiesAutonomousIntervention(materialCorrection), true);
  assert.equal(qualifiesAutonomousIntervention(marginalAddition), false);
  assert.equal(qualifiesAutonomousIntervention(uncertainCorrection), false);
});

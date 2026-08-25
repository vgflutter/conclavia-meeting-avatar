import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSufficientAutonomousApplauseContext,
  maxOutputTokensForLane,
  meetingContextBudget,
  parseMaryReply,
  parseMaryTurn,
  participationLane,
  qualifiesAutonomousApplause,
  qualifiesAutonomousIntervention,
  shouldOfferWebSearch,
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

await test("keeps ordinary direct questions off the web-search planning path", () => {
  assert.equal(shouldOfferWebSearch(true, "direct", "Mary, quanto fa due più due?"), false);
  assert.equal(
    shouldOfferWebSearch(true, "direct", "Mary, spiegami perché una coda riduce la latenza."),
    false,
  );
  assert.equal(shouldOfferWebSearch(false, "direct", "Mary, cerca online le ultime notizie."), false);
});

await test("offers web search for explicit or time-sensitive direct questions", () => {
  assert.equal(
    shouldOfferWebSearch(true, "direct", "Mary, cerca online la documentazione aggiornata."),
    true,
  );
  assert.equal(
    shouldOfferWebSearch(true, "direct", "Mary, chi è attualmente il presidente?"),
    true,
  );
  assert.equal(
    shouldOfferWebSearch(true, "direct", "Mary, qual è il prezzo di questa azione oggi?"),
    true,
  );
  assert.equal(shouldOfferWebSearch(true, "direct", "Read https://example.com/report"), true);
});

await test("preserves web verification for material autonomous decisions", () => {
  assert.equal(shouldOfferWebSearch(true, "observer-autonomy", "Questo dato è sbagliato."), true);
  assert.equal(shouldOfferWebSearch(true, "observer-listening", "Ultime notizie."), false);
});

await test("uses lane-aware meeting context without weakening summaries", () => {
  const listening = meetingContextBudget("observer-listening", "Continuiamo.");
  const direct = meetingContextBudget("direct", "Mary, cosa suggerisci?");
  const autonomy = meetingContextBudget("observer-autonomy", "Questo dato cambia la decisione.");
  const summary = meetingContextBudget("direct", "Mary, riassumi l'intera riunione in chat.");

  assert.ok(listening.maximumCharacters < direct.maximumCharacters);
  assert.ok(listening.maximumSegments < direct.maximumSegments);
  assert.ok(direct.maximumCharacters < autonomy.maximumCharacters);
  assert.ok(direct.maximumSegments < autonomy.maximumSegments);
  assert.deepEqual(summary, { maximumCharacters: 14_000, maximumSegments: 80 });
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

await test("never publishes truncated structured output as speech or chat text", () => {
  assert.throws(
    () => parseMaryTurn(
      '{"action":"speak","sentences":[{"text":"Risposta interrotta',
      "direct",
    ),
    /incomplete structured response/u,
  );
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

await test("reserves autonomous applause for a highly significant conclusion", () => {
  const meaningfulConclusion = parseMaryTurn(
    '{"action":"applaud","reason":"Il gruppo ha concluso un ragionamento complesso con un risultato decisivo.","interventionType":"meaningful-conclusion","importance":5,"confidence":4,"listeningMood":"amused","listeningLevel":3,"sentences":[]}',
    "observer",
  );
  const ordinaryGoodPoint = parseMaryTurn(
    '{"action":"applaud","reason":"È un punto interessante.","interventionType":"meaningful-conclusion","importance":4,"confidence":5,"listeningMood":"attentive","listeningLevel":2,"sentences":[]}',
    "observer",
  );

  assert.equal(meaningfulConclusion.action, "applaud");
  assert.equal(qualifiesAutonomousApplause(meaningfulConclusion), true);
  assert.equal(qualifiesAutonomousApplause(ordinaryGoodPoint), false);
  assert.equal(qualifiesAutonomousIntervention(meaningfulConclusion), false);
});

await test("requires substantive meeting context before autonomous applause", () => {
  assert.equal(
    hasSufficientAutonomousApplauseContext(
      "Abbiamo chiuso il budget e possiamo partire lunedì.",
      ["Abbiamo chiuso il budget e possiamo partire lunedì."],
    ),
    false,
  );
  assert.equal(
    hasSufficientAutonomousApplauseContext(
      "Abbiamo isolato la causa, confrontato tre alternative e dimostrato che il nuovo flusso elimina il collo di bottiglia senza aumentare costi o rischi operativi.",
      [],
    ),
    true,
  );
  assert.equal(
    hasSufficientAutonomousApplauseContext("Quindi adottiamo questa soluzione.", [
      "Il primo test ha mostrato che la coda seriale aggiunge quasi quattro secondi a ogni risposta durante una normale conversazione.",
      "Parallelizzando sintesi e preparazione del gesto eliminiamo la maggior parte dell'attesa percepita senza aumentare il carico del renderer.",
      "Quindi adottiamo questa soluzione e manteniamo il fallback precedente per ridurre il rischio operativo del rilascio di domani.",
    ]),
    true,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";

import {
  canOpenAutonomousRequest,
  firstStreamedSpeechSentence,
  hasSufficientAutonomousApplauseContext,
  maxOutputTokensForLane,
  maxOutputTokensForTurn,
  meetingContextBudget,
  parseMaryReply,
  parseMaryTurn,
  participationLane,
  qualifiesAutonomousApplause,
  qualifiesAutonomousIntervention,
  requiresCompleteMeetingContext,
  shouldOfferWebSearch,
  transcriptForModel,
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

await test("keeps self-contained direct questions on the fast path", () => {
  assert.equal(shouldOfferWebSearch(true, "direct", "Mary, quanto fa due più due?"), false);
  assert.equal(
    shouldOfferWebSearch(true, "direct", "Mary, spiegami perché una coda riduce la latenza."),
    false,
  );
  assert.equal(shouldOfferWebSearch(false, "direct", "Mary, cerca online le ultime notizie."), false);
  assert.equal(maxOutputTokensForTurn("direct", "Mary, quanto fa due più due?"), 220);
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

await test("uses compact direct context except for meeting-wide requests", () => {
  const listening = meetingContextBudget("observer-listening", "Continuiamo.");
  const direct = meetingContextBudget("direct", "Mary, cosa suggerisci?");
  const autonomy = meetingContextBudget("observer-autonomy", "Questo dato cambia la decisione.");
  const summary = meetingContextBudget("direct", "Mary, riassumi l'intera riunione in chat.");

  assert.ok(listening.maximumCharacters < direct.maximumCharacters);
  assert.ok(listening.maximumSegments < direct.maximumSegments);
  assert.ok(direct.maximumSegments < autonomy.maximumSegments);
  assert.deepEqual(direct, {
    maximumCharacters: 8_000,
    maximumSegments: 32,
    maximumAgeMs: null,
  });
  assert.deepEqual(summary, {
    maximumCharacters: 48_000,
    maximumSegments: 200,
    maximumAgeMs: null,
  });
  assert.equal(requiresCompleteMeetingContext("Mary, fammi il resoconto"), true);
  assert.equal(requiresCompleteMeetingContext("Mary, quanto fa due più due?"), false);
  assert.equal(maxOutputTokensForTurn("direct", "Mary, riassumi la riunione"), 320);
});

await test("keeps recent direct memory but bounds observer context by age", () => {
  const oldSegment: TranscriptSegment = {
    id: "old",
    speakerName: "Vincenzo",
    text: "Questa frase è vecchia.",
    isFinal: true,
    capturedAt: "2026-08-26T12:00:00.000Z",
    source: "speech",
  };
  const recentSegment: TranscriptSegment = {
    ...oldSegment,
    id: "recent",
    text: "Questa frase è recente.",
    capturedAt: "2026-08-26T12:04:45.000Z",
  };
  const latestSegment: TranscriptSegment = {
    ...oldSegment,
    id: "latest",
    text: "Questa è l'ultima frase.",
    capturedAt: "2026-08-26T12:05:00.000Z",
  };

  const observerContext = transcriptForModel(
    [oldSegment, recentSegment, latestSegment],
    latestSegment,
    meetingContextBudget("observer-autonomy", latestSegment.text),
  );
  const directContext = transcriptForModel(
    [oldSegment, recentSegment, latestSegment],
    latestSegment,
    meetingContextBudget("direct", latestSegment.text),
  );
  assert.doesNotMatch(observerContext, /vecchia/u);
  assert.match(observerContext, /recente/u);
  assert.match(directContext, /vecchia/u);
  assert.match(directContext, /recente/u);
});

await test("extracts the first spoken sentence before streamed mood metadata completes", () => {
  assert.deepEqual(
    firstStreamedSpeechSentence(
      '{"action":"speak","sentences":[{"text":"Nevis è un’isola caraibica.","mood":"neu',
    ),
    {
      text: "Nevis è un’isola caraibica.",
      mood: "neutral",
      level: 1,
      language: "it-IT",
    },
  );
  assert.equal(
    firstStreamedSpeechSentence('{"action":"speak","sentences":[{"text":"Ancora incompleta'),
    null,
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

await test("uses stricter thresholds for subjective omissions and additions", () => {
  const ordinaryOmission = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Manca un dettaglio.","interventionType":"critical-omission","importance":4,"confidence":5,"sentences":[{"text":"Aggiungerei un dettaglio.","mood":"attentive","level":2}]}',
    "observer",
  );
  const decisiveOmission = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Manca un vincolo decisivo.","interventionType":"critical-omission","importance":5,"confidence":4,"sentences":[{"text":"Il vincolo cambia la decisione.","mood":"concerned","level":3}]}',
    "observer",
  );
  const uncertainAddition = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Potrebbe essere utile.","interventionType":"material-addition","importance":5,"confidence":4,"sentences":[{"text":"Aggiungerei un contesto.","mood":"attentive","level":2}]}',
    "observer",
  );

  assert.equal(qualifiesAutonomousIntervention(ordinaryOmission), false);
  assert.equal(qualifiesAutonomousIntervention(decisiveOmission), true);
  assert.equal(qualifiesAutonomousIntervention(uncertainAddition), false);
});

await test("does not let cooldown hide a certain critical factual error", () => {
  const arithmeticError = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Il calcolo dichiarato è falso.","interventionType":"factual-correction","importance":5,"confidence":5,"sentences":[{"text":"Tre più tre fa sei, non nove.","mood":"assertive","level":3}]}',
    "observer",
  );
  const marginalAddition = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Potrei aggiungere un dettaglio.","interventionType":"material-addition","importance":3,"confidence":5,"sentences":[{"text":"Aggiungerei un dettaglio.","mood":"attentive","level":2}]}',
    "observer",
  );
  const importantOmission = parseMaryTurn(
    '{"action":"request-to-speak","reason":"Manca un vincolo decisivo.","interventionType":"critical-omission","importance":5,"confidence":5,"sentences":[{"text":"Manca il vincolo normativo.","mood":"concerned","level":3}]}',
    "observer",
  );

  assert.equal(canOpenAutonomousRequest(arithmeticError, false), true);
  assert.equal(canOpenAutonomousRequest(marginalAddition, false), false);
  assert.equal(canOpenAutonomousRequest(importantOmission, false), false);
  assert.equal(canOpenAutonomousRequest(importantOmission, true), true);
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

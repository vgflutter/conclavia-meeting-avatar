import assert from "node:assert/strict";
import test from "node:test";

import {
  decideActivation,
  isAddressedToAvatar,
  isAutonomyCandidate,
  isDialogueFollowUpCandidate,
  isDialogueDismissal,
  isFloorGrant,
} from "./activation.js";
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

await test("does not treat unrelated meeting chatter as an active-dialogue follow-up", () => {
  const decision = decideActivation(
    segment({ text: "Il preventivo del fornitore arriva domani mattina." }),
    "Mary",
    true,
  );

  assert.equal(decision.activated, false);
  assert.equal(decision.reason, "not-addressed");
  assert.equal(isDialogueFollowUpCandidate("Puoi approfondire questo punto?"), true);
  assert.equal(isDialogueFollowUpCandidate("E perché?"), true);
  assert.equal(isDialogueFollowUpCandidate("E per domani?"), true);
  assert.equal(isDialogueFollowUpCandidate("Parliamo del preventivo domani."), false);
});

await test("uses any exact avatar-name mention as the explicit wake trigger", () => {
  assert.equal(isAddressedToAvatar("Mary, cosa suggerisci?", "Mary"), true);
  assert.equal(isAddressedToAvatar("Mary mi ascolti", "Mary"), true);
  assert.equal(isAddressedToAvatar("Mary mi senti", "Mary"), true);
  assert.equal(isAddressedToAvatar("Mary buongiorno", "Mary"), true);
  assert.equal(isAddressedToAvatar("Ciao Mary, come stai oggi?", "Mary"), true);
  assert.equal(
    isAddressedToAvatar(
      "Ciao Mary, possiamo parlare del rapporto di avanzamento per il progetto Alpha?",
      "Mary",
    ),
    true,
  );
  assert.equal(isAddressedToAvatar("Scusa, Mary, mi ascolti?", "Mary"), true);
  assert.equal(isAddressedToAvatar("Ehi Mary, puoi aiutarci?", "Mary"), true);
  assert.equal(
    isAddressedToAvatar(
      "Vediamo quanto tempo ci mette a rispondere. Mary, quanto fa 2 per 2?",
      "Mary",
    ),
    true,
  );
  assert.equal(
    isAddressedToAvatar(
      "La trascrizione si è fermata... Mary, quanto fa 2 per 2?",
      "Mary",
    ),
    true,
  );
  assert.equal(isAddressedToAvatar("Ciao Pippo, Mary, che dici?", "Mary"), true);
  assert.equal(isAddressedToAvatar("Ciao Pippo Mary, come stai?", "Mary"), true);
  assert.equal(
    isAddressedToAvatar("Pippo ha finito. Ehi Mary, cosa suggerisci?", "Mary"),
    true,
  );
  assert.equal(isAddressedToAvatar("Che cosa suggerisci, Mary?", "Mary"), true);
  assert.equal(isAddressedToAvatar("Ciao a tutti, sono Mary.", "Mary"), true);
  assert.equal(
    isAddressedToAvatar("Buongiorno a tutti, Mary ci raggiunge più tardi.", "Mary"),
    true,
  );
  assert.equal(isAddressedToAvatar("Mary ha già risposto a questa domanda.", "Mary"), true);
  assert.equal(
    isAddressedToAvatar(
      "Abbiamo discusso il problema. Mary ha già risposto a questa domanda.",
      "Mary",
    ),
    true,
  );
  assert.equal(isAddressedToAvatar("Ciao Pippo, Mary arriva dopo.", "Mary"), true);
  assert.equal(
    isAddressedToAvatar("Ciao Pippo, Mary, arriva dopo la pausa.", "Mary"),
    true,
  );
  assert.equal(isAddressedToAvatar("Mariano ci raggiunge più tardi.", "Mary"), false);
  assert.equal(isAddressedToAvatar("Il progetto Maryland è pronto.", "Mary"), false);
  assert.equal(isAddressedToAvatar("Ciao Mary   Jane, come stai?", "Mary Jane"), true);
  assert.equal(
    decideActivation(segment({ text: "Mary ha già risposto a questa domanda." }), "Mary")
      .activated,
    true,
  );
});

await test("recognizes explicit dialogue dismissal phrases", () => {
  assert.equal(isDialogueDismissal("Grazie Mary, basta così.", "Mary"), true);
  assert.equal(isDialogueDismissal("Mary, puoi smettere di rispondere.", "Mary"), true);
  assert.equal(isDialogueDismissal("Thank you Mary.", "Mary"), true);
  assert.equal(isDialogueDismissal("Grazie per il contributo.", "Mary"), false);
});

await test("recognizes an explicit grant after a request to speak", () => {
  assert.equal(isFloorGrant("Mary, vai pure.", "Mary"), true);
  assert.equal(isFloorGrant("Prego Mary, intervieni.", "Mary"), true);
  assert.equal(isFloorGrant("Mary, go ahead.", "Mary"), true);
  assert.equal(isFloorGrant("Vai avanti Luca.", "Mary"), false);
});

await test("only sends substantial meeting turns to the autonomy evaluator", () => {
  assert.equal(isAutonomyCandidate("Sì, ok."), false);
  assert.equal(isAutonomyCandidate("Il dato trimestrale è cambiato rispetto alla previsione."), true);
});

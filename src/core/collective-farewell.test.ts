import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { CollectiveFarewellTracker } from "./collective-farewell.js";

const baseTime = Date.parse("2026-08-24T18:00:00.000Z");

function segment(
  id: string,
  speakerName: string,
  text: string,
  offsetMs: number,
  speakerId = speakerName.toLocaleLowerCase("it-IT"),
): TranscriptSegment {
  return {
    id,
    speakerId,
    speakerName,
    text,
    isFinal: true,
    capturedAt: new Date(baseTime + offsetMs).toISOString(),
    source: "speech",
    platform: "generic",
    meetingId: "meeting-1",
  };
}

const discussion = [
  segment("1", "Vincenzo", "Abbiamo definito le priorità del rilascio e verificato tutti i rischi.", 0),
  segment("2", "Giulia", "Confermo che il team può partire domani con la prima attività prevista.", 5_000),
];

await test("joins a collective Italian farewell once the meeting is closing", () => {
  const tracker = new CollectiveFarewellTracker();
  const first = segment("3", "Vincenzo", "Ciao a tutti.", 20_000);
  const second = segment("4", "Giulia", "Buona serata, a presto!", 24_000);

  assert.equal(tracker.consider([...discussion, first], first, "Mary"), null);
  const decision = tracker.consider([...discussion, first, second], second, "Mary");

  assert.equal(decision?.signalCount, 2);
  assert.equal(decision?.participantCount, 2);
  assert.equal(decision?.cue.provider, "system");
  assert.equal(decision?.cue.sentences[0]?.mood, "amused");
  assert.match(decision?.cue.sentences[0]?.text ?? "", /A presto/u);
});

await test("does not mistake opening greetings for a closing wave", () => {
  const tracker = new CollectiveFarewellTracker();
  const first = segment("1", "Vincenzo", "Ciao a tutti.", 0);
  const second = segment("2", "Giulia", "Ciao!", 2_000);

  assert.equal(tracker.consider([first, second], second, "Mary"), null);
});

await test("does not treat an ordinary group thank-you as the end of the meeting", () => {
  const tracker = new CollectiveFarewellTracker();
  const thanks = segment("3", "Vincenzo", "Grazie a tutti per il contributo, passiamo al prossimo punto.", 20_000);

  assert.equal(tracker.consider([...discussion, thanks], thanks, "Mary"), null);
});

await test("works when mixed meeting audio cannot distinguish speakers", () => {
  const tracker = new CollectiveFarewellTracker();
  const first = segment("3", "Partecipante meeting", "Ciao a tutti.", 20_000, "shared-audio");
  const second = segment("4", "Partecipante meeting", "Arrivederci e buona serata.", 24_000, "shared-audio");

  const decision = tracker.consider([...discussion, first, second], second, "Mary");
  assert.equal(decision?.signalCount, 2);
  assert.equal(decision?.participantCount, 1);
});

await test("answers only once during the same farewell wave", () => {
  const tracker = new CollectiveFarewellTracker();
  const first = segment("3", "Vincenzo", "Arrivederci.", 20_000);
  const second = segment("4", "Giulia", "A presto!", 24_000);
  const third = segment("5", "Luca", "Buona serata a tutti.", 28_000);

  assert.ok(tracker.consider([...discussion, first, second], second, "Mary"));
  assert.equal(tracker.consider([...discussion, first, second, third], third, "Mary"), null);
});

await test("uses an English farewell when the closing wave is in English", () => {
  const tracker = new CollectiveFarewellTracker();
  const first = segment("3", "Vincenzo", "Goodbye everyone.", 20_000);
  const second = segment("4", "Giulia", "See you soon!", 24_000);

  const decision = tracker.consider([...discussion, first, second], second, "Mary");
  assert.equal(decision?.cue.sentences[0]?.language, "en-US");
  assert.match(decision?.cue.sentences[0]?.text ?? "", /See you soon/u);
});

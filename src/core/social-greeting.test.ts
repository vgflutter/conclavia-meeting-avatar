import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { SocialGreetingTracker } from "./social-greeting.js";

const baseTime = Date.parse("2026-08-27T17:00:00.000Z");

function segment(id: string, text: string, offsetMs = 0): TranscriptSegment {
  return {
    id,
    speakerId: "vincenzo",
    speakerName: "Vincenzo",
    text,
    isFinal: true,
    capturedAt: new Date(baseTime + offsetMs).toISOString(),
    source: "speech",
    platform: "generic",
    meetingId: "meeting-1",
  };
}

await test("joins an explicit greeting addressed to another participant", () => {
  const tracker = new SocialGreetingTracker();
  const decision = tracker.consider(segment("1", "Ciao Stefano, benvenuto!"), "Mary");

  assert.equal(decision?.targetName, "Stefano");
  assert.equal(decision?.cue.provider, "system");
  assert.equal(decision?.cue.sentences[0]?.text, "Ciao a tutti!");
  assert.equal(decision?.cue.sentences[0]?.mood, "amused");
  assert.equal(decision?.cue.addressedTo, "meeting");
});

await test("supports punctuation, Italian day greetings and English greetings", () => {
  const italian = new SocialGreetingTracker().consider(
    segment("1", "Buongiorno, giulia. Come stai?"),
    "Mary",
  );
  const english = new SocialGreetingTracker().consider(
    segment("2", "Hello John, welcome."),
    "Mary",
  );

  assert.equal(italian?.cue.sentences[0]?.text, "Ciao a tutti!");
  assert.equal(english?.cue.sentences[0]?.text, "Ciao a tutti!");
  assert.equal(english?.cue.sentences[0]?.language, "it-IT");
});

await test("does not join generic greetings or a greeting addressed to Mary", () => {
  const tracker = new SocialGreetingTracker();

  assert.equal(tracker.consider(segment("1", "Ciao a tutti!"), "Mary"), null);
  assert.equal(tracker.consider(segment("2", "Ciao team"), "Mary"), null);
  assert.equal(tracker.consider(segment("3", "Ciao Mary"), "Mary"), null);
  assert.equal(tracker.consider(segment("4", "Oggi ho detto ciao a Stefano"), "Mary"), null);
});

await test("greets the room only once during the same entrance wave", () => {
  const tracker = new SocialGreetingTracker();

  assert.ok(tracker.consider(segment("1", "Ciao Stefano"), "Mary"));
  assert.equal(
    tracker.consider(segment("2", "Buongiorno Giulia", 5_000), "Mary"),
    null,
  );
  assert.ok(
    tracker.consider(segment("3", "Ciao Stefano", 10 * 60_000 + 1), "Mary"),
  );
});

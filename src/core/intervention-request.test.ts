import assert from "node:assert/strict";
import test from "node:test";

import type { AvatarSpeechCue, TranscriptSegment } from "../domain/protocol.js";
import {
  createInterventionRequest,
  grantedInterventionCue,
} from "./intervention-request.js";

const disputedSegment: TranscriptSegment = {
  id: "claim-1",
  speakerName: "Vincenzo",
  text: "Secondo me tre più tre fa nove.",
  isFinal: true,
  capturedAt: "2026-08-26T15:40:00.000Z",
  source: "speech",
};

const proposedCue: AvatarSpeechCue = {
  id: "draft-1",
  kind: "speak",
  provider: "openai",
  model: "gpt-test",
  speakerName: "Mary",
  sentences: [{
    text: "Tre più tre fa sei, non nove.",
    mood: "assertive",
    level: 3,
    language: "it-IT",
  }],
  addressedTo: "Vincenzo",
  sourceSegmentIds: ["context-1", "claim-1"],
  createdAt: "2026-08-26T15:40:01.000Z",
};

await test("preserves the objection, reason and correction draft while waiting", () => {
  const request = createInterventionRequest({
    avatarName: "Mary",
    segment: disputedSegment,
    reason: "L'affermazione aritmetica è oggettivamente falsa.",
    interventionType: "factual-correction",
    importance: 4,
    confidence: 5,
    proposedCue,
    ttlMs: 60_000,
    now: new Date("2026-08-26T15:40:02.000Z"),
  });

  assert.deepEqual(request.objection, {
    sourceSegmentId: "claim-1",
    speakerName: "Vincenzo",
    statement: "Secondo me tre più tre fa nove.",
    capturedAt: "2026-08-26T15:40:00.000Z",
  });
  assert.equal(request.reason, "L'affermazione aritmetica è oggettivamente falsa.");
  assert.deepEqual(request.draft, proposedCue.sentences);
  assert.equal(request.expiresAt, "2026-08-26T15:41:02.000Z");
});

await test("answers with the preserved correction when the floor is granted", () => {
  const request = createInterventionRequest({
    avatarName: "Mary",
    segment: disputedSegment,
    reason: "Il calcolo è errato.",
    interventionType: "factual-correction",
    importance: 4,
    confidence: 5,
    proposedCue,
    ttlMs: 60_000,
  });
  const grantSegment: TranscriptSegment = {
    id: "grant-1",
    speakerName: "Giulia",
    text: "Mary, cosa volevi aggiungere?",
    isFinal: true,
    capturedAt: "2026-08-26T15:40:10.000Z",
    source: "speech",
  };

  const cue = grantedInterventionCue(
    request,
    grantSegment,
    new Date("2026-08-26T15:40:11.000Z"),
  );
  assert.deepEqual(cue.sentences, proposedCue.sentences);
  assert.equal(cue.addressedTo, "Giulia");
  assert.deepEqual(cue.sourceSegmentIds, ["context-1", "claim-1", "grant-1"]);
  assert.equal(cue.createdAt, "2026-08-26T15:40:11.000Z");
  assert.notEqual(cue.id, proposedCue.id);
});

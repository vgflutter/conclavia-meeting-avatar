import assert from "node:assert/strict";
import test from "node:test";

import type { AvatarSpeechCue } from "../domain/protocol.js";
import { PerformanceHub } from "./performance-hub.js";
import { WebPerformanceRenderer } from "./web-performance-renderer.js";

const cue: AvatarSpeechCue = {
  id: "cue-web",
  kind: "speak",
  provider: "openai",
  model: "gpt-test",
  speakerName: "Mary",
  sentences: [
    { text: "Ciao.", mood: "amused", level: 4, language: "it-IT" },
    { text: "Ti ascolto.", mood: "attentive", level: 3, language: "it-IT" },
  ],
  addressedTo: "Vincenzo",
  sourceSegmentIds: ["segment-web"],
  createdAt: "2026-08-25T08:00:00.000Z",
};

await test("runs a full browser performance without an Unreal session", async () => {
  const hub = new PerformanceHub();
  const renderer = new WebPerformanceRenderer(
    hub,
    "http://127.0.0.1:4310",
    () => Promise.resolve({
      audio: new Uint8Array(3_200),
      marks: [{ time: 25, type: "viseme", value: "p" }],
      voice: "Bianca",
      languageCode: "it-IT",
      engine: "neural",
    }),
  );

  const session = await renderer.start("showcase");
  const delivery = await renderer.deliver(cue);
  const packets = hub.since(0);
  const speech = packets.find((packet) => packet.kind === "speech");

  assert.equal(session.playerUrl, "http://127.0.0.1:4310/web-output");
  assert.equal(delivery.delivered, true);
  assert.equal(delivery.sentenceCount, 2);
  assert.equal(delivery.durationMs, 280);
  assert.deepEqual(delivery.voiceEngines, ["neural"]);
  assert.equal(speech?.clock.source, "audio");
  assert.deepEqual(speech?.tracks.visemes.map((item) => item.atMs), [25, 205]);
  assert.ok(speech?.audio?.assetId);
  assert.equal(hub.audioAsset(speech.audio.assetId)?.bytes.byteLength, 9_004);
});

await test("publishes physical gestures and interrupt events", async () => {
  const hub = new PerformanceHub();
  const renderer = new WebPerformanceRenderer(hub, "http://127.0.0.1:4310");
  await renderer.start("showcase");
  await renderer.raiseHand("Mary");
  await renderer.applaud("Mary", "Vincenzo");
  await renderer.interruptSpeech("Mary");

  const packets = hub.since(0);
  assert.equal(packets.some((packet) => packet.events[0]?.type === "raise-hand"), true);
  assert.equal(packets.some((packet) => packet.events[0]?.type === "applause"), true);
  assert.equal(packets.at(-1)?.events[0]?.type, "interrupt");
});

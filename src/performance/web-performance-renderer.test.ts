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
  const speech = packets.filter((packet) => packet.kind === "speech");

  assert.equal(session.playerUrl, "http://127.0.0.1:4310/web-output");
  assert.equal(delivery.delivered, true);
  assert.equal(delivery.sentenceCount, 2);
  assert.equal(delivery.durationMs, 280);
  assert.deepEqual(delivery.voiceEngines, ["neural"]);
  assert.equal(speech.length, 2);
  assert.deepEqual(speech.map((packet) => packet.clock.durationMs), [180, 100]);
  assert.deepEqual(speech.map((packet) => packet.tracks.visemes[0]?.atMs), [25, 25]);
  assert.equal(speech[0]?.metadata.deliveryId, speech[1]?.metadata.deliveryId);
  assert.deepEqual(speech.map((packet) => packet.metadata.chunkIndex), [0, 1]);
  assert.deepEqual(speech.map((packet) => packet.metadata.chunkCount), [2, 2]);
  const audioBytes = speech.map((packet) => packet.audio?.assetId)
    .map((assetId) => assetId ? hub.audioAsset(assetId)?.bytes.byteLength : null);
  assert.deepEqual(audioBytes, [5_804, 3_244]);
});

await test("publishes first audio without waiting for later sentence synthesis", async () => {
  const hub = new PerformanceHub();
  let releaseSecond: (() => void) | undefined;
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const renderer = new WebPerformanceRenderer(
    hub,
    "http://127.0.0.1:4310",
    async ({ text }) => {
      if (text === "Ti ascolto.") await secondGate;
      return {
        audio: new Uint8Array(3_200),
        marks: [{ time: 25, type: "viseme" as const, value: "p" }],
        voice: "Bianca" as const,
        languageCode: "it-IT",
        engine: "neural" as const,
      };
    },
  );
  await renderer.start("showcase");
  const firstPacket = new Promise<void>((resolve) => {
    const unsubscribe = hub.subscribe((packet) => {
      if (packet.kind !== "speech") return;
      unsubscribe();
      resolve();
    });
  });
  const delivery = renderer.deliver(cue);
  await firstPacket;
  assert.equal(hub.since(0).filter((packet) => packet.kind === "speech").length, 1);
  releaseSecond?.();
  await delivery;
  assert.equal(hub.since(0).filter((packet) => packet.kind === "speech").length, 2);
});

await test("does not publish queued speech after an interruption", async () => {
  const hub = new PerformanceHub();
  let releaseSecond: (() => void) | undefined;
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const renderer = new WebPerformanceRenderer(
    hub,
    "http://127.0.0.1:4310",
    async ({ text }) => {
      if (text === "Ti ascolto.") await secondGate;
      return {
        audio: new Uint8Array(3_200),
        marks: [],
        voice: "Bianca" as const,
        languageCode: "it-IT",
        engine: "neural" as const,
      };
    },
  );
  await renderer.start("showcase");
  const firstPacket = new Promise<void>((resolve) => {
    const unsubscribe = hub.subscribe((packet) => {
      if (packet.kind !== "speech") return;
      unsubscribe();
      resolve();
    });
  });
  const delivery = renderer.deliver(cue);
  await firstPacket;
  await renderer.interruptSpeech("Mary");
  const interrupted = assert.rejects(
    delivery,
    (error: Error) => error.name === "AbortError",
  );
  releaseSecond?.();
  await interrupted;
  assert.equal(hub.since(0).filter((packet) => packet.kind === "speech").length, 1);
  assert.equal(hub.since(0).at(-1)?.events[0]?.type, "interrupt");
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

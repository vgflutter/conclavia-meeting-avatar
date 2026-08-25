import assert from "node:assert/strict";
import test from "node:test";

import type { AvatarSpeechCue } from "../domain/protocol.js";
import { PerformanceHub } from "./performance-hub.js";
import {
  controlPerformancePacket,
  gesturePerformancePacket,
  pcm16MonoToWav,
  speechPerformancePacket,
} from "./performance-packet.js";

const cue: AvatarSpeechCue = {
  id: "cue-1",
  kind: "speak",
  provider: "openai",
  model: "gpt-test",
  speakerName: "Mary",
  sentences: [{
    text: "Una risposta breve.",
    mood: "confident",
    level: 4,
    language: "it-IT",
  }],
  addressedTo: "Vincenzo",
  sourceSegmentIds: ["segment-1"],
  createdAt: "2026-08-25T08:00:00.000Z",
};

await test("builds a versioned audio-clock performance packet", () => {
  const draft = speechPerformancePacket({
    cue,
    avatarId: "showcase",
    avatarName: "Mary",
    audio: {
      assetId: "42ef8e41-df25-46b4-9522-0c1584658f89",
      url: "http://127.0.0.1:4310/api/performance/audio/42ef8e41-df25-46b4-9522-0c1584658f89.wav",
      mimeType: "audio/wav",
      sampleRate: 16_000,
      channels: 1,
      durationMs: 1_200,
      clockRole: "master",
    },
    beats: [{
      atMs: 0,
      semanticMood: "confident",
      mood: "happiness",
      intensity: 0.6,
      focus: "camera",
      gesture: "nod",
    }],
    speechMarks: [
      { time: 20, type: "word", value: "Una", start: 0, end: 3 },
      { time: 45, type: "viseme", value: "u" },
    ],
    delivery: { id: "delivery-1", chunkIndex: 0, chunkCount: 2 },
  });

  assert.equal(draft.schema, "conclavia.performance");
  assert.equal(draft.version, 1);
  assert.equal(draft.clock.source, "audio");
  assert.deepEqual(draft.tracks.visemes, [{ atMs: 45, value: "u", weight: 1 }]);
  assert.deepEqual(draft.tracks.expressions, [{
    atMs: 0,
    semanticMood: "confident",
    rendererMood: "happiness",
    level: 0.6,
  }]);
  assert.equal(draft.events.at(-1)?.type, "speech-end");
  assert.equal(draft.events.at(-1)?.atMs, 1_200);
  assert.equal(draft.metadata.deliveryId, "delivery-1");
  assert.equal(draft.metadata.chunkIndex, 0);
  assert.equal(draft.metadata.chunkCount, 2);
});

await test("wraps mono PCM16 in a valid WAV container", () => {
  const wav = pcm16MonoToWav(new Uint8Array([1, 2, 3, 4]));
  assert.equal(Buffer.from(wav.subarray(0, 4)).toString("ascii"), "RIFF");
  assert.equal(Buffer.from(wav.subarray(8, 12)).toString("ascii"), "WAVE");
  assert.equal(new DataView(wav.buffer).getUint32(40, true), 4);
  assert.deepEqual([...wav.subarray(44)], [1, 2, 3, 4]);
});

await test("sequences, replays and broadcasts packets through the hub", () => {
  const hub = new PerformanceHub();
  const observed: number[] = [];
  const unsubscribe = hub.subscribe((packet) => observed.push(packet.sequence));
  const first = hub.publish(controlPerformancePacket({
    avatarId: "showcase",
    avatarName: "Mary",
    event: "ready",
  }));
  const second = hub.publish(gesturePerformancePacket({
    avatarId: "showcase",
    avatarName: "Mary",
    gesture: "raise-hand",
    durationMs: 8_000,
    mood: "assertive",
    rendererMood: "confidence",
    intensity: 0.5,
  }));
  unsubscribe();

  assert.deepEqual(observed, [1, 2]);
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.deepEqual(hub.since(1).map((packet) => packet.sequence), [2]);
});

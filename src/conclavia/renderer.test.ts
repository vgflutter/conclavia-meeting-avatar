import assert from "node:assert/strict";
import test from "node:test";

import {
  ConclaviaRenderer,
  performanceBeatsForCue,
  speechTextForCue,
} from "./renderer.js";
import type { AvatarSpeechCue } from "../domain/protocol.js";

const cue: AvatarSpeechCue = {
  id: "cue-1",
  kind: "speak",
  provider: "openai",
  model: "gpt-5.4-mini",
  sentences: [
    { text: "Sono d'accordo.", mood: "confident", level: 4, language: "it-IT" },
    {
      text: "Ma verifichiamo questo rischio con attenzione.",
      mood: "concerned",
      level: 3,
      language: "it-IT",
    },
  ],
  addressedTo: "Vincenzo",
  sourceSegmentIds: ["segment-1", "segment-2"],
  createdAt: "2026-08-21T10:00:00.000Z",
};

await test("combines all Mary sentences for one synchronized speech", () => {
  assert.equal(
    speechTextForCue(cue),
    "Sono d'accordo. Ma verifichiamo questo rischio con attenzione.",
  );
});

await test("maps sentence moods to timed Unreal performance beats", () => {
  assert.deepEqual(performanceBeatsForCue(cue, 6_000), [
    {
      atMs: 0,
      mood: "confidence",
      intensity: 0.84,
      focus: "camera",
      gesture: "nod",
    },
    {
      atMs: 1_080,
      mood: "confidence",
      intensity: 0.18,
      focus: "camera",
      gesture: "none",
    },
    {
      atMs: 1_430,
      mood: "fear",
      intensity: 0.18,
      focus: "thought",
      gesture: "none",
    },
    {
      atMs: 1_760,
      mood: "fear",
      intensity: 0.61,
      focus: "thought",
      gesture: "tilt",
    },
  ]);
});

await test("uses a clearly visible intensity for a single non-neutral mood", () => {
  assert.deepEqual(
    performanceBeatsForCue(
      {
        ...cue,
        sentences: [{
          text: "Davvero?",
          mood: "surprised",
          level: 5,
          language: "it-IT",
        }],
      },
      3_000,
    ),
    [{
      atMs: 0,
      mood: "surprise",
      intensity: 1,
      focus: "camera",
      gesture: "emphasis",
    }],
  );
});

await test("reports the MetaHuman profile currently loaded by Unreal", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({
    configured: true,
    available: true,
    serverStatus: "ready",
    playerUrl: "http://renderer.example/player",
    health: { avatarId: "jelena" },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  try {
    const renderer = new ConclaviaRenderer("http://conclavia.example");
    assert.deepEqual(await renderer.status(), {
      configured: true,
      available: true,
      serverStatus: "ready",
      playerUrl: "http://renderer.example/player",
      avatarProfile: "jelena",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

await test("sends a bounded silent listening reaction to Unreal", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  const fetchMock: typeof fetch = (input, init) => {
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    const url = input instanceof Request ? input.url : input.toString();
    requests.push({
      url,
      body: JSON.parse(init.body) as Record<string, unknown>,
    });
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  };
  globalThis.fetch = fetchMock;

  try {
    const renderer = new ConclaviaRenderer("http://renderer.test");
    await renderer.reactToListening({
      mood: "concerned",
      level: 3,
      sourceSegmentId: "segment-2",
      observedSpeakerName: "Luca",
      createdAt: "2026-08-22T10:00:00.000Z",
      holdMs: 7_100,
    }, "Mary");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [{
    url: "http://renderer.test/api/unreal/cue",
    body: {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: "Mary",
      targetName: "Luca",
      shot: "reaction",
      intent: "listen-react",
      bodyGesture: "none",
      listenerMood: "fear",
      listenerMoodIntensity: 0.34,
      expectedDurationMs: 7_100,
    },
  }]);
});

await test("sends a high-priority interrupt cue to stop accepted speech", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    requests.push(JSON.parse(init.body) as Record<string, unknown>);
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  };
  try {
    await new ConclaviaRenderer("http://renderer.test").interruptSpeech("Mary");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [{
    speakerId: "participant-1",
    targetId: "meeting-participant",
    speakerName: "Mary",
    shot: "close-up",
    intent: "interrupt",
    bodyGesture: "lower-hand",
    expectedDurationMs: 0,
    performanceBeats: [],
  }]);
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

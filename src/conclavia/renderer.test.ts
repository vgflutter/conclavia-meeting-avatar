import assert from "node:assert/strict";
import test from "node:test";

import {
  ConclaviaRenderer,
  performanceBeatsForCue,
  speechTextForCue,
} from "./renderer.js";
import { avatarMoods, type AvatarSpeechCue } from "../domain/protocol.js";

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

await test("reports synthesis and renderer handoff latency for a delivered answer", async () => {
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    requests.push(url);
    if (url.endsWith("/api/unreal/speech")) {
      return Promise.resolve(new Response(new Uint8Array(32_000), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "x-conclavia-engine": "neural",
          "x-conclavia-tts-ms": "8",
        },
      }));
    }
    if (url.endsWith("/api/unreal/audio/speech")) {
      return Promise.resolve(new Response(JSON.stringify({
        ok: true,
        durationMs: 1_000,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  };

  let delivery;
  try {
    delivery = await new ConclaviaRenderer("http://renderer.test").deliver({
      ...cue,
      sentences: [cue.sentences[0]!],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(delivery.delivered, true);
  assert.equal(delivery.durationMs, 1_000);
  assert.equal(delivery.sentenceCount, 1);
  assert.ok(delivery.synthesisMs >= 0);
  assert.ok(delivery.cueMs >= 0);
  assert.ok(delivery.playbackMs >= 0);
  assert.ok(delivery.timeToFirstAudioMs >= delivery.synthesisMs);
  assert.deepEqual(delivery.voiceEngines, ["neural"]);
  assert.deepEqual(requests, [
    "http://renderer.test/api/unreal/speech",
    "http://renderer.test/api/unreal/cue",
    "http://renderer.test/api/unreal/audio/speech",
  ]);
});

await test("maps sentence moods to timed Unreal performance beats", () => {
  assert.deepEqual(performanceBeatsForCue(cue, 6_000), [
    {
      atMs: 0,
      semanticMood: "confident",
      mood: "happiness",
      intensity: 0.59,
      focus: "camera",
      gesture: "nod",
    },
    {
      atMs: 1_080,
      semanticMood: "confident",
      mood: "happiness",
      intensity: 0.18,
      focus: "camera",
      gesture: "none",
    },
    {
      atMs: 1_430,
      semanticMood: "concerned",
      mood: "fear",
      intensity: 0.18,
      focus: "target",
      gesture: "none",
    },
    {
      atMs: 1_760,
      semanticMood: "concerned",
      mood: "fear",
      intensity: 0.46,
      focus: "target",
      gesture: "settle",
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
      semanticMood: "surprised",
      mood: "surprise",
      intensity: 1,
      focus: "camera",
      gesture: "emphasis",
    }],
  );
});

await test("preserves all twelve semantic moods as distinct performance signatures", () => {
  const signatures = new Set<string>();
  const facialMoods = new Set<string>();
  for (const mood of avatarMoods) {
    const [beat] = performanceBeatsForCue({
      ...cue,
      sentences: [{ text: `Test ${mood}.`, mood, level: 5, language: "it-IT" }],
    }, 2_500);
    assert.equal(beat?.semanticMood, mood);
    facialMoods.add(beat?.mood ?? "missing");
    signatures.add(JSON.stringify({
      facialMood: beat?.mood,
      intensity: beat?.intensity,
      focus: beat?.focus,
      gesture: beat?.gesture,
    }));
  }
  assert.equal(signatures.size, avatarMoods.length);
  assert.equal(facialMoods.size, avatarMoods.length);
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
      listenerSemanticMood: "concerned",
      listenerMood: "fear",
      listenerMoodIntensity: 0.23,
      expectedDurationMs: 7_100,
    },
  }]);
});

await test("routes all twelve moods to Unreal while Mary listens silently", async () => {
  const cues: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    cues.push(JSON.parse(init.body) as Record<string, unknown>);
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  };
  try {
    const renderer = new ConclaviaRenderer("http://renderer.test");
    for (const mood of avatarMoods) {
      await renderer.reactToListening({
        mood,
        level: 5,
        sourceSegmentId: `segment-${mood}`,
        observedSpeakerName: "Luca",
        createdAt: "2026-08-23T10:00:00.000Z",
        holdMs: 6_000,
      }, "Mary");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    cues.map((value) => value.listenerSemanticMood),
    [...avatarMoods],
  );
  assert.ok(cues.every((value) => value.intent === "listen-react"));
  assert.equal(new Set(cues.map((value) => value.listenerMood)).size, avatarMoods.length);
  assert.equal(new Set(cues.map((value) => JSON.stringify({
    facialMood: value.listenerMood,
    intensity: value.listenerMoodIntensity,
  }))).size, avatarMoods.length);
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

await test("routes applause as an authored physical gesture", async () => {
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
    await new ConclaviaRenderer("http://renderer.test").applaud("Mary", "Vincenzo");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [{
    speakerId: "participant-1",
    targetId: "meeting-participant",
    speakerName: "Mary",
    targetName: "Vincenzo",
    shot: "wide",
    intent: "applause",
    bodyGesture: "applause",
    listenerSemanticMood: "amused",
    listenerMood: "happiness",
    listenerMoodIntensity: 0.68,
    expectedDurationMs: 4_500,
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
    health: {
      avatarId: "jelena",
      processId: 7840,
      runtimeRevision: "ue58-commercial-lipsync-v16-meeting-presence",
    },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  try {
    const renderer = new ConclaviaRenderer("http://conclavia.example");
    assert.deepEqual(await renderer.status(), {
      configured: true,
      available: true,
      serverStatus: "ready",
      playerUrl: "http://renderer.example/player",
      avatarProfile: "jelena",
      streamId: "ue58-commercial-lipsync-v16-meeting-presence:7840",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test("starts the isolated UE 5.8 meeting profile through the companion renderer gateway", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    requests.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    return Promise.resolve(new Response(JSON.stringify({
      ok: true,
      playerUrl: "http://renderer.example/conclavia.html",
    }), { status: 200, headers: { "content-type": "application/json" } }));
  };
  try {
    assert.deepEqual(
      await new ConclaviaRenderer("http://127.0.0.1:4310").start("vivian"),
      {
        playerUrl: "http://renderer.example/conclavia.html",
        serverStatus: "ready",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(requests, [{
    url: "http://127.0.0.1:4310/api/unreal/session",
    body: { profile: "meeting", avatarId: "vivian" },
  }]);
});

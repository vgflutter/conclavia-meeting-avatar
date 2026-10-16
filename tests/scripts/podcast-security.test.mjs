import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}, env = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(`../../src/${file}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const target = { exports: {} };
  runInNewContext(compiled, {
    module: target, exports: target.exports, Request, Response, URL, TextDecoder, TextEncoder, ReadableStream,
    process: { env },
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return target.exports;
}

const guard = load("lib/podcast/request-guard");
const podcastCatalog = {
  podcastVoiceProvider: value => value === "kokoro" ? "kokoro" : "inworld",
  KOKORO_PODCAST_SPEED: 1.03,
  findPodcastVoice: (id, provider, language, sex) => provider === "kokoro" && language === "it" &&
    ((id === "im_nicola" && sex === "male") || (id === "if_sara" && sex === "female")) ? { id } : undefined,
};
const speech = load("lib/podcast/speech", {
  "@conclavia/avatar-kit/lib/podcast-voice-catalog": podcastCatalog,
  "@conclavia/avatar-kit/lib/local-kokoro-tts": { localKokoroHealth: async () => true },
  "@/lib/avatar-voice-catalog": { isAvatarVoice: (id, language) => (language === "it" ? ["Gianni", "Orietta"] : ["Dennis", "Olivia"]).includes(id) },
  "@/lib/meeting-tts-config": { meetingTtsConfig: () => ({ ready: true, model: "inworld-tts-2-flash" }) },
});
const context = { params: Promise.resolve({ id: "a".repeat(24) }) };
const voiceUrl = `http://127.0.0.1:3101/api/podcast/runs/${"a".repeat(24)}/speech`;

function fixture() {
  return {
    talkSnapshot: { language: "it", participants: [{ kind: "ai", sex: "male", voiceId: "Gianni" }, { kind: "ai", sex: "female", voiceId: "Dennis" }, { kind: "human", sex: "male" }], moderator: { kind: "none" } },
    messages: [
      { sequence: 1, origin: "ai", speakerType: "participant", participantIndex: 0, content: "Una domanda per il nostro ospite." },
      { sequence: 2, origin: "ai", speakerType: "participant", participantIndex: 1, content: "Sono curiosa di sentire la tua esperienza." },
      { sequence: 3, origin: "human", speakerType: "participant", participantIndex: 2, content: "La mia voce resta umana." },
    ],
  };
}

test("podcast management mutations reject foreign and sibling browser origins", () => {
  const check = headers => guard.podcastMutationIsSameOrigin(new Request(voiceUrl, { method: "POST", headers }));
  assert.equal(check({ origin: "http://127.0.0.1:3101", "sec-fetch-site": "same-origin" }), true);
  assert.equal(check({}), true, "local CLI remains usable");
  assert.equal(check({ origin: "https://evil.example" }), false);
  assert.equal(check({ origin: "null" }), false);
  assert.equal(check({ "sec-fetch-site": "cross-site" }), false);
  assert.equal(check({ "sec-fetch-site": "same-site" }), false);
  assert.equal(check({ origin: "https://evil.example", "x-forwarded-host": "evil.example" }), false);
  assert.equal(guard.podcastMutationIsSameOrigin(new Request("http://localhost:3101/api/podcast", {
    method: "POST", headers: { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" },
  })), true, "normalised bind host must not reject actual local destination");
});

test("podcast JSON limits count streamed UTF-8 bytes before parsing", async () => {
  const valid = new Request(voiceUrl, { method: "POST", headers: { "content-type": "application/json" }, body: '{"sequence":1}' });
  assert.equal((await guard.readPodcastJson(valid, 50)).sequence, 1);
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('"èèèèèèèèèèèèèèèèèèèè"')); },
    cancel() { cancelled = true; },
  });
  const chunked = new Request(voiceUrl, { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" });
  await assert.rejects(guard.readPodcastJson(chunked, 30), error => error.status === 413);
  assert.equal(cancelled, true);
  await assert.rejects(guard.readPodcastJson(new Request(voiceUrl, { method: "POST", body: "{}" })), /must be JSON/);
  await assert.rejects(guard.readPodcastJson(new Request(voiceUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), /valid JSON/);
});

test("podcast speech selects only stored AI content and a locale-compatible voice", () => {
  const run = fixture();
  assert.equal(speech.podcastSpeechOptions(run, 1).text, run.messages[0].content);
  assert.equal(speech.podcastSpeechOptions(run, 2).voiceId, "Orietta");
  assert.equal(speech.podcastSpeechOptions(run, 3), undefined);
  assert.equal(speech.podcastSpeechOptions(run, 99), undefined);
  run.messages[2].origin = "ai";
  assert.equal(speech.podcastSpeechOptions(run, 3), undefined, "AI label cannot voice a human seat");
  run.messages[0].content = "x".repeat(4001);
  assert.equal(speech.podcastSpeechOptions(run, 1), undefined);
  run.talkSnapshot.language = "fr";
  assert.equal(speech.podcastSpeechOptions(run, 2), undefined);
});

function voiceRoute({ ready = false, run = fixture() } = {}) {
  const calls = { database: 0, provider: 0, input: undefined };
  class SpeechServiceError extends Error { status = 503; }
  const route = load("app/api/podcast/runs/[id]/speech/route", {
    mongoose: { Types: { ObjectId: { isValid: id => /^[a-f0-9]{24}$/u.test(id) } } },
    "@/lib/mongodb": { connectToDatabase: async () => { calls.database++; } },
    "@conclavia/avatar-kit/lib/local-kokoro-tts": { LocalKokoroError: class LocalKokoroError extends Error {}, localKokoroSpeechResponse: async input => { calls.provider++; calls.input = input; return new Response('{"done":true}\n'); } },
    "@/lib/inworld-tts": { SpeechServiceError, inworldSpeechResponse: async input => { calls.provider++; calls.input = input; return new Response('{"done":true}\n'); } },
    "@/lib/speech-request-limit": { limitedSpeechResponse: async (key, create) => create() },
    "@/lib/podcast/speech": { ...speech, publicPodcastSpeechConfig: () => ({ enabled: ready, ready, model: "inworld-tts-2-flash", providers: { inworld: ready, kokoro: ready } }) },
    "@/lib/podcast/request-guard": guard,
    "@/models/PodcastRun": { TalkRunModel: { findById: () => ({ select: () => ({ lean: async () => run }) }) } },
  });
  return { ...route, calls };
}
const post = (body, headers = {}) => new Request(voiceUrl, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});

test("podcast speech is disabled before any database or paid provider access", async () => {
  const { POST, calls } = voiceRoute();
  assert.equal((await POST(post({ sequence: 1 }), context)).status, 503);
  assert.equal((await POST(post({ sequence: 1 }, { origin: "https://foreign.example" }), context)).status, 403);
  assert.equal((await POST(post({ sequence: 1, text: "Injected words" }), context)).status, 400);
  assert.equal(calls.database, 0);
  assert.equal(calls.provider, 0);
});

test("podcast speech adapter voices stored AI turn once and rejects human content", async () => {
  const { POST, calls } = voiceRoute({ ready: true });
  assert.equal((await POST(post({ sequence: 3 }), context)).status, 404);
  assert.equal(calls.provider, 0);
  assert.equal((await POST(post({ sequence: 2 }), context)).status, 200);
  assert.equal(calls.provider, 1);
  assert.equal(calls.input.text, fixture().messages[1].content);
  assert.equal(calls.input.voiceId, "Orietta");
});

test("podcast readiness exposes flags without credentials or provider calls", async () => {
  const { GET } = load("app/api/podcast/config/route", {
    "@/lib/podcast/speech": { publicPodcastSpeechConfig: () => ({ enabled: false, ready: false, model: "inworld-tts-2-flash" }) },
  }, { PODCAST_AI_ENABLED: "true", OPENAI_API_KEY: "never-return-this-key", GEMINI_API_KEY: "never-return-this-other-key", PODCAST_GEMINI_MODEL: "example-model" });
  const response = await GET();
  const text = await response.text();
  assert.equal(text.includes("never-return"), false);
  assert.equal(JSON.parse(text).ai.providers.openai, true);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("public meeting tunnel does not expose podcast management or broadcast pages", () => {
  class NextResponse extends Response { static next() { return new Response(null, { status: 200 }); } }
  const { proxy } = load("proxy", {
    "next/server": { NextResponse },
    "@conclavia/avatar-kit/lib/photoreal-host": { HOST_ASSET_ROOT: "/avatars/host-v1", HOST_FILES: [] },
  });
  for (const pathname of ["/podcast", "/podcast/new", "/podcast/abc/broadcast", "/api/podcast/config", "/api/podcast/talks", "/api/podcast/runs/abc/speech"]) {
    for (const [host, forwarded] of [["example.trycloudflare.com", "localhost"], ["localhost", "example.trycloudflare.com"]]) {
      const request = new Request(`https://example.trycloudflare.com${pathname}`, { headers: { host, "x-forwarded-host": forwarded } });
      Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
      assert.equal(proxy(request).status, 404, pathname);
    }
  }
});

test("Kokoro podcast snapshots select the approved Nicola/Sara pair at their original speed", () => {
  const run = fixture(); run.talkSnapshot.settings = { voiceProvider: "kokoro" };
  const male = speech.podcastSpeechOptions(run, 1), female = speech.podcastSpeechOptions(run, 2);
  assert.equal(male.provider, "kokoro"); assert.equal(male.voiceId, "im_nicola"); assert.equal(male.speakingRate, 1.03);
  assert.equal(female.provider, "kokoro"); assert.equal(female.voiceId, "if_sara"); assert.equal(female.speakingRate, 1.03);
  assert.equal(speech.podcastSpeechOptions(run, 3), undefined);
  run.talkSnapshot.language = "en";
  assert.equal(speech.podcastSpeechOptions(run, 1), undefined);
});

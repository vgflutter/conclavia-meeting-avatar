import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const testModule = { exports: {} };
const network = [];
let networkHandler;
const compiled = ts.transpileModule(readFileSync(new URL("../../src/lib/podcast/rehearsal-player.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(compiled, {
  module: testModule, exports: testModule.exports, AbortController, AbortSignal, DOMException, Response, ReadableStream, TextDecoder, setTimeout, clearTimeout,
  fetch: (...args) => { if (networkHandler) return networkHandler(...args); network.push(args); throw new Error("Unexpected network request"); },
  require(name) {
    if (name === "@/lib/podcast/llm-models") {
      const models = { exports: {} };
      runInNewContext(ts.transpileModule(readFileSync(new URL("../../src/lib/podcast/llm-models.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: models, exports: models.exports });
      return models.exports;
    }
    if (name !== "@conclavia/avatar-kit/lib/streaming-voice-player") throw new Error(`Unexpected dependency: ${name}`);
    return {
      requestStreamingSpeech() { throw new Error("Unexpected default synthesis"); },
      playStreamingSpeech() { throw new Error("Unexpected default playback"); },
    };
  },
});
const { runPodcastRehearsal } = testModule.exports;
const runId = "b".repeat(24);
const id = "a".repeat(24);

function message(sequence) {
  return { sequence, origin: "ai", speakerType: "participant", participantIndex: (sequence - 1) % 2,
    speakerName: sequence % 2 ? "Riccardo" : "Sofia", content: `Intervento ${sequence}`, createdAt: new Date(0).toISOString() };
}
function run(count = 0, status = "idle") {
  return { id: runId, talkId: id, status, phase: "discussion", maxTurns: 8, participantTurnCount: count,
    estimatedAirtimeSeconds: count * 8, messages: Array.from({ length: count }, (_, index) => message(index + 1)),
    talkSnapshot: { id, participants: [{ kind: "ai" }, { kind: "ai" }], moderator: { kind: "none" }, settings: { defaultModel: "openai-default" } } };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function fixture(changes = {}, overrides = {}) {
  const state = { trace: [], phases: [], speech: [], frames: [], advance: 0, prepared: [], played: [], waits: [], ready: 0 };
  const controller = new AbortController();
  const options = { runId, maxTurns: 8, signal: controller.signal, audioContext: {}, pauseMs: 550,
    onRun(value) { state.trace.push(`run:${value.messages.length}`); },
    onSpeech(value) { state.speech.push(value?.sequence ?? null); },
    onFrame(shape, level) { state.frames.push([shape, level]); },
    onPhase(value) { state.phases.push(value); }, ...changes };
  const ports = {
    async loadRun() { state.trace.push("load"); return run(); },
    async checkReady() { state.trace.push("ready"); state.ready++; },
    async advance() { state.advance++; state.trace.push(`advance:${state.advance}`); return run(state.advance); },
    async prepareSpeech(value, turn) { state.prepared.push(turn.sequence); return new Response('{"done":true}\n'); },
    async playSpeech(value, turn, response, callbacks) { state.played.push(turn.sequence); callbacks.onStart(); },
    async wait(ms) { state.waits.push(ms); }, ...overrides,
  };
  return { options, ports, state, controller, start: () => runPodcastRehearsal(options, ports) };
}

test("rehearsal import and invalid budgets never start network, synthesis or loading", async () => {
  assert.equal(network.length, 0);
  for (const changes of [{ maxTurns: 0 }, { maxTurns: 9 }, { maxTurns: 1.5 }, { pauseMs: -1 }, { pauseMs: 1501 },
    { afterSequence: -1 }, { afterSequence: NaN }, { afterSequence: 1.5 }, { runId: "invalid" }]) {
    const f = fixture(changes);
    await assert.rejects(f.start());
    assert.equal(f.state.advance, 0);
    assert.deepEqual(f.state.prepared, []);
    assert.deepEqual(f.state.trace, []);
  }
});

test("rehearsal readiness is checked before the first generation or voice", async () => {
  const f = fixture({}, { async checkReady() { throw new Error("Services disabled"); } });
  await assert.rejects(f.start(), /Services disabled/u);
  assert.equal(f.state.advance, 0);
  assert.deepEqual(f.state.prepared, []);
  assert.deepEqual(f.state.played, []);
  assert.deepEqual(f.state.frames.at(-1), ["rest", 0]);
});

test("rehearsal rejects a loaded session with another identity before paid work", async () => {
  const f = fixture({}, { async loadRun() { return { ...run(), id: "c".repeat(24) }; } });
  await assert.rejects(f.start());
  assert.equal(f.state.advance, 0);
  assert.deepEqual(f.state.prepared, []);
});

test("rehearsal voices at most eight turns and never requests a ninth lookahead", async () => {
  const f = fixture();
  const result = await f.start();
  assert.equal(result.messages.length, 8);
  assert.equal(f.state.advance, 8);
  assert.deepEqual(f.state.prepared, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(f.state.played, f.state.prepared);
  assert.deepEqual(f.state.waits, [550, 550, 550, 550, 550, 550, 550]);
  assert.equal(f.state.phases.at(-1), "complete");
  assert.deepEqual(f.state.frames.at(-1), ["rest", 0]);
});

test("lookahead waits for the first audible frame, holds one response, and never overlaps playback", { timeout: 3000 }, async () => {
  const started = [deferred(), deferred(), deferred()];
  const ended = [deferred(), deferred(), deferred()];
  const secondPrepared = deferred(), thirdPrepared = deferred(), pause = deferred(), releasePause = deferred();
  let active = 0, maximum = 0, waits = 0;
  const f = fixture({ maxTurns: 3 }, {
    async prepareSpeech(value, turn) {
      f.state.prepared.push(turn.sequence);
      if (turn.sequence === 2) secondPrepared.resolve();
      if (turn.sequence === 3) thirdPrepared.resolve();
      return new Response('{"done":true}\n');
    },
    async playSpeech(value, turn, response, callbacks) {
      f.state.played.push(turn.sequence); active++; maximum = Math.max(maximum, active);
      started[turn.sequence - 1].resolve(callbacks);
      try { await ended[turn.sequence - 1].promise; } finally { active--; }
    },
    async wait(ms) { waits++; f.state.waits.push(ms); if (waits === 1) { pause.resolve(); await releasePause.promise; } },
  });
  const result = f.start();
  const first = await started[0].promise;
  await flush();
  assert.equal(f.state.advance, 1, "no speculative work before the voice starts");
  first.onStart();
  await secondPrepared.promise;
  await flush();
  assert.equal(f.state.advance, 2);
  assert.deepEqual(f.state.prepared, [1, 2]);
  assert.deepEqual(f.state.played, [1], "prepared response stays silent while first voice plays");
  ended[0].resolve();
  await pause.promise;
  assert.deepEqual(f.state.played, [1], "no second voice during the editorial pause");
  releasePause.resolve();
  const second = await started[1].promise;
  second.onStart();
  await thirdPrepared.promise;
  assert.equal(f.state.advance, 3);
  assert.deepEqual(f.state.played, [1, 2]);
  ended[1].resolve();
  const third = await started[2].promise;
  third.onStart();
  ended[2].resolve();
  await result;
  assert.equal(maximum, 1);
  assert.equal(active, 0);
  assert.deepEqual(f.state.waits, [550, 550]);
  assert.equal(f.state.advance, 3);
});

test("completed stored final turn is voiced once and the resume cursor skips already heard turns", async () => {
  const f = fixture({ afterSequence: 1 }, { async loadRun() { return run(2, "completed"); } });
  const result = await f.start();
  assert.equal(result.status, "completed");
  assert.deepEqual(f.state.played, [2]);
  assert.equal(f.state.advance, 0);
  const alreadyHeard = fixture({ afterSequence: 2 }, { async loadRun() { return run(2, "completed"); } });
  await alreadyHeard.start();
  assert.deepEqual(alreadyHeard.state.played, []);
  assert.equal(alreadyHeard.state.advance, 0);
});

test("human waiting state is never voiced or advanced automatically", async () => {
  const initial = fixture({}, { async loadRun() { return run(0, "waiting_for_human"); } });
  const result = await initial.start();
  assert.equal(result.status, "waiting_for_human");
  assert.equal(initial.state.advance, 0);
  assert.deepEqual(initial.state.prepared, []);
  const advanced = fixture({}, { async advance() { advanced.state.advance++; return run(0, "waiting_for_human"); } });
  const next = await advanced.start();
  assert.equal(next.status, "waiting_for_human");
  assert.equal(advanced.state.advance, 1);
  assert.deepEqual(advanced.state.prepared, []);
});

test("abort stops the active voice and cancels an already prepared unheard response", { timeout: 3000 }, async () => {
  const started = deferred(), ahead = deferred();
  let cancelled = false, active = false;
  const f = fixture({}, {
    async prepareSpeech(value, turn) {
      f.state.prepared.push(turn.sequence);
      if (turn.sequence === 2) {
        ahead.resolve();
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
      }
      return new Response('{"done":true}\n');
    },
    async playSpeech(value, turn, response, callbacks) {
      active = true; f.state.played.push(turn.sequence); started.resolve(callbacks);
      try { await new Promise((resolve, reject) => callbacks.signal.addEventListener("abort", () => reject(callbacks.signal.reason), { once: true })); }
      finally { active = false; }
    },
  });
  const finished = f.start();
  const first = await started.promise;
  first.onStart();
  await ahead.promise;
  await flush();
  f.controller.abort(new DOMException("Operator stopped", "AbortError"));
  await assert.rejects(finished, error => error.name === "AbortError");
  await flush();
  assert.equal(active, false);
  assert.equal(cancelled, true);
  assert.deepEqual(f.state.played, [1]);
  assert.equal(f.state.advance, 2);
  assert.deepEqual(f.state.frames.at(-1), ["rest", 0]);
});

test("lookahead generation failures are surfaced after current voice, with no unhandled rejection", async () => {
  const f = fixture({}, {
    async advance() {
      f.state.advance++;
      if (f.state.advance === 2) throw new Error("Generation failed");
      return run(1);
    },
  });
  await assert.rejects(f.start(), /Generation failed/u);
  assert.deepEqual(f.state.played, [1]);
  assert.equal(f.state.advance, 2);
  assert.deepEqual(f.state.prepared, [1]);
});

test("a response that resolves during cancellation is closed before any playback", async () => {
  const preparing = deferred(), release = deferred();
  let cancelled = false;
  const f = fixture({}, { async prepareSpeech() { preparing.resolve(); return release.promise; } });
  const finished = f.start();
  await preparing.promise;
  f.controller.abort(new DOMException("Stopped while buffering", "AbortError"));
  release.resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await assert.rejects(finished, error => error.name === "AbortError");
  await flush();
  assert.equal(cancelled, true, "an unheard synthesis response must not stay open after Stop");
  assert.deepEqual(f.state.played, []);
});

test("stale generation results and an expired editorial budget cannot loop into more paid work", async () => {
  const stale = fixture({}, { async advance() { stale.state.advance++; return run(); } });
  await assert.rejects(stale.start(), /No new AI intervention/u);
  assert.equal(stale.state.advance, 1);
  assert.deepEqual(stale.state.prepared, []);
  const expired = fixture({}, { async loadRun() { return { ...run(), estimatedAirtimeSeconds: 120 }; } });
  await expired.start();
  assert.equal(expired.state.advance, 0);
  assert.deepEqual(expired.state.prepared, []);
});

test("short overlaps require actual complete PCM timing, distinct AI voices and a heated exchange", () => {
  const { overlapAllowed } = testModule.exports;
  const a = { ...message(1), performance: { sentences: [{ mood: "disagreement", intensity: .7 }] } };
  const b = { ...message(2), intent: "challenge" };
  const progress = { seconds: 2.7, bufferedSeconds: 3, complete: true, sentenceIndex: 0 };
  assert.equal(overlapAllowed(a, b, progress, { allowInterruptions: true }), true);
  for (const [first, second, timing, settings] of [
    [a, b, { ...progress, complete: false }, { allowInterruptions: true }],
    [a, b, { ...progress, seconds: 1 }, { allowInterruptions: true }],
    [a, b, progress, { allowInterruptions: false }],
    [{ ...a, origin: "human" }, b, progress, { allowInterruptions: true }],
    [a, { ...b, participantIndex: 0 }, progress, { allowInterruptions: true }],
    [a, { ...b, intent: "closing" }, progress, { allowInterruptions: true }],
    [{ ...a, performance: undefined }, b, progress, { allowInterruptions: true }],
  ]) assert.equal(overlapAllowed(first, second, timing, settings), false);
});

test("streamed generation releases stored speech before editorial completion and rejects truncated completion", async () => {
  const { advanceRehearsalTurn } = testModule.exports;
  let output;
  networkHandler = async () => new Response(new ReadableStream({ start(controller) { output = controller; } }), { headers: { "Content-Type": "text/event-stream" } });
  try {
    let stored = 0, completed = false;
    const final = advanceRehearsalTurn(runId, new AbortController().signal, ready => { stored++; assert.equal(ready.messages.length, 1); });
    await flush();
    const event = new TextEncoder().encode(`data: ${JSON.stringify({ type: "speech_stored", run: run(1, "generating") })}\r\n\r\n`);
    output.enqueue(event.slice(0, 17)); output.enqueue(event.slice(17));
    final.then(() => { completed = true; });
    await flush();
    assert.equal(stored, 1);
    assert.equal(completed, false);
    output.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "complete", run: run(1) })}\n\n`)); output.close();
    assert.equal((await final).messages.length, 1);
    networkHandler = async () => new Response(`data: ${JSON.stringify({ type: "speech_stored", run: run(1) })}\n\n`);
    await assert.rejects(advanceRehearsalTurn(runId, new AbortController().signal), /Incomplete/u);
  } finally { networkHandler = undefined; }
});

test("default pauses adapt to pace instead of imposing the previous fixed silence", async () => {
  const f = fixture({ pauseMs: undefined, maxTurns: 2 });
  await f.start();
  assert.equal(f.state.waits.length, 1);
  assert.ok(f.state.waits[0] >= 60 && f.state.waits[0] <= 340);
});

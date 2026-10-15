import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

/** Execute real recovered TS modules with explicit boundaries; never load env or a DB. */
function loader({ overrides = {}, env = {}, fetcher = () => { throw new Error("Unstubbed network"); } } = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === "server-only") return {};
    if (!name.startsWith("@/") && !name.startsWith("@conclavia/avatar-kit/")) return nativeRequire(name);
    const path = name.startsWith("@/")
      ? resolve("src", `${name.slice(2)}.ts`)
      : resolve("../conclavia-avatar-kit/src", `${name.slice("@conclavia/avatar-kit/".length)}.ts`);
    if (cache.has(path)) return cache.get(path).exports;
    const testModule = { exports: {} };
    cache.set(path, testModule);
    const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = dependency => dependency.startsWith(".")
      ? load(name.slice(0, name.lastIndexOf("/") + 1) + dependency.replace(/^\.\//, ""))
      : load(dependency);
    runInNewContext(compiled, { module: testModule, exports: testModule.exports, require: localRequire,
      process: { env }, console, fetch: fetcher, AbortController, AbortSignal, DOMException, TextDecoder, TextEncoder, setTimeout,
    }, { filename: path });
    return testModule.exports;
  }
  return load;
}

function fixture(count = 3) {
  return {
    id: "abc", title: "Due punti di vista", topic: "AI nel lavoro", centralQuestion: "Chi decide quando fidarsi?",
    editorialInstructions: "Chiedi esempi concreti e ascolta l'ospite.", language: "it", status: "ready",
    participants: Array.from({ length: count }, (_, index) => ({
      kind: index === 2 ? "human" : "ai", sex: index % 2 ? "female" : "male",
      name: `Persona ${index}`, role: index === 2 ? "Ospite reale" : "Conduttore", perspectiveMode: "custom",
      perspectivePrompt: `PRIVATE_POSITION_${index}`, speakingStylePrompt: `PRIVATE_VOICE_${index}`,
      goals: `PRIVATE_GOAL_${index}`, assertiveness: 50, patience: 60, interruptiveness: 20, baselineTension: 20,
    })),
    moderator: { kind: "none", style: "neutral", canInterrupt: true, manageTime: true, summarizeAtEnd: true },
    settings: { maxTurns: 20, targetDurationMinutes: 5, videoMode: "cartoon", studioTheme: "clean-line", defaultModel: "openai-default", allowInterruptions: false, pace: "balanced" },
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  };
}

function runFixture(talk, director) {
  return { id: "run", talkId: talk.id, status: "idle", phase: "discussion", participantTurnCount: 0,
    maxTurns: talk.settings.maxTurns, targetDurationMinutes: 5, estimatedAirtimeSeconds: 0, nextParticipantIndex: 0,
    hasPreparedTurn: false, discussionState: director.createInitialDiscussionState(talk), messages: [],
    startedAt: new Date(0).toISOString(), createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
}

const load = loader();
const validation = load("@/lib/podcast/talk-validation");
const director = load("@/lib/podcast/talk-director");
const prompt = load("@/lib/podcast/talk-run-prompt");

test("podcast accepts 2–5 participants, preserves human identity and central question", () => {
  for (const count of [2, 3, 4, 5]) {
    const result = validation.validateTalkInput(fixture(count));
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(result.data.participants.length, count);
    assert.equal(result.data.centralQuestion, "Chi decide quando fidarsi?");
    if (count >= 3) assert.equal(result.data.participants[2].kind, "human");
  }
  for (const count of [0, 1, 6]) assert.equal(validation.validateTalkInput(fixture(count)).success, false);
});

test("obsolete paid-video modes, malformed characters and excessive run budgets are rejected", () => {
  for (const videoMode of ["liveavatar", "unreal", "anything"]) {
    const talk = fixture(); talk.settings.videoMode = videoMode;
    assert.equal(validation.validateTalkInput(talk).success, false);
  }
  for (const [key, value] of [["maxTurns", 51], ["maxTurns", 0], ["targetDurationMinutes", 61], ["targetDurationMinutes", 0]]) {
    const talk = fixture(); talk.settings[key] = value;
    assert.equal(validation.validateTalkInput(talk).success, false);
  }
  const invalid = fixture(); invalid.participants[0].assertiveness = 101;
  assert.equal(validation.validateTalkInput(invalid).success, false);
  invalid.participants[0].assertiveness = 50; invalid.topic = "x".repeat(2001);
  assert.equal(validation.validateTalkInput(invalid).success, false);
});

test("recovered director plans valid turns fairly for 2, 3 and 5 seats with bounded word budgets", () => {
  for (const count of [2, 3, 5]) {
    const talk = fixture(count), run = runFixture(talk, director), seen = new Set();
    assert.equal(run.discussionState.centralQuestion, talk.centralQuestion);
    assert.match(run.discussionState.phaseObjective, /posizioni/);
    for (let index = 0; index < 15; index++) {
      const plan = director.chooseNextTurn(talk, run);
      assert.ok(plan);
      assert.ok(plan.participantIndex >= 0 && plan.participantIndex < count);
      assert.ok(plan.minWords >= 8 && plan.maxWords >= plan.minWords && plan.maxWords <= 100);
      assert.equal(plan.speakerName, talk.participants[plan.participantIndex].name);
      seen.add(plan.participantIndex);
      const content = `Un punto concreto ${index}: servono prove. Quale condizione accetteresti?`;
      run.discussionState = director.updateDiscussionState(run.discussionState, plan, content, index + 1);
      run.messages.push({ ...plan, sequence: index + 1, content, origin: talk.participants[plan.participantIndex].kind, wordCount: 12, estimatedAirtimeSeconds: 5, createdAt: new Date(0).toISOString() });
      run.participantTurnCount++;
    }
    assert.equal(seen.size, count);
    assert.equal(run.discussionState.participantMemories.length, count);
    assert.ok(run.discussionState.participantMemories.every(memory => memory.statements.length <= 8));
  }
});

test("only the speaking AI's private character is included; real human is never scripted", () => {
  const talk = fixture(), run = runFixture(talk, director);
  const plan = director.chooseNextTurn(talk, run);
  const built = prompt.buildTurnPrompt(talk, run, plan);
  const sent = built.instructions + "\n" + built.input;
  assert.match(sent, new RegExp(`PRIVATE_POSITION_${plan.participantIndex}`));
  for (let index = 0; index < 3; index++) {
    if (index !== plan.participantIndex) assert.ok(!sent.includes(`PRIVATE_POSITION_${index}`));
  }
  assert.match(built.instructions, /Never write dialogue.*real human/);
  assert.match(built.input, /Chi decide quando fidarsi/);
  assert.match(built.input, /Chiedi esempi concreti/);
});

test("closing remains an AI turn with optional human guest; completed run has no next turn", () => {
  const talk = fixture(), run = runFixture(talk, director);
  run.phase = "closing";
  const closing = director.chooseNextTurn(talk, run);
  assert.equal(closing.intent, "closing");
  assert.equal(talk.participants[closing.participantIndex].kind, "ai");
  run.phase = "completed";
  assert.equal(director.chooseNextTurn(talk, run), undefined);
});

test("text and editorial generation refuse before any network when podcast AI opt-in is absent", async () => {
  let network = 0;
  const provider = loader({ fetcher: () => { network++; throw new Error("Unexpected provider call"); }, env: {} })("@/lib/podcast/llm-provider");
  const request = { model: "openai-default", instructions: "test", input: "test" };
  assert.equal(provider.isProviderConfigured("openai"), false);
  await assert.rejects(provider.generateLlmText(request), /disabled/);
  await assert.rejects(provider.generateLlmJson({ ...request, schemaName: "test", schema: {} }), /disabled/);
  assert.equal(network, 0);
});

/** In-memory persistence boundary exercises orchestration without Mongo or a provider. */
function orchestrationFixture({ expectHuman = false, aiEnabled = false, generation } = {}) {
  const { Types } = nativeRequire("mongoose");
  const talk = fixture(), run = runFixture(talk, director);
  const plan = { speakerType: "participant", participantIndex: 2, speakerName: talk.participants[2].name,
    speakerRole: talk.participants[2].role, intent: "answer", threadLabel: "Decisioni", arcPhase: "positions",
    preparationMode: "reactive", referenceStyle: "idea_first", minWords: 10, maxWords: 40 };
  const document = { ...run, _id: new Types.ObjectId(), talkId: new Types.ObjectId(),
    status: expectHuman ? "waiting_for_human" : "idle", activeTurn: expectHuman ? plan : undefined,
    talkSnapshot: talk, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) };
  let providerCalls = 0;
  function apply(update) {
    Object.assign(document, update.$set ?? {});
    for (const key of Object.keys(update.$unset ?? {})) delete document[key];
    for (const [key, value] of Object.entries(update.$push ?? {})) document[key].push(value);
    return document;
  }
  const query = value => ({ exec: async () => value === document ? { ...document, messages: [...document.messages] } : value });
  function matches(filter) {
    if (Object.hasOwn(filter, "generationToken") && filter.generationToken !== document.generationToken) return false;
    if (typeof filter.status === "string") return filter.status === document.status;
    if (filter.$or) return ["idle", "failed"].includes(document.status);
    return true;
  }
  const model = {
    findById: () => query(document),
    findOneAndUpdate: (filter, update) => {
      return query(matches(filter) ? apply(update) : null);
    },
    findByIdAndUpdate: (_id, update) => query(apply(update)),
    updateOne: (filter, update) => query(matches(filter) ? apply(update) : null),
  };
  const engine = loader({ overrides: {
    "@/lib/mongodb": { connectToDatabase: async () => {} },
    "@/models/PodcastRun": { TalkRunModel: model },
    "@/models/PodcastTalk": { TalkModel: { findById: () => { throw new Error("Snapshot must isolate live talk changes"); } } },
    "@/models/PodcastAudienceRoom": { AudienceRoomModel: {} },
    "@/lib/podcast/llm-provider": {
      isProviderConfigured: () => aiEnabled,
      generateLlmTextStream: async (request, onDelta) => {
        providerCalls++;
        if (!aiEnabled) throw new Error("No paid calls");
        if (generation) return generation(request, onDelta);
        const content = "La verifica umana deve seguire criteri chiari, altrimenti rischiamo di approvare ogni suggerimento senza comprenderlo.";
        await onDelta?.(content);
        return { content, model: "openai-default", provider: "openai", inputTokens: 10, outputTokens: 10 };
      },
      ProviderError: class ProviderError extends Error {},
    },
    "@/lib/podcast/talk-editorial-review": { reviewEditorialArc: () => { providerCalls++; throw new Error("No paid editorial calls"); } },
  } })("@/lib/podcast/advance-talk-run");
  return { engine, document, id: document._id.toString(), providerCalls: () => providerCalls };
}

test("human turn is saved once, attributed to the real guest, and returns the floor without model calls", async () => {
  const context = orchestrationFixture({ expectHuman: true });
  const attempts = await Promise.allSettled([
    context.engine.submitHumanTalkRunTurn(context.id, { content: "Io userei una verifica umana prima di decidere." }),
    context.engine.submitHumanTalkRunTurn(context.id, { content: "Duplicate request must not become another guest turn." }),
  ]);
  assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(item => item.status === "rejected").length, 1);
  const run = attempts.find(item => item.status === "fulfilled").value;
  assert.equal(run.status, "idle");
  assert.equal(run.messages.length, 1);
  assert.equal(run.messages[0].origin, "human");
  assert.equal(run.messages[0].participantIndex, 2);
  assert.equal(run.messages[0].provider, undefined);
  assert.match(run.messages[0].content, /verifica umana/);
  assert.equal(run.nextParticipantIndex, 0); // modulo actual 3 seats, not historic 5
  assert.equal(context.providerCalls(), 0);
});

test("operator next returns explicit unavailable state and releases its lease while AI is disabled", async () => {
  const context = orchestrationFixture();
  await assert.rejects(context.engine.advanceTalkRun(context.id), error => {
    assert.equal(error.status, 503);
    assert.equal(error.code, "podcast_ai_unavailable");
    assert.equal(error.run.status, "idle");
    return true;
  });
  assert.equal(context.document.status, "idle");
  assert.equal(context.document.generationStartedAt, undefined);
  assert.equal(context.document.messages.length, 0);
  assert.equal(context.providerCalls(), 0);
});

test("a completed turn never clears a newer generation lease claimed during its saved hook", async () => {
  const context = orchestrationFixture({ aiEnabled: true });
  const run = await context.engine.advanceTalkRun(context.id, {
    onTurnSaved: async () => {
      // Another operator action claims a new generation after this turn becomes idle.
      context.document.status = "generating";
      context.document.generationToken = "newer-worker-token";
      context.document.generationStartedAt = new Date();
      context.document.activeTurn = { speakerName: "Next speaker" };
    },
  });
  assert.equal(run.messages.length, 1);
  assert.equal(run.messages[0].origin, "ai");
  assert.equal(context.document.status, "generating");
  assert.equal(context.document.generationToken, "newer-worker-token");
  assert.equal(context.document.activeTurn.speakerName, "Next speaker");
  assert.equal(context.providerCalls(), 1);
});

test("cancellation from an obsolete worker cannot release a newer worker's generation lease", async () => {
  let context;
  context = orchestrationFixture({ aiEnabled: true, generation: async () => {
    context.document.status = "generating";
    context.document.generationToken = "newer-worker-token";
    context.document.generationStartedAt = new Date();
    context.document.activeTurn = { speakerName: "New worker" };
    throw new DOMException("Cancelled old generation", "AbortError");
  } });
  await assert.rejects(context.engine.advanceTalkRun(context.id), error => error.status === 499);
  assert.equal(context.document.status, "generating");
  assert.equal(context.document.generationToken, "newer-worker-token");
  assert.equal(context.document.activeTurn.speakerName, "New worker");
  assert.equal(context.document.messages.length, 0);
});

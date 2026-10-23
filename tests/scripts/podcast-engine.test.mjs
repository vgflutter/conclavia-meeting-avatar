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
      process: { env }, console, fetch: fetcher, AbortController, AbortSignal, DOMException, TextDecoder, TextEncoder, Response, ReadableStream, setTimeout,
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
      perspectivePrompt: `PRIVATE_POSITION_${index}`, speakingStylePrompt: `PRIVATE_VOICE_${index}`, personalityPrompt: `PRIVATE_PERSONALITY_${index}`,
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
const performance = load("@/lib/podcast/performance");

function acting(text, changes = {}) {
  return { text, mood: "curiosity", intensity: 0.55, listenerMood: "attention", listenerIntensity: 0.3, ...changes };
}

test("structured spoken sentences preserve accents, punctuation and acting with complete sentence coverage", () => {
  const result = performance.parseGeneratedPerformance({ sentences: [
    acting("È una scelta interessante.\nQuale prova ti convincerebbe?"),
    acting("Capisco il dubbio.", { mood: "empathy", listenerMood: "doubt", intensity: 0.4 }),
  ] });
  assert.equal(result.content, "È una scelta interessante. Quale prova ti convincerebbe? Capisco il dubbio.");
  assert.equal(result.performance.version, 1);
  assert.equal(result.performance.source, "ai");
  assert.equal(result.performance.sentences.length, 3);
  assert.equal(result.performance.sentences[1].mood, "curiosity");
  assert.equal(result.performance.sentences[2].listenerMood, "doubt");
  assert.equal(result.content, result.performance.sentences.map(sentence => sentence.text).join(" "));
});

test("malformed or excessive performance never reaches spoken text", () => {
  const invalid = [
    null, [], {}, { sentences: [] }, { sentences: [acting(" ")] },
    { sentences: [acting("Ok.", { mood: "angry" })] },
    { sentences: [acting("Ok.", { intensity: "0.5" })] },
    { sentences: [acting("Ok.", { intensity: NaN })] },
    { sentences: [acting("Ok.", { listenerIntensity: Infinity })] },
    { sentences: [acting("Ok.", { intensity: -0.01 })] },
    { sentences: [acting("Ok.", { listenerIntensity: 1.01 })] },
    { sentences: [acting("Ok.", { listenerMood: null })] },
    { sentences: [acting("Ok.", { extra: "not allowed" })] },
    { sentences: [acting("Ok.")], content: "Unannotated speech must not leak." },
    { sentences: [acting("a".repeat(1601))] },
    { sentences: [acting("a".repeat(1100)), acting("b".repeat(1100))] },
    { sentences: Array.from({ length: 25 }, () => acting("Ok.")) },
    { sentences: [acting(Array.from({ length: 25 }, () => "Ok.").join(" "))] },
    { sentences: [acting("Bad\u0000text")] },
  ];
  for (const value of invalid) assert.throws(() => performance.parseGeneratedPerformance(value), /Invalid podcast performance/u);
});

test("legacy AI gets explicitly neutral sentence directions while humans never get inferred moods", () => {
  const legacy = performance.resolveMessagePerformance({ origin: "ai", content: "Non sono sicuro. Cosa proponi?" });
  assert.equal(legacy.source, "legacy");
  assert.equal(legacy.sentences.length, 2);
  assert.ok(legacy.sentences.every(sentence => sentence.mood === "attention" && sentence.listenerMood === "attention"));
  const annotated = performance.parseGeneratedPerformance({ sentences: [acting("Sono d'accordo.", { mood: "agreement" })] });
  assert.equal(performance.resolveMessagePerformance({ origin: "ai", ...annotated }).source, "ai");
  const mismatched = performance.resolveMessagePerformance({ origin: "ai", content: "Altro testo.", performance: annotated.performance });
  assert.equal(mismatched.source, "legacy");
  assert.equal(mismatched.sentences[0].text, "Altro testo.");
  assert.equal(performance.resolveMessagePerformance({ origin: "human", ...annotated }), undefined);
  assert.equal(performance.resolveMessagePerformance({ content: "La mia opinione." }), undefined);
  const exact = "La prima frase.\n\nLa  seconda frase.";
  const unmodified = performance.resolveMessagePerformance({ origin: "ai", content: exact });
  assert.equal(unmodified.source, "legacy");
  assert.equal(unmodified.sentences.map(sentence => sentence.text).join(" "), exact);
});

test("performance schema and prompt keep all eight emotions bounded to fictional avatars", () => {
  const schema = performance.TURN_PERFORMANCE_SCHEMA;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.sentences.items.additionalProperties, false);
  assert.equal(schema.properties.sentences.items.properties.mood.enum.length, 8);
  const talk = fixture(), run = runFixture(talk, director);
  const built = prompt.buildTurnPrompt(talk, run, director.chooseNextTurn(talk, run));
  assert.match(built.instructions, /Every spoken sentence must have its acting directions/u);
  assert.match(built.instructions, /Never infer or prescribe the real human guest's emotions/u);
});

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

test("podcast settings accept four canonical compositions and default legacy records to the shared studio", () => {
  const legacy = validation.validateTalkInput(fixture());
  assert.equal(legacy.success, true);
  assert.equal(legacy.data.settings.studioLayout, "studio");
  for (const studioLayout of ["studio", "speaker", "table", "lounge"]) {
    const talk = fixture(); talk.settings.studioLayout = studioLayout;
    const result = validation.validateTalkInput(talk);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(result.data.settings.studioLayout, studioLayout);
    assert.equal(result.data.settings.studioTheme, "clean-line", "composition is independent of the art style");
    assert.equal(result.data.participants[2].kind, "human");
  }
  for (const studioLayout of ["unknown", "", null, 0, {}, ["studio"]]) {
    const talk = fixture(); talk.settings.studioLayout = studioLayout;
    const result = validation.validateTalkInput(talk);
    assert.equal(result.success, false);
    assert.ok(result.issues.some(issue => issue.startsWith("settings.studioLayout")));
  }
});

test("Mongoose round trips studio composition and serialized run snapshots keep their original staging", () => {
  const { Types } = nativeRequire("mongoose");
  const { TalkModel } = load("@/models/PodcastTalk");
  const { TalkRunModel } = load("@/models/PodcastRun");
  const { serializeTalk } = load("@/lib/podcast/serialize-talk");
  const { serializeTalkRun } = load("@/lib/podcast/serialize-talk-run");
  for (const studioLayout of ["studio", "speaker", "table", "lounge"]) {
    const input = fixture(); input.settings.studioLayout = studioLayout;
    const document = new TalkModel({ ...input, createdAt: new Date(0), updatedAt: new Date(0) });
    assert.equal(document.validateSync(), undefined);
    const reloaded = TalkModel.hydrate(document.toObject());
    const snapshot = serializeTalk(reloaded);
    assert.equal(snapshot.settings.studioLayout, studioLayout);
    const run = new TalkRunModel({ ...runFixture(snapshot, director), talkId: new Types.ObjectId(),
      talkSnapshot: snapshot, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) });
    reloaded.settings.studioLayout = studioLayout === "studio" ? "lounge" : "studio";
    const response = serializeTalkRun(run);
    assert.equal(response.talkSnapshot.settings.studioLayout, studioLayout, "later episode edits do not alter the run's snapshot");
    response.talkSnapshot.settings.studioLayout = "table";
    assert.equal(run.talkSnapshot.settings.studioLayout, studioLayout, "serialized snapshots never mutate stored staging");
  }
  const legacy = fixture();
  const document = new TalkModel({ ...legacy, createdAt: new Date(0), updatedAt: new Date(0) });
  assert.equal(document.settings.studioLayout, "studio");
  const raw = document.toObject(); delete raw.settings.studioLayout;
  assert.equal(serializeTalk(TalkModel.hydrate(raw)).settings.studioLayout, "studio");
  document.settings.studioLayout = "unknown";
  assert.ok(document.validateSync()?.errors["settings.studioLayout"]);
  const legacyRun = new TalkRunModel({ ...runFixture(legacy, director), talkId: new Types.ObjectId(),
    talkSnapshot: legacy, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) });
  assert.equal(serializeTalkRun(legacyRun).talkSnapshot.settings.studioLayout, "studio");
  assert.equal(legacyRun.talkSnapshot.settings.studioLayout, undefined, "read compatibility does not rewrite old database snapshots");
});

test("ten animated directions, three casts and optional guest staging validate and persist independently", () => {
  const { TalkModel } = load("@/models/PodcastTalk");
  const { TalkRunModel } = load("@/models/PodcastRun");
  const { Types } = nativeRequire("mongoose");
  const { serializeTalk } = load("@/lib/podcast/serialize-talk");
  const { serializeTalkRun } = load("@/lib/podcast/serialize-talk-run");
  const catalog = load("@/lib/podcast/studio-themes");
  assert.equal(catalog.STUDIO_THEME_IDS.length, 10);
  for (const studioTheme of catalog.STUDIO_THEME_IDS) {
    for (const studioCast of catalog.STUDIO_CAST_IDS) {
      for (const studioGuest of catalog.STUDIO_GUEST_MODES) {
        const input = fixture(2);
        Object.assign(input.settings, { studioTheme, studioCast, studioGuest });
        const validated = validation.validateTalkInput(input);
        assert.equal(validated.success, true, JSON.stringify(validated));
        const document = new TalkModel({ ...validated.data, createdAt: new Date(0), updatedAt: new Date(0) });
        assert.equal(document.validateSync(), undefined);
        const snapshot = serializeTalk(TalkModel.hydrate(document.toObject()));
        assert.equal(snapshot.settings.studioTheme, studioTheme);
        assert.equal(snapshot.settings.studioCast, studioCast);
        assert.equal(snapshot.settings.studioGuest, studioGuest);
        const run = new TalkRunModel({ ...runFixture(snapshot, director), talkId: new Types.ObjectId(), talkSnapshot: snapshot, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) });
        const restored = serializeTalkRun(run);
        assert.equal(restored.talkSnapshot.settings.studioTheme, studioTheme);
        assert.equal(restored.talkSnapshot.settings.studioCast, studioCast);
        assert.equal(restored.talkSnapshot.settings.studioGuest, studioGuest);
        assert.equal(restored.talkSnapshot.participants.length, 2, "reserving a video space never creates a human participant");
      }
    }
  }
  for (const setting of ["studioCast", "studioGuest"]) {
    for (const value of ["unknown", null, 0, {}, ["original"]]) {
      const input = fixture(); input.settings[setting] = value;
      const result = validation.validateTalkInput(input);
      assert.equal(result.success, false);
      assert.ok(result.issues.some(issue => issue.startsWith(`settings.${setting}`)));
      const document = new TalkModel(input);
      assert.ok(document.validateSync()?.errors[`settings.${setting}`]);
    }
  }
});

test("legacy visual settings read safely and shared query links preserve every explicit choice", () => {
  const { TalkModel } = load("@/models/PodcastTalk");
  const { TalkRunModel } = load("@/models/PodcastRun");
  const { Types } = nativeRequire("mongoose");
  const { serializeTalk } = load("@/lib/podcast/serialize-talk");
  const { serializeTalkRun } = load("@/lib/podcast/serialize-talk-run");
  const { studioSelectionQuery } = load("@/lib/podcast/studio-themes");
  const validated = validation.validateTalkInput(fixture());
  assert.equal(validated.data.settings.studioCast, "original");
  assert.equal(validated.data.settings.studioGuest, "auto");
  const document = new TalkModel({ ...fixture(), createdAt: new Date(0), updatedAt: new Date(0) });
  const raw = document.toObject(); delete raw.settings.studioCast; delete raw.settings.studioGuest;
  const response = serializeTalk(TalkModel.hydrate(raw));
  assert.equal(response.settings.studioCast, "original");
  assert.equal(response.settings.studioGuest, "auto");
  const legacy = fixture();
  const run = new TalkRunModel({ ...runFixture(legacy, director), talkId: new Types.ObjectId(), talkSnapshot: legacy, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) });
  assert.equal(serializeTalkRun(run).talkSnapshot.settings.studioCast, "original");
  assert.equal(serializeTalkRun(run).talkSnapshot.settings.studioGuest, "auto");
  assert.equal(run.talkSnapshot.settings.studioCast, undefined);
  assert.equal(run.talkSnapshot.settings.studioGuest, undefined);
  assert.equal(studioSelectionQuery({ studioTheme: "original-anime", studioLayout: "lounge", studioCast: "expressive", studioGuest: "hidden" }), "style=original-anime&scenario=lounge&cast=expressive&guest=hidden");
  assert.equal(studioSelectionQuery({ studioTheme: "unknown", studioLayout: "unknown", studioCast: [], studioGuest: {} }), "style=clean-line&scenario=studio&cast=original&guest=auto");
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
  assert.match(sent, new RegExp(`PRIVATE_PERSONALITY_${plan.participantIndex}`));
  for (let index = 0; index < 3; index++) {
    if (index !== plan.participantIndex) assert.ok(!sent.includes(`PRIVATE_POSITION_${index}`));
    if (index !== plan.participantIndex) assert.ok(!sent.includes(`PRIVATE_PERSONALITY_${index}`));
  }
  assert.match(built.instructions, /Never write dialogue.*real human/);
  assert.match(built.input, /Chi decide quando fidarsi/);
  assert.match(built.input, /Chiedi esempi concreti/);
});

test("personality is optional for legacy records, bounded for AI, and never assigned to the human guest", () => {
  const input = fixture();
  const parsed = validation.validateTalkInput(input);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.participants[0].personalityPrompt, "PRIVATE_PERSONALITY_0");
  assert.equal(parsed.data.participants[2].personalityPrompt, undefined);
  const legacy = fixture();
  for (const person of legacy.participants) delete person.personalityPrompt;
  const original = JSON.stringify(legacy.participants);
  const result = validation.validateTalkInput(legacy);
  assert.equal(result.success, true);
  assert.equal(result.data.participants[0].personalityPrompt, undefined);
  assert.equal(result.data.participants[0].perspectivePrompt, "PRIVATE_POSITION_0");
  assert.equal(JSON.stringify(legacy.participants), original);
  for (const invalid of [25, {}, "a".repeat(2001)]) {
    input.participants[0].personalityPrompt = invalid;
    const rejected = validation.validateTalkInput(input);
    assert.equal(rejected.success, false);
    assert.ok(rejected.issues.some(issue => issue.includes("personalityPrompt")));
  }
});

test("personality and episode viewpoint survive persistence separately and run snapshots remain immutable", () => {
  const { Types } = nativeRequire("mongoose");
  const { TalkModel } = load("@/models/PodcastTalk");
  const { TalkRunModel } = load("@/models/PodcastRun");
  const { serializeTalk } = load("@/lib/podcast/serialize-talk");
  const { serializeTalkRun } = load("@/lib/podcast/serialize-talk-run");
  const input = fixture();
  const record = new TalkModel({ ...input, createdAt: new Date(0), updatedAt: new Date(0) });
  assert.equal(record.validateSync(), undefined);
  const snapshot = serializeTalk(TalkModel.hydrate(record.toObject()));
  assert.equal(snapshot.participants[0].personalityPrompt, "PRIVATE_PERSONALITY_0");
  assert.equal(snapshot.participants[0].perspectivePrompt, "PRIVATE_POSITION_0");
  const run = new TalkRunModel({ ...runFixture(snapshot, director), talkId: new Types.ObjectId(),
    talkSnapshot: snapshot, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0) });
  const persistedRun = TalkRunModel.hydrate(run.toObject());
  record.participants[0].personalityPrompt = "Later personality";
  snapshot.participants[0].personalityPrompt = "Later source edit";
  const serialized = serializeTalkRun(persistedRun);
  assert.equal(serialized.talkSnapshot.participants[0].personalityPrompt, "PRIVATE_PERSONALITY_0");
  serialized.talkSnapshot.participants[0].personalityPrompt = "Later response edit";
  assert.equal(persistedRun.talkSnapshot.participants[0].personalityPrompt, "PRIVATE_PERSONALITY_0");
});

test("simple personality profiles fill real character instructions without changing identity, voice or episode stance", () => {
  const { personalityProfile, selectedPersonalityProfile } = load("@/lib/podcast/personality-presets");
  for (const language of ["it", "en"]) {
    for (const id of ["curious", "analytical", "playful", "empathetic"]) {
      const before = fixture(2).participants[0];
      before.voiceId = "im_nicola";
      const person = { ...before, ...personalityProfile(id, language) };
      assert.equal(selectedPersonalityProfile(person), id);
      for (const key of ["voiceId", "name", "sex", "role", "perspectivePrompt", "goals"]) assert.equal(person[key], before[key]);
      assert.equal(selectedPersonalityProfile({ ...person, patience: person.patience - 1 }), "custom");
      assert.equal(selectedPersonalityProfile({ ...person, personalityPrompt: "My own character" }), "custom");
    }
  }
  assert.equal(selectedPersonalityProfile(fixture(2).participants[0]), "custom");
  assert.equal(personalityProfile("missing", "it"), undefined);
});

test("new hosts can start with a personality and no preassigned opinion", () => {
  const { defaultPodcast } = load("@/components/podcast/podcast-defaults");
  for (const english of [false, true]) {
    const talk = defaultPodcast(english);
    const parsed = validation.validateTalkInput(talk);
    assert.equal(parsed.success, true, JSON.stringify(parsed));
    for (const person of parsed.data.participants.filter(person => person.kind === "ai")) {
      assert.equal(person.perspectiveMode, "automatic");
      assert.equal(person.perspectivePrompt, "");
      assert.ok(person.personalityPrompt.length > 0);
    }
    const run = runFixture(talk, director);
    const plan = director.chooseNextTurn(talk, run);
    const built = prompt.buildTurnPrompt(talk, run, plan);
    assert.match(built.instructions, /Form your own position from the episode context/u);
    assert.match(built.instructions, /allowing your opinion and sentence moods to evolve/u);
  }
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

test("structured provider responses reject truncation and refusals even when a valid JSON object is present", async () => {
  const request = { model: "openai-default", instructions: "Offline mock only", input: "Offline mock only", schemaName: "podcast_test", schema: {} };
  const data = { sentences: [acting("Una risposta completa.")] };
  const output = [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(data) }] }];
  for (const payload of [
    { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output },
    { status: "failed", output },
    { status: "completed", output: [...output, { type: "message", content: [{ type: "refusal", refusal: "Refusal should stay private" }] }] },
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"sentences":[' }] }] },
  ]) {
    let calls = 0;
    const provider = loader({ env: { PODCAST_AI_ENABLED: "true", OPENAI_API_KEY: "offline-test-placeholder" },
      fetcher: async () => { calls++; return Response.json(payload); } })("@/lib/podcast/llm-provider");
    await assert.rejects(provider.generateLlmJson(request), error => error.name === "ProviderError" && !error.message.includes("private"));
    assert.equal(calls, 1, "invalid output never triggers an automatic paid retry");
  }
  const provider = loader({ env: { PODCAST_AI_ENABLED: "true", OPENAI_API_KEY: "offline-test-placeholder" },
    fetcher: async () => Response.json({ status: "completed", output, usage: { input_tokens: 10, output_tokens: 12 } }) })("@/lib/podcast/llm-provider");
  const result = await provider.generateLlmJson(request);
  assert.equal(result.data.sentences[0].text, data.sentences[0].text);
  assert.equal(result.generation.inputTokens, 10);
  assert.equal(result.generation.outputTokens, 12);
});

test("Gemini structured responses reject token limits and blocked content without inspecting their text as speech", async () => {
  const request = { model: "gemini-default", instructions: "Offline mock only", input: "Offline mock only", schemaName: "podcast_test", schema: {} };
  const content = { parts: [{ text: JSON.stringify({ sentences: [acting("Una frase completa.")] }) }] };
  for (const payload of [
    { candidates: [{ finishReason: "MAX_TOKENS", content }] },
    { candidates: [{ finishReason: "SAFETY", content }] },
    { candidates: [{ finishReason: "STOP", content }], promptFeedback: { blockReason: "SAFETY" } },
  ]) {
    let calls = 0;
    const provider = loader({ env: { PODCAST_AI_ENABLED: "true", GEMINI_API_KEY: "offline-test-placeholder", PODCAST_GEMINI_MODEL: "offline-model" },
      fetcher: async () => { calls++; return Response.json(payload); } })("@/lib/podcast/llm-provider");
    await assert.rejects(provider.generateLlmJson(request), /did not complete/u);
    assert.equal(calls, 1);
  }
  const provider = loader({ env: { PODCAST_AI_ENABLED: "true", GEMINI_API_KEY: "offline-test-placeholder", PODCAST_GEMINI_MODEL: "offline-model" },
    fetcher: async () => Response.json({ candidates: [{ finishReason: "STOP", content }] }) })("@/lib/podcast/llm-provider");
  assert.equal((await provider.generateLlmJson(request)).data.sentences[0].text, "Una frase completa.");
});

/** In-memory persistence boundary exercises orchestration without Mongo or a provider. */
function orchestrationFixture({ expectHuman = false, aiEnabled = false, generation, review } = {}) {
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
      generateLlmJson: async (request) => {
        providerCalls++;
        if (!aiEnabled) throw new Error("No paid calls");
        if (generation) return generation(request);
        const content = "La verifica umana deve seguire criteri chiari, altrimenti rischiamo di approvare ogni suggerimento senza comprenderlo.";
        const data = { sentences: [{ text: content, mood: "doubt", intensity: 0.55,
          listenerMood: "curiosity", listenerIntensity: 0.35 }] };
        return { data, generation: { content: JSON.stringify(data), model: "openai-default", provider: "openai", inputTokens: 10, outputTokens: 10 } };
      },
      ProviderError: class ProviderError extends Error {},
    },
    "@/lib/podcast/talk-editorial-review": { reviewEditorialArc: (...args) => { providerCalls++; if (review) return review(...args); throw new Error("No paid editorial calls"); } },
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
  assert.equal(run.messages[0].performance, undefined);
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

test("one structured generation supplies clean deltas and sentence moods before speech and persistence", async () => {
  const context = orchestrationFixture({ aiEnabled: true });
  context.document.talkSnapshot.settings.studioLayout = "lounge";
  const events = [], deltas = [];
  const result = await context.engine.advanceTalkRun(context.id, {
    onDelta(delta) { events.push("delta"); deltas.push(delta); },
    onSpeechReady(message) {
      events.push("speech");
      assert.equal(message.performance.source, "ai");
      assert.equal(message.performance.sentences[0].mood, "doubt");
      assert.equal(message.content, message.performance.sentences.map(sentence => sentence.text).join(" "));
    },
    onTurnSaved(run) { events.push("saved"); assert.equal(run.messages.at(-1).performance.source, "ai"); },
  });
  const message = result.messages[0];
  assert.equal(deltas.join(""), message.content);
  assert.ok(deltas.every(delta => !/[{}]/u.test(delta)), "JSON annotations are never transcript or TTS text");
  assert.equal(events.filter(event => event === "speech").length, 1);
  assert.ok(events.indexOf("speech") < events.indexOf("saved"));
  assert.equal(message.inputTokens, 10);
  assert.equal(message.outputTokens, 10);
  assert.equal(context.providerCalls(), 1);
  assert.equal(result.talkSnapshot.settings.studioLayout, "lounge");
});

test("invalid structured acting fails the turn without deltas, speech or persisted dialogue", async () => {
  let speech = 0, deltas = 0;
  const context = orchestrationFixture({ aiEnabled: true, generation: async request => {
    assert.equal(request.schemaName, "podcast_turn_performance");
    return { data: { sentences: [acting("Questa frase non deve essere pronunciata.", { mood: "invalid" })] },
      generation: { provider: "openai", model: request.model, content: "raw JSON", inputTokens: 2, outputTokens: 5 } };
  } });
  await assert.rejects(context.engine.advanceTalkRun(context.id, {
    onDelta() { deltas++; }, onSpeechReady() { speech++; },
  }), error => error.status === 502 && error.run.status === "failed");
  assert.equal(speech, 0);
  assert.equal(deltas, 0);
  assert.equal(context.document.messages.length, 0);
  assert.equal(context.document.generationToken, undefined);
  assert.equal(context.providerCalls(), 1);
});

test("a prepared reply retains sentence moods and is consumed once without a second generation", async () => {
  for (const legacy of [false, true]) {
    const context = orchestrationFixture({ aiEnabled: true });
    const first = await context.engine.advanceTalkRun(context.id, {}, { prepareNext: true });
    assert.equal(first.hasPreparedTurn, true);
    assert.equal(context.document.preparedTurn.performance.source, "ai");
    assert.equal(context.providerCalls(), 2, "one current and one explicitly requested prepared turn");
    if (legacy) delete context.document.preparedTurn.performance;
    const preparedContent = context.document.preparedTurn.content;
    const second = await context.engine.advanceTalkRun(context.id);
    assert.equal(second.messages.length, 2);
    assert.equal(second.messages[1].content, preparedContent);
    assert.equal(second.messages[1].performance.source, legacy ? "legacy" : "ai");
    assert.equal(second.messages[1].performance.sentences[0].mood, legacy ? "attention" : "doubt");
    assert.equal(second.hasPreparedTurn, false);
    assert.equal(context.document.preparedTurn, undefined);
    assert.equal(context.providerCalls(), 2, "consuming a valid prepared turn never generates it again");
  }
});

test("an aborted structured request releases its own lease before speech or storage", async () => {
  const controller = new AbortController();
  const context = orchestrationFixture({ aiEnabled: true, generation: async request => {
    assert.equal(request.signal.aborted, false);
    controller.abort(new DOMException("Operator stopped", "AbortError"));
    assert.equal(request.signal.aborted, true);
    return { data: { sentences: [acting("Non deve partire.")] }, generation: { content: "JSON", model: request.model, provider: "openai" } };
  } });
  let spoken = 0;
  await assert.rejects(context.engine.advanceTalkRun(context.id, { onSpeechReady() { spoken++; } }, { signal: controller.signal }), error => error.status === 499);
  assert.equal(spoken, 0);
  assert.equal(context.document.messages.length, 0);
  assert.equal(context.document.status, "idle");
  assert.equal(context.document.generationToken, undefined);
});

test("Mongoose persists and serializes sentence acting for messages and prepared turns without internal fields", () => {
  const { Types } = nativeRequire("mongoose");
  const { TalkRunModel } = load("@/models/PodcastRun");
  const { serializeTalkRun } = load("@/lib/podcast/serialize-talk-run");
  const talk = fixture(), run = runFixture(talk, director), plan = director.chooseNextTurn(talk, run);
  const annotated = performance.parseGeneratedPerformance({ sentences: [acting("Quale prova proponi?"), acting("Ti ascolto.", { mood: "empathy" })] });
  const document = new TalkRunModel({ ...run, _id: new Types.ObjectId(), talkId: new Types.ObjectId(),
    messages: [{ ...plan, ...annotated, origin: "ai", sequence: 1, provider: "openai", model: "openai-default",
      wordCount: 5, estimatedAirtimeSeconds: 3, createdAt: new Date(0) }],
    preparedTurn: { basedOnSequence: 1, plan, ...annotated, provider: "openai", model: "openai-default", createdAt: new Date(0) },
    talkSnapshot: talk, startedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0),
  });
  assert.equal(document.validateSync(["messages", "preparedTurn"]), undefined);
  assert.equal(document.preparedTurn.performance.sentences[1].mood, "empathy");
  const serialized = serializeTalkRun(document);
  assert.equal(serialized.messages[0].performance.source, "ai");
  assert.equal(serialized.messages[0].performance.sentences.length, 2);
  assert.deepEqual(Object.keys(serialized.messages[0].performance.sentences[0]).sort(),
    ["intensity", "listenerIntensity", "listenerMood", "mood", "text"]);
  document.messages[0].performance.sentences[0].intensity = 2;
  assert.ok(document.validateSync(["messages"])?.errors["messages.0.performance.sentences.0.intensity"]);
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

test("new Kokoro settings preserve approved voice IDs while missing provider stays Inworld-compatible", () => {
  const legacy = validation.validateTalkInput(fixture());
  assert.equal(legacy.success, true); assert.equal(legacy.data.settings.voiceProvider, "inworld");
  const talk = fixture(); talk.settings.voiceProvider = "kokoro";
  talk.participants[0].voiceId = "im_nicola"; talk.participants[1].voiceId = "if_sara";
  const result = validation.validateTalkInput(talk);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.data.participants[0].voiceId, "im_nicola"); assert.equal(result.data.settings.voiceProvider, "kokoro");
  talk.participants[0].voiceId = "Gianni";
  assert.equal(validation.validateTalkInput(talk).success, false);
  talk.participants[0].voiceId = "im_nicola"; talk.language = "en";
  assert.equal(validation.validateTalkInput(talk).success, false);
});

test("visual format presets cover six distinct families and preserve editorial content and voices", () => {
  const formats = load("@/lib/podcast/studio-formats");
  const catalog = load("@/lib/podcast/studio-themes");
  assert.equal(formats.STUDIO_FORMATS.length, 8);
  assert.equal(new Set(Object.values(formats.STUDIO_STYLE_GUIDES).map(guide => guide.family)).size, 6);
  assert.deepEqual(Object.keys(formats.STUDIO_STYLE_GUIDES).sort(), [...catalog.STUDIO_THEME_IDS].sort());
  for (const format of formats.STUDIO_FORMATS) {
    const input = fixture(2);
    input.settings.voiceProvider = "kokoro";
    const before = JSON.stringify({ participants: input.participants, topic: input.topic, centralQuestion: input.centralQuestion, voiceProvider: input.settings.voiceProvider });
    Object.assign(input.settings, format.selection);
    assert.equal(formats.matchesStudioFormat(input.settings, format), true);
    assert.equal(validation.validateTalkInput(input).success, true, format.id);
    assert.equal(JSON.stringify({ participants: input.participants, topic: input.topic, centralQuestion: input.centralQuestion, voiceProvider: input.settings.voiceProvider }), before);
    assert.ok(formats.getStudioStyleGuide(format.selection.studioTheme).formats.some(item => item.id === format.id));
  }
});

test("low latency stores validated speech before editorial review and retains the lease until memory is ready", async () => {
  let finishReview, startedReview;
  const reviewing = new Promise(resolve => { startedReview = resolve; });
  const release = new Promise(resolve => { finishReview = resolve; });
  const context = orchestrationFixture({ aiEnabled: true, review: async (_talk, projected) => {
    startedReview(); await release; return { state: projected.discussionState };
  } });
  context.document.participantTurnCount = 3;
  let ready = 0;
  const generating = context.engine.advanceTalkRun(context.id, {
    onSpeechStored(run) {
      ready++;
      assert.equal(run.status, "generating");
      assert.equal(context.document.messages.length, 1);
      assert.equal(run.messages[0].performance.source, "ai");
      assert.equal(context.document.generationToken.length > 0, true);
    },
  }, { lowLatency: true });
  await reviewing;
  assert.equal(ready, 1);
  await assert.rejects(context.engine.advanceTalkRun(context.id), error => error.status === 409);
  finishReview();
  const result = await generating;
  assert.equal(result.messages.length, 1, "early save and final review never duplicate speech");
  assert.equal(result.status, "idle");
  assert.equal(context.document.generationToken, undefined);
});

test("Claude receives the selected character and context in one structured API request without altering the shared schema", async () => {
  const calls = [];
  const data = { sentences: [acting("Un esempio concreto aiuterebbe.")] };
  const schemaBefore = JSON.stringify(performance.TURN_PERFORMANCE_SCHEMA);
  const provider = loader({ env: { PODCAST_AI_ENABLED: "true", ANTHROPIC_API_KEY: "offline-test-key", PODCAST_CLAUDE_MODEL: "configured-claude-test" },
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(data) }], usage: { input_tokens: 42, output_tokens: 23 } });
    } })("@/lib/podcast/llm-provider");
  const talk = fixture(2); talk.participants[0].modelOverride = "claude-default";
  const run = runFixture(talk, director), plan = { ...director.chooseNextTurn(talk, run), participantIndex: 0 };
  const built = prompt.buildTurnPrompt(talk, run, plan);
  const result = await provider.generateLlmJson({ model: "claude-default", ...built, schemaName: "podcast_turn_performance", schema: performance.TURN_PERFORMANCE_SCHEMA });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "configured-claude-test");
  assert.ok(body.system.includes("PRIVATE_PERSONALITY_0"));
  assert.ok(!body.system.includes("PRIVATE_PERSONALITY_1"));
  assert.ok(body.messages[0].content.includes(talk.centralQuestion));
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(result.generation.provider, "claude");
  assert.equal(result.generation.inputTokens, 42);
  assert.equal(performance.parseGeneratedPerformance(result.data).performance.sentences[0].mood, "curiosity");
  assert.equal(JSON.stringify(performance.TURN_PERFORMANCE_SCHEMA), schemaBefore);
});

test("Claude readiness requires an explicit model and key; partial or refused messages never become speech", async () => {
  let network = 0;
  const disabled = loader({ env: { ANTHROPIC_API_KEY: "offline-key", PODCAST_CLAUDE_MODEL: "test-model" }, fetcher: () => { network++; } })("@/lib/podcast/llm-provider");
  assert.equal(disabled.isProviderConfigured("claude"), false);
  await assert.rejects(disabled.generateLlmJson({ model: "claude-default", instructions: "test", input: "test", schemaName: "test", schema: {} }));
  assert.equal(network, 0);
  for (const stop_reason of ["max_tokens", "refusal", "stop_sequence"]) {
    const provider = loader({ env: { PODCAST_AI_ENABLED: "true", ANTHROPIC_API_KEY: "offline-key", PODCAST_CLAUDE_MODEL: "test-model" },
      fetcher: async () => Response.json({ stop_reason, content: [{ type: "text", text: '{"sentences":[]}' }] }) })("@/lib/podcast/llm-provider");
    await assert.rejects(provider.generateLlmJson({ model: "claude-default", instructions: "test", input: "test", schemaName: "test", schema: {} }), /did not complete/u);
  }
});

test("disconnecting the podcast SSE stream cancels its generation signal", async () => {
  let observed;
  const streamRoute = loader({ overrides: {
    "@/lib/podcast/request-guard": { podcastMutationIsSameOrigin: () => true },
    "@/lib/podcast/advance-talk-run": {
      AdvanceTalkRunError: class AdvanceTalkRunError extends Error {},
      advanceTalkRun: async (_id, hooks, options) => {
        observed = options.signal;
        hooks.onPlan({ speakerName: "Offline fixture" });
        await new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("Disconnected")), { once: true }));
      },
    },
  } })("@/app/api/podcast/runs/[id]/next/stream/route");
  const response = await streamRoute.POST(new Request("http://127.0.0.1/api/podcast/runs/aaaaaaaaaaaaaaaaaaaaaaaa/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "a".repeat(24) }) });
  const reader = response.body.getReader();
  await reader.read(); assert.equal(observed.aborted, false);
  await reader.cancel(); assert.equal(observed.aborted, true);
});

test("public video topic modes validate, serialize, and preserve immutable episode snapshots", () => {
  const topic = load("@/lib/podcast/video-topic");
  const input = fixture();
  assert.equal(topic.resolveVideoTopic(input, "Un altro tema"), input.topic);
  input.settings.videoTopicMode = "conversation";
  assert.equal(topic.resolveVideoTopic(input), input.topic);
  assert.equal(topic.resolveVideoTopic(input, "Una domanda in onda"), "Una domanda in onda");
  input.settings.videoTopicMode = "hidden";
  assert.equal(topic.resolveVideoTopic(input, "Una domanda in onda"), "");
  input.settings.videoTopicMode = "custom";
  input.settings.videoTopicText = "  AI: aiuto o delega?  ";
  const valid = validation.validateTalkInput(input);
  assert.equal(valid.success, true);
  assert.equal(valid.data.settings.videoTopicText, "AI: aiuto o delega?");
  assert.equal(topic.resolveVideoTopic(valid.data, "Altro"), "AI: aiuto o delega?");
  const { TalkModel } = load("@/models/PodcastTalk");
  const { serializeTalk } = load("@/lib/podcast/serialize-talk");
  const record = new TalkModel({ ...valid.data, createdAt: new Date(0), updatedAt: new Date(0) });
  assert.equal(record.validateSync(), undefined);
  const saved = serializeTalk(TalkModel.hydrate(record.toObject()));
  assert.equal(saved.settings.videoTopicMode, "custom");
  assert.equal(saved.settings.videoTopicText, "AI: aiuto o delega?");
  for (const changes of [{ videoTopicMode: "unknown" }, { videoTopicText: 23 }, { videoTopicText: "x".repeat(81) }, { videoTopicText: "  " }]) {
    assert.equal(validation.validateTalkInput({ ...input, settings: { ...input.settings, ...changes } }).success, false);
  }
  const { studioSelectionQuery } = load("@/lib/podcast/studio-themes");
  const query = new URLSearchParams(studioSelectionQuery(saved.settings));
  assert.equal(query.get("topicText"), "AI: aiuto o delega?");
  assert.equal(query.get("topicMode"), "custom");
  assert.equal(topic.normalizeVideoTopicMode(undefined), "episode");
});

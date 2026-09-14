// Opt-in paid OpenAI check, fictional data only. No database, bot or TTS access.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import nextEnv from "@next/env";
import ts from "typescript";

if (!process.argv.includes("--run")) {
  console.log("Opt-in: node --import=./scripts/system-ca.mjs scripts/verify-conversation.mjs --run (up to 12 OpenAI calls; fictional data only).");
  console.log("Add --interventions for only 6 contextual hand-raise probes (no database, bot or TTS).");
  process.exit(0);
}
nextEnv.loadEnvConfig(process.cwd());
const nativeRequire = createRequire(import.meta.url);
const layers = { global: "Fictional test: Progetto Aurora è nato a Lione, in Francia.", series: "", meeting: "" };
const briefing = { openQuestions: [], rememberedFacts: [], decisions: [], actionItems: [], participantNotes: [], previousMeetingIds: [] };
const overrides = {
  "server-only": {},
  "@/lib/assistant-context-store": { getMeetingContextLayers: async () => layers },
  "@/lib/assistant-profile": { getAssistantProfile: async () => ({ displayName: "Riccardo", role: "digital colleague", personality: { responseStyle: "concise", attitude: "collaborative" } }) },
  "@/lib/meeting-continuity": { buildMeetingContinuity: async () => briefing },
  "@/lib/serialize-meeting": { serializeMeeting: value => JSON.parse(JSON.stringify(value)) },
};
const cache = new Map();
function load(name) {
  if (Object.hasOwn(overrides, name)) return overrides[name];
  if (name.startsWith("node:")) return nativeRequire(name);
  if (!/^@\/lib\/[a-z-]+$/.test(name)) throw new Error("Unexpected module boundary");
  if (cache.has(name)) return cache.get(name);
  const compiled = ts.transpileModule(readFileSync(`src/lib/${name.slice("@/lib/".length)}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const probeModule = { exports: {} };
  runInNewContext(compiled, { module: probeModule, exports: probeModule.exports, require: load,
    process, fetch, AbortSignal, AbortController, URL, Date, console, setTimeout, clearTimeout });
  cache.set(name, probeModule.exports);
  return probeModule.exports;
}
const api = load("@/lib/openai-meeting");
if (!api.isMeetingIntelligenceConfigured()) {
  console.log("SKIPPED: existing meeting AI configuration is not enabled/available. No configuration changed.");
  process.exit(2);
}
let successfulProviderCalls = 0;
overrides["@/lib/openai-meeting"] = { ...api,
  generateMeetingIntelligence: async (...args) => { const result = await api.generateMeetingIntelligence(...args); successfulProviderCalls++; return result; },
  generateMeetingStructured: async (...args) => { const result = await api.generateMeetingStructured(...args); successfulProviderCalls++; return result; },
};
const resolver = load("@/lib/resolve-meeting-speaking-turn");
const executor = load("@/lib/execute-meeting-command");
const meeting = () => ({ id: "fictional-probe", language: "it", status: "live", objective: "Review fictional project Aurora",
  bot: { status: "joined" }, assistant: { wakeWord: "Riccardo", correctionPolicy: "important_only" }, agenda: [],
  transcript: [], commandHistory: [], summary: { overview: "", rememberedFacts: [], decisions: [], actionItems: [], openQuestions: [] },
  save: async () => {},
});
let failed = 0;
async function check(name, run, accept) {
  const start = performance.now();
  const previousSuccesses = successfulProviderCalls;
  try {
    const result = await run(); const pass = successfulProviderCalls > previousSuccesses && accept(result);
    if (!pass) failed++;
    console.log(JSON.stringify({ test: name, pass, elapsedMs: Math.round(performance.now() - start), result }));
  } catch {
    failed++; console.log(JSON.stringify({ test: name, pass: false, error: "probe_failed", elapsedMs: Math.round(performance.now() - start) }));
  }
}
if (process.argv.includes("--interventions")) {
  const examples = [
    { name: "embedded Italian assertion", texts: ["Siamo pronti per la prova. Direi che tre per tre fa 12, possiamo proseguire."], correction: true },
    { name: "embedded English assertion", texts: ["Before we continue with the exercise, three times three is twelve, so let us proceed."], correction: true },
    { name: "negated error", texts: ["Non è vero che tre per tre fa dodici: fa nove."], correction: false },
    { name: "reported and already corrected", texts: ['Nel compito c’era scritto "tre per tre fa dodici": abbiamo già corretto l’errore, fa nove.'], correction: false },
    { name: "correct decimals", texts: ["Per questo esercizio, 1,5 per 2 fa 3. Possiamo continuare."], correction: false },
    { name: "later self-correction in the batch", texts: ["Direi che tre per tre fa dodici, procediamo.", "Anzi, rettifico: tre per tre fa nove, avevo sbagliato."], correction: false },
  ];
  for (const example of examples) {
    const probe = meeting();
    probe.objective = "Check elementary calculations during a fictional acceptance test";
    const batch = example.texts.map((text, index) => ({ segmentId: `probe-${index}`, speakerName: "Elena", text }));
    probe.transcript = batch.map((segment, index) => ({ ...segment, source: "participant", createdAt: new Date(Date.now() - 5000 + index * 1000) }));
    await check(example.name, async () => {
      let outcome;
      const proposal = await executor.detectImportantIntervention(probe, example.texts.at(-1), (reason, detail) => { outcome = { reason, detail }; }, batch);
      return { proposal, outcome };
    }, result => example.correction
      ? result.proposal?.type === "correction" && /9|nove|nine/i.test(result.proposal.response) && result.proposal.sourceSegmentId === batch[0].segmentId
      : !result.proposal && result.outcome?.reason === "no_material_issue");
  }
  console.log(JSON.stringify({ failed, successfulProviderCalls, scope: "six fictional contextual assessments only; no Teams or audio" }));
  process.exit(failed ? 1 : 0);
}
for (const [text, expected] of [
  ["Riccardo ci sta ascoltando.", "ignore"],
  ["Continuiamo pure. Riccardo ci sta ascoltando?", "ignore"],
  ["Before we continue, Riccardo, what did you want to add?", "grant"],
  ["Ok, prima di continuare, Riccardo, cosa volevi dire?", "grant"],
  ["Prima però Riccardo ti chiedo di aspettare", "decline"],
  ["Se ci servirà, Riccardo potrà parlare dopo", "ignore"],
  ["Prima di continuare, Riccardo, potrai intervenire solamente quando ti chiamerò.", "defer"],
  ["Prima di andare avanti, Riccardo, cosa pensi del budget?", "request"],
]) {
  await check(`turn: ${text}`, () => resolver.resolveMeetingSpeakingTurn(meeting(), {
    text, wakeWord: "Riccardo", recent: [{ speakerName: "Elena", text: "Tre per tre fa 12" }],
    pending: { id: "fictional-hand", statement: "Tre per tre fa 12", response: "Tre per tre fa 9, non 12" },
  }), result => result.action === expected);
}
const noTechnicalPreamble = text => typeof text === "string" && !/transcript|trascrizion|contesto disponibile|conferma esplicita/i.test(text);
await check("answer from configured background", () => executor.executeMeetingCommand(meeting(), "ask", "Dove è nato il progetto Aurora?"),
  text => noTechnicalPreamble(text) && /Lione|Francia/i.test(text));
const dialogue = meeting();
dialogue.commandHistory.push({ id: "fictional-answer", kind: "ask", prompt: "Raccontami una barzelletta", response: "Perché il libro di matematica era triste? Perché aveva troppi problemi.", createdAt: new Date(Date.now() - 5000) });
await check("remember own previous answer", () => executor.executeMeetingCommand(dialogue, "ask", "Spiegami la barzelletta che hai appena raccontato."),
  text => noTechnicalPreamble(text) && /problem/i.test(text) && /matematic|doppio senso|gioco di parole/i.test(text));
const older = meeting();
older.transcript = [{ speakerName: "Elena", source: "participant", text: "Il responsabile del progetto Aurora è Marco, con consegna venerdì.", createdAt: new Date(Date.now() - 120000) },
  ...Array.from({ length: 45 }, (_, i) => ({ speakerName: "Elena", source: "participant", text: `Stiamo discutendo la sala riunioni, dettaglio ${i}.`, createdAt: new Date(Date.now() - 90000 + i * 1000) }))];
await check("retrieve an earlier named point", () => executor.executeMeetingCommand(older, "ask", "Chi è il responsabile del progetto Aurora e quando deve consegnare?"),
  text => noTechnicalPreamble(text) && /Marco/i.test(text) && /venerd/i.test(text));
await check("unknown fact stays uncertain", () => executor.executeMeetingCommand(meeting(), "ask", "Qual è il codice fiscale di Elena?"),
  text => noTechnicalPreamble(text) && /non (?:lo |ho |conosco|so|dispongo)|informazion/i.test(text));
console.log(JSON.stringify({ failed, successfulProviderCalls, scope: "fictional OpenAI text probes only; not Teams, microphone or media acceptance" }));
process.exitCode = failed ? 1 : 0;

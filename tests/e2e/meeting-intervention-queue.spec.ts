import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import ts from "typescript";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel, type MeetingDocument } from "../../src/models/Meeting";
import * as commands from "../../src/lib/meeting-command";
import * as source from "../../src/lib/meeting-transcript-source";
import * as followUp from "../../src/lib/meeting-follow-up";
import * as participants from "../../src/lib/meeting-participants";
import * as limits from "../../src/lib/meeting-intervention-context";
import * as redaction from "../../src/lib/diagnostic-redaction.mjs";
import type { MeetingTranscriptSegment } from "../../src/types/meeting";
import * as consume from "../../src/lib/consume-meeting-intervention";
import * as pending from "../../src/lib/meeting-pending-intervention";
import { resolveLocalMeetingSpeakingTurn, type SpeakingTurnInput } from "../../src/lib/meeting-speaking-turn";

const owned: string[] = [];
const incident = "Sono prontissimi. Ieri ha scritto grandi cose fa il camionista e i camionisti, si sa, ma non lo so che si mangia bene. Andiamo tre per tre fa 12, deve cominciare.";
type Candidate = limits.InterventionCandidate;
type Proposal = { type: "correction"; sourceSegmentId: string; reason: string; response: string } | undefined;
type Decide = (reason: "no_material_issue" | "ai_unavailable" | "analysis_error", detail?: string) => void;

test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated DB required");
  loadEnvConfig(process.cwd()); await connectToDatabase();
});
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Queue /u });
});

function caption(text: string, sequence: number): MeetingTranscriptSegment {
  return { segmentId: randomUUID(), entryAttemptId: "attempt", speakerName: "Elena", source: "participant", sequence,
    createdAt: new Date(Date.now() - 1000 + sequence), text,
    interventionDecision: { state: "queued", reason: "awaiting_check", decidedAt: new Date() } };
}
async function fixture(request: APIRequestContext, texts = [incident]) {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Queue ${randomUUID()}`, objective: "Verificare le affermazioni", meetingUrl: "https://teams.microsoft.com/l/meetup-join/queue-fixture",
    scheduledStart: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "it", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const { meeting } = await response.json(); owned.push(meeting.id);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    status: "live", "assistant.wakeWord": "Riccardo", "bot.status": "joined", "bot.provider": "attendee", "bot.entryAttemptId": "attempt",
    "bot.interventionNextCheckAt": new Date(Date.now() - 1000), transcript: texts.map((text, index) => caption(text, index + 1)),
  } });
  return MeetingModel.findById(meeting.id).orFail();
}

function harness(analyze: (batch: Candidate[], decide: Decide) => Promise<Proposal>) {
  const calls: Candidate[][] = [];
  const deps: Record<string, unknown> = {
    "node:crypto": { randomUUID }, "@/models/Meeting": { MeetingModel },
    "@/lib/meeting-command": commands, "@/lib/meeting-transcript-source": source,
    "@/lib/meeting-follow-up": followUp, "@/lib/meeting-participants": participants,
    "@/lib/meeting-intervention-context": limits, "@/lib/diagnostic-redaction.mjs": redaction,
    "@/lib/execute-meeting-command": { detectImportantIntervention: async (_m: unknown, _text: string, decide: Decide, batch: Candidate[]) => {
      calls.push(batch); return analyze(batch, decide);
    } },
  };
  const code = ts.transpileModule(readFileSync("src/lib/meeting-intervention-queue.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} as {
    processMeetingInterventionQueue: (id: string) => Promise<void>;
    enqueueMeetingIntervention: (meeting: MeetingDocument, segment: MeetingTranscriptSegment) => Promise<void>;
  } };
  runInNewContext(code, { module: mod, exports: mod.exports, console, require: (name: string) => {
    if (!(name in deps)) throw new Error(`Unmocked boundary ${name}`); return deps[name];
  } });
  return { ...mod.exports, calls };
}

test("ingress collects a fixed 2.5-second batch, performs no analysis and cannot postpone it", async ({ request }) => {
  const m = await fixture(request, [incident]);
  await MeetingModel.updateOne({ _id: m._id }, { $unset: { "bot.interventionNextCheckAt": 1 } });
  const h = harness(async () => { throw new Error("Analysis must not run on ingress or before the window"); });
  const before = Date.now();
  await h.enqueueMeetingIntervention(m, m.transcript[0]);
  const saved = await MeetingModel.findById(m._id).orFail();
  const due = saved.bot.interventionNextCheckAt!.getTime();
  expect(limits.INTERVENTION_CHECK_INTERVAL_MS).toBe(2500);
  expect(due).toBeGreaterThanOrEqual(before + 2500);
  expect(due).toBeLessThanOrEqual(Date.now() + 2500);
  const next = caption("Anzi, il risultato corretto è nove.", 2);
  await MeetingModel.updateOne({ _id: m._id }, { $push: { transcript: next } });
  await h.enqueueMeetingIntervention(m, next);
  await h.processMeetingInterventionQueue(m.id);
  const collected = await MeetingModel.findById(m._id).orFail();
  expect(collected.bot.interventionNextCheckAt?.getTime()).toBe(due);
  expect(collected.transcript.every(item => item.interventionDecision?.state === "queued")).toBe(true);
  expect(h.calls).toHaveLength(0);
});

test("simple arithmetic also waits for the collection window and keeps a later self-correction", async ({ request }) => {
  const m = await fixture(request, ["Tre per tre fa 12."]);
  await MeetingModel.updateOne({ _id: m._id }, { $unset: { "bot.interventionNextCheckAt": 1 } });
  const h = harness(async (batch, decide) => {
    expect(batch.map(item => item.text)).toEqual(["Tre per tre fa 12.", "Anzi, fa nove."]);
    decide("no_material_issue", "Already corrected in the next caption"); return undefined;
  });
  await h.enqueueMeetingIntervention(m, m.transcript[0]);
  expect((await MeetingModel.findById(m.id).orFail()).pendingIntervention).toBeUndefined();
  const next = caption("Anzi, fa nove.", 2);
  await MeetingModel.updateOne({ _id: m._id }, { $push: { transcript: next } });
  await h.enqueueMeetingIntervention(m, next);
  await MeetingModel.updateOne({ _id: m._id }, { $set: { "bot.interventionNextCheckAt": new Date(Date.now() - 1) } });
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls).toHaveLength(1);
  expect((await MeetingModel.findById(m.id).orFail()).pendingIntervention).toBeUndefined();
});

test("a named request completes while proactive model IO is still blocked, without waiting on its lease", async ({ request }) => {
  const m = await fixture(request);
  let finish!: (proposal: Proposal) => void;
  const h = harness(async () => new Promise(resolve => { finish = resolve; }));
  const running = h.processMeetingInterventionQueue(m.id);
  await expect.poll(() => h.calls.length).toBe(1);
  const named = caption("Riccardo, mi senti?", 2);
  named.interventionDecision = undefined;
  await MeetingModel.updateOne({ _id: m._id }, { $push: { transcript: named } });
  let responded = false;
  const deps: Record<string, unknown> = {
    "node:crypto": { randomUUID }, "@/models/Meeting": { MeetingModel },
    "@/lib/meeting-command": commands, "@/lib/meeting-transcript-source": source,
    "@/lib/meeting-follow-up": followUp, "@/lib/meeting-participants": participants,
    "@/lib/consume-meeting-intervention": consume, "@/lib/diagnostic-redaction.mjs": redaction,
    "@/lib/meeting-intervention-queue": h,
    "@/lib/resolve-meeting-speaking-turn": { resolveMeetingSpeakingTurn: (_m: unknown, input: SpeakingTurnInput) => resolveLocalMeetingSpeakingTurn(input) },
    "@/lib/execute-meeting-command": { executeMeetingCommand: async (meeting: MeetingDocument, _kind: unknown, _prompt: unknown, options: { canRespond: () => Promise<boolean> }) => {
      expect(await options.canRespond()).toBe(true);
      meeting.commandHistory.push({ id: randomUUID(), kind: "ask", response: "Sì, ti sento.", createdAt: new Date() });
      await meeting.save(); responded = true; return "Sì, ti sento.";
    } },
  };
  const code = ts.transpileModule(readFileSync("src/lib/process-meeting-transcript.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} as { processMeetingTranscriptAutomation: (m: MeetingDocument, text: string, id: string) => Promise<unknown> } };
  runInNewContext(code, { module: mod, exports: mod.exports, console, require: (name: string) => {
    if (!(name in deps)) throw new Error(`Unmocked boundary ${name}`); return deps[name];
  } });
  try {
    const namedRun = mod.exports.processMeetingTranscriptAutomation(m, named.text, named.segmentId!);
    await expect.poll(() => responded, { timeout: 2000 }).toBe(true);
    expect(await namedRun).toMatchObject({ response: "Sì, ti sento." });
    expect((await MeetingModel.findById(m.id).orFail()).bot.interventionLeaseUntil).toBeTruthy();
  } finally {
    finish({ type: "correction", sourceSegmentId: m.transcript[0].segmentId!, reason: "math", response: "Fa nove" });
    await running;
  }
  const saved = await MeetingModel.findById(m.id).orFail();
  expect(saved.pendingIntervention).toBeUndefined();
  expect(saved.commandHistory).toHaveLength(1);
});

test("queued incident inside a long caption reaches contextual analysis and prepares only a silent hand", async ({ request }) => {
  const m = await fixture(request, [incident, "Proseguiamo con la preparazione della prova."]);
  const h = harness(async batch => ({ type: "correction", sourceSegmentId: batch[0].segmentId, reason: "Clear incorrect multiplication", response: "3 per 3 fa 9, non 12." }));
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls).toHaveLength(1);
  expect(h.calls[0].map(item => item.text)).toEqual(m.transcript.map(item => item.text));
  const saved = await MeetingModel.findById(m._id).orFail();
  expect(saved.pendingIntervention?.sourceStatement).toBe(incident);
  expect(saved.transcript[0].interventionDecision).toMatchObject({ state: "raised", reason: "contextual_contribution" });
  expect(saved.transcript[1].interventionDecision?.state).toBe("none");
  expect(saved.commandHistory).toHaveLength(0);
});

test("negative model decision is retained and sanitized, not confused with skipped work", async ({ request }) => {
  const m = await fixture(request, ['Ha detto "tre per tre fa 12", ma è sbagliato.']);
  const h = harness(async (_batch, decide) => { decide("no_material_issue", "Quoted and corrected already https://example.test/private?p=secret"); return undefined; });
  await h.processMeetingInterventionQueue(m.id);
  const saved = await MeetingModel.findById(m._id).orFail();
  expect(saved.pendingIntervention).toBeUndefined();
  expect(saved.transcript[0].interventionDecision).toMatchObject({ state: "none", reason: "no_material_issue" });
  expect(saved.transcript[0].interventionDecision?.detail).toContain("Quoted and corrected");
  expect(saved.transcript[0].interventionDecision?.detail).not.toContain("secret");
});

test("captions arriving during model IO survive and competing polls do not duplicate calls", async ({ request }) => {
  const m = await fixture(request);
  let finish!: (proposal: Proposal) => void;
  let pass = 0;
  const h = harness(async (batch, decide) => {
    if (pass++ === 0) return new Promise(resolve => { finish = resolve; });
    expect(batch.map(item => item.text)).toEqual([incident, "Anzi, correggo: il risultato del calcolo è nove."]);
    decide("no_material_issue", "The later caption corrected the point"); return undefined;
  });
  const running = h.processMeetingInterventionQueue(m.id);
  await expect.poll(() => h.calls.length).toBe(1);
  const next = caption("Anzi, correggo: il risultato del calcolo è nove.", 2);
  await MeetingModel.updateOne({ _id: m._id }, { $push: { transcript: next } });
  await h.enqueueMeetingIntervention(m, next);
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls).toHaveLength(1);
  finish({ type: "correction", sourceSegmentId: m.transcript[0].segmentId!, reason: "math", response: "Fa nove" });
  await running;
  const saved = await MeetingModel.findById(m._id).orFail();
  expect(saved.pendingIntervention).toBeUndefined();
  expect(saved.transcript.every(item => item.interventionDecision?.state === "queued")).toBe(true);
  expect(saved.bot.interventionNextCheckAt).toBeTruthy();
  expect(saved.bot.interventionLeaseUntil).toBeUndefined();
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls).toHaveLength(1); // No immediate catch-up/provider storm.
  await MeetingModel.updateOne({ _id: m._id }, { $set: {
    "bot.lastCorrectionCheckAt": new Date(Date.now() - limits.INTERVENTION_CHECK_INTERVAL_MS - 100),
    "bot.interventionNextCheckAt": new Date(Date.now() - 100),
  } });
  await h.processMeetingInterventionQueue(m.id);
  const reviewed = await MeetingModel.findById(m.id).orFail();
  expect(h.calls).toHaveLength(2);
  expect(reviewed.pendingIntervention).toBeUndefined();
  expect(reviewed.transcript.every(item => item.interventionDecision?.state === "none")).toBe(true);
  expect(reviewed.bot.interventionNextCheckAt).toBeUndefined();
});

test("media state is returned before contextual work and repeated polls do not duplicate an in-flight worker", async ({ request }) => {
  const m = await fixture(request);
  let finish!: (proposal: Proposal) => void;
  const h = harness(async () => new Promise(resolve => { finish = resolve; }));
  const callbacks: Array<() => Promise<void>> = [];
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: Response, after: (callback: () => Promise<void>) => callbacks.push(callback) },
    "@/lib/meeting-intervention-queue": h, "@/lib/mongodb": { connectToDatabase },
    "@/models/Meeting": { MeetingModel },
    "@/models/AssistantProfile": { AssistantProfileModel: { findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => null }) }) }) } },
    "@/lib/meeting-tts-config": { publicMeetingTtsConfig: () => ({ provider: "inworld" }) },
    "@/lib/voice-playback-metrics": {},
    "@/lib/meeting-pending-intervention": pending,
  };
  const code = ts.transpileModule(readFileSync("src/app/api/meeting-room/[token]/state/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} as { GET: (r: Request, context: { params: Promise<{ token: string }> }) => Promise<Response> } };
  runInNewContext(code, { module: mod, exports: mod.exports, console, URL, require: (name: string) => {
    if (!(name in deps)) throw new Error(`Unmocked boundary ${name}`); return deps[name];
  } });
  const read = () => mod.exports.GET(new Request("http://localhost/state?after="), { params: Promise.resolve({ token: m.bot.outputToken! }) });
  const response = await read();
  expect(response.status).toBe(200);
  expect(h.calls).toHaveLength(0);
  expect(callbacks).toHaveLength(1);
  const running = callbacks[0]();
  try {
    await expect.poll(() => h.calls.length).toBe(1);
    const state = await (await read()).json();
    expect(state).not.toHaveProperty("transcript");
    expect(state).not.toHaveProperty("interventionNextCheckAt");
    expect(state.commands).toHaveLength(0);
    expect(callbacks).toHaveLength(1);
  } finally { finish(undefined); await running; }
});

for (const mutation of ["departure", "namesake", "disabled", "new_attempt", "refusal", "replacement_hand", "late_echo"] as const) {
  test(`delayed contextual correction cannot override ${mutation}`, async ({ request }) => {
    const m = await fixture(request);
    if (mutation === "late_echo") await MeetingModel.updateOne({ _id: m._id }, { $push: { commandHistory: {
      id: "earlier-output", kind: "ask", response: incident, createdAt: new Date(Date.now() - 3000),
    } } });
    let finish!: (proposal: Proposal) => void;
    const h = harness(async () => new Promise(resolve => { finish = resolve; }));
    const running = h.processMeetingInterventionQueue(m.id);
    await expect.poll(() => h.calls.length).toBe(1);
    if (mutation === "departure") await MeetingModel.updateOne({ _id: m._id }, { $set: { status: "completed", "bot.leftAt": new Date() } });
    if (mutation === "new_attempt") await MeetingModel.updateOne({ _id: m._id }, { $set: { "bot.entryAttemptId": "new-attempt" } });
    if (mutation === "disabled") await MeetingModel.updateOne({ _id: m._id }, { $set: { "assistant.correctionPolicy": "off" } });
    if (mutation === "namesake") await MeetingModel.updateOne({ _id: m._id }, { $set: { participantRoster: {
      attemptId: "attempt", entries: [{ participantId: "human", name: "Riccardo Bianchi", present: true, timestampMs: Date.now(), eventId: "event" }],
    } } });
    if (mutation === "refusal") await MeetingModel.updateOne({ _id: m._id }, { $push: { transcript: caption("Riccardo, non intervenire", 2) } });
    if (mutation === "late_echo") await MeetingModel.updateOne({ _id: m._id }, { $set: {
      "commandHistory.0.playbackStartedAt": new Date(Date.now() - 2000),
    } });
    if (mutation === "replacement_hand") await MeetingModel.updateOne({ _id: m._id }, { $set: { pendingIntervention: {
      id: "replacement", type: "correction", sourceStatement: "Other point", reason: "other", response: "Other answer",
      createdAt: new Date(), expiresAt: new Date(Date.now() + 90000),
    } } });
    finish({ type: "correction", sourceSegmentId: m.transcript[0].segmentId!, reason: "math", response: "Fa nove" });
    await running;
    const saved = await MeetingModel.findById(m._id).orFail();
    expect(saved.pendingIntervention?.id).toBe(mutation === "replacement_hand" ? "replacement" : undefined);
    expect(saved.commandHistory).toHaveLength(mutation === "late_echo" ? 1 : 0);
  });
}

test("bounded batches retain overflow and reclaim a worker abandoned after a crash", async ({ request }) => {
  const m = await fixture(request, Array.from({ length: 10 }, (_, i) => `Punto numero ${i}: questa è una frase da verificare nel meeting.`));
  await MeetingModel.updateOne({ _id: m._id }, { $set: {
    "bot.interventionLeaseUntil": new Date(Date.now() - 1000), "transcript.0.interventionDecision.state": "checking",
  } });
  const h = harness(async (_batch, decide) => { decide("no_material_issue", "No material issue"); return undefined; });
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls[0]).toHaveLength(8);
  let saved = await MeetingModel.findById(m._id).orFail();
  expect(saved.transcript.filter(item => item.interventionDecision?.state === "queued")).toHaveLength(2);
  await MeetingModel.updateOne({ _id: m._id }, { $set: {
    "bot.lastCorrectionCheckAt": new Date(Date.now() - limits.INTERVENTION_CHECK_INTERVAL_MS - 100), "bot.interventionNextCheckAt": new Date(Date.now() - 1000),
  } });
  await h.processMeetingInterventionQueue(m.id);
  expect(h.calls[1]).toHaveLength(2);
  saved = await MeetingModel.findById(m._id).orFail();
  expect(saved.transcript.every(item => item.interventionDecision?.state === "none")).toBe(true);
});

test("expired, superseded and oversized candidates are explicitly skipped without provider IO", async ({ request }) => {
  const m = await fixture(request, [incident, "x".repeat(5000)]);
  await MeetingModel.updateOne({ _id: m._id }, { $set: { "transcript.0.createdAt": new Date(Date.now() - 91000) } });
  const h = harness(async () => { throw new Error("Unexpected paid boundary"); });
  await h.processMeetingInterventionQueue(m.id);
  const saved = await MeetingModel.findById(m._id).orFail();
  expect(h.calls).toHaveLength(0);
  expect(saved.transcript.map(item => item.interventionDecision?.reason)).toEqual(["expired", "context_limit"]);
});

test("invalid source or provider failure cannot prepare a hand or create an endless retry", async ({ request }) => {
  for (const failure of ["invalid_source", "provider_error"]) {
    const m = await fixture(request);
    const h = harness(async () => {
      if (failure === "provider_error") throw new Error("Provider failed");
      return { type: "correction", sourceSegmentId: "wrong", reason: "wrong source", response: "No" };
    });
    await h.processMeetingInterventionQueue(m.id);
    await h.processMeetingInterventionQueue(m.id);
    const saved = await MeetingModel.findById(m._id).orFail();
    expect(h.calls).toHaveLength(1);
    expect(saved.pendingIntervention).toBeUndefined();
    expect(saved.transcript[0].interventionDecision).toMatchObject({ state: "error", reason: "analysis_error" });
  }
});

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import ts from "typescript";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel, type MeetingDocument } from "../../src/models/Meeting";
import * as source from "../../src/lib/meeting-transcript-source";
import * as commands from "../../src/lib/meeting-command";
import * as followUp from "../../src/lib/meeting-follow-up";
import * as participants from "../../src/lib/meeting-participants";
import * as consume from "../../src/lib/consume-meeting-intervention";
import * as redaction from "../../src/lib/diagnostic-redaction.mjs";
import type { SpeakingTurnDecision } from "../../src/lib/meeting-speaking-turn";

const owned: string[] = [];
test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated DB required");
  loadEnvConfig(process.cwd()); await connectToDatabase();
});
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Semantic /u });
});

async function fixture(request: APIRequestContext) {
  const result = await request.post("/api/meetings", { data: {
    title: `E2E Semantic ${randomUUID()}`, objective: "Verificare un turno", meetingUrl: "https://teams.microsoft.com/l/meetup-join/semantic-fixture",
    scheduledStart: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30, timezone: "Europe/Rome",
    language: "it", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(result.status()).toBe(201);
  const { meeting } = await result.json(); owned.push(meeting.id);
  const text = "Prima di continuare, Riccardo, cosa volevi dire?";
  const segmentId = randomUUID();
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    status: "live", "assistant.wakeWord": "Riccardo", "bot.status": "joined", "bot.provider": "attendee", "bot.entryAttemptId": "attempt",
    pendingIntervention: { id: "hand", type: "correction", sourceStatement: "3 per 3 fa 12", response: "Fa 9", reason: "math", createdAt: new Date(), expiresAt: new Date(Date.now() + 90000) },
    transcript: [{ segmentId, entryAttemptId: "attempt", source: "participant", speakerName: "Elena", text, sequence: 1, createdAt: new Date() }],
  } });
  return { document: await MeetingModel.findById(meeting.id).orFail(), text, segmentId };
}

function harness() {
  const waiting: Array<(turn: SpeakingTurnDecision) => void> = [];
  const executed: unknown[] = [];
  const deps: Record<string, unknown> = {
    "node:crypto": { randomUUID }, "@/lib/meeting-transcript-source": source,
    "@/lib/meeting-command": commands, "@/models/Meeting": { MeetingModel },
    "@/lib/meeting-follow-up": followUp, "@/lib/meeting-participants": participants,
    "@/lib/consume-meeting-intervention": consume,
    "@/lib/diagnostic-redaction.mjs": redaction,
    "@/lib/meeting-intervention-queue": { enqueueMeetingIntervention: async () => { throw new Error("Unexpected proactive queue in named-turn test"); } },
    "@/lib/resolve-meeting-speaking-turn": { resolveMeetingSpeakingTurn: () => new Promise(resolve => { waiting.push(resolve); }) },
    "@/lib/execute-meeting-command": { executeMeetingCommand: async (...args: unknown[]) => { executed.push(args); return "fixture"; }, detectImportantIntervention: async () => undefined },
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/process-meeting-transcript.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} as { processMeetingTranscriptAutomation: (m: MeetingDocument, text: string, id: string) => Promise<unknown> } };
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, console,
    require: (name: string) => { if (!(name in deps)) throw new Error(`Unmocked boundary: ${name}`); return deps[name]; } });
  return { waiting, executed, run: testModule.exports.processMeetingTranscriptAutomation };
}

for (const change of ["departure", "attempt", "namesake", "newer_turn", "replaced_hand", "expired_hand", "late_echo"] as const) {
  test(`late semantic grant cannot act after ${change}`, async ({ request }) => {
    const f = await fixture(request); const h = harness();
    if (change === "late_echo") await MeetingModel.updateOne({ _id: f.document._id }, { $push: { commandHistory: {
      id: "earlier-output", kind: "ask", response: f.text, createdAt: new Date(Date.now() - 3000),
    } } });
    const result = h.run(f.document, f.text, f.segmentId);
    await expect.poll(() => h.waiting.length).toBe(1);
    const filter = { _id: f.document._id };
    if (change === "departure") await MeetingModel.updateOne(filter, { $set: { status: "completed", "bot.leftAt": new Date() } });
    if (change === "attempt") await MeetingModel.updateOne(filter, { $set: { "bot.entryAttemptId": "new-attempt" } });
    if (change === "namesake") await MeetingModel.updateOne(filter, { $set: { participantRoster: {
      attemptId: "attempt", entries: [{ participantId: "human", name: "Riccardo Bianchi", present: true, timestampMs: Date.now(), eventId: "event" }],
    } } });
    if (change === "newer_turn") await MeetingModel.updateOne(filter, { $push: { transcript: {
      segmentId: randomUUID(), entryAttemptId: "attempt", source: "participant", speakerName: "Elena", text: "Riccardo, non ora", sequence: 2, createdAt: new Date(),
    } } });
    if (change === "replaced_hand") await MeetingModel.updateOne(filter, { $set: { "pendingIntervention.id": "new-hand" } });
    if (change === "expired_hand") await MeetingModel.updateOne(filter, { $set: { "pendingIntervention.expiresAt": new Date(Date.now() - 1000) } });
    if (change === "late_echo") await MeetingModel.updateOne(filter, { $set: {
      "commandHistory.0.playbackStartedAt": new Date(Date.now() - 2000),
    } });
    h.waiting[0]({ action: "grant", reason: "named_grant", method: "semantic" });
    expect(await result).toBeUndefined();
    expect(h.executed).toHaveLength(0);
    expect((await MeetingModel.findById(f.document._id).orFail()).commandHistory).toHaveLength(change === "late_echo" ? 1 : 0);
  });
}

test("late semantic refusal cannot clear a replacement contribution", async ({ request }) => {
  const f = await fixture(request); const h = harness();
  const result = h.run(f.document, f.text, f.segmentId);
  await expect.poll(() => h.waiting.length).toBe(1);
  await MeetingModel.updateOne({ _id: f.document._id }, { $set: { "pendingIntervention.id": "new-hand" } });
  h.waiting[0]({ action: "decline", reason: "declined", method: "semantic" });
  await result;
  expect((await MeetingModel.findById(f.document._id).orFail()).pendingIntervention?.id).toBe("new-hand");
});

test("semantic grant consumes exactly the prepared response and cannot replay its caption", async ({ request }) => {
  const f = await fixture(request); const h = harness();
  const result = h.run(f.document, f.text, f.segmentId);
  await expect.poll(() => h.waiting.length).toBe(1);
  h.waiting[0]({ action: "grant", reason: "named_grant", method: "semantic" });
  expect(await result).toMatchObject({ response: "Fa 9", kind: "correct" });
  expect(await h.run(f.document, f.text, f.segmentId)).toBeUndefined();
  const saved = await MeetingModel.findById(f.document._id).orFail();
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.pendingIntervention).toBeUndefined();
  expect(saved.transcript[0].turnDecision?.method).toBe("semantic");
});

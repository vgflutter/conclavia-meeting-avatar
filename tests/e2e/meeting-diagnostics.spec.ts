import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel, type MeetingDocument } from "../../src/models/Meeting";
import { MeetingDiagnosticModel } from "../../src/models/MeetingDiagnostic";
import { parseAttendeeDiagnostic, storeAttendeeDiagnostic } from "../../src/lib/meeting-diagnostics";

const ids: string[] = [];
test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
  await MeetingDiagnosticModel.init();
});
test.afterEach(async () => {
  for (const id of ids.splice(0)) {
    await MeetingDiagnosticModel.deleteMany({ meetingId: id });
    await MeetingModel.deleteOne({ _id: id, title: /^E2E Diagnostics /u });
  }
});

async function fixture(request: APIRequestContext) {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Diagnostics ${randomUUID()}`, objective: "Diagnostic isolation",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/${randomUUID()}`,
    scheduledStart: new Date().toISOString(), durationMinutes: 30, timezone: "Europe/Rome",
    language: "it", autoJoin: false, correctionPolicy: "off", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const { meeting } = await response.json(); ids.push(meeting.id);
  const doc = (await MeetingModel.findById(meeting.id).exec())!;
  doc.status = "failed"; doc.bot.provider = "attendee"; doc.bot.status = "failed";
  doc.bot.entryAttemptId = randomUUID(); doc.bot.externalBotId = `bot_fixture${randomUUID().replaceAll("-", "")}`;
  doc.bot.leftAt = new Date(); doc.bot.failureCode = "join_timeout";
  await doc.save();
  return doc;
}
function event(meeting: MeetingDocument, overrides: Record<string, unknown> = {}) {
  return {
    idempotency_key: randomUUID(), bot_id: meeting.bot.externalBotId,
    bot_metadata: { conclavia_meeting_id: meeting.id, conclavia_attempt_id: meeting.bot.entryAttemptId },
    trigger: "bot_logs.update", data: { id: randomUUID(), level: "error", entry_type: "uncategorized",
      message: "TimeoutException finding join button https://teams.live.com/meet/123?p=private-passcode",
      created_at: new Date().toISOString() }, ...overrides,
  };
}
async function read(request: APIRequestContext, doc: MeetingDocument) {
  const response = await request.get(`/api/meetings/${doc.id}/diagnostics`);
  expect(response.ok()).toBe(true); expect(response.headers()["cache-control"]).toBe("no-store");
  return response.json();
}

test("diagnostics: authenticated late logs survive timeout without changing meeting or transcript", async ({request}) => {
  const doc = await fixture(request), before = await MeetingModel.findById(doc.id).lean();
  const response = await request.post(`/api/webhooks/attendee?meeting_token=${doc.bot.outputToken}`, { data: event(doc) });
  expect(response.status()).toBe(200);
  expect(await MeetingModel.findById(doc.id).lean()).toEqual(before);
  const diagnostic = await read(request, doc);
  expect(diagnostic.logs).toHaveLength(1);
  expect(diagnostic.logs[0].message).toContain("TimeoutException");
  expect(JSON.stringify(diagnostic)).not.toContain("private-passcode");
  expect(JSON.stringify(diagnostic)).not.toContain(doc.bot.outputToken);
  expect(diagnostic.logSubscription).toBe("not_confirmed_for_this_attempt");
  expect(Object.keys(diagnostic)).not.toContain("transcript");
});

test("diagnostics: wrong token, bot and attempt cannot store logs", async ({request}) => {
  const doc = await fixture(request), endpoint = `/api/webhooks/attendee?meeting_token=${doc.bot.outputToken}`;
  expect((await request.post("/api/webhooks/attendee?meeting_token=wrong", {data: event(doc)})).status()).toBe(401);
  for (const payload of [event(doc, {bot_id: "bot_foreign"}), event(doc, {bot_metadata: {conclavia_attempt_id: "foreign"}})]) {
    expect((await request.post(endpoint, {data: payload})).status()).toBe(200);
  }
  expect((await read(request, doc)).logs).toHaveLength(0);
});

test("diagnostics: concurrent duplicate deliveries are idempotent", async ({request}) => {
  const doc = await fixture(request), payload = event(doc);
  const responses = await Promise.all(Array.from({length: 6}, () => request.post(`/api/webhooks/attendee?meeting_token=${doc.bot.outputToken}`, {
    data: {...payload, idempotency_key: randomUUID()},
  })));
  expect(responses.every(response => response.status() === 200)).toBe(true);
  expect((await read(request, doc)).logs).toHaveLength(1);
});

test("diagnostics: creation-race logs do not bind bot or mark entry successful", async ({request}) => {
  const doc = await fixture(request), payload = event(doc);
  doc.bot.externalBotId = undefined; await doc.save();
  const before = await MeetingModel.findById(doc.id).lean();
  expect((await request.post(`/api/webhooks/attendee?meeting_token=${doc.bot.outputToken}`, {data: payload})).status()).toBe(200);
  expect(await MeetingModel.findById(doc.id).lean()).toEqual(before);
  expect(await MeetingDiagnosticModel.countDocuments({meetingId: doc._id})).toBe(1);
});

test("diagnostics: bounded retention, expired entries hidden, previous attempt not relabelled", async ({request}) => {
  const doc = await fixture(request);
  const scope = {meetingId: doc._id, attemptId: doc.bot.entryAttemptId!, botId: doc.bot.externalBotId!};
  for (let i = 0; i < 105; i++) await storeAttendeeDiagnostic(scope, parseAttendeeDiagnostic({
    id: `log-${i}`, message: `failure ${i}`, level: "warning", entry_type: "join_warning", created_at: new Date().toISOString(),
  })!);
  expect((await read(request, doc)).logs).toHaveLength(100);
  expect((await read(request, doc)).logs[0].message).toBe("failure 5");
  doc.bot.entryAttemptId = randomUUID(); await doc.save();
  expect((await read(request, doc)).logs).toHaveLength(0);
  doc.bot.entryAttemptId = scope.attemptId; await doc.save();
  await MeetingDiagnosticModel.updateOne({meetingId: doc._id}, {$set: {expiresAt: new Date(0)}});
  expect((await read(request, doc)).logs).toHaveLength(0);
  const indexes = await MeetingDiagnosticModel.collection.indexes();
  expect(indexes.some(index => index.expireAfterSeconds === 0 && index.key.expiresAt === 1)).toBe(true);
});

test("diagnostics: public and forwarded hosts denied; malformed logs never enter conversation", async ({request}) => {
  const doc = await fixture(request);
  for (const host of ["test.trycloudflare.com", "public.example.com", "localhost, public.example.com"]) {
    expect((await request.get(`/api/meetings/${doc.id}/diagnostics`, {headers: {"x-forwarded-host": host}})).status()).toBe(404);
  }
  const payload = event(doc); payload.data.created_at = "bad date";
  expect((await request.post(`/api/webhooks/attendee?meeting_token=${doc.bot.outputToken}`, {data: payload})).status()).toBe(400);
  expect((await read(request, doc)).logs).toHaveLength(0);
});

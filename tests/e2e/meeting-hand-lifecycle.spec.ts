import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import { installVoiceProbe, voiceProbeStats } from "./voice-probe";

const owned: string[] = [];
test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated database required");
  loadEnvConfig(process.cwd()); await connectToDatabase();
});
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Hand lifecycle /u });
});

async function fixture(request: APIRequestContext) {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Hand lifecycle ${randomUUID()}`, objective: "Verificare lo stato della mano",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/hand-lifecycle-fixture",
    scheduledStart: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "it", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const { meeting } = await response.json(); owned.push(meeting.id);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    status: "live", "bot.status": "joined", "bot.entryAttemptId": randomUUID(),
    pendingIntervention: { id: randomUUID(), type: "correction", sourceStatement: "3 per 3 fa 12", reason: "math",
      response: "Fa nove.", createdAt: new Date(), expiresAt: new Date(Date.now() + 90000) },
  } });
  return MeetingModel.findById(meeting.id).orFail();
}

for (const change of ["completed", "processing", "failed", "cancelled", "stop_requested", "left", "disabled", "expired"] as const) {
  test(`a pending hand disappears from management and renderer after ${change}`, async ({ request }) => {
    const m = await fixture(request);
    const stateUrl = `/api/meeting-room/${m.bot.outputToken}/state`;
    expect((await (await request.get(stateUrl)).json()).pendingIntervention?.id).toBe(m.pendingIntervention!.id);
    const fields = change === "stop_requested" ? { "bot.stopRequestedAt": new Date() }
      : change === "left" ? { "bot.leftAt": new Date() }
      : change === "disabled" ? { "assistant.correctionPolicy": "off" }
      : change === "expired" ? { "pendingIntervention.expiresAt": new Date(Date.now() - 1) }
      : { status: change };
    await MeetingModel.updateOne({ _id: m._id }, { $set: fields });
    expect((await (await request.get(`/api/meetings/${m.id}`)).json()).meeting.pendingIntervention).toBeUndefined();
    expect((await (await request.get(stateUrl)).json()).pendingIntervention).toBeUndefined();
    // Presentation must not erase evidence or synthesize a command.
    const saved = await MeetingModel.findById(m.id).orFail();
    expect(saved.pendingIntervention?.id).toBe(m.pendingIntervention!.id);
    expect(saved.commandHistory).toHaveLength(0);
  });
}

test("mounted avatar lowers its hand on terminal state, including after page reload", async ({ page, request }) => {
  await installVoiceProbe(page);
  const m = await fixture(request);
  const output = `/meeting-room/${m.bot.outputToken}?mode=meeting&attempt=${m.bot.entryAttemptId}`;
  await page.goto(output);
  await expect(page.locator("svg[data-gesture='hand_raise']")).toBeVisible();
  await MeetingModel.updateOne({ _id: m._id }, { $set: { status: "completed", "bot.leftAt": new Date() } });
  await expect(page.locator("svg[data-gesture='rest']")).toBeVisible();
  await expect(page.locator("[data-speaking='false']")).toBeVisible();
  await page.reload();
  await expect(page.locator("svg[data-gesture='rest']")).toBeVisible();
  expect((await voiceProbeStats(page)).playbacks).toHaveLength(0);
});

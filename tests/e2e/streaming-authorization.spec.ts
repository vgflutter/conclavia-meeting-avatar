import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import { verifyMeetingOutput, MeetingOutputUnavailableError } from "../../src/lib/meeting-output-health";

test("streaming autorizzazione: solo comando e tentativo attivi; stop e completamento revocano l'accesso", async ({ request }) => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
  const title = `E2E Streaming ${randomUUID()}`;
  const response = await request.post("/api/meetings", { data: {
    title, objective: "Voice authorization fixture", meetingUrl: `https://teams.microsoft.com/l/meetup-join/${randomUUID()}`,
    scheduledStart: "2030-01-01T10:00:00Z", durationMinutes: 30, timezone: "Europe/Rome",
    language: "it", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const id = (await response.json()).meeting.id;
  try {
    const meeting = (await MeetingModel.findById(id))!;
    meeting.status = "live";
    meeting.bot.status = "joined";
    meeting.bot.entryAttemptId = randomUUID();
    const commandId = randomUUID();
    meeting.commandHistory.push({ id: commandId, kind: "ask", response: "Ciao!", createdAt: new Date() });
    await meeting.save();
    const endpoint = `/api/meeting-room/${meeting.bot.outputToken}/speech`;
    const data = { attemptId: meeting.bot.entryAttemptId, commandId, chunk: 0 };
    // A valid capability passes authorization, then stops because paid TTS is disabled in E2E.
    expect((await request.post(endpoint, { data })).status()).toBe(503);
    expect((await request.post(endpoint, { data: { ...data, commandId: randomUUID() } })).status()).toBe(404);
    expect((await request.post(endpoint, { data: { ...data, attemptId: randomUUID() } })).status()).toBe(404);
    expect((await request.post(endpoint, { data: { ...data, text: "Unauthorized text" } })).status()).toBe(400);
    expect((await request.post(endpoint, { data: { ...data, chunk: 1 } })).status()).toBe(400);
    await MeetingModel.updateOne({ _id: id }, { $set: { "bot.stopRequestedAt": new Date() } });
    expect((await request.post(endpoint, { data })).status()).toBe(404);
    await MeetingModel.updateOne({ _id: id }, { $unset: { "bot.stopRequestedAt": 1 }, $set: {
      "bot.outputSpeechCommandId": commandId, "bot.outputSpeechState": "completed",
    } });
    expect((await request.post(endpoint, { data })).status()).toBe(404);
  } finally {
    await MeetingModel.deleteOne({ _id: id, title });
  }
});

test("streaming preflight: configurazione vocale incompleta blocca il tentativo", async () => {
  await expect(verifyMeetingOutput("https://avatar.example/meeting-room/11111111-1111-4111-8111-111111111111", async (url) => {
    if (String(url).endsWith("/state")) return Response.json({ status: "joining", voice: { provider: "inworld", ready: false } });
    return new Response('<main data-output-runtime="conclavia-v1"></main><script src="/_next/runtime.js"></script>', { headers: { "Content-Type": "text/html" } });
  })).rejects.toBeInstanceOf(MeetingOutputUnavailableError);
});

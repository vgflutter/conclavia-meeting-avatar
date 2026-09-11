import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { deleteModel, model, Schema } from "mongoose";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel, registerMeetingModel, type MeetingDocument } from "../../src/models/Meeting";
import { hasMeetingLifecycleSchema, MEETING_LIFECYCLE_PATHS } from "../../src/lib/meeting-model-schema";
import { startAttendeeEntry, requestAttendeeExit, MeetingEntryConflictError } from "../../src/lib/meeting-entry";
import { checkMeetingEntries, reconcileMeetingEntry } from "../../src/lib/meeting-entry-monitor";
import { persistAttendeeState } from "../../src/lib/persist-attendee-state";
import { applyAttendeeState, type AttendeeState } from "../../src/lib/attendee-state";
import { meetingEntryDeadline } from "../../src/lib/meeting-entry-policy";
import { MeetingBotProviderError, type MeetingBotAdapter, type MeetingBotSession } from "../../src/lib/meeting-bot-adapter";
import type { MeetingResponse } from "../../src/types/meeting";
import { MeetingOutputUnavailableError } from "../../src/lib/meeting-output-health";

const ownedIds: string[] = [];
const origin = new Date("2030-01-01T10:00:00Z");
const later = (seconds: number) => new Date(origin.getTime() + seconds * 1000);

class FakeAttendee implements MeetingBotAdapter {
  readonly provider = "attendee" as const;
  readonly live = true;
  joins = 0;
  leaves = 0;
  error?: Error;
  leaveError?: Error;
  statusError?: Error;
  captionError?: Error;
  captionCalls: Array<{ id: string; language: string }> = [];
  onCaption?: () => Promise<void>;
  onJoin?: (meeting: MeetingResponse) => Promise<void>;
  current: AttendeeState = { state: "joining", occurredAt: origin };
  lastId = `fake-${randomUUID()}`;
  async join(meeting: MeetingResponse): Promise<MeetingBotSession> {
    this.joins++;
    if (this.onJoin) await this.onJoin(meeting);
    if (this.error) throw this.error;
    return { provider: "attendee", externalBotId: this.lastId, outputUrl: "https://example.invalid/output" };
  }
  async schedule(meeting: MeetingResponse) { return this.join(meeting); }
  async cancel() {}
  async leave() {
    this.leaves++;
    if (this.leaveError) throw this.leaveError;
    return { leftAt: later(121) }; // Acknowledgement, NOT confirmed exit.
  }
  async getStatus() { if (this.statusError) throw this.statusError; return this.current; }
  async setCaptionLanguage(id: string, language: "it-it" | "en-us") {
    this.captionCalls.push({ id, language });
    await this.onCaption?.();
    if (this.captionError) throw this.captionError;
  }
  async findAttempt() { return { externalBotId: this.lastId, state: this.current }; }
}

test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated test database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});

test.afterEach(async () => {
  // Exact fixture IDs only. No provider calls or user records.
  for (const id of ownedIds.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Entry /u });
});

async function create(request: APIRequestContext, room = randomUUID()): Promise<MeetingDocument> {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Entry ${randomUUID()}`, objective: "Verify safe entry lifecycle",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/${room}`,
    scheduledStart: origin.toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "auto", autoJoin: false,
    correctionPolicy: "important_only", agenda: [],
  }});
  expect(response.status()).toBe(201);
  const id = (await response.json()).meeting.id;
  ownedIds.push(id);
  const meeting = await MeetingModel.findById(id).exec();
  expect(meeting).not.toBeNull();
  return meeting!;
}

async function reload(meeting: MeetingDocument) { return (await MeetingModel.findById(meeting._id).exec())!; }

async function italianEntry(request: APIRequestContext, adapter: FakeAttendee) {
  const meeting = await create(request);
  meeting.language = "it";
  await meeting.save();
  return startAttendeeEntry(meeting, { adapter, now: origin });
}

test("lingua: aspetta l’ascolto confermato e invia una sola richiesta anche con monitor concorrenti", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  expect(meeting.bot.captionLanguage).toBe("it-it");
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(10) });
  adapter.current = { state: "joined_not_recording", occurredAt: later(15) };
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(20) });
  expect(adapter.captionCalls).toHaveLength(0);
  adapter.current = { state: "joined_recording", occurredAt: later(25) };
  await Promise.all([30, 30].map(seconds => reconcileMeetingEntry(meeting.id, {adapter, now: later(seconds)})));
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(45) });
  expect(adapter.captionCalls).toEqual([{ id: adapter.lastId, language: "it-it" }]);
  expect((await reload(meeting)).bot.captionLanguageRequestedAt).toEqual(later(30));
});

test("lingua: errore transitorio riprovato senza uscita o nuovo bot", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  adapter.current = { state: "joined_recording", occurredAt: later(5) };
  adapter.captionError = new Error("Temporary provider outage");
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(10) });
  expect((await reload(meeting)).bot.captionLanguageRequestedAt).toBeUndefined();
  adapter.captionError = undefined;
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(25) });
  expect((await reload(meeting)).bot.captionLanguageRequestedAt).toEqual(later(25));
  expect(adapter.captionCalls).toHaveLength(2);
  expect(adapter.joins).toBe(1);
  expect(adapter.leaves).toBe(0);
});

test("lingua: tre tentativi al massimo e avviso visibile, senza falsi successi", async ({request, page}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  adapter.current = { state: "joined_recording", occurredAt: later(5) };
  adapter.captionError = new Error("Rejected");
  for (const seconds of [10, 25, 40, 55]) await reconcileMeetingEntry(meeting.id, { adapter, now: later(seconds) });
  const current = await reload(meeting);
  expect(adapter.captionCalls).toHaveLength(3);
  expect(current.bot.captionLanguageAttempts).toBe(3);
  expect(current.bot.captionLanguageRequestedAt).toBeUndefined();
  expect(current.status).toBe("live");
  expect(adapter.leaves).toBe(0);
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByTestId("caption-language-status")).toContainText(/lingua dei sottotitoli|caption language/iu);
});

test("lingua: auto e sessioni precedenti non vengono riconfigurate", async ({request}) => {
  const adapter = new FakeAttendee();
  const automatic = await startAttendeeEntry(await create(request), { adapter, now: origin });
  const legacy = await italianEntry(request, adapter);
  await MeetingModel.updateOne({_id: legacy._id}, {$unset: {"bot.captionLanguage": 1, "bot.captionLanguageAttempts": 1}});
  adapter.current = { state: "joined_recording", occurredAt: later(5) };
  for (const entry of [automatic, legacy]) await reconcileMeetingEntry(entry.id, { adapter, now: later(10) });
  expect(adapter.captionCalls).toHaveLength(0);
});

test("lingua: nessuna richiesta dopo stop o se il provider non è verificabile", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  adapter.current = { state: "joined_recording", occurredAt: later(5) };
  adapter.statusError = new Error("Unavailable");
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(10) });
  adapter.statusError = undefined;
  await requestAttendeeExit(await reload(meeting), { adapter, now: later(12) });
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(25) });
  expect(adapter.captionCalls).toHaveLength(0);
});

test("lingua: una risposta tardiva non aggiorna un tentativo sostituito", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  adapter.current = { state: "joined_recording", occurredAt: later(5) };
  adapter.onCaption = async () => {
    await MeetingModel.updateOne({_id: meeting._id}, {$set: {"bot.entryAttemptId": randomUUID()}});
  };
  await reconcileMeetingEntry(meeting.id, { adapter, now: later(10) });
  expect(adapter.captionCalls).toHaveLength(1);
  expect((await reload(meeting)).bot.captionLanguageRequestedAt).toBeUndefined();
});

test("lingua: un nuovo ingresso azzera il precedente esito e riparte dalla lingua selezionata", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await italianEntry(request, adapter);
  await MeetingModel.updateOne({_id: meeting._id}, {$set: {
    status: "failed", "bot.status": "failed", "bot.leftAt": later(20), "bot.providerStatusCode": "ended",
    "bot.captionLanguageAttempts": 3, "bot.captionLanguageRequestedAt": later(10), language: "en",
  }});
  const restarted = await startAttendeeEntry(await reload(meeting), {adapter, now: later(30)});
  expect(restarted.bot.captionLanguage).toBe("en-us");
  expect(restarted.bot.captionLanguageAttempts).toBe(0);
  expect(restarted.bot.captionLanguageRequestedAt).toBeUndefined();
});

test("archiviazione concorrente: una richiesta con documento vecchio non crea un bot", async ({request}) => {
  const stale = await create(request);
  const adapter = new FakeAttendee();
  await MeetingModel.updateOne({_id: stale._id}, {$set: {archivedAt: new Date()}});
  expect(stale.archivedAt).toBeUndefined();
  await expect(startAttendeeEntry(stale, {adapter})).rejects.toBeInstanceOf(MeetingEntryConflictError);
  expect(adapter.joins).toBe(0);
  expect((await reload(stale)).archivedAt).toBeDefined();
});

test("saluto via webhook: Ricardo risponde, non duplica la consegna e non risponde alla propria voce", async ({request}) => {
  let meeting = await create(request);
  meeting.assistant.wakeWord = "Riccardo";
  meeting.language = "it";
  await meeting.save();
  meeting = await startAttendeeEntry(meeting, {adapter: new FakeAttendee()});
  await persistAttendeeState(meeting, {state: "joined_recording", occurredAt: new Date()});
  const endpoint = `/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`;
  const payload = (text: string, speaker = "Partecipante test") => ({
    idempotency_key: randomUUID(), bot_id: meeting.bot.externalBotId,
    trigger: "transcript.update", data: {
      speaker_name: speaker, timestamp_ms: Date.now(), duration_ms: 1000,
      transcription: {transcript: text, words: []},
    },
  });
  const greeting = payload("Chao Chao, Ricardo.");
  expect((await request.post(endpoint, {data: greeting})).ok()).toBeTruthy();
  await expect.poll(async () => (await reload(meeting)).commandHistory.at(-1)?.response).toBe("Ciao! Sono qui, dimmi pure.");
  expect((await request.post(endpoint, {data: greeting})).ok()).toBeTruthy();
  expect((await request.post(endpoint, {data: payload("Ciao Riccardo, mi senti?", "Riccardo (Guest)")})).ok()).toBeTruthy();
  await expect.poll(async () => (await reload(meeting)).transcript.length).toBe(2);
  expect((await reload(meeting)).commandHistory).toHaveLength(1);

  expect((await request.post(endpoint, {data: payload("Riccardo")})).ok()).toBeTruthy();
  await expect.poll(async () => (await reload(meeting)).transcript.length).toBe(3);
  expect((await request.post(endpoint, {data: payload("Mi senti?")})).ok()).toBeTruthy();
  await expect.poll(async () => (await reload(meeting)).commandHistory.length).toBe(2);
  expect((await reload(meeting)).commandHistory.at(-1)?.response).toMatch(/^Sì,/);
});

test("avatar: la perdita dei webhook non lascia un bot terminato indicato come live", async ({request}) => {
  const adapter = new FakeAttendee();
  const meeting = await startAttendeeEntry(await create(request), {adapter});
  await persistAttendeeState(meeting, {state: "joined_recording", occurredAt: new Date(Date.now() - 1000)});
  expect((await reload(meeting)).bot.joinDeadlineAt).toBeUndefined();
  adapter.current = {state: "ended", occurredAt: new Date()};
  await checkMeetingEntries({adapter});
  const updated = await reload(meeting);
  expect(updated.bot.leftAt).toBeDefined();
  expect(updated.status).not.toBe("live");
});

test("avatar: preflight fallito non lascia un bot incerto o un blocco sul rientro", async ({request}) => {
  const adapter = new FakeAttendee();
  adapter.error = new MeetingOutputUnavailableError();
  const meeting = await startAttendeeEntry(await create(request), {adapter});
  expect(meeting.bot.failureCode).toBe("output_unavailable");
  expect(meeting.bot.externalBotId).toBeUndefined();
  expect(meeting.bot.activeRoomKey).toBeUndefined();
  expect(meeting.bot.joinDeadlineAt).toBeUndefined();
  adapter.error = undefined;
  const retried = await startAttendeeEntry(meeting, {adapter});
  expect(retried.bot.externalBotId).toBe(adapter.lastId);
});

for (const code of ["SELF_SIGNED_CERT_IN_CHAIN", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED"]) {
  test(`ingresso: ${code} non crea un blocco incerto e consente riprova`, async ({request}) => {
    const adapter = new FakeAttendee();
    adapter.error = new TypeError("fetch failed", {cause: {code}});
    const failed = await startAttendeeEntry(await create(request), {adapter});
    expect(failed.status).toBe("failed");
    expect(failed.bot.failureCode).toBe("provider_tls_error");
    expect(failed.bot.externalBotId).toBeUndefined();
    expect(failed.bot.activeRoomKey).toBeUndefined();
    expect(failed.bot.joinDeadlineAt).toBeUndefined();
    adapter.error = undefined;
    expect((await startAttendeeEntry(failed, {adapter})).bot.externalBotId).toBe(adapter.lastId);
  });
}

test("ingresso: un reset dopo l'invio resta incerto e non consente duplicati", async ({request}) => {
  const adapter = new FakeAttendee();
  adapter.error = new TypeError("fetch failed", {cause: {code: "ECONNRESET"}});
  const failed = await startAttendeeEntry(await create(request), {adapter});
  expect(failed.bot.failureCode).toBe("create_uncertain");
  expect(failed.bot.activeRoomKey).toBeDefined();
  await expect(startAttendeeEntry(failed, {adapter})).rejects.toBeInstanceOf(MeetingEntryConflictError);
  expect(adapter.joins).toBe(1);
});

test("avatar: conferme del tentativo corrente, voce pronta e perdita di collegamento nella GUI", async ({request, page}) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), {adapter});
  await persistAttendeeState(meeting, {state: "joined_recording", occurredAt: new Date()});
  meeting = await reload(meeting);
  const stateUrl = `/api/meeting-room/${meeting.bot.outputToken}/state`;
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByTestId("output-readiness")).toHaveAttribute("data-readiness", "missing");
  expect((await request.post(stateUrl, {data: {attemptId: randomUUID(), voiceReady: true}})).status()).toBe(404);
  expect((await request.post(stateUrl, {data: {attemptId: meeting.bot.entryAttemptId, voiceReady: "true"}})).status()).toBe(400);
  expect((await request.post(stateUrl, {data: {attemptId: meeting.bot.entryAttemptId, voiceReady: false}})).status()).toBe(204);
  await page.reload();
  await expect(page.getByTestId("output-readiness")).toHaveAttribute("data-readiness", "preparing");
  expect((await request.post(stateUrl, {data: {attemptId: meeting.bot.entryAttemptId, voiceReady: true}})).status()).toBe(204);
  await page.reload();
  await expect(page.getByTestId("output-readiness")).toHaveAttribute("data-readiness", "ready");
  await MeetingModel.updateOne({_id: meeting._id}, {$set: {"bot.outputLastSeenAt": new Date(Date.now() - 25_000)}});
  await page.reload();
  await expect(page.getByTestId("output-readiness")).toHaveAttribute("data-readiness", "missing");
  await requestAttendeeExit(await reload(meeting), {adapter});
  expect((await request.post(stateUrl, {data: {attemptId: meeting.bot.entryAttemptId, voiceReady: true}})).status()).toBe(404);
});

test("audio: conferma solo comandi esistenti del tentativo attivo e non retrocede dopo completamento", async ({request}) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), {adapter});
  await persistAttendeeState(meeting, {state: "joined_recording", occurredAt: new Date()});
  meeting = await reload(meeting);
  const answer = await request.post(`/api/meetings/${meeting.id}/commands`, {data: {kind: "ask", prompt: "Ciao"}});
  expect(answer.ok()).toBeTruthy();
  const {meeting: response, response: text} = await answer.json();
  expect(text).toBe("Ciao! Sono qui, dimmi pure.");
  const commandId = response.commandHistory.at(-1).id;
  const url = `/api/meeting-room/${meeting.bot.outputToken}/state`;
  const report = (state: string, id = commandId, attemptId = meeting.bot.entryAttemptId) => request.post(url, {data: {
    attemptId, voiceReady: true, playback: {commandId: id, state},
  }});
  expect((await report("completed", randomUUID())).status()).toBe(404);
  expect((await report("completed", commandId, randomUUID())).status()).toBe(404);
  expect((await report("invented")).status()).toBe(400);
  expect((await report("speaking")).status()).toBe(204);
  expect((await reload(meeting)).bot.outputSpeechState).toBe("speaking");
  expect((await (await request.get(`/api/meetings/${meeting.id}/debug`)).json()).playback?.state).toBe("speaking");
  await MeetingModel.updateOne({_id: meeting._id}, {$set: {"bot.outputLastSeenAt": new Date(Date.now() - 25_000)}});
  expect((await (await request.get(`/api/meetings/${meeting.id}/debug`)).json()).playback).toBeUndefined();
  expect((await report("completed")).status()).toBe(204);
  const completed = await reload(meeting);
  expect(completed.bot.outputSpeechState).toBe("completed");
  expect(completed.commandHistory.at(-1)?.playbackStartedAt).toBeInstanceOf(Date);
  expect(completed.commandHistory.at(-1)?.playbackEndedAt).toBeInstanceOf(Date);
  expect((await report("completed")).status()).toBe(204);
  expect((await report("speaking")).status()).toBe(204);
  const repeated = await reload(meeting);
  expect(repeated.bot.outputSpeechState).toBe("completed");
  expect(repeated.bot.outputSpeechUpdatedAt).toEqual(completed.bot.outputSpeechUpdatedAt);
  expect(repeated.commandHistory.at(-1)?.playbackStartedAt).toEqual(completed.commandHistory.at(-1)?.playbackStartedAt);
  expect(repeated.commandHistory.at(-1)?.playbackEndedAt).toEqual(completed.commandHistory.at(-1)?.playbackEndedAt);
  const debug = await (await request.get(`/api/meetings/${meeting.id}/debug`)).json();
  expect(debug.playback).toMatchObject({commandId, state: "completed"});
  expect(JSON.stringify(debug)).not.toContain(meeting.bot.outputToken);
  await requestAttendeeExit(repeated, {adapter});
  expect((await report("completed")).status()).toBe(404);
});

test("avatar: anteprima non conferma il bot; il renderer segnala caricamento e disconnessione", async ({request, page}) => {
  const meeting = await startAttendeeEntry(await create(request), {adapter: new FakeAttendee()});
  await page.goto(`/meeting-room/${meeting.bot.outputToken}`);
  await expect(page.locator('[data-output-runtime="conclavia-v1"]')).toBeVisible();
  expect((await reload(meeting)).bot.outputLastSeenAt).toBeUndefined();
  await page.goto(`/meeting-room/${meeting.bot.outputToken}?mode=meeting&attempt=${meeting.bot.entryAttemptId}`);
  await expect.poll(async () => Boolean((await reload(meeting)).bot.outputLastSeenAt)).toBe(true);
  await page.route(`**/api/meeting-room/${meeting.bot.outputToken}/state**`, route => route.abort());
  await expect(page.getByTestId("meeting-status-badge")).toContainText(/COLLEGAMENTO|CONNECTING/, {timeout: 12_000});
  await expect(page.locator('[data-output-runtime="conclavia-v1"]')).toHaveAttribute("data-live", "false");
});

test("ingresso: timeout persistente senza GUI e nuovo tentativo solo dopo uscita reale", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  expect(meeting.bot.joinDeadlineAt).toEqual(later(120));
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  meeting = await reload(meeting);
  expect(meeting.status).toBe("failed");
  expect(meeting.bot.failureCode).toBe("join_timeout");
  expect(meeting.bot.status).toBe("leaving");
  expect(meeting.bot.leftAt).toBeUndefined();
  expect(meeting.summary.generatedAt).toBeUndefined();
  expect(adapter.leaves).toBe(1);
  await expect(startAttendeeEntry(meeting, { adapter })).rejects.toBeInstanceOf(MeetingEntryConflictError);
  adapter.current = { state: "post_processing", occurredAt: later(123) };
  await reconcileMeetingEntry(meeting.id, { now: later(132), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.leftAt).toEqual(later(123));
  await expect(startAttendeeEntry(meeting, { adapter })).rejects.toBeInstanceOf(MeetingEntryConflictError);
  adapter.current = { state: "ended", occurredAt: later(125) };
  await reconcileMeetingEntry(meeting.id, { now: later(143), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.leftAt).toEqual(later(123));
  expect(meeting.bot.activeRoomKey).toBeUndefined();
  expect(meeting.status).toBe("failed");
  const previousAttempt = meeting.bot.entryAttemptId;
  const retry = await startAttendeeEntry(meeting, { now: later(140), adapter });
  expect(retry.bot.entryAttemptId).not.toBe(previousAttempt);
  expect(retry.bot.providerStatusCode).toBeUndefined();
  expect(adapter.joins).toBe(2);
});

test("rientro: una risposta incerta non conserva stato e URL del vecchio bot", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter, scheduled: true });
  await persistAttendeeState(meeting, { state: "ended", occurredAt: later(10) });
  meeting = await reload(meeting);
  expect(meeting.bot.outputUrl).toBeDefined();
  expect(meeting.bot.scheduledFor).toBeDefined();
  adapter.error = new Error("Creation response lost");
  const retry = await startAttendeeEntry(meeting, { now: later(20), adapter });
  expect(retry.bot.failureCode).toBe("create_uncertain");
  expect(retry.bot.providerStatusCode).toBeUndefined();
  expect(retry.bot.outputUrl).toBeUndefined();
  expect(retry.bot.scheduledFor).toBeUndefined();
  expect(retry.bot.leftAt).toBeUndefined();
});

test("ingresso: presenza senza ascolto non significa operativo", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.current = { state: "joined_not_recording", occurredAt: later(10) };
  await reconcileMeetingEntry(meeting.id, { now: later(11), adapter });
  meeting = await reload(meeting);
  expect(meeting.status).toBe("joining");
  expect(meeting.bot.readyAt).toBeUndefined();
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  expect((await reload(meeting)).bot.failureCode).toBe("media_not_ready");
  expect(adapter.leaves).toBe(1);
});

test("ingresso: la conferma di ascolto annulla il timeout", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.current = { state: "joined_recording", occurredAt: later(10) };
  await reconcileMeetingEntry(meeting.id, { now: later(11), adapter });
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  meeting = await reload(meeting);
  expect(meeting.status).toBe("live");
  expect(meeting.bot.readyAt).toEqual(later(10));
  expect(meeting.bot.joinDeadlineAt).toBeUndefined();
  expect(adapter.leaves).toBe(0);
});

test("ingresso: ammissione vicina alla scadenza concede un avvio limitato, senza rinnovi dai poll", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.current = { state: "joined_not_recording", occurredAt: later(115) };
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.joinedAt).toEqual(later(115));
  expect(meeting.bot.joinDeadlineAt).toEqual(later(175));
  expect(meeting.bot.readyAt).toBeUndefined();
  expect(meeting.bot.stopRequestedAt).toBeUndefined();
  expect(adapter.leaves).toBe(0);
  // Repeated provider polls, including a newer occurrence, must not renew the grace.
  await reconcileMeetingEntry(meeting.id, { now: later(132), adapter });
  adapter.current = { state: "joined_not_recording", occurredAt: later(140) };
  await reconcileMeetingEntry(meeting.id, { now: later(151), adapter });
  expect((await reload(meeting)).bot.joinDeadlineAt).toEqual(later(175));
  expect(adapter.leaves).toBe(0);
  await reconcileMeetingEntry(meeting.id, { now: later(176), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.failureCode).toBe("media_not_ready");
  expect(meeting.bot.leftAt).toBeUndefined();
  expect(adapter.leaves).toBe(1);
});

test("ingresso: ascolto confermato nella finestra dopo ammissione evita l’uscita", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.current = { state: "joined_not_recording", occurredAt: later(115) };
  await reconcileMeetingEntry(meeting.id, { now: later(116), adapter });
  await reconcileMeetingEntry(meeting.id, { now: later(127), adapter });
  adapter.current = { state: "joined_recording", occurredAt: later(170) };
  await reconcileMeetingEntry(meeting.id, { now: later(171), adapter });
  await reconcileMeetingEntry(meeting.id, { now: later(182), adapter });
  meeting = await reload(meeting);
  expect(meeting.status).toBe("live");
  expect(meeting.bot.readyAt).toEqual(later(170));
  expect(meeting.bot.joinDeadlineAt).toBeUndefined();
  expect(meeting.bot.stopRequestedAt).toBeUndefined();
  expect(adapter.leaves).toBe(0);
});

test("ingresso: due richieste contemporanee creano un solo bot", async ({ request }) => {
  const adapter = new FakeAttendee();
  const meeting = await create(request);
  const results = await Promise.allSettled([
    startAttendeeEntry(meeting, { now: origin, adapter }),
    startAttendeeEntry(await reload(meeting), { now: origin, adapter }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(adapter.joins).toBe(1);
  const stale = await create(request);
  await MeetingModel.updateOne({ _id: stale._id }, { $set: { status: "completed" } });
  await expect(startAttendeeEntry(stale, { now: origin, adapter })).rejects.toBeInstanceOf(MeetingEntryConflictError);
  expect(adapter.joins).toBe(1);
});

test("ingresso: appuntamenti duplicati con query diverse non creano due partecipanti", async ({ request }) => {
  const adapter = new FakeAttendee();
  const room = randomUUID();
  const first = await create(request, room);
  const second = await create(request, room);
  second.meetingUrl += "?navigation=other";
  await second.save();
  const results = await Promise.allSettled([
    startAttendeeEntry(first, { now: origin, adapter }),
    startAttendeeEntry(second, { now: origin, adapter }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(adapter.joins).toBe(1);
});

test("ingresso: recupera la risposta persa senza ripetere la creazione", async ({ request }) => {
  const adapter = new FakeAttendee();
  adapter.error = new Error("Response lost after provider acceptance");
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  expect(meeting.bot.failureCode).toBe("create_uncertain");
  await expect(startAttendeeEntry(meeting, { adapter })).rejects.toBeInstanceOf(MeetingEntryConflictError);
  await reconcileMeetingEntry(meeting.id, { now: later(10), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.externalBotId).toBe(adapter.lastId);
  expect(adapter.joins).toBe(1);
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  expect(adapter.leaves).toBe(1);
});

test("ingresso: un rifiuto certo libera il tentativo", async ({ request }) => {
  const adapter = new FakeAttendee();
  adapter.error = new MeetingBotProviderError("Invalid meeting", 400);
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  expect(meeting.bot.status).toBe("failed");
  expect(meeting.bot.activeRoomKey).toBeUndefined();
  expect(meeting.bot.joinDeadlineAt).toBeUndefined();
  expect((await request.delete(`/api/meetings/${meeting.id}`)).status()).toBe(200);
});

test("uscita: dopo un errore riprova solo l’uscita, con controllo concorrente", async ({ request }) => {
  const adapter = new FakeAttendee();
  adapter.leaveError = new Error("Provider unavailable");
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  adapter.leaveError = undefined;
  await Promise.all([
    reconcileMeetingEntry(meeting.id, { now: later(132), adapter }),
    reconcileMeetingEntry(meeting.id, { now: later(132), adapter }),
  ]);
  expect(adapter.joins).toBe(1);
  expect(adapter.leaves).toBe(2);
  expect((await reload(meeting)).bot.leftAt).toBeUndefined();
});

test("uscita: una lettura precedente allo stop non può sovrascriverlo", async ({ request }) => {
  const adapter = new FakeAttendee();
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  const stale = await reload(meeting);
  await requestAttendeeExit(meeting, { adapter, now: later(10) });
  expect(await persistAttendeeState(stale, { state: "joined_recording", occurredAt: later(11) })).toBe(false);
  expect((await reload(meeting)).bot.status).toBe("leaving");
});

test("webhook: ignora vecchi tentativi e non riattiva un ingresso interrotto", async ({ request }) => {
  const adapter = new FakeAttendee();
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  async function event(state: string, seconds: number, attempt = meeting.bot.entryAttemptId) {
    return request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
      bot_id: adapter.lastId, bot_metadata: { conclavia_meeting_id: meeting.id, conclavia_attempt_id: attempt },
      idempotency_key: randomUUID(), trigger: "bot.state_change",
      data: { new_state: state, created_at: later(seconds).toISOString() },
    }});
  }
  expect((await event("joined_recording", 5, "old-attempt")).ok()).toBeTruthy();
  expect((await reload(meeting)).status).toBe("joining");
  await requestAttendeeExit(meeting, { adapter, now: later(10) });
  expect((await event("joined_recording", 11)).ok()).toBeTruthy();
  expect((await event("leaving", 12)).ok()).toBeTruthy();
  meeting = await reload(meeting);
  expect(meeting.bot.status).toBe("leaving");
  expect(meeting.bot.leftAt).toBeUndefined();
  expect((await request.delete(`/api/meetings/${meeting.id}`)).status()).toBe(409);
  expect((await request.post(`/api/meetings/${meeting.id}/outcome`, { data: {
    overview: "Not actually ended", decisions: [], rememberedFacts: [], actionItems: [], openQuestions: [],
  }})).status()).toBe(409);
  expect((await event("ended", 13)).ok()).toBeTruthy();
  expect((await event("joining", 14)).ok()).toBeTruthy();
  meeting = await reload(meeting);
  expect(meeting.status).toBe("failed");
  expect(meeting.bot.leftAt).toEqual(later(13));
});

test("webhook: conserva una conferma arrivata prima della risposta di creazione", async ({ request }) => {
  const adapter = new FakeAttendee();
  adapter.onJoin = async (meeting) => {
    const response = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
      bot_id: adapter.lastId, bot_metadata: { conclavia_meeting_id: meeting.id, conclavia_attempt_id: meeting.bot.entryAttemptId },
      idempotency_key: randomUUID(), trigger: "bot.state_change",
      data: { new_state: "joined_recording", created_at: later(5).toISOString() },
    }});
    expect(response.ok()).toBeTruthy();
  };
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  expect(meeting.status).toBe("live");
  expect(meeting.bot.status).toBe("joined");
});

test("video: sfondo senza cerchio, nome e stato visibili su desktop e mobile", async ({ request, page }, testInfo) => {
  const meeting = await create(request);
  await page.goto(`/meeting-room/${meeting.bot.outputToken}`);
  const surface = page.locator('[data-output-runtime="conclavia-v1"]');
  for (const viewport of [{ width: 1440, height: 810 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(surface.locator("svg[data-viseme]")).toBeVisible();
    await expect(page.getByTestId("meeting-identity")).toContainText(meeting.assistant.wakeWord);
    await expect(page.getByTestId("meeting-status-badge")).toBeVisible();
    const circles = await surface.evaluate((element) => Array.from(element.children).filter((child) => {
      const style = getComputedStyle(child);
      return style.borderRadius === "50%" && child.getBoundingClientRect().width > 100;
    }).length);
    expect(circles).toBe(0);
    await surface.screenshot({ path: testInfo.outputPath(`avatar-no-circle-${viewport.width}.png`) });
  }
});

test("video: non mostra operativo durante l’ingresso o dopo un errore", async ({ request, page }) => {
  const adapter = new FakeAttendee();
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.goto(`/meeting-room/${meeting.bot.outputToken}?mode=meeting`);
  await expect(page.getByText("INGRESSO IN CORSO", { exact: true })).toBeVisible();
  await expect(page.locator("[data-live='false']")).toBeVisible();
  await requestAttendeeExit(meeting, { adapter, now: later(10) });
  await expect(page.getByText("NON OPERATIVO", { exact: true })).toBeVisible();
  await expect(page.locator("[data-speaking='false']")).toBeVisible();
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByText("Uscita in corso. Attendiamo la conferma prima di consentire un nuovo tentativo.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fai entrare ora", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elimina meeting", exact: true })).toBeDisabled();
  await persistAttendeeState(await reload(meeting), { state: "ended", occurredAt: later(20) });
  await page.reload();
  await expect(page.getByText("Il collega è uscito dal meeting.", { exact: true })).toBeVisible();
  await expect(page.getByText("Ingresso annullato.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elimina meeting", exact: true })).toBeEnabled();
  await page.close();
});

test("ingresso: il timeout di un appuntamento futuro parte dall’orario previsto", () => {
  expect(meetingEntryDeadline(origin, later(3600))).toEqual(later(3720));
});

test("ingresso: il controllo dello stato non disponibile non disattiva il timeout", async ({ request }) => {
  const adapter = new FakeAttendee();
  const meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.statusError = new Error("Status service unavailable");
  await reconcileMeetingEntry(meeting.id, { now: later(121), adapter });
  expect((await reload(meeting)).bot.status).toBe("leaving");
  expect(adapter.leaves).toBe(1);
  expect(adapter.joins).toBe(1);
});

test("ingresso: risolve l’incertezza anche quando ritrova un bot già terminato", async ({ request }) => {
  const adapter = new FakeAttendee();
  adapter.error = new Error("Creation response lost");
  let meeting = await startAttendeeEntry(await create(request), { now: origin, adapter });
  adapter.current = { state: "ended", occurredAt: later(10) };
  await reconcileMeetingEntry(meeting.id, { now: later(11), adapter });
  meeting = await reload(meeting);
  expect(meeting.bot.failureCode).toBe("entry_failed");
  expect(meeting.bot.leftAt).toBeDefined();
  adapter.error = undefined;
  await startAttendeeEntry(meeting, { now: later(12), adapter });
  expect(adapter.joins).toBe(2);
});

test("stati: eventi vecchi o non validi non sovrascrivono lo stato", async ({ request }) => {
  const meeting = await create(request);
  applyAttendeeState(meeting, { state: "joined_recording", occurredAt: later(20) });
  applyAttendeeState(meeting, { state: "joining", occurredAt: later(5) });
  applyAttendeeState(meeting, { state: "fatal_error", occurredAt: new Date("invalid") });
  expect(meeting.status).toBe("live");
  expect(meeting.bot.providerStatusCode).toBe("joined_recording");
  applyAttendeeState(meeting, { state: "joined_recording_permission_denied", occurredAt: later(25) });
  expect(meeting.status).toBe("joining");
  expect(meeting.bot.readyAt).toBeUndefined();
  expect(meeting.bot.joinDeadlineAt).toEqual(later(145));
});

test("aggiornamenti: sostituisce il modello in memoria obsoleto senza perdere i meeting", async ({ request }) => {
  const fixture = await create(request);
  deleteModel("Meeting");
  model("Meeting", new Schema({ title: String, bot: new Schema({ status: String }) }));
  const current = registerMeetingModel();
  expect(hasMeetingLifecycleSchema(current)).toBe(true);
  for (const path of MEETING_LIFECYCLE_PATHS) expect(current.schema.path(path)).toBeDefined();
  expect((await current.findById(fixture._id).exec())?.title).toBe(fixture.title);
  expect(registerMeetingModel()).toBe(current);
  // A fresh model must persist the complete claim, not silently strip new fields.
  const updated = await current.findByIdAndUpdate(fixture._id, { $set: {
    "bot.entryAttemptId": "schema-test", "bot.stopRequestedAt": later(5), "bot.failureCode": "entry_cancelled",
  } }, { new: true, strict: "throw" }).exec();
  expect(updated?.bot.entryAttemptId).toBe("schema-test");
  expect(updated?.bot.stopRequestedAt).toEqual(later(5));
});

test("aggiornamenti: un vecchio riferimento al modello non può inviare bot o fingere un’uscita", async ({ request }) => {
  const meeting = await create(request);
  const adapter = new FakeAttendee();
  const botSchema = (MeetingModel.schema.path("bot") as unknown as { schema: Schema }).schema;
  const definition = botSchema.path("entryAttemptId").options;
  botSchema.remove("entryAttemptId");
  try {
    await expect(startAttendeeEntry(meeting, { now: origin, adapter })).rejects.toThrow("schema is outdated");
    await expect(requestAttendeeExit(meeting, { now: origin, adapter })).rejects.toThrow("schema is outdated");
    expect(adapter.joins).toBe(0);
    expect(adapter.leaves).toBe(0);
    const raw = await MeetingModel.collection.findOne({ _id: meeting._id });
    expect(raw?.bot.status).toBe("not_scheduled");
    expect(raw?.bot.stopRequestedAt).toBeUndefined();
  } finally {
    botSchema.add({ entryAttemptId: definition });
  }
});

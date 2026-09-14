import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { AttendeeMeetingBotAdapter } from "../../src/lib/meeting-bot-adapter";
import type { MeetingBotRuntimeConfig } from "../../src/lib/meeting-bot-config";
import { meetingParticipantStatus, mergeParticipantEvents, parseParticipantEvent, sameTranscriptSpeaker, type ParticipantEvent } from "../../src/lib/meeting-participants";
import { persistParticipantEvents, syncMeetingParticipants } from "../../src/lib/sync-meeting-participants";
import { MeetingModel, type MeetingDocument } from "../../src/models/Meeting";
import { connectToDatabase } from "../../src/lib/mongodb";
import { classifyTranscriptSource } from "../../src/lib/meeting-transcript-source";
import { serializeMeeting } from "../../src/lib/serialize-meeting";
import { reconcileMeetingEntry } from "../../src/lib/meeting-entry-monitor";

const config: MeetingBotRuntimeConfig = { provider: "attendee", liveRequested: true, ready: true,
  apiBaseUrl: "https://app.attendee.dev/api/v1", apiKey: "fixture-not-a-real-key", publicBaseUrl: "https://avatar.example",
  accessMode: "anonymous_guest", displayName: "Riccardo", signedInConfirmed: false };
const at = Date.parse("2030-01-01T10:00:00Z");
const event = (participantId = "human-1", name = "Riccardo Bianchi", type: "join" | "leave" = "join", timestampMs = at): ParticipantEvent =>
  ({ id: `${participantId}-${type}-${timestampMs}`, participantId, name, type, timestampMs });
const wire = (e: ParticipantEvent) => ({ id: e.id, participant_uuid: e.participantId, participant_name: e.name, event_type: e.type, timestamp_ms: e.timestampMs });
const context = (events: ParticipantEvent[] = [event()]) => ({
  assistant: { wakeWord: "Riccardo" }, bot: { provider: "attendee", status: "joined", entryAttemptId: "attempt" },
  participantRoster: { attemptId: "attempt", revision: 1, entries: mergeParticipantEvents([], events), synchronizedAt: new Date(at) },
});

test("roster: preserves identical names with distinct participant identities", () => {
  const roster = context([event("one"), event("two")]);
  expect(roster.participantRoster.entries).toHaveLength(2);
  expect(meetingParticipantStatus(roster, at).collisions).toHaveLength(2);
  expect(sameTranscriptSpeaker({ speakerId: "one", speakerName: "Riccardo" }, { speakerId: "two", speakerName: "Riccardo" })).toBe(false);
  expect(sameTranscriptSpeaker({ speakerId: "one", speakerName: "Riccardo" }, { speakerName: "Riccardo" })).toBe(false);
});

test("roster: leave, duplicate, out-of-order delivery and rejoin converge", () => {
  const joined = event();
  const left = event("human-1", "Riccardo Bianchi", "leave", at + 1000);
  for (const events of [[joined, left, joined], [left, joined, left], [joined, left, left]]) {
    const entries = mergeParticipantEvents([], events);
    expect(entries).toHaveLength(1);
    expect(entries[0].present).toBe(false);
    expect(mergeParticipantEvents(entries, [event("human-1", "Riccardo Rossi", "join", at + 2000)])[0]).toMatchObject({ present: true, name: "Riccardo Rossi" });
  }
  for (const events of [[joined, { ...left, timestampMs: at }], [{ ...left, timestampMs: at }, joined]]) {
    expect(mergeParticipantEvents([], events)[0].present).toBe(false);
  }
});

for (const [wakeWord, name, collision] of [
  ["Riccardo", "RICCARDO Bianchi (Guest)", true], ["Riccardo", "Ricardo Smith", true],
  ["Riccardo", "Riccardone", false], ["José", "Jose Gomez", true],
  ["Anna Maria", "Anna Maria Rossi", true], ["Anna Maria", "Anna Rossi", false],
  ["Nora", "Nora Jones", true],
] as const) {
  test(`roster: invocation spelling and boundaries ${wakeWord}/${name}`, () => {
    const meeting = context([event("human", name)]);
    meeting.assistant.wakeWord = wakeWord;
    expect(meetingParticipantStatus(meeting, at).voiceBlocked).toBe(collision);
  });
}

test("roster: missing, partial and stale lists are not reported as verified", () => {
  expect(meetingParticipantStatus({ ...context([]), participantRoster: undefined }, at).state).toBe("unverified");
  expect(meetingParticipantStatus(context(), at + 90_001)).toMatchObject({ state: "stale", voiceBlocked: true });
  expect(meetingParticipantStatus({ ...context(), participantRoster: { ...context().participantRoster, incomplete: true } }, at).state).toBe("stale");
  expect(meetingParticipantStatus({ ...context(), bot: { ...context().bot, entryAttemptId: "new" } }, at))
    .toMatchObject({ state: "unverified", collisions: [] });
  expect(meetingParticipantStatus({ ...context(), bot: { ...context().bot, leftAt: new Date(at) } }, at).state).toBe("inactive");
});

test("roster: validates event identity and timestamp without inventing missing IDs", () => {
  expect(parseParticipantEvent(wire(event()))).toEqual(event());
  for (const malformed of [{ participant_name: "Riccardo", event_type: "join" }, { ...wire(event()), timestamp_ms: NaN }, { ...wire(event()), participant_uuid: "" }]) {
    expect(parseParticipantEvent(malformed)).toBeUndefined();
  }
});

test("roster: initial paginated history restores participants already present, using GET only", async () => {
  const calls: string[] = [];
  const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
    calls.push(String(input));
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeDefined();
    return Response.json(calls.length === 1
      ? { results: [wire(event("one"))], next: "https://app.attendee.dev/api/v1/bots/fixture/participant_events?cursor=page2" }
      : { results: [wire(event("two", "Elena")), wire(event("one", "Riccardo Bianchi", "leave", at + 1))], next: null });
  });
  const result = await adapter.getParticipantEvents("fixture");
  expect(result.complete).toBe(true);
  expect(calls).toHaveLength(2);
  expect(mergeParticipantEvents([], result.events).filter(entry => entry.present).map(entry => entry.name)).toEqual(["Elena"]);
});

for (const next of ["https://evil.example/steal", "https://app.attendee.dev/api/v1/bots/other/participant_events", "http://app.attendee.dev/api/v1/bots/fixture/participant_events", "https://user@ app.attendee.dev/invalid"]) {
  test(`roster: never forwards authorization to unsafe pagination ${next}`, async () => {
    let calls = 0;
    const adapter = new AttendeeMeetingBotAdapter(config, async () => { calls++; return Response.json({ results: [wire(event())], next }); });
    const result = await adapter.getParticipantEvents("fixture").catch(() => ({ complete: false }));
    expect(result.complete).toBe(false);
    expect(calls).toBe(1);
  });
}

test("roster: invalid rows and pagination loops cannot produce a verified list", async () => {
  for (const response of [
    { results: [wire(event()), { event_type: "join" }], next: null },
    { results: [wire(event())], next: "https://app.attendee.dev/api/v1/bots/fixture/participant_events" },
    { results: [], next: undefined },
  ]) {
    const adapter = new AttendeeMeetingBotAdapter(config, async () => Response.json(response));
    expect((await adapter.getParticipantEvents("fixture")).complete).toBe(false);
  }
});

test("roster: same-name human identity wins over a caption name, while acoustic echo stays quarantined", () => {
  const meeting = { ...context(), commandHistory: [] };
  const segment = { speakerName: "Riccardo", speakerId: "human-1", entryAttemptId: "attempt", text: "Abbiamo approvato il budget del progetto", createdAt: new Date(at) };
  const classified = classifyTranscriptSource(meeting, segment);
  expect(classified).toEqual({ source: "participant", speakerIsParticipant: true });
  expect(classifyTranscriptSource({ ...meeting, participantRoster: undefined }, { ...segment, ...classified }).source).toBe("participant");
  expect(classifyTranscriptSource(meeting, { ...segment, speakerId: "bot-id" }).source).toBe("avatar");
  expect(classifyTranscriptSource({ ...meeting, commandHistory: [{ id: "reply", response: segment.text, createdAt: new Date(at - 1), playbackStartedAt: new Date(at) }] }, segment).source).toBe("suspected_echo");
});

const owned: string[] = [];
test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated test database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Roster /u });
});
async function fixture(request: APIRequestContext) {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Roster ${randomUUID()}`, objective: "Verify participants",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/${randomUUID()}`,
    scheduledStart: new Date().toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "it", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const { meeting } = await response.json();
  owned.push(meeting.id);
  return (await MeetingModel.findByIdAndUpdate(meeting.id, { $set: {
    status: "live", "assistant.wakeWord": "Riccardo", "bot.provider": "attendee", "bot.status": "joined",
    "bot.externalBotId": `fixture-${meeting.id}`, "bot.entryAttemptId": randomUUID(), "bot.readyAt": new Date(),
  } }, { new: true }).orFail());
}
const attempt = (meeting: MeetingDocument) => ({ meetingId: meeting.id, attemptId: meeting.bot.entryAttemptId!, externalBotId: meeting.bot.externalBotId! });
const reload = (meeting: MeetingDocument) => MeetingModel.findById(meeting.id).orFail();
async function caption(request: APIRequestContext, meeting: MeetingDocument, text: string, speakerId = "elena-id", speakerName = "Elena", timestamp = Date.now()) {
  const response = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
    idempotency_key: randomUUID(), bot_id: meeting.bot.externalBotId,
    bot_metadata: { conclavia_attempt_id: meeting.bot.entryAttemptId }, trigger: "transcript.update",
    data: { speaker_name: speakerName, speaker_uuid: speakerId, timestamp_ms: timestamp, duration_ms: 500,
      transcription: { transcript: text, words: [] } },
  } });
  expect(response.status()).toBe(200);
}

test("roster DB: concurrent events merge without losing identities; a stale attempt cannot overwrite", async ({ request }) => {
  const meeting = await fixture(request);
  await Promise.all(["one", "two", "three", "four"].map(id => persistParticipantEvents(attempt(meeting), [event(id)])));
  expect((await reload(meeting)).participantRoster?.entries).toHaveLength(4);
  await persistParticipantEvents(attempt(meeting), [event("one", "Riccardo Bianchi", "leave", at + 2)]);
  await persistParticipantEvents(attempt(meeting), [event("one")], { complete: true, at: new Date(at) });
  expect((await reload(meeting)).participantRoster?.entries.find(entry => entry.participantId === "one")?.present).toBe(false);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "bot.entryAttemptId": "replacement" } });
  await persistParticipantEvents(attempt(meeting), [event("five")]);
  expect((await reload(meeting)).participantRoster?.entries).toHaveLength(4);
  expect(serializeMeeting(await reload(meeting)).participantStatus?.state).toBe("unverified");
});

test("roster DB: sync restores initial presence, shares a lease, and retains collisions on failure", async ({ request }) => {
  const meeting = await fixture(request);
  let calls = 0;
  let fail = false;
  const adapter = new AttendeeMeetingBotAdapter(config, async () => {
    calls++;
    if (fail) throw new Error("offline");
    return Response.json({ results: [wire(event())], next: null });
  });
  await Promise.all([1, 2, 3].map(() => syncMeetingParticipants(meeting.id, { adapter, now: new Date(at) })));
  expect(calls).toBe(1);
  expect(meetingParticipantStatus(await reload(meeting), at)).toMatchObject({ state: "synced", voiceBlocked: true });
  fail = true;
  await syncMeetingParticipants(meeting.id, { adapter, now: new Date(at + 31_000) });
  expect(meetingParticipantStatus(await reload(meeting), at + 31_000)).toMatchObject({ state: "stale", voiceBlocked: true });
  expect((await reload(meeting)).bot.externalBotId).toBe(meeting.bot.externalBotId);
});

test("roster DB: empty initial history remains unverified, not no matching names", async ({ request }) => {
  const meeting = await fixture(request);
  const adapter = new AttendeeMeetingBotAdapter(config, async () => Response.json({ results: [], next: null }));
  await syncMeetingParticipants(meeting.id, { adapter });
  expect(serializeMeeting(await reload(meeting)).participantStatus?.state).toBe("unverified");
});

test("roster monitor: initial sync and missing leave callback recover without an open GUI", async ({ request }) => {
  const meeting = await fixture(request);
  let left = false;
  const methods: string[] = [];
  const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
    methods.push(init?.method || "");
    if (String(input).includes("participant_events")) return Response.json({
      results: [wire(event()), ...(left ? [wire(event("human-1", "Riccardo Bianchi", "leave", at + 1))] : [])], next: null,
    });
    return Response.json({ state: "joined_recording", events: [{ type: "joined_recording", created_at: new Date(at).toISOString() }] });
  });
  await reconcileMeetingEntry(meeting.id, { adapter, now: new Date(at) });
  expect(meetingParticipantStatus(await reload(meeting), at).voiceBlocked).toBe(true);
  left = true;
  await reconcileMeetingEntry(meeting.id, { adapter, now: new Date(at + 31_000) });
  expect(meetingParticipantStatus(await reload(meeting), at + 31_000)).toMatchObject({ state: "synced", voiceBlocked: false });
  expect(methods).toEqual(["GET", "GET", "GET", "GET"]);
});

test("roster DB: poll in flight cannot restore participants after stop or replacement", async ({ request }) => {
  for (const replace of [false, true]) {
    const meeting = await fixture(request);
    const adapter = new AttendeeMeetingBotAdapter(config, async () => {
      await MeetingModel.updateOne({ _id: meeting.id }, { $set: replace
        ? { "bot.entryAttemptId": "new-attempt" } : { "bot.stopRequestedAt": new Date() } });
      return Response.json({ results: [wire(event())], next: null });
    });
    await syncMeetingParticipants(meeting.id, { adapter });
    expect((await reload(meeting)).participantRoster).toBeUndefined();
  }
});

test("roster DB: a webhook leave arriving during a poll wins over its old join history", async ({ request }) => {
  const meeting = await fixture(request);
  const adapter = new AttendeeMeetingBotAdapter(config, async () => {
    await persistParticipantEvents(attempt(meeting), [event("human-1", "Riccardo Bianchi", "leave", at + 1)]);
    return Response.json({ results: [wire(event())], next: null });
  });
  await syncMeetingParticipants(meeting.id, { adapter });
  expect(serializeMeeting(await reload(meeting)).participantStatus?.voiceBlocked).toBe(false);
  expect((await reload(meeting)).participantRoster?.entries[0].present).toBe(false);
});

test("roster webhook: join/leave updates current presence but preserves historical names and rejects old attempts", async ({ request }) => {
  const meeting = await fixture(request);
  const post = (e: ParticipantEvent, attemptId = meeting.bot.entryAttemptId) => request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
    idempotency_key: e.id, bot_id: meeting.bot.externalBotId, bot_metadata: { conclavia_attempt_id: attemptId },
    trigger: "participant_events.join_leave", data: wire(e),
  } });
  expect((await post(event())).status()).toBe(200);
  expect((await post(event())).status()).toBe(200);
  expect((await reload(meeting)).participantRoster?.entries).toHaveLength(1);
  expect(serializeMeeting(await reload(meeting)).participantStatus?.voiceBlocked).toBe(true);
  expect((await post(event("human-1", "Riccardo Bianchi", "leave", at + 1))).status()).toBe(200);
  const left = await reload(meeting);
  expect(serializeMeeting(left).participantStatus?.voiceBlocked).toBe(false);
  expect(left.participants).toContain("Riccardo Bianchi");
  await post(event("old", "Riccardo"), "old-attempt");
  expect((await reload(meeting)).participantRoster?.entries).toHaveLength(1);
});

test("roster commands: ambiguous speech and refusal stay silent; GUI works; voice resumes after departure", async ({ request }) => {
  let meeting = await fixture(request);
  await persistParticipantEvents(attempt(meeting), [event()]);
  const pending = { id: randomUUID(), type: "correction", sourceStatement: "Tre per tre fa 12", reason: "Arithmetic", response: "Tre per tre fa nove.", createdAt: new Date(), expiresAt: new Date(Date.now() + 90_000) };
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { pendingIntervention: pending } });
  for (const text of ["Ciao Riccardo", "Riccardo, dimmi", "Riccardo, non ora", "Riccardo, ricorda che il budget è approvato"]) {
    meeting = await reload(meeting);
    await caption(request, meeting, text);
    // Negative asynchronous assertion: give the post-response worker time to run.
    await new Promise(resolve => setTimeout(resolve, 300));
    expect((await reload(meeting)).pendingIntervention?.id).toBe(pending.id);
  }
  expect((await reload(meeting)).commandHistory).toHaveLength(0);
  const gui = await request.post(`/api/meetings/${meeting.id}/commands`, { data: { kind: "ask", prompt: "mi senti?" } });
  expect(gui.status()).toBe(200);
  expect((await reload(meeting)).commandHistory).toHaveLength(1);
  await persistParticipantEvents(attempt(meeting), [event("human-1", "Riccardo Bianchi", "leave", at + 1)]);
  meeting = await reload(meeting);
  await caption(request, meeting, "Riccardo, dimmi.");
  await expect.poll(async () => (await reload(meeting)).commandHistory.length).toBe(2);
});

test("roster captions: identical speech from two same-name humans is not deduplicated or labelled avatar", async ({ request }) => {
  let meeting = await fixture(request);
  await persistParticipantEvents(attempt(meeting), [event("first", "Riccardo"), event("second", "Riccardo")]);
  meeting = await reload(meeting);
  for (const speakerId of ["first", "second"]) {
    await caption(request, meeting, "Confermo il budget", speakerId, "Riccardo", at);
  }
  const transcripts = (await reload(meeting)).transcript;
  expect(transcripts).toHaveLength(2);
  expect(transcripts.every(segment => segment.source === "participant" && segment.speakerIsParticipant)).toBe(true);
});

for (const locale of ["it", "en"] as const) {
  test(`roster GUI ${locale}: compact warning, unknown state, recovery and no public roster leak`, async ({ page, request, baseURL }) => {
    const meeting = await fixture(request);
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: baseURL! }]);
    if (locale === "en") await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/meetings/${meeting.id}`);
    const panel = page.getByTestId("participant-status");
    await expect(panel).toHaveAttribute("data-state", "unverified");
    await persistParticipantEvents(attempt(meeting), [event()], { complete: true, at: new Date() });
    await expect(panel).toContainText(locale === "it" ? "comandi vocali sospesi" : "voice commands paused");
    await expect(panel).toContainText("Riccardo Bianchi");
    const publicResponse = await request.get(`/api/meetings/${meeting.id}/participants`, { headers: { "x-forwarded-host": "fixture.trycloudflare.com" } });
    expect(publicResponse.status()).toBe(404);
    const privatePayload = await (await request.get(`/api/meetings/${meeting.id}/participants`)).json();
    expect(JSON.stringify(privatePayload)).not.toContain(meeting.bot.outputToken);
    expect(JSON.stringify(privatePayload)).not.toContain("human-1");
    await persistParticipantEvents(attempt(meeting), [event("human-1", "Riccardo Bianchi", "leave", at + 1)]);
    await expect(panel).toContainText(locale === "it" ? "Nessun omonimo rilevato" : "No matching name detected");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

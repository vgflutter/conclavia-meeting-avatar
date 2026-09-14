import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { detectElementaryArithmetic, meetingPermissionDecision, parseMeetingVoiceCommand } from "../../src/lib/meeting-command";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import { participantTranscript } from "../../src/lib/meeting-transcript-source";
import { serializeMeeting } from "../../src/lib/serialize-meeting";
import { INTERVENTION_CHECK_INTERVAL_MS } from "../../src/lib/meeting-intervention-context";

const ownedIds: string[] = [];
let transcriptRequest: APIRequestContext;

test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated test database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});

test.afterEach(async () => {
  for (const id of ownedIds.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E Trigger /u });
});

async function fixture(request: APIRequestContext, policy = "important_only") {
  transcriptRequest = request;
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Trigger ${randomUUID()}`, objective: "Confermare il budget del progetto Aurora",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/trigger-${randomUUID()}`,
    scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "auto", autoJoin: false,
    correctionPolicy: policy, agenda: [{ title: "Budget", mandatory: true }],
  } });
  expect(response.status()).toBe(201);
  const { meeting } = await response.json();
  ownedIds.push(meeting.id);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.wakeWord": "Riccardo" } });
  return meeting as { id: string; bot: { outputToken: string } };
}

async function drainHandQueue(id: string) {
  // Advance only the isolated fixture's collection window; exercise the real
  // after-response drain. Named speaking turns never call or wait for this.
  const document = await MeetingModel.findById(id).orFail();
  if (!document.bot.interventionNextCheckAt) return;
  await MeetingModel.updateOne({ _id: id }, { $set: {
    "bot.lastCorrectionCheckAt": new Date(Date.now() - INTERVENTION_CHECK_INTERVAL_MS - 100),
    "bot.interventionNextCheckAt": new Date(Date.now() - 100),
  } });
  expect((await transcriptRequest.get(`/api/meeting-room/${document.bot.outputToken}/state`)).ok()).toBe(true);
  await expect.poll(async () => (await MeetingModel.findById(id).orFail()).transcript
    .some(segment => ["queued", "checking"].includes(segment.interventionDecision?.state || ""))).toBe(false);
}

async function speak(id: string, text: string, speakerName = "Elena Costa", drain = true) {
  const document = await MeetingModel.findById(id).orFail();
  // Exercise the synchronous transcript ingress with a DB-only provider fixture.
  // No external bot is created; the separate webhook test exercises Attendee ingress.
  await MeetingModel.updateOne({ _id: id }, { $set: {
    status: "live", "bot.provider": "recall", "bot.externalBotId": `audit-${id}`,
  } });
  const response = await transcriptRequest.post(`/api/meeting-room/${document.bot.outputToken}/transcript`, {
    data: { text, speakerName, startMs: document.transcript.length * 2000 },
  });
  expect(response.status()).toBe(200);
  if (drain) await drainHandQueue(id);
  return MeetingModel.findById(id).orFail();
}

test("hand diagnostics: short collection window retains the caption and polling drains it without new speech", async ({ request }) => {
  const meeting = await fixture(request);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "bot.lastCorrectionCheckAt": new Date() } });
  const saved = await speak(meeting.id, "Sono prontissimi. Andiamo tre per tre fa 12, deve cominciare.", "Elena Costa", false);
  expect(saved.transcript.at(-1)?.interventionDecision).toMatchObject({ state: "queued", reason: "awaiting_check" });
  expect(saved.pendingIntervention).toBeUndefined();
  expect(saved.commandHistory).toHaveLength(0);
  const debug = await (await request.get(`/api/meetings/${meeting.id}/debug`)).json();
  expect(debug.events.at(-1).interventionDecision).toMatchObject({ state: "queued", reason: "awaiting_check" });
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    "bot.lastCorrectionCheckAt": new Date(Date.now() - INTERVENTION_CHECK_INTERVAL_MS - 100), "bot.interventionNextCheckAt": new Date(Date.now() - 1_000),
  } });
  expect((await request.get(`/api/meeting-room/${meeting.bot.outputToken}/state`)).status()).toBe(200);
  await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).transcript.at(-1)?.interventionDecision?.reason).toBe("ai_unavailable");
});

test("hand diagnostics: a local correction logs the reason but remains silent", async ({ request }) => {
  const meeting = await fixture(request);
  const saved = await speak(meeting.id, "Tre per tre fa 12.");
  expect(saved.transcript.at(-1)?.interventionDecision).toMatchObject({ state: "raised", reason: "arithmetic_error" });
  expect(saved.pendingIntervention?.response).toContain("fa 9");
  expect(saved.commandHistory).toHaveLength(0);
});

test("hand diagnostics: disabled policy is distinct from unavailable AI", async ({ request }) => {
  const meeting = await fixture(request, "off");
  let saved = await speak(meeting.id, "Questa affermazione dovrebbe essere valutata nel contesto.");
  expect(saved.transcript.at(-1)?.interventionDecision).toMatchObject({ state: "skipped", reason: "policy_disabled" });
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.correctionPolicy": "important_only" } });
  saved = await speak(meeting.id, "Questa nuova affermazione richiede una valutazione del contesto.");
  expect(saved.transcript.at(-1)?.interventionDecision).toMatchObject({ state: "error", reason: "ai_unavailable" });
  expect(saved.commandHistory).toHaveLength(0);
});

for (const text of [
  "Ciao Marco, mi senti?", "Hello Nora, can you hear me?",
  "Ho chiesto a Riccardo di controllare il budget", "Lo ha detto Riccardo ieri mattina",
  "Se Riccardo dice ricorda che il budget è approvato, cosa succede?",
  'Elena ha detto: "Riccardo, ricorda il budget".',
]) {
  test(`trigger: ignora altri destinatari e menzioni: ${text}`, () => {
    expect(parseMeetingVoiceCommand(text, "Riccardo")).toBeUndefined();
  });
}

for (const name of ["Riccardo", "Nora", "José", "Anna Maria"]) {
  test(`trigger: nome dinamico ${name}, saluto, memoria, riepilogo, domanda e verifica`, () => {
    expect(parseMeetingVoiceCommand(`Ciao ${name}!`, name)).toEqual({ kind: "ask", prompt: "Ciao" });
    expect(parseMeetingVoiceCommand(`Scusa ${name}, mi senti?`, name)).toEqual({ kind: "ask", prompt: "mi senti?" });
    expect(parseMeetingVoiceCommand(`${name}, ricorda che il budget è approvato`, name)).toEqual({ kind: "remember", prompt: "il budget è approvato" });
    expect(parseMeetingVoiceCommand(`${name}, riepiloga`, name)).toEqual({ kind: "summary", prompt: "" });
    expect(parseMeetingVoiceCommand(`${name}, ricordami cosa abbiamo deciso`, name)).toEqual({ kind: "ask", prompt: "ricordami cosa abbiamo deciso" });
    expect(parseMeetingVoiceCommand(`${name}, verifica la data`, name)).toEqual({ kind: "correct", prompt: "la data" });
    expect(meetingPermissionDecision(`${name}, vai pure`, name)).toBe("grant");
    expect(meetingPermissionDecision(`${name}, non ora`, name)).toBe("decline");
  });
}

test("trigger: un saluto autonomo dopo una frase nei sottotitoli richiama il nome dinamico", () => {
  expect(parseMeetingVoiceCommand("Guarda, è così? Ciao Riccardo.", "Riccardo")).toEqual({kind: "ask", prompt: "Ciao"});
  expect(parseMeetingVoiceCommand("Abbiamo finito. Nora, ricorda che il budget è approvato.", "Nora"))
    .toEqual({kind: "remember", prompt: "il budget è approvato."});
  expect(parseMeetingVoiceCommand("È chiaro! José, mi senti?", "José")).toEqual({kind: "ask", prompt: "mi senti?"});
});

test("trigger: punteggiatura nelle citazioni e nelle menzioni non le trasforma in comandi", () => {
  for (const text of [
    'Ha detto "Aspetta. Riccardo, ricorda il budget".',
    "Abbiamo finito. Elena ha chiesto a Riccardo di ricordare il budget.",
    "Abbiamo finito. Elena ha detto: Riccardo, ricorda il budget.",
    "Guarda, è così? Ciao Marco.",
  ]) expect(parseMeetingVoiceCommand(text, "Riccardo")).toBeUndefined();
});

test("trigger: saluto a fine sottotitolo produce una risposta attraverso l’ingresso trascrizioni", async ({request}) => {
  const meeting = await fixture(request);
  const result = await speak(meeting.id, "Guarda, è così? Ciao Riccardo.");
  expect(result.commandHistory).toHaveLength(1);
  expect(result.commandHistory[0].response).toBe("Ciao! Sono qui, dimmi pure.");
});

for (const text of [
  "Non è vero che tre per tre fa dodici.", "1,5 per 2 fa 3.", "1.5 times 2 is 3.",
  "3 per 3 fa 9,5.", "-3 per 3 fa -9.", 'Ha detto "tre per tre fa dodici".',
  "Se tre per tre fa dodici, il calcolo è sbagliato.", "Tre per tre fa dodici?",
  "999999999999999999999 per 2 fa 3.",
]) {
  test(`correzioni: non corregge frasi ambigue o fuori dominio: ${text}`, () => {
    expect(detectElementaryArithmetic(text)).toBeUndefined();
  });
}

test("permesso: una menzione o una citazione non concede la parola", () => {
  expect(meetingPermissionDecision("Ho detto a Riccardo che puoi parlare", "Riccardo")).toBeUndefined();
  expect(meetingPermissionDecision('Elena dice "Riccardo, vai pure"', "Riccardo")).toBeUndefined();
  expect(meetingPermissionDecision("Vai pure, Riccardo", "Riccardo")).toBe("grant");
});

test("segnalazione reale: secondo me tre per tre fa 12, poi Ehi Riccardo Dimmi riprende la correzione", async ({ request }) => {
  const meeting = await fixture(request);
  const pending = await speak(meeting.id, "Secondo me tre per tre fa 12.");
  expect(pending.pendingIntervention?.response).toContain("fa 9, non 12");
  const result = await speak(meeting.id, "Ehi Riccardo, Dimmi.");
  expect(result.pendingIntervention).toBeUndefined();
  expect(result.commandHistory).toHaveLength(1);
  expect(result.commandHistory[0]).toMatchObject({ kind: "correct", prompt: "Secondo me tre per tre fa 12." });
  expect(result.commandHistory[0].response).toContain("fa 9, non 12");
  expect(result.transcript.at(-1)?.text).toBe("Ehi Riccardo, Dimmi.");
});

test("segnalazione reale: ci sta ascoltando non produce risposta e non consuma la mano alzata", async ({ request }) => {
  const meeting = await fixture(request);
  const mention = "Riprenderò la mia vita in mano. Riccardo ci sta ascoltando.";
  let saved = await speak(meeting.id, mention);
  expect(saved.commandHistory).toHaveLength(0);
  expect(saved.transcript.at(-1)?.text).toBe(mention);
  expect(saved.transcript.at(-1)?.turnDecision?.action).toBe("unresolved");
  saved = await speak(meeting.id, "Secondo me tre per tre fa 12.");
  const pendingId = saved.pendingIntervention?.id;
  expect(pendingId).toBeTruthy();
  for (const text of ["Riccardo ci sta ascoltando?", "Riccardo is listening to us."]) {
    saved = await speak(meeting.id, text);
    expect(saved.commandHistory).toHaveLength(0);
    expect(saved.pendingIntervention?.id).toBe(pendingId);
  }
  saved = await speak(meeting.id, "Sì, Riccardo.");
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0].response).toBe("Sì, 3 per 3 fa 9, non 12.");
  expect(saved.pendingIntervention).toBeUndefined();
});

test("dimmi is a named floor control; a real question is not swallowed and punctuation is not a question", () => {
  expect(meetingPermissionDecision("Ehi Riccardo, Dimmi.", "Riccardo")).toBe("grant");
  expect(meetingPermissionDecision("Riccardo, dimmi quanto costa", "Riccardo")).toBeUndefined();
  expect(parseMeetingVoiceCommand("Riccardo, dimmi quanto costa", "Riccardo")).toEqual({ kind: "ask", prompt: "quanto costa" });
  for (const text of ["Riccardo, dimmi.", "Riccardo, rispondi!", "Riccardo, verifica.", "Riccardo, ricorda."]) {
    expect(parseMeetingVoiceCommand(text, "Riccardo")).toBeUndefined();
  }
  for (const statement of ["Secondo me non è vero che tre per tre fa dodici.", "Secondo me tre per tre fa dodici?", 'Secondo me "tre per tre fa dodici".', "Secondo me 1,5 per 2 fa 3."]) {
    expect(detectElementaryArithmetic(statement)).toBeUndefined();
  }
});

for (const grant of ["Sì, Riccardo.", "Sì, Riccardo, dimmi.", "Vai Riccardo", "Sentiamo Riccardo", "Yes, Riccardo.", "Temperatura? Non si può. Sì, Riccardo, dimmi."]) {
  test(`raised hand: original incident through transcript ingress with ${grant}`, async ({ request }) => {
    const meeting = await fixture(request);
    let saved = await speak(meeting.id, "Tre per tre fa 13.");
    expect(saved.pendingIntervention?.response).toBe("Sì, 3 per 3 fa 9, non 13.");
    expect(saved.commandHistory).toHaveLength(0);
    saved = await speak(meeting.id, "Non mi manca sostenendoti con le mani sulla sbarra e appoggiando i piedi.");
    expect(saved.commandHistory).toHaveLength(0);
    saved = await speak(meeting.id, grant);
    expect(saved.commandHistory).toHaveLength(1);
    expect(saved.commandHistory[0]).toMatchObject({ kind: "correct", response: "Sì, 3 per 3 fa 9, non 13." });
    expect(saved.pendingIntervention).toBeUndefined();
    expect(saved.transcript.at(-1)?.text).toBe(grant);
    expect(saved.transcript.at(-1)?.turnDecision).toMatchObject({ action: "grant", reason: "named_grant" });
    saved = await speak(meeting.id, "Sì, Riccardo.");
    expect(saved.commandHistory).toHaveLength(1);
    const debug = await (await request.get(`/api/meetings/${meeting.id}/debug`)).json();
    expect(debug.events.some((event: { turnDecision?: { reason: string } }) => event.turnDecision?.reason === "named_grant")).toBe(true);
  });
}

test("raised hand: expiry/refusal/disabled corrections do not resurrect a response on named yes", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Tre per tre fa 13.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "pendingIntervention.expiresAt": new Date(Date.now() - 1000) } });
  let saved = await speak(meeting.id, "Sì, Riccardo.");
  expect(saved.commandHistory).toHaveLength(0);
  await speak(meeting.id, "Tre per tre fa 14.");
  await speak(meeting.id, "Aspetta Riccardo");
  saved = await speak(meeting.id, "Sì, Riccardo.");
  expect(saved.commandHistory).toHaveLength(0);
  await speak(meeting.id, "Tre per tre fa 15.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.correctionPolicy": "off" } });
  saved = await speak(meeting.id, "Sì, Riccardo.");
  expect(saved.commandHistory).toHaveLength(0);
});

test("GUI floor grant: works with a namesake, is idempotent, and stays off the public tunnel", async ({ request, page }) => {
  const meeting = await fixture(request);
  let saved = await speak(meeting.id, "Tre per tre fa 13.");
  const interventionId = saved.pendingIntervention!.id;
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    "bot.provider": "attendee", "bot.status": "joined", "bot.entryAttemptId": "floor-fixture",
    participantRoster: { attemptId: "floor-fixture", revision: 1, synchronizedAt: new Date(), entries: [
      { participantId: "namesake", name: "Riccardo Bianchi", present: true, timestampMs: Date.now(), eventId: "fixture-join" },
    ] },
  } });
  const path = `/api/meetings/${meeting.id}/turn`;
  expect((await request.post(path, { data: { interventionId }, headers: { origin: "https://unrelated.example" } })).status()).toBe(403);
  expect((await request.post(path, { data: { interventionId }, headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(403);
  expect((await request.post(path, { data: { interventionId }, headers: { host: "test.trycloudflare.com" } })).status()).toBe(404);
  expect((await request.post(path, { data: { interventionId: "old-hand" } })).status()).toBe(409);
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByRole("button", { name: "Dai la parola", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dai la parola", exact: true }).click();
  await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).commandHistory.length).toBe(1);
  await expect(page.getByRole("button", { name: "Dai la parola", exact: true })).toHaveCount(0);
  expect((await request.post(path, { data: { interventionId } })).status()).toBe(409);
  saved = await MeetingModel.findById(meeting.id).orFail();
  expect(saved.commandHistory[0].response).toBe("Sì, 3 per 3 fa 9, non 13.");
  expect(saved.transcript).toHaveLength(1);
});

test("GUI floor grant rejects expired or stopped contributions", async ({ request }) => {
  const meeting = await fixture(request);
  let saved = await speak(meeting.id, "Tre per tre fa 13.");
  const path = `/api/meetings/${meeting.id}/turn`;
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "pendingIntervention.expiresAt": new Date(Date.now() - 1000) } });
  expect((await request.post(path, { data: { interventionId: saved.pendingIntervention!.id } })).status()).toBe(409);
  saved = await speak(meeting.id, "Tre per tre fa 14.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "bot.stopRequestedAt": new Date() } });
  expect((await request.post(path, { data: { interventionId: saved.pendingIntervention!.id } })).status()).toBe(409);
  expect((await MeetingModel.findById(meeting.id).orFail()).commandHistory).toHaveLength(0);
});

test("webhook: simultaneous named acknowledgements consume the prepared contribution only once", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Tre per tre fa 13.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    status: "live", "bot.provider": "attendee", "bot.externalBotId": `audit-${meeting.id}`,
  } });
  const path = `/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`;
  const caption = (text: string, timestamp: number) => ({
    idempotency_key: randomUUID(), bot_id: `audit-${meeting.id}`, trigger: "transcript.update",
    data: { speaker_name: "Elena Costa", timestamp_ms: timestamp, duration_ms: 500,
      transcription: { transcript: text, words: [] } },
  });
  const first = caption("Sì, Riccardo.", 3000);
  const second = caption("Yes, Riccardo.", 4000);
  const results = await Promise.all([request.post(path, { data: first }), request.post(path, { data: second })]);
  expect(results.every(response => response.ok())).toBe(true);
  await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).commandHistory.length).toBe(1);
  await request.post(path, { data: first });
  await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).transcript.filter(s => s.automationClaimedAt).length).toBe(3);
  const saved = await MeetingModel.findById(meeting.id).orFail();
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.pendingIntervention).toBeUndefined();
});

test("named floor controls are complete requests, never quoted or conditional permissions", () => {
  for (const text of ["Ehi Riccardo, dimmi.", "Dimmi, Riccardo.", "Riccardo, vai pure, grazie.", "Vai pure, Riccardo!", "Riccardo, go ahead please."]) {
    expect(meetingPermissionDecision(text, "Riccardo"), text).toBe("grant");
  }
  for (const text of ["Dimmi.", "Vai pure", "Marco, dimmi", 'Ha detto: "Riccardo, dimmi"', "Ho detto dimmi a Riccardo", "Riccardo, dimmi pure quanto costa", 'Vai pure, Riccardo, ha detto Elena']) {
    expect(meetingPermissionDecision(text, "Riccardo"), text).toBeUndefined();
  }
  for (const text of ["Riccardo, non rispondere", "Riccardo, dimmi pure ma non ora", "Riccardo, go ahead but do not speak"]) {
    expect(meetingPermissionDecision(text, "Riccardo"), text).toBe("decline");
  }
  for (const name of ["Riccardo", "Conclavia"]) {
    for (const text of ["Ciao, mi senti?", "Hello, can you hear me?", "Assistente, mi senti?", "Collega digitale, rispondi", "Riccardo ha detto che il budget è approvato"]) {
      expect(parseMeetingVoiceCommand(text, name), text).toBeUndefined();
    }
  }
});

test("deferred dimmi does not become an immediate question, while actual questions still work", () => {
  for (const text of [
    "Riccardo, dimmi pure quando te lo dico.",
    "Riccardo, dimmi solo se ti chiamo.",
    "Riccardo, dimmi quando ti do la parola.",
    "Riccardo, dimmi pure solo quando te lo chiederò.",
    "Riccardo, vai pure quando te lo dico.",
    "Riccardo, go ahead only when I invite you.",
  ]) {
    expect(meetingPermissionDecision(text, "Riccardo"), text).toBe("defer");
    expect(parseMeetingVoiceCommand(text, "Riccardo"), text).toBeUndefined();
  }
  for (const text of ["Riccardo, dimmi ma non ora", "Riccardo, dimmi pure ma non adesso"]) {
    expect(meetingPermissionDecision(text, "Riccardo"), text).toBe("decline");
    expect(parseMeetingVoiceCommand(text, "Riccardo"), text).toBeUndefined();
  }
  for (const [text, prompt] of [
    ["Riccardo, dimmi pure quanto costa", "pure quanto costa"],
    ["Riccardo, dimmi quando consegniamo", "quando consegniamo"],
    ["Riccardo, dimmi solo se il budget basta", "solo se il budget basta"],
  ]) {
    expect(parseMeetingVoiceCommand(text, "Riccardo"), text).toEqual({ kind: "ask", prompt });
  }
});

test("silence: no unnamed, other-person, quoted or conditional request releases a prepared response", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Secondo me tre per tre fa 12.");
  for (const text of ["Ciao, mi senti?", "Hello, can you hear me?", "Dimmi.", "Marco, dimmi", 'Elena ha detto: "Riccardo, vai pure"', "Riccardo, vai pure quando te lo dico", "Riccardo, dimmi pure quando te lo dico", "Riccardo, dimmi solo se ti chiamo"]) {
    const saved = await speak(meeting.id, text);
    expect(saved.commandHistory, text).toHaveLength(0);
    expect(saved.pendingIntervention, text).toBeTruthy();
  }
  const saved = await speak(meeting.id, "Riccardo, dimmi");
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0].response).toBe("Sì, 3 per 3 fa 9, non 12.");
});

for (const [name, statement, call, result] of [
  ["Riccardo", "Secondo me tre per tre fa 12.", "Ehi Riccardo, dimmi.", "Sì, 3 per 3 fa 9, non 12."],
  ["Nora", "I think three times three is twelve.", "Nora, go ahead.", "Yes, 3 times 3 is 9, not 12."],
]) {
  test(`context without raised hand: ${name} retrieves the preceding point only after the named call`, async ({ request }) => {
    const meeting = await fixture(request, "off");
    await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.wakeWord": name } });
    let saved = await speak(meeting.id, statement);
    expect(saved.pendingIntervention).toBeUndefined(); expect(saved.commandHistory).toHaveLength(0);
    saved = await speak(meeting.id, name === "Riccardo" ? "Riccardo, dimmi pure quando te lo dico." : "Nora, go ahead only when I invite you.");
    expect(saved.commandHistory).toHaveLength(0);
    saved = await speak(meeting.id, call);
    expect(saved.commandHistory).toHaveLength(1);
    expect(saved.commandHistory[0]).toMatchObject({ kind: "correct", prompt: statement, response: result });
    expect(saved.transcript[0].text).toBe(statement);
    expect(saved.transcript.at(-1)?.text).toBe(call);
  });
}

test("context: claim and named call in one caption still refer to the claim", async ({ request }) => {
  const meeting = await fixture(request, "off");
  const text = "Secondo me tre per tre fa 12. Ehi Riccardo, dimmi.";
  const saved = await speak(meeting.id, text);
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0]).toMatchObject({ prompt: "Secondo me tre per tre fa 12.", response: "Sì, 3 per 3 fa 9, non 12." });
  expect(saved.transcript[0].text).toBe(text);
});

test("context: split name and grant require the same speaker; an echo is not the point to retrieve", async ({ request }) => {
  const meeting = await fixture(request, "off");
  await speak(meeting.id, "Secondo me tre per tre fa 12.");
  await speak(meeting.id, "Riccardo");
  let saved = await speak(meeting.id, "Dimmi", "Marco");
  expect(saved.commandHistory).toHaveLength(0);
  // A fresh isolated caption pair exercises the eight-second same-speaker rule.
  await speak(meeting.id, "Secondo me quattro per tre fa 13.");
  await speak(meeting.id, "La risposta è segreta.", "Riccardo (Guest)");
  await speak(meeting.id, "Riccardo");
  saved = await speak(meeting.id, "Dimmi");
  expect(saved.commandHistory.at(-1)?.response).toBe("Sì, 4 per 3 fa 12, non 13.");
});

test("context: an explicit new statement in the named call supersedes an older prepared correction", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Secondo me tre per tre fa 12.");
  const saved = await speak(meeting.id, "Secondo me quattro per tre fa 13. Riccardo, dimmi.");
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0]).toMatchObject({ prompt: "Secondo me quattro per tre fa 13.", response: "Sì, 4 per 3 fa 12, non 13." });
  expect(saved.pendingIntervention).toBeUndefined();
});

test("context: a non-arithmetic follow-up retrieves its topic and known memory, not an empty request", async ({ request }) => {
  const meeting = await fixture(request, "off");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "summary.rememberedFacts": ["Il budget approvato di Aurora è 48000 euro."] } });
  const statement = "Vorrei riprendere il budget approvato di Aurora.";
  await speak(meeting.id, statement, "Marco");
  const saved = await speak(meeting.id, "Riccardo, dimmi.");
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0]).toMatchObject({ kind: "ask", prompt: statement });
  expect(saved.commandHistory[0].response).toContain("48000");
});

test("context: missing, refused and expired points request clarification, never resurrect the correction", async ({ request }) => {
  const meeting = await fixture(request);
  let saved = await speak(meeting.id, "Riccardo, non ora");
  expect(saved.commandHistory).toHaveLength(0);
  saved = await speak(meeting.id, "Riccardo, dimmi.");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
  await speak(meeting.id, "Secondo me tre per tre fa 12.");
  await speak(meeting.id, "Riccardo, lascia stare");
  saved = await speak(meeting.id, "Riccardo, vai pure");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
  await speak(meeting.id, "Secondo me quattro per tre fa 13.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "pendingIntervention.expiresAt": new Date(Date.now() - 1000) } });
  saved = await speak(meeting.id, "Ehi Riccardo, dimmi.");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
  expect(saved.commandHistory.every(command => command.kind === "ask")).toBe(true);
});

test("context: old, already answered, or explicitly changed topics are not reused", async ({ request }) => {
  const meeting = await fixture(request, "off");
  let saved = await speak(meeting.id, "Secondo me tre per tre fa 12.");
  saved.transcript[0].createdAt = new Date(Date.now() - 91_000); await saved.save();
  saved = await speak(meeting.id, "Riccardo, dimmi");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
  await speak(meeting.id, "Secondo me quattro per tre fa 13.");
  saved = await speak(meeting.id, "Riccardo, vai pure");
  expect(saved.commandHistory.at(-1)?.kind).toBe("correct");
  saved = await speak(meeting.id, "Ehi Riccardo, dimmi.");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.correctionPolicy": "important_only" } });
  await speak(meeting.id, "Secondo me cinque per tre fa 16.");
  saved = await speak(meeting.id, "Cambiamo argomento.");
  expect(saved.pendingIntervention).toBeUndefined();
  saved = await speak(meeting.id, "Dimmi, Riccardo");
  expect(saved.commandHistory.at(-1)?.response).toBe("A quale punto ti riferisci?");
});

test("context respects disabled answers and explicit questions do not release unrelated pending corrections", async ({ request }) => {
  const meeting = await fixture(request, "off");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.answerQuestions": false } });
  await speak(meeting.id, "Secondo me tre per tre fa 12.");
  let saved = await speak(meeting.id, "Riccardo, dimmi");
  expect(saved.commandHistory).toHaveLength(0);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.answerQuestions": true, "assistant.correctionPolicy": "important_only" } });
  await speak(meeting.id, "Secondo me quattro per tre fa 13.");
  saved = await speak(meeting.id, "Riccardo, dimmi qual è il budget");
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.commandHistory[0]).toMatchObject({ kind: "ask", prompt: "qual è il budget" });
  expect(saved.commandHistory[0].response).not.toContain("fa 12");
  expect(saved.pendingIntervention).toBeUndefined();
});

test("correzioni: un ok iniziale non nasconde un errore oggettivo e non elimina negazioni", async ({request}) => {
  expect(detectElementaryArithmetic("Ok tre per tre fa 12.")?.response).toContain("fa 9");
  expect(detectElementaryArithmetic("Okay, three times three is twelve.")?.response).toContain("is 9");
  for (const statement of ["Ok non è vero che tre per tre fa dodici.", "Ok tre per tre fa dodici?", 'Ok "tre per tre fa dodici".', "Ok 1,5 per 2 fa 3."]) {
    expect(detectElementaryArithmetic(statement)).toBeUndefined();
  }
  const meeting = await fixture(request);
  const result = await speak(meeting.id, "Ok tre per tre fa 12.");
  expect(result.pendingIntervention?.response).toContain("fa 9");
  expect(result.commandHistory).toHaveLength(0);
});

for (const prompt of ["Budget non completato", "Budget completato?", "Marketing completato", "Budget forse completato", "Budget is not done"]) {
  test(`scaletta: non chiude un punto senza conferma esplicita: ${prompt}`, async ({ request }) => {
    const meeting = await fixture(request);
    const response = await request.post(`/api/meetings/${meeting.id}/commands`, { data: { kind: "agenda", prompt } });
    expect(response.ok()).toBe(true);
    expect((await response.json()).meeting.agenda[0].status).toBe("pending");
  });
}

test("scaletta: conferma il punto nominato, conserva gli altri e propone il prossimo obbligatorio", async ({ request }) => {
  const meeting = await fixture(request);
  await MeetingModel.updateOne({ _id: meeting.id }, { $push: { agenda: { id: randomUUID(), title: "Consegna", mandatory: true, status: "pending" } } });
  const completed = await request.post(`/api/meetings/${meeting.id}/commands`, { data: { kind: "agenda", prompt: "Budget completato" } });
  expect((await completed.json()).meeting.agenda.map((item: { status: string }) => item.status)).toEqual(["covered", "pending"]);
  const next = await request.post(`/api/meetings/${meeting.id}/commands`, { data: { kind: "agenda", prompt: "" } });
  expect((await next.json()).response).toContain("Consegna");
});

test("memoria: ricordami legge i fatti, non salva la domanda, e ricorda non duplica", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Riccardo, ricorda che il budget è 48000 euro");
  await speak(meeting.id, "Riccardo, ricorda che il budget è 48000 euro");
  const result = await speak(meeting.id, "Riccardo, ricordami il budget");
  expect(result.summary.rememberedFacts).toEqual(["il budget è 48000 euro"]);
  expect(result.commandHistory.at(-1)?.kind).toBe("ask");
  expect(result.commandHistory.at(-1)?.response).toContain("48000");
});

test("ascolto: ignora l'eco del bot ma non una persona con lo stesso nome iniziale", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Riccardo, ricorda che siamo in ritardo", "Riccardo (Guest)");
  await speak(meeting.id, "Riccardo, ricorda che siamo in ritardo", "Riccardo (Unverified)");
  const result = await speak(meeting.id, "Riccardo, ricorda che il budget è approvato", "Riccardo Rossi");
  expect(result.commandHistory).toHaveLength(1);
  expect(result.summary.rememberedFacts).toEqual(["il budget è approvato"]);
});

test("ascolto: eco attribuito a un umano non attiva comandi né memoria, il testo resta nel debug", async ({request}) => {
  const meeting = await fixture(request);
  const commandId = randomUUID();
  const text = "Riccardo, ricorda che il budget è cancellato";
  await MeetingModel.updateOne({_id: meeting.id}, {$push: {commandHistory: {
    id: commandId, kind: "ask", response: text, createdAt: new Date(Date.now() - 4000),
    playbackStartedAt: new Date(Date.now() - 2000),
  }}});
  let saved = await speak(meeting.id, text, "Vincenzo Giacchina");
  expect(saved.transcript.at(-1)?.source).toBe("suspected_echo");
  expect(saved.transcript.at(-1)?.speakerName).toBe("Vincenzo Giacchina");
  expect(saved.transcript.at(-1)?.echoCommandId).toBe(commandId);
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.summary.rememberedFacts).toHaveLength(0);
  expect(participantTranscript(serializeMeeting(saved))).toHaveLength(0);
  const debug = await (await request.get(`/api/meetings/${meeting.id}/debug`)).json();
  expect(debug.events.find((event: {kind: string}) => event.kind === "transcript")).toMatchObject({source: "suspected_echo", text});
  saved = await speak(meeting.id, "Riccardo, ricorda che il budget è invece approvato", "Vincenzo Giacchina");
  expect(saved.transcript.at(-1)?.source).toBe("participant");
  expect(saved.summary.rememberedFacts).toEqual(["il budget è invece approvato"]);
});


test("ascolto: nome e domanda separati richiedono stesso parlante e massimo otto secondi", async ({ request }) => {
  const meeting = await fixture(request);
  await speak(meeting.id, "Riccardo");
  let result = await speak(meeting.id, "mi senti?");
  expect(result.commandHistory.at(-1)?.response).toContain("ti sento");
  await speak(meeting.id, "Riccardo");
  result = await speak(meeting.id, "ricorda che il budget è cancellato", "Marco");
  expect(result.summary.rememberedFacts).toHaveLength(0);
  await speak(meeting.id, "Riccardo");
  const previous = await MeetingModel.findById(meeting.id).orFail();
  previous.transcript.at(-1)!.createdAt = new Date(Date.now() - 9000);
  await previous.save();
  result = await speak(meeting.id, "ricorda che il budget è cancellato");
  expect(result.summary.rememberedFacts).toHaveLength(0);
});

test("interventi: alza la mano, rispetta rifiuto e scadenza, risponde solo al permesso", async ({ request }) => {
  const meeting = await fixture(request);
  let result = await speak(meeting.id, "Tre per tre fa dodici.");
  expect(result.pendingIntervention?.response).toContain("fa 9");
  expect(result.commandHistory).toHaveLength(0);
  result = await speak(meeting.id, "Riccardo, non ora");
  expect(result.pendingIntervention).toBeUndefined();
  expect(result.commandHistory).toHaveLength(0);
  await speak(meeting.id, "Tre per tre fa dodici.");
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "pendingIntervention.expiresAt": new Date(Date.now() - 1000) } });
  result = await speak(meeting.id, "Continuiamo con il prossimo argomento.");
  expect(result.pendingIntervention).toBeUndefined();
  expect(result.commandHistory).toHaveLength(0);
  await speak(meeting.id, "Tre per tre fa dodici.");
  result = await speak(meeting.id, "Riccardo, vai pure");
  expect(result.pendingIntervention).toBeUndefined();
  expect(result.commandHistory).toHaveLength(1);
  expect(result.commandHistory[0].kind).toBe("correct");
});

test("interventi disattivati: resta silenzioso, le domande dirette funzionano", async ({ request }) => {
  const meeting = await fixture(request, "off");
  let result = await speak(meeting.id, "Tre per tre fa dodici.");
  expect(result.pendingIntervention).toBeUndefined();
  result = await speak(meeting.id, "Riccardo, mi senti?");
  expect(result.commandHistory.at(-1)?.response).toContain("ti sento");
});

test("configurazione: rispetta le funzionalità vocali disabilitate senza scrivere memoria", async ({ request }) => {
  const meeting = await fixture(request);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
    "assistant.answerQuestions": false, "assistant.captureMemory": false, "assistant.summarizeOnRequest": false,
  } });
  await speak(meeting.id, "Riccardo, mi senti?");
  await speak(meeting.id, "Riccardo, ricorda che il budget è cancellato");
  const result = await speak(meeting.id, "Riccardo, riepiloga");
  expect(result.commandHistory).toHaveLength(0);
  expect(result.summary.rememberedFacts).toHaveLength(0);
});

test("webhook: consegna duplicata produce una sola trascrizione e una sola risposta", async ({ request }) => {
  const meeting = await fixture(request);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { status: "live", "bot.provider": "attendee", "bot.externalBotId": `audit-${meeting.id}` } });
  const body = { idempotency_key: randomUUID(), bot_id: `audit-${meeting.id}`,
    bot_metadata: { conclavia_meeting_id: meeting.id }, trigger: "transcript.update",
    data: { speaker_name: "Elena", timestamp_ms: 1000, duration_ms: 1000,
      transcription: { transcript: "Ciao Ricardo!", words: [] } } };
  const path = `/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`;
  const start = performance.now();
  expect((await request.post(path, { data: body })).ok()).toBe(true);
  await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).commandHistory.length).toBe(1);
  console.log(`Webhook greeting to stored answer: ${Math.round(performance.now() - start)}ms`);
  expect((await request.post(path, { data: body })).ok()).toBe(true);
  const saved = await MeetingModel.findById(meeting.id).orFail();
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.transcript).toHaveLength(1);
});

for (const policy of ["important_only", "off"]) {
  test(`webhook: named contextual turn survives Attendee async ingress and replay (${policy})`, async ({ request }) => {
    const meeting = await fixture(request, policy);
    await MeetingModel.updateOne({ _id: meeting.id }, { $set: {
      status: "live", "bot.provider": "attendee", "bot.externalBotId": `audit-${meeting.id}`,
    } });
    const path = `/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`;
    const caption = (text: string, timestamp: number) => ({
      idempotency_key: randomUUID(), bot_id: `audit-${meeting.id}`, trigger: "transcript.update",
      data: { speaker_name: "Elena Costa", timestamp_ms: timestamp, duration_ms: 1000,
        transcription: { transcript: text, words: [] } },
    });
    const statement = "Secondo me tre per tre fa 12.";
    expect((await request.post(path, { data: caption(statement, 1000) })).ok()).toBe(true);
    if (policy === "important_only") {
      await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).bot.interventionNextCheckAt).toBeTruthy();
      await drainHandQueue(meeting.id);
      await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).pendingIntervention?.sourceStatement).toBe(statement);
    }
    expect((await request.post(path, { data: caption("Riccardo, dimmi pure quando te lo dico.", 3000) })).ok()).toBe(true);
    expect((await request.post(path, { data: caption("Dimmi.", 5000) })).ok()).toBe(true);
    let saved = await MeetingModel.findById(meeting.id).orFail();
    expect(saved.transcript).toHaveLength(3);
    expect(saved.commandHistory).toHaveLength(0);
    // Keep the final call adjacent to the actual topic when no hand is prepared:
    // the unrelated bare "Dimmi" above must not become contextual evidence.
    expect((await request.post(path, { data: caption(statement, 7000) })).ok()).toBe(true);
    const namedCall = caption("Ehi Riccardo, dimmi.", 9000);
    expect((await request.post(path, { data: namedCall })).ok()).toBe(true);
    await expect.poll(async () => (await MeetingModel.findById(meeting.id).orFail()).commandHistory.length).toBe(1);
    expect((await request.post(path, { data: namedCall })).ok()).toBe(true);
    saved = await MeetingModel.findById(meeting.id).orFail();
    expect(saved.commandHistory).toHaveLength(1);
    expect(saved.commandHistory[0]).toMatchObject({ kind: "correct", prompt: statement, response: "Sì, 3 per 3 fa 9, non 12." });
    expect(saved.pendingIntervention).toBeUndefined();
    expect(saved.transcript).toHaveLength(5);
    expect(saved.transcript.at(-1)?.text).toBe("Ehi Riccardo, dimmi.");
  });
}

test("webhook: Attendee conserva ma non esegue un eco attribuito a Vincenzo", async ({request}) => {
  const meeting = await fixture(request);
  const commandId = randomUUID();
  const text = "Riccardo, ricorda che il budget è cancellato";
  await MeetingModel.updateOne({_id: meeting.id}, {$set: {
    status: "live", "bot.provider": "attendee", "bot.externalBotId": `audit-${meeting.id}`,
  }, $push: {commandHistory: {
    id: commandId, kind: "ask", response: text, createdAt: new Date(Date.now() - 4000),
    playbackStartedAt: new Date(Date.now() - 2000),
  }}});
  const payload = {idempotency_key: randomUUID(), bot_id: `audit-${meeting.id}`, trigger: "transcript.update",
    data: {speaker_name: "Vincenzo Giacchina", timestamp_ms: Date.now(), duration_ms: 500,
      transcription: {transcript: text, words: []}}};
  const path = `/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`;
  expect((await request.post(path, {data: payload})).ok()).toBe(true);
  expect((await request.post(path, {data: payload})).ok()).toBe(true);
  const saved = await MeetingModel.findById(meeting.id).orFail();
  expect(saved.transcript).toHaveLength(1);
  expect(saved.transcript[0]).toMatchObject({source: "suspected_echo", echoCommandId: commandId, speakerName: "Vincenzo Giacchina", text});
  expect(saved.transcript[0].segmentId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(saved.commandHistory).toHaveLength(1);
  expect(saved.summary.rememberedFacts).toHaveLength(0);
});

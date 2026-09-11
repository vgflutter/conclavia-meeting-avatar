import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { detectElementaryArithmetic, meetingPermissionDecision, parseMeetingVoiceCommand } from "../../src/lib/meeting-command";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import { participantTranscript } from "../../src/lib/meeting-transcript-source";
import { serializeMeeting } from "../../src/lib/serialize-meeting";

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

async function speak(id: string, text: string, speakerName = "Elena Costa") {
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
  return MeetingModel.findById(id).orFail();
}

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

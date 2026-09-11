import { expect, test, type APIRequestContext } from "@playwright/test";
import { meetingPermissionDecision, selectMeetingMemory } from "../../src/lib/meeting-command";
import { meetingSpeechLanguage, splitMeetingSpeech } from "../../src/lib/meeting-speech";
import { installVoiceProbe, voiceProbeStats } from "./voice-probe";

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

async function createMeeting(request: APIRequestContext) {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Reliability ${crypto.randomUUID()}`,
    objective: "Confermare budget e prossimi passi",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/reliability-test",
    scheduledStart: new Date().toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "auto", autoJoin: false,
    correctionPolicy: "important_only", agenda: [{title: "Budget", mandatory: true}],
  }});
  expect(response.status()).toBe(201);
  return (await response.json()).meeting;
}

async function cleanupMeeting(request: APIRequestContext, id: string) {
  const current = await request.get(`/api/meetings/${id}`);
  const meeting = current.ok() ? (await current.json()).meeting : undefined;
  if (meeting?.bot.externalBotId === `test-${id}` && !meeting.bot.leftAt) {
    await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
      idempotency_key: crypto.randomUUID(), bot_id: `test-${id}`, trigger: "bot.state_change",
      data: { new_state: "ended", created_at: new Date().toISOString() },
    }});
    await expect.poll(async () => (await (await request.get(`/api/meetings/${id}`)).json()).meeting.status).toBe("completed");
  }
  let response = await request.delete(`/api/meetings/${id}`);
  if (response.status() === 409) {
    await request.post(`/api/meetings/${id}/outcome`, {data: {
      overview: "Sessione E2E terminata", rememberedFacts: [], decisions: [], actionItems: [], openQuestions: [],
    }});
    response = await request.delete(`/api/meetings/${id}`);
  }
  expect([200, 404]).toContain(response.status());
}

async function webhook(request: APIRequestContext, meeting: {id: string; bot: {outputToken: string}}, text: string, timestamp: number) {
  const response = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, {data: {
    idempotency_key: crypto.randomUUID(), bot_id: `test-${meeting.id}`,
    bot_metadata: {conclavia_meeting_id: meeting.id}, trigger: "transcript.update",
    data: {speaker_name: "Partecipante test", timestamp_ms: timestamp, duration_ms: 1000,
      transcription: {transcript: text, words: []}},
  }});
  expect(response.ok()).toBeTruthy();
}

test("affidabilità: recupera tutti i comandi tra due letture del video", async ({request}) => {
  const meeting = await createMeeting(request);
  try {
    for (const prompt of ["Il budget è approvato", "Il lancio è il 15 ottobre"]) {
      const response = await request.post(`/api/meetings/${meeting.id}/commands`, {data: {kind: "remember", prompt}});
      expect(response.ok()).toBeTruthy();
    }
    const response = await request.get(`/api/meeting-room/${meeting.bot.outputToken}/state?after=`);
    const state = await response.json();
    expect(state.commands).toHaveLength(2);
    expect(new Set(state.commands.map((command: {id: string}) => command.id)).size).toBe(2);
    const next = await request.get(`/api/meeting-room/${meeting.bot.outputToken}/state?after=${state.commands[0].id}`);
    expect((await next.json()).commands.map((command: {id: string}) => command.id)).toEqual([state.commands[1].id]);
  } finally { await cleanupMeeting(request, meeting.id); }
});

test("affidabilità: una correzione certa alza la mano anche dopo un altro controllo", async ({request}) => {
  const meeting = await createMeeting(request);
  try {
    await webhook(request, meeting, "Il team sta preparando la proposta per il prossimo incontro.", 1000);
    await expect.poll(async () => {
      const r = await request.get(`/api/meetings/${meeting.id}`);
      return Boolean((await r.json()).meeting.transcript.length);
    }).toBe(true);
    await webhook(request, meeting, "Tre per tre fa dodici.", 3000);
    const stateUrl = `/api/meeting-room/${meeting.bot.outputToken}/state`;
    await expect.poll(async () => (await (await request.get(stateUrl)).json()).pendingIntervention?.type).toBe("correction");
    const waiting = await (await request.get(stateUrl)).json();
    expect(waiting.command).toBeUndefined();
    expect(waiting.pendingIntervention.response).toContain("fa 9");
    await webhook(request, meeting, `${meeting.assistant.wakeWord}, vai pure`, 5000);
    await expect.poll(async () => (await (await request.get(stateUrl)).json()).command?.kind).toBe("correct");
    expect((await (await request.get(stateUrl)).json()).pendingIntervention).toBeUndefined();
  } finally { await cleanupMeeting(request, meeting.id); }
});

test("affidabilità: chiude il meeting anche se era già stato chiesto un riepilogo", async ({request}) => {
  const meeting = await createMeeting(request);
  try {
    await request.post(`/api/meetings/${meeting.id}/commands`, {data: {kind: "summary"}});
    const result = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, {data: {
      idempotency_key: crypto.randomUUID(), bot_id: `test-${meeting.id}`,
      bot_metadata: {conclavia_meeting_id: meeting.id}, trigger: "bot.state_change",
      data: {new_state: "ended", created_at: new Date().toISOString()},
    }});
    expect(result.ok()).toBeTruthy();
    await expect.poll(async () => (await (await request.get(`/api/meetings/${meeting.id}`)).json()).meeting.status).toBe("completed");
  } finally { await cleanupMeeting(request, meeting.id); }
});

test("affidabilità: il divieto di parlare non concede la parola", () => {
  expect(meetingPermissionDecision("Riccardo, non puoi parlare adesso", "Riccardo")).toBe("decline");
  expect(meetingPermissionDecision("Riccardo, don't speak yet", "Riccardo")).toBe("decline");
});

test("voce: prepara frasi brevi preservando numeri e riconosce la lingua", () => {
  const text = "Il budget è 12.500 euro. La consegna è fissata al 15 ottobre, dopo la verifica finale.";
  expect(splitMeetingSpeech(text).join(" ")).toBe(text);
  expect(splitMeetingSpeech("Una frase lunga ".repeat(40), 160).every((part) => part.length <= 160)).toBe(true);
  expect(meetingSpeechLanguage("Yes, the budget was approved. We can continue.", "it")).toBe("en");
  expect(meetingSpeechLanguage("Il budget è approvato. Il prossimo punto è la consegna.", "en")).toBe("it");
});

for (const appearance of ["business_clay", "business_clay_female"]) for (const cpuOnly of [false, true]) {
test(`streaming simulato ${appearance}${cpuOnly ? " senza GPU" : ""}: attende il permesso e completa due risposte ravvicinate`, async ({page, request}) => {
  test.setTimeout(300_000);
  await installVoiceProbe(page);
  await page.addInitScript(() => {
    // The fixture tests output only: never access a real microphone.
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Test input disabled", "NotAllowedError"); };
  });
  if (cpuOnly) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", {value: undefined, configurable: true});
    });
  }
  const meeting = await createMeeting(request);
  const { profile } = await (await request.get("/api/avatar")).json();
  const profileBody = { displayName: profile.displayName, role: profile.role,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate };
  try {
    expect((await request.patch("/api/avatar", { data: { ...profileBody, appearance } })).status()).toBe(200);
    await page.context().addCookies([{name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101"}]);
    const joined = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, {data: {
      idempotency_key: crypto.randomUUID(), bot_id: `test-${meeting.id}`,
      bot_metadata: {conclavia_meeting_id: meeting.id}, trigger: "bot.state_change",
      data: {new_state: "joined_recording", created_at: new Date().toISOString()},
    }});
    expect(joined.ok()).toBeTruthy();
    await page.goto(`/meeting-room/${meeting.bot.outputToken}?mode=meeting`);
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-appearance", appearance);
    await expect(page.locator("[data-voice-state]")).toBeVisible();
    await webhook(request, meeting, "Tre per tre fa dodici.", 1000);
    await expect(page.locator("svg[data-gesture='hand_raise']")).toBeVisible();
    expect((await voiceProbeStats(page)).playbacks).toHaveLength(0);
    await expect(page.locator("[data-speaking='false']")).toBeVisible();
    const started = performance.now();
    await webhook(request, meeting, `${meeting.assistant.wakeWord}, vai pure`, 3000);
    await expect(page.locator("[data-speaking='true']")).toBeVisible({timeout: 5000});
    const latencyMs = Math.round(performance.now() - started);
    console.log(`Prepared correction to audio: ${latencyMs}ms`);
    expect(latencyMs).toBeLessThan(3000);
    await expect(page.locator("[data-spoken-command]")).toBeVisible({timeout: 15000});

    await page.evaluate(() => {
      const completed: string[] = [];
      Object.assign(window, {completedCommands: completed});
      const surface = document.querySelector("[data-voice-state]")!;
      new MutationObserver(() => {
        const id = surface.getAttribute("data-spoken-command");
        if (id && !completed.includes(id)) completed.push(id);
      }).observe(surface, {attributes: true, attributeFilter: ["data-spoken-command"]});
    });
    const ids: string[] = [];
    for (const prompt of ["Budget approvato", "Consegna confermata"]) {
      const response = await request.post(`/api/meetings/${meeting.id}/commands`, {data: {kind: "remember", prompt}});
      expect(response.ok()).toBeTruthy();
      ids.push((await response.json()).meeting.commandHistory.at(-1).id);
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as {completedCommands: string[]}).completedCommands), {timeout: 60_000}).toEqual(ids);
    await expect(page.locator("[data-voice-state='ready']")).toBeVisible();
    const stats = await voiceProbeStats(page);
    expect(stats.playbacks).toHaveLength(3);
    expect(stats.playbacks.every((audio) => audio.ended && audio.seconds > 0)).toBe(true);
  } finally {
    await page.goto("about:blank");
    await cleanupMeeting(request, meeting.id);
    await request.patch("/api/avatar", { data: { ...profileBody, appearance: profile.appearance } });
  }
});
}

test("voce: una domanda inglese in modalità automatica riceve una risposta inglese", async ({request}) => {
  const meeting = await createMeeting(request);
  try {
    const response = await request.post(`/api/meetings/${meeting.id}/commands`, {data: {kind: "ask", prompt: "Can you hear me?"}});
    expect((await response.json()).response).toMatch(/^Yes,/);
  } finally { await cleanupMeeting(request, meeting.id); }
});

test("memoria: recupera i fatti rilevanti anche oltre i primi quattordici ricordi", () => {
  const candidates = [
    ...Array.from({length: 20}, (_, i) => `Documento numero ${i + 1} archiviato`),
    "Il budget del progetto Aurora è 48000 euro.",
    "La consegna di Aurora è il 27 novembre.",
  ];
  const selected = selectMeetingMemory("Preparare la consegna del progetto Aurora e confermare il budget", candidates);
  expect(selected).toHaveLength(14);
  expect(selected.slice(0, 2)).toEqual(candidates.slice(-2));
});

test("tunnel: un host inoltrato alterato non espone le API di gestione", async ({request}) => {
  const host = "meeting-test.trycloudflare.com";
  const hostCases: Array<Record<string, string>> = [
    {host},
    {host, "x-forwarded-host": "localhost:3101"},
    {host: "localhost:3101", "x-forwarded-host": host},
    {host: "MEETING-TEST.TRYCLOUDFLARE.COM:443", "x-forwarded-host": "localhost:3101"},
  ];
  for (const headers of hostCases) {
    for (const path of ["/meetings", "/api/meetings", "/api/avatar"]) {
      expect((await request.get(path, {headers})).status()).toBe(404);
    }
    expect((await request.get("/api/health", {headers})).status()).toBe(200);
  }
  expect((await request.get("/api/meetings")).status()).toBe(200);
});

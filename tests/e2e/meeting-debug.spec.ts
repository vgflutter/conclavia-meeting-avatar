import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import type { MeetingResponse } from "../../src/types/meeting";
import type { MeetingDebugResponse } from "../../src/types/meeting-debug";

const ownedIds: string[] = [];
const origin = "http://127.0.0.1:3101";

test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated test database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});

test.afterEach(async () => {
  for (const id of ownedIds.splice(0)) {
    await MeetingModel.deleteOne({ _id: id, title: /^E2E Debug /u });
  }
});

async function createMeeting(request: APIRequestContext): Promise<MeetingResponse> {
  const response = await request.post("/api/meetings", { data: {
    title: `E2E Debug ${randomUUID()}`, objective: "Verificare la conversazione durante una prova",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/debug-${randomUUID()}`,
    scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "auto", autoJoin: false,
    correctionPolicy: "off", agenda: [],
  } });
  expect(response.status()).toBe(201);
  const meeting = (await response.json()).meeting as MeetingResponse;
  ownedIds.push(meeting.id);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { "assistant.wakeWord": "Riccardo" } });
  return meeting;
}

async function openDebug(page: Page, id: string, locale = "it") {
  await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
  await page.goto(`/meetings/${id}`);
  await page.getByRole("switch", { name: locale === "it" ? "Modalità debug" : "Debug mode" }).click();
  return page.getByRole("log");
}

async function seedTranscript(id: string, count: number) {
  await MeetingModel.updateOne({ _id: id }, { $set: { transcript: Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    speakerName: "Partecipante prova",
    text: `Intervento ${index + 1}: dettagli del progetto e prossimi passi.`,
    createdAt: new Date(Date.now() - (count - index) * 1000),
  })) } });
}

async function appendTranscript(id: string, sequence: number, text: string) {
  await MeetingModel.updateOne({ _id: id }, { $push: { transcript: {
    sequence, speakerName: "Partecipante prova", text, createdAt: new Date(),
  } } });
}

test("debug: eco sospetto non è presentato come un intervento umano certo", async ({page, request}) => {
  const meeting = await createMeeting(request);
  await MeetingModel.updateOne({_id: meeting.id}, {$push: {transcript: {
    sequence: 1, speakerName: "Vincenzo Giacchina", text: "Certo, perché il libro.",
    source: "suspected_echo", echoCommandId: randomUUID(), createdAt: new Date(),
  }}});
  const log = await openDebug(page, meeting.id);
  await expect(log.getByText("Possibile eco dell’avatar", {exact: true})).toBeVisible();
  await expect(log.getByText("Attribuzione incerta", {exact: true})).toBeVisible();
  await expect(log.getByText(/Il servizio l’ha attribuito a Vincenzo Giacchina/)).toBeVisible();
  await expect(log.getByText("Intervento", {exact: true})).toHaveCount(0);
  await expect(log.getByText("Certo, perché il libro.", {exact: true})).toBeVisible();
});

test("debug: opzionale, webhook in diretta, risposta con nome dinamico e spegnimento", async ({ page, request }) => {
  const meeting = await createMeeting(request);
  const path = `/api/meetings/${meeting.id}/debug`;
  let requests = 0;
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => { if (request.url().endsWith(path)) requests++; });
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await page.goto(`/meetings/${meeting.id}`);
  const toggle = page.getByRole("switch", { name: "Modalità debug" });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole("log")).toHaveCount(0);
  await page.waitForTimeout(1200);
  expect(requests).toBe(0);
  await toggle.click();
  const log = page.getByRole("log", { name: "Conversazione in diretta" });
  await expect(log.getByText(/Nessun intervento ricevuto/)).toBeVisible();

  const webhookResponse = await request.post(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, { data: {
    idempotency_key: randomUUID(), bot_id: `test-debug-${meeting.id}`,
    bot_metadata: { conclavia_meeting_id: meeting.id }, trigger: "transcript.update",
    data: { speaker_name: "Vincenzo", timestamp_ms: 1000, duration_ms: 1000,
      transcription: { transcript: "Il lancio è fissato a ottobre.", words: [] } },
  } });
  expect(webhookResponse.ok()).toBeTruthy();
  const storedAt = Date.now();
  await expect(log.getByText("Il lancio è fissato a ottobre.", { exact: true })).toBeVisible({ timeout: 3500 });
  console.log(`Stored transcript to debug UI: ${Date.now() - storedAt}ms`);
  await expect(log.getByText("Vincenzo", { exact: true })).toBeVisible();

  const result = await request.post(`/api/meetings/${meeting.id}/commands`, { data: { kind: "remember", prompt: "Budget approvato" } });
  expect(result.ok()).toBeTruthy();
  const answer = (await result.json()).response;
  await expect(log.getByText(answer, { exact: true })).toBeVisible();
  await expect(log.getByText("Riccardo", { exact: true })).toBeVisible();
  await expect(log.locator("time").first()).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await page.waitForResponse((response) => response.url().endsWith(path) && response.status() === 304);
  await expect(log.getByText(answer, { exact: true })).toHaveCount(1);

  // Saving through the GUI refreshes server components but must keep debug open.
  await page.getByPlaceholder("Es. Ricorda che il lancio è fissato al 15 ottobre").fill("Demo confermata");
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  await expect(log.getByText("Richiesta: Demo confermata", { exact: true })).toBeVisible();
  await expect(toggle).toBeChecked();
  await page.getByRole("region", { name: "Modalità debug" }).screenshot({ path: test.info().outputPath("meeting-debug-desktop.png") });

  await toggle.click();
  await expect(page.getByRole("log")).toHaveCount(0);
  const countAtStop = requests;
  await page.waitForTimeout(1600);
  expect(requests).toBe(countAtStop);
  const saved = await (await request.get(`/api/meetings/${meeting.id}`)).json();
  expect(saved.meeting.summary.rememberedFacts).toContain("Budget approvato");
  expect(saved.meeting.transcript).toHaveLength(1);
  await toggle.click();
  await expect(page.getByRole("log").getByRole("article").filter({ hasText: "Richiesta: Budget approvato" }).getByText(answer, { exact: true })).toBeVisible();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  expect(browserErrors).toEqual([]);
});

test("debug: endpoint limitato, ordinato, senza configurazione privata e senza cache condivisa", async ({ request }) => {
  const meeting = await createMeeting(request);
  await seedTranscript(meeting.id, 120);
  await MeetingModel.updateOne({ _id: meeting.id }, { $set: { commandHistory: [{
    id: "recent-answer", kind: "ask", prompt: "Qual è il prossimo passo?", response: "Preparare la demo.", createdAt: new Date(),
  }] } });
  const response = await request.get(`/api/meetings/${meeting.id}/debug`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const payload = await response.json() as MeetingDebugResponse;
  expect(Object.keys(payload).sort()).toEqual(["events", "hasEarlierEvents"]);
  expect(payload.events).toHaveLength(100);
  expect(payload.hasEarlierEvents).toBe(true);
  expect(payload.events[0].id).toBe("transcript-22");
  expect(payload.events.at(-1)).toMatchObject({ id: "response-recent-answer", speakerName: "Riccardo", text: "Preparare la demo." });
  const dates = payload.events.map((event) => event.createdAt);
  expect(dates).toEqual([...dates].sort());
  expect(new Set(payload.events.map((event) => event.id)).size).toBe(100);
  expect(JSON.stringify(payload)).not.toContain(meeting.bot.outputToken);
  const unchanged = await request.get(`/api/meetings/${meeting.id}/debug`, { headers: { "If-None-Match": response.headers().etag } });
  expect(unchanged.status()).toBe(304);
  expect(await unchanged.text()).toBe("");
  await appendTranscript(meeting.id, 121, "Un nuovo intervento");
  const updated = await request.get(`/api/meetings/${meeting.id}/debug`, { headers: { "If-None-Match": response.headers().etag } });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).events.at(-1).text).toBe("Un nuovo intervento");
  expect((await request.get("/api/meetings/not-an-id/debug")).status()).toBe(404);
  expect((await request.get("/api/meetings/000000000000000000000000/debug")).status()).toBe(404);
  expect((await request.get(`/api/meetings/${meeting.id}/debug`, { headers: { "x-forwarded-host": "test.trycloudflare.com" } })).status()).toBe(404);
});

test("debug: recupera dopo un errore senza perdere i messaggi già mostrati", async ({ page, request }) => {
  const meeting = await createMeeting(request);
  await seedTranscript(meeting.id, 1);
  let fail = false;
  await page.route(`**/api/meetings/${meeting.id}/debug`, async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: "Unavailable" } });
    else await route.continue();
  });
  const log = await openDebug(page, meeting.id);
  await expect(log.getByText("Intervento 1:", { exact: false })).toBeVisible();
  fail = true;
  await expect(page.getByRole("alert").filter({ hasText: "Non riusciamo ad aggiornare" })).toBeVisible();
  await expect(log.getByText("Intervento 1:", { exact: false })).toBeVisible();
  await appendTranscript(meeting.id, 2, "Connessione ripristinata");
  fail = false;
  await expect(log.getByText("Connessione ripristinata", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Non riusciamo ad aggiornare" })).toHaveCount(0);
});

test("debug: si ferma nella scheda nascosta e recupera al ritorno", async ({ page, request }) => {
  const meeting = await createMeeting(request);
  let requests = 0;
  page.on("request", (request) => { if (request.url().endsWith(`/api/meetings/${meeting.id}/debug`)) requests++; });
  const log = await openDebug(page, meeting.id);
  await expect(log.getByText(/Nessun intervento ricevuto/)).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Aggiornamenti in pausa", { exact: true })).toBeVisible();
  const atPause = requests;
  await appendTranscript(meeting.id, 1, "Messaggio durante la pausa");
  await page.waitForTimeout(1500);
  expect(requests).toBe(atPause);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(log.getByText("Messaggio durante la pausa", { exact: true })).toBeVisible();
});

test("debug: leggibile su mobile, preserva lo scorrimento e segue i nuovi messaggi a richiesta", async ({ page, request }) => {
  const meeting = await createMeeting(request);
  await seedTranscript(meeting.id, 30);
  await page.setViewportSize({ width: 390, height: 844 });
  const log = await openDebug(page, meeting.id, "en");
  await expect(log.locator("article")).toHaveCount(30);
  await expect.poll(() => log.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(48);
  await log.evaluate((node) => { node.scrollTop = 0; });
  const jump = page.getByRole("button", { name: "Jump to latest messages ↓" });
  await expect(jump).toBeVisible();
  await appendTranscript(meeting.id, 31, "https://example.test/" + "a".repeat(300));
  await expect(log.locator("article")).toHaveCount(31);
  expect(await log.evaluate((node) => node.scrollTop)).toBe(0);
  await jump.click();
  await expect.poll(() => log.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const panel = page.getByRole("region", { name: "Debug mode" });
  await panel.screenshot({ path: test.info().outputPath("meeting-debug-mobile.png") });
});

test("debug: spegnere durante una richiesta non riapre la vista e non sovrappone letture", async ({ page, request }) => {
  const meeting = await createMeeting(request);
  let reads = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/meetings/${meeting.id}/debug`, async (route) => {
    reads++;
    await pending;
    await route.fulfill({ status: 200, json: { events: [], hasEarlierEvents: false } }).catch(() => {});
  });
  await openDebug(page, meeting.id);
  await expect.poll(() => reads).toBeGreaterThan(0);
  // React Strict Mode can start and abort the initial effect before remounting it.
  // There must be no additional polling while the current read is pending.
  const readsAtStart = reads;
  await page.waitForTimeout(1500);
  expect(reads).toBe(readsAtStart);
  await page.getByRole("switch", { name: "Modalità debug" }).click();
  release();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("log")).toHaveCount(0);
  expect(reads).toBe(readsAtStart);
});

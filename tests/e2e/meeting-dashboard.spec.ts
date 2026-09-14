import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { MeetingModel } from "../../src/models/Meeting";
import { MeetingSeriesModel } from "../../src/models/MeetingSeries";
import { meetingDocumentData } from "../../src/lib/meeting-factory";
import { dashboardFilters, dashboardHref, loadMeetingDashboard } from "../../src/lib/meeting-dashboard";
import type { MeetingRecord, MeetingStatus } from "../../src/types/meeting";

const owned: string[] = [];
const ownedSeries: string[] = [];
const photoFixtures: Array<{id: string; url: string}> = [];
const prefix = "E2E Dashboard ";
const origin = "http://127.0.0.1:3101";
const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
function fixture(title: string, days: number) {
  return meetingDocumentData({ title: `${prefix}${title}`, objective: "Confermare roadmap e consegna", meetingUrl: `https://teams.microsoft.com/l/meetup-join/${randomUUID()}`,
    scheduledStart: at(days), durationMinutes: 60, timezone: "Europe/Rome", language: "it", autoJoin: false,
    agenda: [{title: "Roadmap", mandatory: true}], correctionPolicy: "important_only", seriesLabel: "Progetto Aurora",
  });
}
async function seed(title: string, days: number, status: MeetingStatus = "scheduled", extra: Partial<MeetingRecord> = {}) {
  const doc = await MeetingModel.create({...fixture(title, days), status, ...extra});
  owned.push(String(doc._id));
  return doc;
}
test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});
test.beforeEach(async ({page}) => { await page.context().addCookies([{name: "conclavia_locale", value: "it", url: origin}]); });
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({_id: id, title: new RegExp(`^${prefix}`)});
  for (const id of ownedSeries.splice(0)) await MeetingSeriesModel.deleteOne({_id: id, title: new RegExp(`^${prefix}`)});
  for (const item of photoFixtures.splice(0)) await MeetingModel.deleteOne({_id: item.id, meetingUrl: item.url});
});

test("panoramica: problemi reali separati da presenza, vecchi errori e riepiloghi", async ({page}) => {
  const live = await seed("Riunione operativa", 0, "live");
  const lobby = await seed("Ammissione richiesta", 0, "waiting_room");
  await seed("Vecchio tentativo", -3, "failed");
  await seed("Riepilogo in preparazione", -1, "processing");
  await seed("Appuntamento non svolto", -2);
  const failed = await seed("Collegamento non valido", 1, "failed");
  await page.goto(`/meetings?q=${encodeURIComponent(prefix)}`);
  const inbox = page.getByTestId("attention-inbox");
  await expect(inbox.locator("summary")).toContainText("2 richiedono un intervento");
  await expect(inbox.getByTestId("meeting-row").first()).toBeHidden();
  await inbox.locator("summary").click();
  const rows = inbox.getByTestId("meeting-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(lobby.title);
  await expect(rows.last()).toContainText(failed.title);
  await expect(page.getByTestId("meeting-list-active")).toContainText(live.title);
  await expect(inbox).not.toContainText("Riunione operativa");
  await expect(page.getByTestId("meeting-list-history")).toContainText("Vecchio tentativo");
  await expect(page.getByTestId("meeting-list-history")).toContainText("Riepilogo in preparazione");
  await expect(page.getByTestId("meeting-list-history")).toContainText("Appuntamento non svolto");
});

test("storico: 250 meeting, payload ridotto, pagine stabili e filtri persistenti", async ({page}) => {
  test.setTimeout(120_000);
  const marker = randomUUID();
  const docs = await MeetingModel.insertMany(Array.from({length: 250}, (_, index) => ({
    ...fixture(`${marker} ${index}`, -1), status: "completed",
    transcript: Array.from({length: 20}, (_, sequence) => ({sequence: sequence + 1, speakerName: "Test", text: "TRANSCRIPT_NOT_FOR_LIST ".repeat(30), createdAt: new Date()})),
    summary: {overview: `Decisione condivisa ${marker} ${"sintesi ".repeat(200)}`, rememberedFacts: [], decisions: ["Consegna approvata"], actionItems: [], openQuestions: [], participantNotes: []},
  })));
  owned.push(...docs.map((doc) => String(doc._id)));
  const filters = dashboardFilters({view: "history", q: marker, state: "completed"});
  const first = await loadMeetingDashboard(filters);
  const second = await loadMeetingDashboard({...filters, page: 2});
  expect(first.counts.history).toBe(250);
  expect(first.history).toHaveLength(20);
  expect(second.history).toHaveLength(20);
  expect(new Set([...first.history, ...second.history].map((item) => item.id)).size).toBe(40);
  expect(JSON.stringify(first)).not.toMatch(/TRANSCRIPT_NOT_FOR_LIST|outputToken|commandHistory|meetingUrl/);
  expect(JSON.stringify(first).length).toBeLessThan(20_000);
  expect(first.history.every((item) => !("overview" in item) && !("summary" in item))).toBe(true);
  // Summary text is still searchable in storage, but never included in list rows.
  expect((await loadMeetingDashboard({...filters, q: `Decisione condivisa ${marker}`})).counts.history).toBe(250);
  await page.goto(dashboardHref(filters));
  await expect(page.getByTestId("meeting-row")).toHaveCount(20);
  await expect(page.getByRole("navigation", {name: "Paginazione meeting"})).toContainText("1–20 di 250");
  await page.getByRole("link", {name: "Successiva", exact: true}).click();
  await expect(page).toHaveURL(/state=completed.*page=2/);
  await expect(page.getByLabel("Cerca meeting")).toHaveValue(marker);
  await expect(page.getByLabel("Stato", {exact: true})).toHaveValue("completed");
  await page.goto(dashboardHref(filters, {page: 9999}));
  await expect(page.getByRole("navigation", {name: "Paginazione meeting"})).toContainText("241–250 di 250");
  await expect(page.getByTestId("meeting-row")).toHaveCount(10);
});

test("filtri: giorno locale inclusivo, date invertite e ricerca letterale", async () => {
  const doc = await seed("Filtro [speciale]", -2, "completed", {scheduledStart: new Date("2026-01-01T23:30:00Z"), scheduledEnd: new Date("2026-01-02T00:30:00Z")});
  const matching = dashboardFilters({view: "history", q: "[speciale]", from: "2026-01-02", to: "2026-01-02"});
  expect((await loadMeetingDashboard(matching)).history.map((item) => item.id)).toContain(String(doc._id));
  expect((await loadMeetingDashboard({...matching, from: "2026-01-01", to: "2026-01-01"})).history).toHaveLength(0);
  expect(dashboardFilters({from: "2026-05-10", to: "2026-05-01"})).toMatchObject({from: "2026-05-01", to: "2026-05-10"});
  expect(dashboardFilters({from: "2026-02-30", page: "-1"})).toMatchObject({from: "", page: 1});
});

test("panoramica: output interrotto richiede attenzione, avvio recente e tentativo annullato no", async () => {
  const stale = await seed("Output interrotto", 0, "live");
  const warming = await seed("Preparazione iniziale", 0, "live");
  const cancelled = await seed("Tentativo annullato", 1, "failed");
  await MeetingModel.updateOne({_id: stale._id}, {$set: {"bot.provider": "attendee", "bot.joinedAt": new Date(Date.now() - 60_000)}});
  await MeetingModel.updateOne({_id: warming._id}, {$set: {"bot.provider": "attendee", "bot.joinedAt": new Date()}});
  await MeetingModel.updateOne({_id: cancelled._id}, {$set: {"bot.failureCode": "entry_cancelled"}});
  const data = await loadMeetingDashboard(dashboardFilters({q: prefix}));
  expect(data.attention.map((item) => item.id)).toEqual([String(stale._id)]);
  expect(data.history.map((item) => item.id)).toContain(String(cancelled._id));
});

test("archiviazione: reversibile, conserva dati, blocca ingresso e partecipanti incerti", async ({page, request}) => {
  const doc = await seed("Da archiviare", -2);
  const id = String(doc._id);
  await page.goto(`/meetings?view=history&q=${encodeURIComponent(doc.title)}`);
  await expect(page.getByRole("button", {name: "Archivia", exact: true})).toHaveCount(0);
  await page.getByTestId("meeting-row").getByRole("link").click();
  await page.getByRole("button", {name: "Archivia", exact: true}).click();
  await expect(page.getByRole("button", {name: "Annulla archiviazione"})).toBeVisible();
  const archived = await MeetingModel.findById(id).lean();
  expect(archived?.archivedAt).toBeDefined();
  expect(archived?.status).toBe("scheduled");
  expect(archived?.meetingUrl).toBe(doc.meetingUrl);
  expect((await request.post(`/api/meetings/${id}/session`, {data: {action: "join"}})).status()).toBe(409);
  await page.goto(`/meetings/${id}`);
  await expect(page.getByText("Archiviato", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Annulla archiviazione"}).click();
  await expect(page.getByRole("button", {name: "Archivia", exact: true})).toBeVisible();
  expect((await MeetingModel.findById(id).lean())?.archivedAt).toBeUndefined();
  for (const botStatus of ["joined", "leaving", "scheduling", "scheduled"] as const) {
    await MeetingModel.updateOne({_id: id}, {$set: {"bot.status": botStatus}});
    expect((await request.post(`/api/meetings/${id}/archive`, {data: {archived: true}})).status()).toBe(409);
  }
  await MeetingModel.updateOne({_id: id}, {$set: {status: "failed", "bot.status": "failed", "bot.failureCode": "create_uncertain"}});
  expect((await request.post(`/api/meetings/${id}/archive`, {data: {archived: true}})).status()).toBe(409);
  const attention = await loadMeetingDashboard(dashboardFilters({view: "attention", q: doc.title}));
  expect(attention.attention.map((item) => item.id)).toContain(id);
  await page.goto(`/meetings/${id}`);
  await expect(page.getByRole("button", {name: "Archivia", exact: true})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Riprogramma", exact: true})).toHaveCount(0);
  await MeetingModel.updateOne({_id: id}, {$set: {
    "bot.status": "left", "bot.failureCode": "entry_cancelled", "bot.externalBotId": "inactive-test-participant",
    "bot.entryAttemptId": "finished-test-attempt", "bot.leftAt": new Date(), "bot.providerStatusCode": "ended",
  }});
  await page.reload();
  await expect(page.getByRole("button", {name: "Archivia", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Archivia", exact: true}).click();
  await expect(page.getByRole("button", {name: "Annulla archiviazione"})).toBeVisible();
});

test("riprogrammazione: modulo precompilato, nuova data obbligatoria e nessun ingresso automatico", async ({page, request}) => {
  const doc = await seed("Da riprogrammare", -2, "failed");
  await page.goto(`/meetings?view=history&q=${encodeURIComponent(doc.title)}`);
  await page.getByTestId("meeting-row").getByRole("link").click();
  await expect(page.getByRole("button", {name: "Archivia", exact: true})).toBeVisible();
  await page.getByRole("link", {name: "Riprogramma", exact: true}).click();
  await expect(page.getByText(/quello originale resterà nello storico/)).toBeVisible();
  await expect(page.getByLabel("Titolo del meeting")).toHaveValue(doc.title);
  await expect(page.getByLabel("Link Microsoft Teams")).toHaveValue(doc.meetingUrl);
  await expect(page.getByLabel("Data e ora", {exact: true})).toHaveValue("");
  const before = await request.get(`/api/meetings/${doc._id}`);
  expect((await before.json()).meeting.scheduledStart).toBe(doc.scheduledStart.toISOString());
  expect((await before.json()).meeting.bot.externalBotId).toBeUndefined();
  await page.getByLabel("Data e ora", {exact: true}).fill("2031-04-15T10:00");
  const createdResponse = page.waitForResponse((response) => response.url().endsWith("/api/meetings") && response.request().method() === "POST");
  await page.getByRole("button", {name: "Memorizza meeting", exact: true}).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const created = (await response.json()).meeting;
  owned.push(created.id);
  expect(created.id).not.toBe(String(doc._id));
  expect(created.autoJoin).toBe(false);
  expect(created.agenda[0].title).toBe("Roadmap");
  expect(created.seriesLabel).toBe("Progetto Aurora");
  expect(created.bot.externalBotId).toBeUndefined();
  expect((await MeetingModel.findById(doc._id))?.scheduledStart.toISOString()).toBe(doc.scheduledStart.toISOString());
});

test("serie: statistiche aggregate senza importare trascrizioni e vecchi appuntamenti", async () => {
  const template = fixture("Serie scalabile", 0);
  const series = await MeetingSeriesModel.create({ title: `${prefix}Serie scalabile`, objective: "Memoria condivisa", timezone: template.timezone, language: template.language, autoJoin: false, agenda: [], assistant: template.assistant, voice: template.voice });
  ownedSeries.push(String(series._id));
  const docs = await MeetingModel.insertMany(Array.from({length: 100}, (_, index) => ({...fixture(`Serie ${index}`, index < 99 ? -1 : 2), seriesId: series._id, status: index < 99 ? "completed" : "scheduled"})));
  owned.push(...docs.map((doc) => String(doc._id)));
  const result = await loadMeetingDashboard(dashboardFilters({view: "series", q: series.title}));
  expect(result.series).toHaveLength(1);
  expect(result.series[0]).toMatchObject({total: 100, completed: 99});
  expect(result.series[0].nextAt).toBeTruthy();
  expect(JSON.stringify(result).length).toBeLessThan(3000);
});

test("mobile e inglese: righe compatte, riepilogo prioritario e trascrizione opzionale", async ({page}) => {
  const doc = await seed("Product review", -1, "completed");
  doc.summary.overview = "The roadmap was approved. Delivery remains on schedule.";
  doc.summary.decisions = ["Approve the roadmap"];
  doc.summary.actionItems = [{description: "Prepare the demo", owner: "Alex", completed: false}];
  doc.transcript.push({sequence: 1, speakerName: "Test", text: "Optional transcript passage", createdAt: new Date()});
  await doc.save();
  await page.context().addCookies([{name: "conclavia_locale", value: "en", url: origin}]);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`/meetings?view=history&q=${encodeURIComponent(doc.title)}`);
  const rowLink = page.getByTestId("meeting-row").getByRole("link");
  await expect(rowLink).toHaveAccessibleName(new RegExp(doc.title));
  await expect(rowLink).toHaveAttribute("href", `/meetings/${doc._id}#summary`);
  await expect(page.getByTestId("meeting-row")).toContainText("1 decision · 1 action");
  await expect(page.getByTestId("meeting-row")).not.toContainText(doc.summary.overview);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: test.info().outputPath("history-mobile-en.png"), fullPage: true});
  await rowLink.click();
  await expect(page.getByRole("heading", {name: "Meeting summary"})).toBeVisible();
  await expect(page.getByText("Optional transcript passage")).toBeHidden();
  const order = await page.locator("#summary").evaluate((summary) => {
    const agenda = [...document.querySelectorAll("h2")].find((h) => /agenda/i.test(h.textContent || ""));
    return !agenda || Boolean(summary.compareDocumentPosition(agenda) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await page.screenshot({path: test.info().outputPath("summary-mobile-en.png"), fullPage: true});
  await page.getByText("Full transcript", {exact: true}).click();
  await expect(page.getByText("Optional transcript passage")).toBeVisible();
});

test("storico compatto: cinque recenti, riga unica da tastiera, conteggi e stati utili", async ({page}) => {
  const marker = randomUUID();
  const doc = await seed(`${marker} Revisione prodotto`, -1, "completed", {seriesLabel: ""});
  doc.summary.overview = "Questo riepilogo deve restare nel dettaglio, non nella lista.";
  doc.summary.decisions = ["Consegna approvata", "Budget approvato"];
  await doc.save();
  await seed(`${marker} Solo attività`, -2, "completed", {seriesLabel: "", summary: {
    overview: "", rememberedFacts: [], decisions: [], actionItems: [{description: "Preparare demo", completed: false}], openQuestions: [], participantNotes: [],
  }});
  await seed(`${marker} Da preparare`, -3, "processing", {seriesLabel: ""});
  await seed(`${marker} Annullato`, -4, "cancelled", {seriesLabel: ""});
  await seed(`${marker} Non svolto`, -5, "scheduled", {seriesLabel: ""});
  await seed(`${marker} Archiviato`, -6, "completed", {archivedAt: new Date(), seriesLabel: ""});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto(`/meetings?q=${marker}`);
  const history = page.getByRole("region", {name: "Storico", exact: true});
  await expect(history.getByTestId("meeting-row")).toHaveCount(5);
  await history.getByRole("link", {name: "Vedi tutti"}).click();
  await expect(page).toHaveURL(new RegExp(`view=history&q=${marker}`));
  const rows = history.getByTestId("meeting-row");
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText("2 decisioni");
  await expect(rows.nth(1)).toContainText("1 attività");
  await expect(history).not.toContainText(/0 attività|0 decisioni|Leggi riepilogo/);
  await expect(rows.first().getByTestId("history-status")).toHaveCount(0);
  await expect(history.getByTestId("history-status")).toHaveText(["Riepilogo in preparazione", "Annullato", "Non svolto", "Archiviato"]);
  await expect(history.getByRole("link")).toHaveCount(6);
  await expect(history.getByRole("button")).toHaveCount(0);
  expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(72);
  await expect(history).not.toContainText(doc.summary.overview);
  const time = await rows.first().locator("time").boundingBox();
  const title = await rows.first().locator(`[title="${doc.title}"]`).boundingBox();
  expect(Math.abs(time!.y - title!.y)).toBeLessThan(10);
  await history.screenshot({path: test.info().outputPath("history-compact-desktop-it.png")});
  // Native link: one focus target, enter opens the retained summary.
  const link = rows.first().getByRole("link");
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/meetings/${doc._id}#summary$`));
  await expect(page.locator("#summary p").filter({hasText: doc.summary.overview})).toBeVisible();
});

test("storico compatto: titoli lunghi, mobile stretto e stato senza contatori vuoti", async ({page}) => {
  const title = `Revisione ${"prodotto ".repeat(15)}`;
  const doc = await seed(title, -1, "completed", {seriesLabel: "Serie molto lunga ".repeat(8)});
  await seed("Senza decisioni", -2, "completed", {seriesLabel: ""});
  for (const locale of ["it", "en"] as const) {
    await page.context().addCookies([{name: "conclavia_locale", value: locale, url: origin}]);
    for (const width of [1440, 320, 390]) {
      await page.setViewportSize({width, height: 900});
      await page.goto(`/meetings?view=history&q=${encodeURIComponent(prefix)}`);
      const rows = page.getByTestId("meeting-list-history").getByTestId("meeting-row");
      await expect(rows).toHaveCount(2);
      await expect(rows.first().getByRole("link")).toHaveAccessibleName(new RegExp(doc.title.trim()));
      await expect(rows.nth(1).getByTestId("history-status")).toHaveCount(0);
      await expect(rows.nth(1)).not.toContainText(/0 (decision|attività|action)/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const truncatedTitle = rows.first().locator(`[title="${doc.title}"]`);
      expect(await truncatedTitle.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(width < 640 ? 100 : 76);
      if (width === 320) await page.getByTestId("meeting-list-history").screenshot({path: test.info().outputPath(`history-long-mobile-${locale}.png`)});
    }
  }
});

test("panoramica inglese: schermata desktop e avvisi compatti", async ({page}) => {
  const entries: Array<[string, number, MeetingStatus, string]> = [
    ["Product kickoff", 0, "live", ""],
    ["Customer feedback", 0, "waiting_room", ""],
    ["Engineering sync", 1, "scheduled", ""],
    ["Launch readiness", 2, "scheduled", ""],
    ["Roadmap review", -1, "completed", "The October launch is confirmed. Engineering will prepare the demo and share the delivery plan."],
    ["Design review", -2, "completed", "The team approved the simpler onboarding flow. The next review will focus on accessibility."],
  ];
  for (const [title, days, status, overview] of entries) {
    const doc = await MeetingModel.create({...fixture(title, days), title, status, seriesLabel: "Aurora",
      summary: {overview, rememberedFacts: [], decisions: overview ? ["Delivery plan approved"] : [], actionItems: overview ? [{description: "Prepare the demo", owner: "Alex", completed: false}] : [], openQuestions: [], participantNotes: []},
    });
    photoFixtures.push({id: String(doc._id), url: doc.meetingUrl});
  }
  await page.context().addCookies([{name: "conclavia_locale", value: "en", url: origin}]);
  await page.setViewportSize({width: 1440, height: 1100});
  await page.goto("/meetings");
  await expect(page.getByRole("heading", {name: "Meetings", exact: true})).toBeVisible();
  await expect(page.getByTestId("attention-inbox").locator("summary")).toContainText("1 needs action");
  await expect(page.getByTestId("meeting-list-history").getByTestId("meeting-row")).toHaveCount(2);
  await page.screenshot({path: process.env.CONCLAVIA_CAPTURE_DOCS === "1" ? "docs/images/meetings.png" : test.info().outputPath("overview-desktop-en.png"), fullPage: true});
});

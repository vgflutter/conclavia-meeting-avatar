import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { meetingDocumentData } from "../../src/lib/meeting-factory";
import { MeetingModel } from "../../src/models/Meeting";

const owned: string[] = [];
const origin = "http://127.0.0.1:3101";
const future = () => new Date(Date.now() + 86_400_000).toISOString();
const fixture = () => meetingDocumentData({
  title: `E2E GUI ${randomUUID()}`, objective: "Review meeting usability",
  meetingUrl: `https://teams.microsoft.com/l/meetup-join/gui-${randomUUID()}`,
  scheduledStart: future(), durationMinutes: 30, timezone: "Europe/Rome", language: "it",
  autoJoin: false, correctionPolicy: "off", agenda: [{ title: "Roadmap", mandatory: true }],
});

test.beforeAll(async () => {
  if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Isolated database required");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});
test.afterEach(async () => {
  for (const id of owned.splice(0)) await MeetingModel.deleteOne({ _id: id, title: /^E2E GUI /u });
});

for (const locale of ["it", "en"] as const) {
  test(`simple navigation and meeting form: ${locale}, desktop and small mobile`, async ({ page }, testInfo) => {
    const it = locale === "it";
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
    let writes = 0;
    page.on("request", request => { if (request.method() !== "GET") writes++; });
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/meetings");
      const newMeeting = page.getByRole("link", { name: it ? "Nuovo meeting" : "New meeting", exact: true });
      await expect(newMeeting).toHaveCount(1);
      await newMeeting.click();
      const url = page.getByLabel(it ? "Link Microsoft Teams" : "Microsoft Teams link", { exact: true });
      const title = page.getByLabel(it ? "Titolo del meeting" : "Meeting title", { exact: true });
      const language = page.getByLabel(it ? "Lingua" : "Language", { exact: true });
      await expect(url).toBeVisible();
      await expect(newMeeting).toHaveCount(0);
      expect(await url.evaluate(input => Boolean(input.compareDocumentPosition(document.querySelector('#meeting-title')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
      await expect(title).toBeVisible();
      await expect(language).toBeVisible();
      await language.selectOption("it");
      const agenda = page.getByTestId("create-agenda");
      await expect(agenda).not.toHaveAttribute("open");
      await expect(page.getByLabel(it ? "Punto 1" : "Item 1", { exact: true })).not.toBeVisible();
      await agenda.locator("summary").click();
      await page.getByLabel(it ? "Punto 1" : "Item 1", { exact: true }).fill("Review scope");
      await agenda.locator("summary").click();
      await expect(agenda.locator("summary")).toContainText("1");
      await url.fill("https://teams.microsoft.com/l/meetup-join/retained-link");
      await page.getByRole("button", { name: it ? /^Serie di meeting/ : /^Meeting series/ }).click();
      await expect(url).toHaveCount(1);
      await expect(url).toHaveValue(/retained-link$/);
      await page.getByRole("button", { name: it ? /Aggiungi appuntamento/ : /Add appointment/ }).click();
      await expect(url).toHaveCount(2);
      await page.getByRole("button", { name: it ? /^Meeting singolo/ : /^Single meeting/ }).click();
      await expect(url).toHaveCount(1);
      await expect(url).toHaveValue(/retained-link$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (!it) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath(`new-meeting-simple-${width}-en.png`), fullPage: true });
      }
    }
    expect(writes).toBe(0);
  });
}

test("new meeting: one submit at a time, failed save retains fields, retry saves the collapsed agenda", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  await page.goto("/meetings/new");
  await page.getByLabel("Microsoft Teams link").fill("https://teams.microsoft.com/l/meetup-join/gui-save");
  await page.getByLabel("Meeting title").fill(`E2E GUI ${randomUUID()}`);
  await page.getByLabel("Meeting objective").fill("Preserve the draft on failure");
  await page.getByLabel("Date and time").fill(future().slice(0, 16));
  const agenda = page.getByTestId("create-agenda");
  await agenda.locator("summary").click();
  await page.getByLabel("Item 1", { exact: true }).fill("Preserved topic");
  await agenda.locator("summary").click();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/meetings", async route => {
    calls++;
    await gate;
    await route.fulfill({ status: 503, json: { error: "Test unavailable" } });
  });
  await page.getByRole("button", { name: "Save meeting", exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByLabel("Meeting title")).toBeDisabled();
  await page.locator("form").evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  release();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByLabel("Meeting objective")).toHaveValue("Preserve the draft on failure");
  await page.unroute("**/api/meetings");
  const savedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/api/meetings"));
  await page.getByRole("button", { name: "Save meeting", exact: true }).click();
  const saved = (await (await savedResponse).json()).meeting;
  owned.push(saved.id);
  expect(saved.agenda).toMatchObject([{ title: "Preserved topic", mandatory: true }]);
  expect(saved.autoJoin).toBe(false);
  await expect(page).toHaveURL(new RegExp(`/meetings/${saved.id}$`));
});

test("assistant: question first, rapid actions cannot overlap, errors retry, refreshed answers appear once", async ({ page, request }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  const doc = await MeetingModel.create(fixture());
  const id = String(doc._id); owned.push(id);
  await page.goto(`/meetings/${id}`);
  const assistant = page.getByRole("region", { name: /^Ask / });
  const input = assistant.getByLabel("Message for the assistant");
  await expect(assistant.getByRole("button", { name: "Answer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await input.fill("Keep this question");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const payloads: unknown[] = [];
  await page.route(`**/api/meetings/${id}/commands`, async route => {
    payloads.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ status: 503, json: { error: "Test unavailable" } });
  });
  const summary = assistant.getByRole("button", { name: "Summarize", exact: true });
  await summary.click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(assistant).toHaveAttribute("aria-busy", "true");
  for (const button of await assistant.getByRole("button").all()) await expect(button).toBeDisabled();
  await summary.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  expect(payloads).toEqual([{ kind: "summary", prompt: "" }]);
  release();
  await expect(assistant.getByRole("alert")).toBeVisible();
  await expect(summary).toBeEnabled();
  await page.unroute(`**/api/meetings/${id}/commands`);
  await summary.click();
  await expect(assistant.getByRole("article")).toHaveCount(1);
  await assistant.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(input).toHaveValue("Keep this question");
  const prompt = `Externally received ${randomUUID()}`;
  expect((await request.post(`/api/meetings/${id}/commands`, { data: { kind: "remember", prompt } })).status()).toBe(200);
  // This refreshes server props without remounting the assistant console.
  await page.getByRole("button", { name: "Covered", exact: true }).click();
  await expect(assistant.getByRole("article").first()).toContainText(prompt);
  await expect(assistant.getByText(prompt, { exact: true })).toHaveCount(1);
});

test("memory search finds decisions, actions and open questions even when absent from the summary", async ({ page }, testInfo) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  const marker = randomUUID();
  const values = [`Decision.[${marker}]`, `Action-${marker}`, `Question-${marker}`];
  const doc = await MeetingModel.create({ ...fixture(), status: "completed", summary: {
    overview: "A short recap without the search terms.", rememberedFacts: [],
    decisions: [values[0]], actionItems: [{ description: values[1], completed: false }], openQuestions: [values[2]], participantNotes: [],
  } });
  owned.push(String(doc._id));
  await page.goto("/memory");
  for (const value of values) {
    await page.getByLabel("Search memory").fill(value);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const card = page.getByRole("article").filter({ hasText: doc.title });
    await expect(card).toHaveCount(1);
    await expect(card.locator("details")).not.toHaveAttribute("open");
    await card.locator("summary").click();
    await expect(card.getByText(value, { exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("memory-search-mobile-en.png"), fullPage: true });
});

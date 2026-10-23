import { choosePodcastStyle } from "./podcast-visual-controls";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { TalkRunModel } from "../../src/models/PodcastRun";
import { defaultPodcast } from "../../src/components/podcast/podcast-defaults";
import type { TalkInput, TalkResponse } from "../../src/types/podcast";
import type { TalkRunResponse } from "../../src/types/podcast-run";

const origin = "http://127.0.0.1:3101";
const owned: string[] = [];
const marker = "E2E Podcast ";

test.beforeAll(async () => {
  if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27018" || !process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) {
    throw new Error("Podcast tests require the temporary MongoDB and an isolated database");
  }
  loadEnvConfig(process.cwd());
  await connectToDatabase();
});
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
});
test.afterEach(async ({ request }) => {
  for (const id of owned.splice(0)) {
    const response = await request.delete(`/api/podcast/talks/${id}`);
    expect([200, 404]).toContain(response.status());
  }
});

async function create(request: APIRequestContext, changes: Partial<TalkInput> = {}) {
  const input = { ...defaultPodcast(), title: marker + randomUUID(), ...changes };
  const response = await request.post("/api/podcast/talks", { data: input });
  expect(response.status()).toBe(201);
  const talk: TalkResponse = (await response.json()).talk;
  owned.push(talk.id);
  return talk;
}

test("podcast CRUD, immutable run snapshots, disabled voice and cross-origin isolation", async ({ request }) => {
  const config = await (await request.get("/api/podcast/config")).json();
  expect(config.ai.enabled).toBe(false);
  expect(config.speech.enabled).toBe(false);
  const talk = await create(request);
  const created = await request.post(`/api/podcast/talks/${talk.id}/runs`);
  expect(created.status()).toBe(201);
  const run: TalkRunResponse = (await created.json()).run;
  expect(run.messages).toEqual([]);
  expect(run.talkSnapshot?.centralQuestion).toBe(talk.centralQuestion);
  const again = await request.post(`/api/podcast/talks/${talk.id}/runs`);
  expect((await again.json()).run.id).toBe(run.id);
  const changed = await request.patch(`/api/podcast/talks/${talk.id}`, { data: { ...talk, topic: "Un nuovo argomento" } });
  expect(changed.status()).toBe(200);
  const historical = await (await request.get(`/api/podcast/runs/${run.id}`)).json();
  expect(historical.run.talkSnapshot.topic).toBe(talk.topic);
  expect((await request.post(`/api/podcast/runs/${run.id}/speech`, { data: { sequence: 1 } })).status()).toBe(503);
  expect((await request.patch(`/api/podcast/talks/${talk.id}`, { headers: { Origin: "https://foreign.example" }, data: talk })).status()).toBe(403);
  expect((await request.post(`/api/podcast/runs/${run.id}/next`, { headers: { "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
  for (const path of ["/podcast", "/api/podcast/config", `/podcast/${talk.id}/broadcast`, `/api/podcast/talks/${talk.id}`]) {
    expect((await request.get(path, { headers: { "x-forwarded-host": "podcast-fixture.trycloudflare.com" } })).status()).toBe(404);
  }
});

for (const locale of ["it", "en"] as const) {
  test(`podcast editor saves characters, topic and direction in ${locale}`, async ({ page }) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
    const it = locale === "it";
    let paidEndpoints = 0;
    page.on("request", (request) => {
      if (/\/api\/podcast\/runs\/[^/]+\/(?:next|speech)/u.test(request.url())) paidEndpoints++;
    });
    await page.goto("/podcast/new");
    await expect(page.getByRole("navigation", { name: it ? "Navigazione principale" : "Primary navigation" })
      .getByRole("link", { name: it ? "Podcast" : "Podcasts", exact: true })).toHaveAttribute("aria-current", "page");
    const title = marker + randomUUID();
    await page.getByLabel(it ? "Titolo del podcast" : "Podcast title", { exact: true }).fill(title);
    await page.getByLabel(it ? "Argomento" : "Topic", { exact: true }).fill("Il ruolo umano nei processi automatizzati");
    await page.getByLabel(it ? "La domanda centrale" : "The central question", { exact: false }).fill("Quale scelta deve rimanere umana?");
    await page.getByLabel(it ? "Descrizione del carattere" : "Personality description", { exact: true }).first().fill("Curioso, cerca esempi concreti e ascolta senza interrompere.");
    await page.getByTestId("personality-advanced-0").locator("summary").click();
    await page.getByTestId("personality-model-0").selectOption("claude-default");
    await page.getByTestId("personality-advanced-0").locator("summary").click();
    await page.getByLabel(it ? "Come deve svolgersi la conversazione" : "How the conversation should develop", { exact: true }).fill("Una domanda aperta per volta, poi una sintesi condivisa.");
    await choosePodcastStyle(page, "anime");
    await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "anime");
    const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/api/podcast/talks"));
    await page.getByRole("button", { name: it ? "Salva e apri studio" : "Save & open studio" }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    const talk: TalkResponse = (await response.json()).talk;
    owned.push(talk.id);
    expect(talk.participants).toHaveLength(3);
    expect(talk.participants.filter((person) => person.kind === "ai")).toHaveLength(2);
    expect(talk.centralQuestion).toBe("Quale scelta deve rimanere umana?");
    expect(talk.participants[0].personalityPrompt).toContain("ascolta senza interrompere");
    expect(talk.participants[0].modelOverride).toBe("claude-default");
    expect(talk.participants[0].perspectivePrompt).toBe("");
    expect(talk.participants[0].perspectiveMode).toBe("automatic");
    expect(talk.editorialInstructions).toContain("sintesi condivisa");
    await expect(page).toHaveURL(new RegExp(`/podcast/${talk.id}/studio$`, "u"));
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: it ? "Crea sessione" : "Create session", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: it ? /Ascolta ultimo intervento AI/u : /Play latest AI turn/u })).toBeDisabled();
    expect(paidEndpoints).toBe(0);
    await page.goto(`/podcast/${talk.id}`);
    await expect(page.getByLabel(it ? "Descrizione del carattere" : "Personality description", { exact: true }).first()).toHaveValue(talk.participants[0].personalityPrompt!);
    await expect(page.getByTestId("personality-profile-0")).toHaveValue("custom");
    await expect(page.getByTestId("personality-model-0")).toHaveValue("claude-default");
    await expect(page.getByTestId("personality-advanced-0")).not.toHaveAttribute("open");
  });
}

test("silent studio preview exposes ten styles, four layouts, expressions and small-screen controls", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") mutations.push(request.url()); });
  await page.goto("/podcast/preview");
  await expect(page.getByText("STUDIO DIMOSTRATIVO", { exact: true })).toBeVisible();
  const stage = page.getByTestId("podcast-stage").locator("canvas[data-podcast-stage]");
  for (const [theme, rendered] of [["clean-line", "clean"], ["soft-editorial", "soft"], ["animated-series", "comic"], ["anime", "anime"], ["original-editorial", "editorial"], ["original-anime", "anime-night"], ["original-comedy", "comedy"]]) {
    await choosePodcastStyle(page, theme);
    await expect(stage).toHaveAttribute("data-podcast-style", rendered);
  }
  for (const layout of ["studio", "speaker", "table", "lounge"]) {
    await page.getByTestId("podcast-layout").selectOption(layout);
    await expect(stage).toHaveAttribute("data-podcast-layout", layout);
  }
  await page.getByRole("button", { name: "Ospite", exact: true }).click();
  await expect(stage).toHaveAttribute("data-podcast-focus", "guest");
  await page.getByTestId("podcast-expression-0").selectOption("doubt");
  await page.getByTestId("podcast-expression-1").selectOption("empathy");
  await expect(page.getByTestId("podcast-expression-0")).toHaveValue("doubt");
  await expect(page.getByTestId("podcast-expression-1")).toHaveValue("empathy");
  await page.getByTestId("podcast-intensity-0").fill("90");
  await page.getByTestId("podcast-intensity-1").fill("35");
  await expect(page.getByTestId("podcast-intensity-0")).toHaveValue("90");
  await expect(page.getByTestId("podcast-intensity-1")).toHaveValue("35");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: /^Vista programma/u }).click();
  await expect(page.getByRole("button", { name: /Torna alla regia/u })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("podcast-layout")).toBeVisible();
  expect(mutations).toEqual([]);
});

test("a real human turn is stored as human and appears in a clean broadcast view without generation", async ({ page, request }) => {
  const talk = await create(request);
  const run: TalkRunResponse = (await (await request.post(`/api/podcast/talks/${talk.id}/runs`)).json()).run;
  // Explicit fixture: the director has handed the floor to the guest, without calling a model.
  await TalkRunModel.updateOne({ _id: run.id, talkId: talk.id }, { $set: {
    status: "waiting_for_human",
    activeTurn: { speakerType: "participant", participantIndex: 2, speakerName: talk.participants[2].name,
      speakerRole: talk.participants[2].role, intent: "answer", threadLabel: talk.centralQuestion,
      arcPhase: "positions", preparationMode: "reactive", referenceStyle: "idea_first", minWords: 10, maxWords: 100 },
  } });
  await page.goto(`/podcast/${talk.id}/studio`);
  await expect(page.getByLabel("Contributo dell’ospite", { exact: true })).toBeEnabled();
  const content = "Nel mio lavoro delego la prima bozza, ma le scelte e la relazione con le persone rimangono mie.";
  await page.getByLabel("Contributo dell’ospite", { exact: true }).fill(content);
  const submission = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/api/podcast/runs/${run.id}/human-turn`));
  await page.getByRole("button", { name: /Inserisci nella conversazione/u }).click();
  expect((await submission).status()).toBe(200);
  await expect(page.locator("p").filter({ hasText: content })).toBeVisible();
  const stored: TalkRunResponse = (await (await request.get(`/api/podcast/runs/${run.id}`)).json()).run;
  expect(stored.messages).toHaveLength(1);
  expect(stored.messages[0]).toMatchObject({ origin: "human", participantIndex: 2, content });
  expect(stored.messages[0].provider).toBeUndefined();
  expect((await request.post(`/api/podcast/runs/${run.id}/human-turn`, { data: { content } })).status()).toBe(409);
  await expect(page.getByRole("button", { name: /Genera prossimo intervento/u })).toBeDisabled();
  const output = await page.context().newPage();
  try {
    await output.goto(`/podcast/${talk.id}/broadcast`);
    await expect(output.locator("canvas[data-podcast-stage]")).toBeVisible();
    await expect(output.getByRole("navigation", { name: "Navigazione principale" })).toHaveCount(0);
    await expect(output.getByText(content, { exact: true })).toBeVisible();
    await expect(output.getByRole("button", { name: /Genera|Ascolta/u })).toHaveCount(0);
  } finally { await output.close(); }
});

test("local camera is explicit and video-only; graphical recording downloads a real video", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const state = { calls: 0, audio: undefined as unknown, stopped: false };
    (window as unknown as { podcastCameraFixture: typeof state }).podcastCameraFixture = state;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      state.calls++; state.audio = constraints.audio;
      const source = document.createElement("canvas"); source.width = 320; source.height = 180;
      const context = source.getContext("2d")!; context.fillStyle = "#526b63"; context.fillRect(0, 0, 320, 180);
      context.fillStyle = "#eee7cf"; context.font = "20px sans-serif"; context.fillText("Simulated guest camera", 25, 95);
      const stream = source.captureStream(15);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { state.stopped = true; stop(); };
      }
      return stream;
    } });
  });
  await page.goto("/podcast/preview");
  const cameraState = () => page.evaluate(() => (window as unknown as { podcastCameraFixture: { calls: number; audio: unknown; stopped: boolean } }).podcastCameraFixture);
  expect((await cameraState()).calls).toBe(0);
  await page.getByTestId("podcast-open-preflight").click();
  const preparation = page.getByTestId("podcast-guest-preflight");
  expect((await cameraState()).calls).toBe(0);
  await preparation.getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(preparation.getByRole("button", { name: "Spegni videocamera e togli dalla scena", exact: true })).toBeVisible();
  await preparation.getByTestId("podcast-guest-publish").click();
  expect((await cameraState()).audio).toBe(false);
  await page.getByTestId("podcast-record").click();
  await expect(page.getByTestId("podcast-record")).toContainText("Ferma registrazione");
  await page.waitForTimeout(1500);
  await page.getByTestId("podcast-record").click();
  await expect(page.getByTestId("podcast-record-download")).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByTestId("podcast-record-download").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.webm$|\.mp4$/u);
  const videoPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(videoPath);
  expect((await readFile(videoPath)).byteLength).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Spegni videocamera", exact: true }).click();
  expect((await cameraState()).stopped).toBe(true);
  expect((await cameraState()).calls).toBe(1);
});

import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { TalkResponse } from "../../src/types/podcast";

const origin = "http://127.0.0.1:3101";
const owned: string[] = [];
const themes = [
  ["clean-line", "clean"],
  ["soft-editorial", "soft"],
  ["animated-series", "comic"],
  ["anime", "anime"],
] as const;

test.beforeAll(() => {
  if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27018" || !process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_") ||
    process.env.PODCAST_AI_ENABLED !== "false" || process.env.PODCAST_SPEECH_ENABLED !== "false") {
    throw new Error("Style acceptance requires isolated MongoDB and disabled paid features");
  }
});
test.afterEach(async ({ request }) => {
  for (const id of owned.splice(0)) {
    expect([200, 404]).toContain((await request.delete(`/api/podcast/talks/${id}`)).status());
  }
});

async function silentBrowsing(page: Page) {
  const requests = { mutations: [] as string[], external: [] as string[] };
  page.on("request", request => {
    if (request.method() !== "GET") requests.mutations.push(request.url());
    if (new URL(request.url()).origin !== origin) requests.external.push(request.url());
  });
  await page.addInitScript(() => {
    const state = { permissionRequests: 0 };
    Object.assign(window, { podcastStylePrivacy: state });
    const devices = navigator.mediaDevices;
    if (devices) Object.defineProperty(devices, "getUserMedia", { configurable: true, value: () => {
      state.permissionRequests++;
      return Promise.reject(new Error("The visual gallery must never request a camera or microphone"));
    } });
  });
  return requests;
}
const permissionsRequested = (page: Page) => page.evaluate(() => (window as unknown as {
  podcastStylePrivacy: { permissionRequests: number };
}).podcastStylePrivacy.permissionRequests);

async function chooseStyle(page: Page, theme: string) {
  const input = page.getByTestId(`podcast-style-option-${theme}`);
  // Native radio keyboard interaction must work even when the image fills its label.
  await input.focus();
  await input.press("Space");
  await expect(input).toBeChecked();
  await expect(page.getByTestId("podcast-style-picker").locator('input[type="radio"]:checked')).toHaveCount(1);
}

for (const locale of ["it", "en"] as const) {
  test(`style gallery in ${locale}: four visual choices, three original images, three compositions and no service activation`, async ({ page, request }, testInfo) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
    const requests = await silentBrowsing(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/podcast/styles");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const picker = page.getByTestId("podcast-style-picker");
    await expect(picker.getByRole("radio")).toHaveCount(4);
    await expect(picker.locator("img")).toHaveCount(4);
    const stage = page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]");
    await expect(stage).toBeVisible();
    for (const [theme, rendered] of themes) {
      await chooseStyle(page, theme);
      await expect(stage).toHaveAttribute("data-podcast-style", rendered);
    }
    await page.getByTestId("podcast-style-option-anime").press("ArrowLeft");
    await expect(page.getByTestId("podcast-style-option-animated-series")).toBeChecked();
    await expect(stage).toHaveAttribute("data-podcast-style", "comic");
    for (const layout of ["studio", "speaker", "table"]) {
      await page.getByTestId("style-gallery-layout").selectOption(layout);
      await expect(stage).toHaveAttribute("data-podcast-layout", layout);
    }
    const guest = page.getByTestId("style-gallery-guest");
    await guest.uncheck();
    const twoHosts = await stage.getAttribute("aria-label");
    await guest.check();
    await expect(stage).not.toHaveAttribute("aria-label", twoHosts || "");
    await page.getByTestId("style-gallery-focus").selectOption("guest");
    await expect(stage).toHaveAttribute("data-podcast-focus", "guest");
    await guest.uncheck();
    await expect(stage).toHaveAttribute("data-podcast-focus", "all");
    const archive = page.getByTestId("style-gallery-originals");
    await expect(archive).not.toHaveAttribute("open");
    await archive.locator("summary").click();
    await expect(archive).toHaveAttribute("open");
    const originals = archive.locator("img");
    await expect(originals).toHaveCount(3);
    const originalNames: string[] = [];
    for (const image of await originals.all()) {
      await image.scrollIntoViewIfNeeded();
      const alt = (await image.getAttribute("alt"))?.trim() || "";
      expect(alt.length).toBeGreaterThan(20);
      expect(alt).not.toMatch(/^[^ ]+\.(?:png|webp|jpe?g)$/iu);
      originalNames.push(alt);
      const src = await image.getAttribute("src");
      expect(src).toBeTruthy();
      const url = new URL(src!, origin);
      expect(url.origin).toBe(origin);
      const response = await request.get(url.toString());
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^image\//u);
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth >= 200 && node.naturalHeight >= 100)).toBe(true);
    }
    expect(new Set(originalNames).size).toBe(3);
    await page.getByTestId("style-gallery-layout").selectOption("studio");
    await chooseStyle(page, "clean-line");
    await expect(picker.locator("img")).toHaveCount(4);
    await page.evaluate(async () => { await document.fonts.ready; });
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width !== 768) await page.screenshot({ path: testInfo.outputPath(`podcast-styles-${locale}-${width}.png`), fullPage: true });
    }
    expect(await permissionsRequested(page)).toBe(0);
    expect(requests.mutations).toEqual([]);
    expect(requests.external).toEqual([]);
  });
}

test("gallery links carry the selected style into the spoken rehearsal and new episode without starting either", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  const requests = await silentBrowsing(page);
  await page.goto("/podcast/styles?style=anime");
  await expect(page.getByTestId("podcast-style-option-anime")).toBeChecked();
  await expect(page.getByTestId("style-use-rehearsal")).toHaveAttribute("href", "/podcast/rehearsal?style=anime");
  await expect(page.getByTestId("style-use-new")).toHaveAttribute("href", "/podcast/new?style=anime");
  await page.getByTestId("style-use-rehearsal").click();
  await expect(page).toHaveURL(/\/podcast\/rehearsal\?style=anime$/u);
  await expect(page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "anime");
  await expect(page.getByTestId("podcast-style-option-anime")).toBeChecked();
  await expect(page.getByTestId("rehearsal-theme")).toHaveValue("anime");
  await page.goto("/podcast/styles?style=soft-editorial");
  await expect(page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  await page.getByTestId("style-use-new").click();
  await expect(page).toHaveURL(/\/podcast\/new\?style=soft-editorial$/u);
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("soft-editorial");
  await expect(page.getByTestId("podcast-style-option-soft-editorial")).toBeChecked();
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  expect(await permissionsRequested(page)).toBe(0);
  expect(requests.mutations).toEqual([]);
  expect(requests.external).toEqual([]);
});

test("the visual picker persists the chosen theme and restores it when the episode is reopened", async ({ page, request }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await page.goto("/podcast/new?style=animated-series");
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("animated-series");
  const title = "E2E Podcast Styles " + randomUUID();
  await page.getByLabel("Titolo del podcast", { exact: true }).fill(title);
  await chooseStyle(page, "anime");
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("anime");
  const creating = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/api/podcast/talks"));
  await page.getByRole("button", { name: "Salva puntata", exact: true }).click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const talk: TalkResponse = (await created.json()).talk;
  owned.push(talk.id);
  expect(talk.settings.studioTheme).toBe("anime");
  await expect(page).toHaveURL(new RegExp(`/podcast/${talk.id}$`, "u"));
  await page.reload();
  await expect(page.getByTestId("podcast-style-option-anime")).toBeChecked();
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "anime");
  await chooseStyle(page, "soft-editorial");
  const saving = page.waitForResponse(response => response.request().method() === "PATCH" && response.url().endsWith(`/api/podcast/talks/${talk.id}`));
  await page.getByRole("button", { name: "Salva puntata", exact: true }).click();
  expect((await saving).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("podcast-style-option-soft-editorial")).toBeChecked();
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("soft-editorial");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  const stored = await (await request.get(`/api/podcast/talks/${talk.id}`)).json();
  expect(stored.talk.settings.studioTheme).toBe("soft-editorial");
});

test("unknown style links safely restore a supported gallery and editor selection", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  const requests = await silentBrowsing(page);
  for (const path of ["/podcast/styles?style=not-a-renderer", "/podcast/new?style=not-a-renderer"]) {
    await page.goto(path);
    await expect(page.getByTestId("podcast-style-option-clean-line")).toBeChecked();
    const stage = path.startsWith("/podcast/styles")
      ? page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]")
      : page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]");
    await expect(stage).toHaveAttribute("data-podcast-style", "clean");
  }
  expect(requests.mutations).toEqual([]);
  expect(await permissionsRequested(page)).toBe(0);
});

test("picture choices update the actual rehearsal and preview canvases without starting a conversation", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  const requests = await silentBrowsing(page);
  for (const [path, wrapper, select] of [["/podcast/rehearsal", "rehearsal-stage", "rehearsal-theme"], ["/podcast/preview", "podcast-stage", "podcast-theme"]]) {
    await page.goto(path);
    const stage = page.getByTestId(wrapper).locator("canvas[data-podcast-stage]");
    for (const [theme, rendered] of themes) {
      await chooseStyle(page, theme);
      await expect(page.getByTestId(select)).toHaveValue(theme);
      await expect(stage).toHaveAttribute("data-podcast-style", rendered);
    }
  }
  expect(requests.mutations).toEqual([]);
  expect(requests.external).toEqual([]);
  expect(await permissionsRequested(page)).toBe(0);
});

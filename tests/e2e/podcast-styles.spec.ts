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
  ["original-editorial", "editorial"],
  ["original-anime", "anime-night"],
  ["original-comedy", "comedy"],
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
  test(`style gallery in ${locale}: seven animated styles, three casts and four optional-guest compositions and no service activation`, async ({ page }, testInfo) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
    const requests = await silentBrowsing(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/podcast/styles");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const picker = page.getByTestId("podcast-style-picker");
    await expect(picker.getByRole("radio")).toHaveCount(7);
    await expect(picker.locator("img")).toHaveCount(7);
    const scenes = page.getByTestId("podcast-scenario-picker");
    await expect(scenes.getByRole("radio")).toHaveCount(4);
    await expect(scenes.locator("img")).toHaveCount(4);
    const stage = page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]");
    await expect(stage).toBeVisible();
    for (const [theme, rendered] of themes) {
      await chooseStyle(page, theme);
      await expect(stage).toHaveAttribute("data-podcast-style", rendered);
    }
    await page.getByTestId("podcast-style-option-anime").press("ArrowLeft");
    await expect(page.getByTestId("podcast-style-option-animated-series")).toBeChecked();
    await expect(stage).toHaveAttribute("data-podcast-style", "comic");
    await expect(stage).toHaveAttribute("data-podcast-guest", "false");
    const casts = page.getByTestId("podcast-cast-picker");
    await expect(casts.getByRole("radio")).toHaveCount(3);
    await expect(casts.locator("img")).toHaveCount(3);
    for (const cast of ["original", "contemporary", "expressive"]) {
      const choice = page.getByTestId(`podcast-cast-option-${cast}`);
      await choice.focus(); await choice.press("Space");
      await expect(choice).toBeChecked();
      await expect(stage).toHaveAttribute("data-podcast-cast", cast);
    }
    await page.getByTestId("style-gallery-guest-toggle").check();
    await expect(stage).toHaveAttribute("data-podcast-guest", "true");
    for (const layout of ["studio", "speaker", "table", "lounge"]) {
      const choice = page.getByTestId(`podcast-scenario-option-${layout}`);
      await choice.focus(); await choice.press("Space");
      await expect(choice).toBeChecked();
      await expect(stage).toHaveAttribute("data-podcast-layout", layout);
      await expect(stage).toHaveAttribute("data-podcast-guest", "true");
      await expect(page.getByTestId("style-gallery-layout")).toHaveValue(layout);
    }
    await page.getByTestId("podcast-scenario-option-lounge").press("ArrowLeft");
    await expect(page.getByTestId("podcast-scenario-option-table")).toBeChecked();
    await expect(stage).toHaveAttribute("data-podcast-layout", "table");
    await expect(page.getByTestId("style-gallery-guest")).toBeVisible();
    await expect(page.getByTestId("style-gallery-guest").getByRole("checkbox")).toHaveCount(0);
    await page.getByTestId("style-gallery-focus").selectOption("guest");
    await expect(stage).toHaveAttribute("data-podcast-focus", "guest");
    await page.getByTestId("podcast-scenario-option-studio").check();
    await expect(stage).toHaveAttribute("data-podcast-focus", "all");
    await expect(page.getByTestId("style-gallery-originals")).toHaveCount(0);
    await page.getByTestId("style-gallery-guest-toggle").uncheck();
    await expect(stage).toHaveAttribute("data-podcast-guest", "false");
    await expect(page.getByTestId("style-gallery-focus").locator('option[value="guest"]')).toHaveCount(0);
    await page.getByTestId("style-gallery-layout").selectOption("studio");
    await chooseStyle(page, "clean-line");
    await expect(picker.locator("img")).toHaveCount(7);
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

test("gallery links carry the selected artwork, cast and optional guest scene into rehearsal and a new episode without starting either", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  const requests = await silentBrowsing(page);
  await page.goto("/podcast/styles?style=original-anime&scenario=lounge&cast=contemporary&guest=reserve");
  await expect(page.getByTestId("podcast-style-option-original-anime")).toBeChecked();
  await expect(page.getByTestId("podcast-cast-option-contemporary")).toBeChecked();
  await expect(page.getByTestId("podcast-scenario-option-lounge")).toBeChecked();
  await expect(page.getByTestId("style-use-rehearsal")).toHaveAttribute("href", "/podcast/rehearsal?style=original-anime&scenario=lounge&cast=contemporary&guest=reserve");
  await expect(page.getByTestId("style-use-new")).toHaveAttribute("href", "/podcast/new?style=original-anime&scenario=lounge&cast=contemporary&guest=reserve");
  await page.getByTestId("style-use-rehearsal").click();
  await expect(page).toHaveURL(/\/podcast\/rehearsal\?style=original-anime&scenario=lounge&cast=contemporary&guest=reserve$/u);
  await expect(page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "anime-night");
  await expect(page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-layout", "lounge");
  await expect(page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-guest", "true");
  await expect(page.getByTestId("podcast-style-option-original-anime")).toBeChecked();
  await expect(page.getByTestId("rehearsal-theme")).toHaveValue("original-anime");
  await expect(page.getByTestId("podcast-cast")).toHaveValue("contemporary");
  await expect(page.getByTestId("podcast-guest-mode")).toHaveValue("reserve");
  await expect(page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-cast", "contemporary");
  await page.goto("/podcast/styles?style=soft-editorial&scenario=table&cast=expressive&guest=hidden");
  await expect(page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  await page.getByTestId("style-use-new").click();
  await expect(page).toHaveURL(/\/podcast\/new\?style=soft-editorial&scenario=table&cast=expressive&guest=hidden$/u);
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("soft-editorial");
  await expect(page.getByTestId("podcast-style-option-soft-editorial")).toBeChecked();
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-layout", "table");
  await expect(page.getByTestId("podcast-cast")).toHaveValue("expressive");
  await expect(page.getByTestId("podcast-guest-mode")).toHaveValue("hidden");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-guest", "false");
  expect(await permissionsRequested(page)).toBe(0);
  expect(requests.mutations).toEqual([]);
  expect(requests.external).toEqual([]);
});

test("the visual picker persists artwork and composition when the episode is reopened", async ({ page, request }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await page.goto("/podcast/new?style=animated-series&scenario=lounge&cast=contemporary&guest=hidden");
  await expect(page.getByTestId("podcast-editor-layout")).toHaveValue("lounge");
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("animated-series");
  const title = "E2E Podcast Styles " + randomUUID();
  await page.getByLabel("Titolo del podcast", { exact: true }).fill(title);
  await chooseStyle(page, "original-comedy");
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("original-comedy");
  const creating = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/api/podcast/talks"));
  await page.getByRole("button", { name: "Salva puntata", exact: true }).click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const talk: TalkResponse = (await created.json()).talk;
  owned.push(talk.id);
  expect(talk.settings.studioTheme).toBe("original-comedy");
  expect(talk.settings.studioCast).toBe("contemporary");
  expect(talk.settings.studioGuest).toBe("hidden");
  expect(talk.settings.studioLayout).toBe("lounge");
  await expect(page).toHaveURL(new RegExp(`/podcast/${talk.id}$`, "u"));
  await page.reload();
  await expect(page.getByTestId("podcast-style-option-original-comedy")).toBeChecked();
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "comedy");
  await expect(page.getByTestId("podcast-cast")).toHaveValue("contemporary");
  await expect(page.getByTestId("podcast-guest-mode")).toHaveValue("hidden");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-layout", "lounge");
  await chooseStyle(page, "soft-editorial");
  await page.getByTestId("podcast-cast").selectOption("expressive");
  await page.getByTestId("podcast-guest-mode").selectOption("reserve");
  await page.getByTestId("podcast-editor-layout").selectOption("table");
  const saving = page.waitForResponse(response => response.request().method() === "PATCH" && response.url().endsWith(`/api/podcast/talks/${talk.id}`));
  await page.getByRole("button", { name: "Salva puntata", exact: true }).click();
  expect((await saving).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("podcast-style-option-soft-editorial")).toBeChecked();
  await expect(page.getByLabel("Stile grafico", { exact: true })).toHaveValue("soft-editorial");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-style", "soft");
  const stored = await (await request.get(`/api/podcast/talks/${talk.id}`)).json();
  expect(stored.talk.settings.studioTheme).toBe("soft-editorial");
  expect(stored.talk.settings.studioLayout).toBe("table");
  expect(stored.talk.settings.studioCast).toBe("expressive");
  expect(stored.talk.settings.studioGuest).toBe("reserve");
  await expect(page.getByTestId("podcast-cast")).toHaveValue("expressive");
  await expect(page.getByTestId("podcast-guest-mode")).toHaveValue("reserve");
  await expect(page.getByTestId("podcast-editor-layout")).toHaveValue("table");
  await expect(page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-layout", "table");
});

test("unknown style links safely restore a supported gallery and editor selection", async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: origin }]);
  const requests = await silentBrowsing(page);
  for (const path of ["/podcast/styles?style=not-a-renderer&scenario=unknown-scene&cast=unknown&guest=unknown", "/podcast/new?style=not-a-renderer&scenario=unknown-scene&cast=unknown&guest=unknown"]) {
    await page.goto(path);
    await expect(page.getByTestId("podcast-style-option-clean-line")).toBeChecked();
    const stage = path.startsWith("/podcast/styles")
      ? page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]")
      : page.getByTestId("podcast-editor-stage").locator("canvas[data-podcast-stage]");
    await expect(stage).toHaveAttribute("data-podcast-style", "clean");
    await expect(stage).toHaveAttribute("data-podcast-layout", "studio");
    await expect(stage).toHaveAttribute("data-podcast-cast", "original");
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


test("guest auto follows invited humans, hidden removes the panel, and reserve works without a human", async ({ page }) => {
  const requests = await silentBrowsing(page);
  await page.goto("/podcast/preview?style=original-editorial&cast=expressive&guest=auto");
  const preview = page.getByTestId("podcast-stage").locator("canvas[data-podcast-stage]");
  await expect(preview).toHaveAttribute("data-podcast-guest", "true");
  await expect(preview).toHaveAttribute("data-podcast-cast", "expressive");
  await page.getByTestId("podcast-guest-mode").selectOption("hidden");
  await expect(preview).toHaveAttribute("data-podcast-guest", "false");
  await expect(page.getByRole("button", { name: /^(?:Ospite|Guest)$/u })).toHaveCount(0);
  await expect(page.getByTestId("podcast-preview-use-new")).toHaveAttribute("href", "/podcast/new?style=original-editorial&scenario=studio&cast=expressive&guest=hidden");
  await page.goto("/podcast/rehearsal?style=original-editorial&cast=expressive&guest=auto");
  const rehearsal = page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]");
  await expect(rehearsal).toHaveAttribute("data-podcast-guest", "false");
  await page.getByTestId("podcast-guest-mode").selectOption("reserve");
  await expect(rehearsal).toHaveAttribute("data-podcast-guest", "true");
  await expect(page.getByTestId("podcast-cast")).toHaveValue("expressive");
  expect(await permissionsRequested(page)).toBe(0);
  expect(requests.mutations).toEqual([]);
  expect(requests.external).toEqual([]);
});

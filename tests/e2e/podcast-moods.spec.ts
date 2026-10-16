import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3101";
const expectedMoods = [
  ["attention", "attention,curiosity", "0"],
  ["curiosity", "attention,curiosity", "1"],
  ["doubt", "doubt,empathy", "0"],
  ["agreement", "amusement,agreement", "1"],
  ["amusement", "amusement,amusement", "0"],
  ["empathy", "attention,empathy", "1"],
  ["disagreement", "disagreement,doubt", "0"],
  ["surprise", "curiosity,surprise", "1"],
] as const;

test.beforeAll(() => {
  if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27018" || !process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_") ||
    process.env.PODCAST_AI_ENABLED !== "false" || process.env.PODCAST_SPEECH_ENABLED !== "false") {
    throw new Error("Emotion acceptance requires isolated MongoDB and disabled paid features");
  }
});

async function openSilentLab(page: Page, locale: "it" | "en" = "it") {
  const calls = { mutations: [] as string[], external: [] as string[] };
  page.on("request", request => {
    if (request.method() !== "GET") calls.mutations.push(request.url());
    if (new URL(request.url()).origin !== origin) calls.external.push(request.url());
  });
  await page.addInitScript(() => {
    const counters = { media: 0, audio: 0 };
    Object.assign(window, { podcastMoodPrivacy: counters });
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      counters.media++; throw new Error("The offline visual rehearsal must not activate media");
    } });
    const audio = window.AudioContext;
    if (audio) Object.defineProperty(window, "AudioContext", { configurable: true, value: class extends audio {
      constructor(options?: AudioContextOptions) { counters.audio++; super(options); }
    } });
  });
  await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
  await page.goto("/podcast/styles?style=anime&scenario=lounge");
  return calls;
}
const privacy = (page: Page) => page.evaluate(() => (window as unknown as { podcastMoodPrivacy: { media: number; audio: number } }).podcastMoodPrivacy);
const stageOf = (page: Page) => page.getByTestId("style-gallery-stage").locator("canvas[data-podcast-stage]");

for (const locale of ["it", "en"] as const) {
  test(`each prepared line carries a mood and its listener has an independent visible reaction in ${locale}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calls = await openSilentLab(page, locale);
    const stage = stageOf(page);
    const line = page.getByTestId("mood-demo-sentence");
    await expect(page.getByTestId("podcast-mood-lab").getByRole("button", { pressed: true })).toHaveCount(1);
    let initialImage = "";
    for (const [mood, pair, speaker] of expectedMoods) {
      await page.getByTestId(`mood-demo-option-${mood}`).click();
      await expect(line).toHaveAttribute("data-mood", mood);
      await expect(line).toHaveAttribute("data-speaker", speaker);
      await expect(line.locator("blockquote")).not.toBeEmpty();
      await expect(stage).toHaveAttribute("data-podcast-moods", pair);
      await expect(stage).toHaveAttribute("data-podcast-phase", "delivery");
      await expect(stage).toHaveAttribute("data-podcast-cue", /^mood-demo-/u);
      await expect(stage).toHaveAttribute("data-podcast-guest", "true");
      await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
      await expect(stage).toHaveAttribute("data-podcast-visemes", "rest,rest");
      if (mood === "attention") initialImage = await stage.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
      if (mood === "surprise") await expect.poll(() => stage.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(initialImage);
    }
    expect(await privacy(page)).toEqual({ media: 0, audio: 0 });
    expect(calls.mutations).toEqual([]);
    expect(calls.external).toEqual([]);
  });
}

test("the visual transport seeks through preparation, expression and release, advances, pauses and resets without calling a provider", async ({ page }) => {
  const calls = await openSilentLab(page);
  const stage = stageOf(page), seek = page.getByTestId("mood-demo-seek");
  for (const [position, phase] of [["200", "anticipation"], ["2000", "delivery"], ["6000", "settle"]]) {
    await seek.fill(position);
    await expect(page.getByTestId("mood-demo-sentence")).toHaveAttribute("data-phase", phase);
    await expect(stage).toHaveAttribute("data-podcast-phase", phase);
    await expect(page.getByTestId("mood-demo-play")).toHaveAttribute("aria-pressed", "false");
  }
  await seek.fill("6700");
  await page.getByTestId("mood-demo-play").click();
  await expect(page.getByTestId("mood-demo-play")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mood-demo-option-curiosity")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mood-demo-sentence")).toHaveAttribute("data-speaker", "1");
  await page.getByTestId("mood-demo-play").click();
  await expect(page.getByTestId("mood-demo-play")).toHaveAttribute("aria-pressed", "false");
  const paused = await seek.inputValue();
  await page.waitForTimeout(350);
  await expect(seek).toHaveValue(paused);
  await page.getByTestId("mood-demo-next").click();
  await expect(page.getByTestId("mood-demo-option-doubt")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("mood-demo-stop").click();
  await expect(page.getByTestId("mood-demo-option-attention")).toHaveAttribute("aria-pressed", "true");
  await expect(seek).toHaveValue("0");
  await expect(stage).toHaveAttribute("data-podcast-phase", "anticipation");
  expect(await privacy(page)).toEqual({ media: 0, audio: 0 });
  expect(calls.mutations).toEqual([]);
  expect(calls.external).toEqual([]);
});

test("manual moods and strengths are independent, stop the sequence, preserve the human seat and return to paired performance", async ({ page }, testInfo) => {
  const calls = await openSilentLab(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const stage = stageOf(page);
  await page.getByTestId("mood-demo-play").click();
  await page.getByTestId("style-gallery-expression-0").selectOption("disagreement");
  await page.getByTestId("style-gallery-expression-1").selectOption("empathy");
  await expect(page.getByTestId("mood-demo-play")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("podcast-mood-lab")).toHaveAttribute("data-mode", "manual");
  await expect(stage).toHaveAttribute("data-podcast-moods", "disagreement,empathy");
  await page.getByTestId("style-gallery-intensity-0").fill("90");
  await page.getByTestId("style-gallery-intensity-1").fill("35");
  await expect(stage).toHaveAttribute("data-podcast-intensities", "0.9,0.35");
  await expect(stage).not.toHaveAttribute("data-podcast-cue");
  await expect(stage).toHaveAttribute("data-podcast-guest", "true");
  await page.getByTestId("mood-demo-option-amusement").click();
  await expect(page.getByTestId("podcast-mood-lab")).toHaveAttribute("data-mode", "scripted");
  await expect(stage).toHaveAttribute("data-podcast-moods", "amusement,amusement");
  await expect(stage).toHaveAttribute("data-podcast-intensities", "0.76,0.52");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 768) {
      const moodChoice = page.getByTestId("mood-demo-option-surprise");
      await moodChoice.scrollIntoViewIfNeeded();
      await moodChoice.click();
      await expect(stage).toBeInViewport({ ratio: .85 });
      const play = page.getByTestId("mood-demo-play");
      await play.scrollIntoViewIfNeeded();
      await play.click();
      await expect(stage).toBeInViewport({ ratio: .85 });
      await play.click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`podcast-mood-studio-${width}.png`), fullPage: true });
    }
  }
  expect(await privacy(page)).toEqual({ media: 0, audio: 0 });
  expect(calls.mutations).toEqual([]);
  expect(calls.external).toEqual([]);
});

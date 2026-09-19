import { expect, test, type Page } from "@playwright/test";
import { installVoiceProbe } from "./voice-probe";
import { avatarPreviewFrame, AVATAR_PREVIEW_DURATION_MS } from "../../src/lib/avatar-preview";

test("shared rehearsal connects phonemes and reserves silence for phrase boundaries", () => {
  const pauses: number[] = [];
  const shapes = new Set<string>();
  let pause = 0;
  for (let ms = 2100; ms < 6600; ms += 10) {
    const frame = avatarPreviewFrame(ms);
    expect(Number.isFinite(frame.level) && frame.level >= 0 && frame.level <= .3).toBe(true);
    shapes.add(frame.viseme);
    if (frame.viseme === "rest") { expect(frame.level).toBe(0); pause += 10; }
    else if (pause) { pauses.push(pause); pause = 0; }
  }
  expect(shapes).toEqual(new Set(["mbp", "a", "e", "o", "u", "fv", "consonant", "rest"]));
  expect(pauses.length).toBeGreaterThan(0);
  expect(pauses.length).toBeLessThanOrEqual(3);
  expect(Math.min(...pauses)).toBeGreaterThanOrEqual(120);
  for (const ms of [-1, 0, 2090, 6600, AVATAR_PREVIEW_DURATION_MS, Infinity, NaN]) {
    expect(avatarPreviewFrame(ms).viseme).toBe("rest");
    expect(avatarPreviewFrame(ms).level).toBe(0);
  }
});

const styles = ["editorial", "stylized_3d", "portrait_2_5d"] as const;
function renderer(page: Page, style: typeof styles[number]) {
  return style === "editorial" ? page.locator('svg[data-design="editorial-comic"]')
    : page.getByTestId(style === "stylized_3d" ? "avatar-3d-canvas" : "portrait-canvas");
}
function amplitudeAttribute(style: typeof styles[number]) {
  return style === "stylized_3d" ? "data-mouth-amplitude" : "data-rendered-mouth-open";
}

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

for (const style of styles) {
  test(`shared animation: ${style}, both identities, complete cycle and manual stop without writes`, async ({ page, request }, info) => {
    const before = (await (await request.get("/api/avatar")).json()).profile;
    const writes: string[] = [];
    page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption(style);
    for (const appearance of ["business_clay", "business_clay_female"]) {
      await page.getByLabel("Avatar appearance").selectOption(appearance);
      const avatar = renderer(page, style);
      await expect(avatar).toHaveAttribute(style === "editorial" ? "data-animation-ready" : "data-renderer-ready", "true");
      const voices = await page.getByTestId("preview-voices").textContent();
      await page.getByRole("button", { name: "Play animation", exact: true }).click();
      await expect(page.getByLabel("Avatar style", { exact: true })).toBeDisabled();
      await expect(page.getByLabel("Avatar appearance")).toBeDisabled();
      await expect.poll(async () => Number(await avatar.getAttribute(amplitudeAttribute(style)))).toBeGreaterThan(.1);
      await page.locator("[data-avatar-stage]").screenshot({ path: info.outputPath(`${style}-${appearance}-animation.png`) });
      if (appearance === "business_clay") {
        // Real elapsed time verifies the bounded demo actually returns to rest.
        await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeVisible({ timeout: 12_000 });
      } else {
        await page.getByRole("button", { name: "Stop animation", exact: true }).click();
      }
      await expect.poll(async () => Number(await avatar.getAttribute(amplitudeAttribute(style))), { timeout: 1000 }).toBe(0);
      await expect(page.getByLabel("Avatar appearance")).toBeEnabled();
      await expect(page.getByTestId("preview-voices")).toHaveText(voices!);
      if (appearance === "business_clay_female") {
        await page.getByRole("button", { name: "Play animation", exact: true }).click();
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, value: true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await expect(page.getByTestId("portrait-rehearsal")).toHaveAttribute("data-state", "idle");
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, value: false });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeEnabled();
        await expect.poll(async () => Number(await avatar.getAttribute(amplitudeAttribute(style)))).toBe(0);
      }
    }
    expect(writes).toEqual([]);
    expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
  });

  test(`shared animation: ${style}, real PCM takes over and stop closes mouth`, async ({ page }) => {
    await installVoiceProbe(page);
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption(style);
    const avatar = renderer(page, style);
    await expect(avatar).toHaveAttribute(style === "editorial" ? "data-animation-ready" : "data-renderer-ready", "true");
    await page.getByRole("button", { name: "Play animation", exact: true }).click();
    await page.getByRole("button", { name: "Listen to voice", exact: true }).click();
    await expect(page.getByTestId("portrait-rehearsal")).toHaveAttribute("data-state", "idle");
    await expect.poll(async () => Number(await avatar.getAttribute(amplitudeAttribute(style)))).toBeGreaterThan(.1);
    await page.getByRole("button", { name: "Stop voice", exact: true }).click();
    await expect.poll(async () => Number(await avatar.getAttribute(amplitudeAttribute(style))), { timeout: 1000 }).toBe(0);
    await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeEnabled();
  });
}

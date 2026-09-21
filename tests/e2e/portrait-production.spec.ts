import { expect, test } from "@playwright/test";
import { portraitFrame } from "../../src/lib/portrait-animation";
import { portraitArmPoint, portraitArmTexturePoint } from "../../src/lib/portrait-motion";

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

test("photographic portraits use their own face, eyelids and arm on both identities", async ({ page, request }, info) => {
  const calls: string[] = [];
  page.on("request", request => { if (request.method() !== "GET") calls.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  const images: string[] = [];
  for (const appearance of ["portrait_natural_male", "portrait_natural_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const portrait = page.getByTestId("avatar-portrait");
    await expect(portrait).toHaveAttribute("data-appearance", appearance);
    await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    for (const [attribute, name] of [["data-asset", "natural-v1"], ["data-features-asset", "natural-features-v1"], ["data-layers-asset", "natural-arm-layers-v1"]]) {
      const url = (await portrait.getAttribute(attribute))!;
      expect(url).toContain("portraits-2-5d-" + name);
      expect((await request.get(url)).ok()).toBe(true);
    }
    images.push(await portrait.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()));
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-hand-raised", "true");
    await portrait.screenshot({ path: info.outputPath(`${appearance}-raised.png`) });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
  }
  expect(images[0]).not.toBe(images[1]);
  expect(calls).toEqual([]);
});

test("failed photographic texture retries only after an explicit identity change, including A to B to A", async ({ page }) => {
  let attempts = 0;
  await page.route(/\/_next\/static\/media\/portraits-2-5d-natural-v1[^/]*\.png/, async route => {
    attempts++;
    if (attempts === 1) await route.abort();
    else await route.continue();
  });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  await page.getByLabel("Avatar appearance").selectOption("portrait_natural_male");
  const portrait = page.getByTestId("avatar-portrait");
  await expect(portrait).toHaveAttribute("data-renderer", "fallback-2d");
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(portrait).toHaveAttribute("data-renderer", "fallback-2d");
  expect(attempts).toBe(1);
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
  await page.getByLabel("Avatar appearance").selectOption("portrait_natural_male");
  await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
  expect(attempts).toBe(2);
});

test("photographic arm registration preserves anchors and F/V contact closes with silence", () => {
  for (const female of [false, true]) {
    const elbow = female ? [142, 502] : [143, 502];
    const wrist = female ? [173, 349] : [176, 325];
    expect(portraitArmTexturePoint(...elbow as [number, number], female)).toEqual(elbow);
    const mappedElbow = portraitArmTexturePoint(...elbow as [number, number], female, true);
    expect(mappedElbow[0]).toBeCloseTo(250, 5);
    expect(mappedElbow[1]).toBeCloseTo(female ? 493 : 550, 5);
    const mappedWrist = portraitArmTexturePoint(...wrist as [number, number], female, true);
    expect(mappedWrist[0]).toBeCloseTo(female ? 306 : 310, 5);
    expect(mappedWrist[1]).toBeCloseTo(female ? 320 : 348, 5);
    for (const raised of [0, .25, .5, .75, 1]) {
      const [x, y] = portraitArmPoint(...wrist as [number, number], raised, female, true);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    const raised = portraitArmPoint(...wrist as [number, number], 1, female, true);
    const originalRaised = portraitArmPoint(...wrist as [number, number], 1, female);
    raised.forEach((value, axis) => expect(value).toBeCloseTo(originalRaised[axis], 8));
  }
  const speaking = { gesture: "rest", mood: "neutral", viseme: "fv", voiceLevel: .15 } as const;
  expect(portraitFrame(speaking, 0, false).lipContact).toBeGreaterThan(0);
  for (const voiceLevel of [0, .025, Number.NaN]) {
    const frame = portraitFrame({ ...speaking, voiceLevel }, 0, false);
    expect(frame.lipContact).toBe(0);
    expect(frame.mouthOpen).toBe(0);
  }
});

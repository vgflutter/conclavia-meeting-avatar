import { expect, test, type Page } from "@playwright/test";

const shapes = ["rest", "mbp", "fv", "a", "e", "o", "u", "consonant"];

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

async function openStudio(page: Page) {
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await expect(page.locator('svg[data-appearance="business_clay_female"]')).toBeVisible();
}

test("illustrated faces: subtle skin shading, soft chin and distinct silhouettes without shadow filters", async ({ page }, testInfo) => {
  await page.goto("/avatar");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  const avatar = page.locator("svg[data-appearance]");
  const head = avatar.locator('path[class*="avatarHead"]');
  await expect(avatar).toHaveAttribute("data-design", "editorial-comic");
  await expect(avatar.locator("linearGradient stop").first()).toHaveAttribute("stop-color", "#f0c9ae");
  await expect(avatar.locator('path[class*="chinDetail"]')).toHaveCount(0);
  await expect(avatar.locator("filter, radialGradient, image")).toHaveCount(0);
  const femalePath = await head.getAttribute("d");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await avatar.screenshot({ path: testInfo.outputPath("female-soft-chin.png") });
  // Both variants use the lighter illustrated design, retaining separate faces.
  await page.getByLabel("Avatar appearance").selectOption("business_clay");
  await expect(avatar.locator("linearGradient stop").first()).toHaveAttribute("stop-color", "#e9bd9c");
  await expect(avatar.locator('path[class*="chinDetail"]')).toHaveCount(0);
  await expect(avatar.locator("filter, radialGradient, image")).toHaveCount(0);
  expect(await head.getAttribute("d")).not.toBe(femalePath);
});

test("female rig: real controls preserve attached hand and mouth within the face", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStudio(page);
  const avatar = page.locator('svg[data-appearance="business_clay_female"]');
  for (let mood = 0; mood < 4; mood++) {
    for (const gesture of ["hand_raise", "rest"]) {
      await page.getByRole("button", { name: "Raise / lower hand" }).click();
      await expect(avatar).toHaveAttribute("data-hand-progress", gesture === "rest" ? "0.0000" : "1.0000");
      await expect(avatar.getByTestId("female-hair")).toHaveCount(1);
      expect(await avatar.locator("[data-avatar-face-clip] path").getAttribute("d"))
        .toBe(await avatar.locator('path[class*="avatarHead"]').getAttribute("d"));
      expect(await avatar.evaluate(node => {
        const head = node.querySelector('[class*="avatarHead"]')!.getBoundingClientRect();
        const mouth = node.querySelector('[data-testid="editorial-mouth"]')!.getBoundingClientRect();
        return mouth.left > head.left && mouth.right < head.right && mouth.top > head.top && mouth.bottom < head.bottom;
      })).toBe(true);
    }
    await avatar.screenshot({ path: testInfo.outputPath(`female-expression-${mood}.png`) });
    await page.getByRole("button", { name: "Change expression" }).click();
  }
});

test("female rig: breathing, head, gaze, blink and live reduced-motion changes", async ({ page }) => {
  // Install before navigation: otherwise the mounted rig may already have a
  // native RAF queued, outside the fake clock's timer queue.
  const clockStart = new Date("2026-09-19T12:00:00Z");
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 100));
  await openStudio(page);
  const avatar = page.locator('svg[data-appearance="business_clay_female"]');
  await page.clock.runFor(32);
  await expect(avatar).toHaveAttribute("data-animation-ready", "true");
  const parts = ['body', 'head', 'pupils', 'eyes', 'collar'];
  const transforms = async () => Promise.all(parts.map(part => avatar.locator(`[data-rig="${part}"]`).getAttribute("transform")));
  const initial = await transforms();
  await page.clock.runFor(4000);
  const idle = await transforms();
  expect(idle[0]).toBe(initial[0]);
  expect(idle[1]).not.toBe(initial[1]);
  expect(idle[2]).not.toBe(initial[2]);
  expect(idle[4]).not.toBe(initial[4]);
  const eyeFrames = new Set<string | null>();
  for (let i = 0; i < 180; i++) { await page.clock.runFor(16); eyeFrames.add(await avatar.locator('[data-rig="eyes"]').getAttribute("transform")); }
  expect(eyeFrames.size).toBeGreaterThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.clock.runFor(50);
  const reduced = await transforms(); await page.clock.runFor(2000);
  expect(await transforms()).toEqual(reduced);
  await page.getByRole("button", { name: "Raise / lower hand" }).evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(50);
  await expect(avatar).toHaveAttribute("data-hand-progress", "1.0000");
});

test("female sync: all phonemes, silence, device clock, stop and replay", async ({ page }, testInfo) => {
  const phones = shapes.slice(1).map((viseme, index) => ({ start: .2 + index * .6, end: .6 + index * .6, viseme }));
  const duration = 4.5;
  const bytes = Buffer.alloc(24000 * duration * 2);
  for (let i = 0; i < bytes.length / 2; i++) {
    const t = i / 24000;
    if (phones.some((phone) => t >= phone.start && t < phone.end)) bytes.writeInt16LE(Math.round(6000 * Math.sin(i / 24000 * 2 * Math.PI * 220)), i * 2);
  }
  await page.route("**/api/avatar/speech", (route) => route.fulfill({ contentType: "application/x-ndjson",
    body: JSON.stringify({ audio: bytes.toString("base64"), phones }) + '\n{"done":true}\n' }));
  await page.addInitScript(() => {
    const probe = { frames: [] as Array<{ shape: string; time: number }>, starts: 0, ended: 0 };
    Object.assign(window, { femaleSync: probe });
    let context: AudioContext | undefined; let start = 0;
    const nativeStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      context = this.context as AudioContext; start = args[0] || 0; probe.starts++;
      this.addEventListener("ended", () => { probe.ended++; });
      return nativeStart.apply(this, args);
    };
    new MutationObserver(() => {
      const svg = document.querySelector("svg[data-viseme]");
      if (!context || !svg) return;
      const stamp = context.getOutputTimestamp();
      if (stamp.contextTime === undefined || stamp.performanceTime === undefined) return;
      const time = stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000 - start;
      const shape = svg.getAttribute("data-viseme")!;
      if (probe.frames.at(-1)?.shape !== shape) probe.frames.push({ shape, time });
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-viseme"] });
  });
  await openStudio(page);
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-hand-progress", "1.0000");
  await page.getByRole("button", { name: "Change expression" }).click();
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  const result = await page.evaluate(() => (window as unknown as { femaleSync: {
    frames: Array<{ shape: string; time: number }>; starts: number; ended: number;
  } }).femaleSync);
  const drifts = phones.map((phone) => {
    const observed = result.frames.find((frame) => frame.shape === phone.viseme);
    expect(observed, phone.viseme).toBeDefined();
    const driftMs = (observed!.time - phone.start) * 1000;
    expect(Math.abs(driftMs), phone.viseme).toBeLessThan(100);
    const silence = result.frames.find((frame) => frame.shape === "rest" && frame.time > phone.start && frame.time < phone.end + .15);
    expect(silence, "silence after " + phone.viseme).toBeDefined();
    return { viseme: phone.viseme, driftMs };
  });
  expect(result.starts).toBe(1); expect(result.ended).toBe(1);
  const metrics = JSON.parse((await page.getByTestId("stream-playback-metrics").getAttribute("data-metrics"))!);
  expect(metrics.underruns).toBe(0);
  await testInfo.attach("female-sync.json", { body: JSON.stringify({ drifts, metrics, result }, null, 2), contentType: "application/json" });
  console.log("Female browser sync " + JSON.stringify({ drifts, metrics }));
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
  await page.getByRole("button", { name: "Stop voice" }).click();
  await expect(page.locator("svg[data-viseme]")).toHaveAttribute("data-viseme", "rest");
  await expect(page.locator("svg[data-viseme]")).toHaveAttribute("data-rendered-mouth-open", "0.0000");
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test("female viewport " + viewport.width + ": raised hand remains inside SVG", async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openStudio(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-hand-progress", "1.0000");
    const geometry = await page.getByTestId("editorial-articulated-arm").evaluate(hand => {
      const root = hand.closest("svg")!;
      const svg = root.getBoundingClientRect();
      // Check the painted parts too: a stale wrist transform must not be hidden
      // by accepting only an aggregate group bound or the target-pose dataset.
      // The sleeve is behind the jacket fill; the hand remains in front.
      return [hand, ...root.querySelectorAll('[data-rig="palm"], [data-rig="forearm"], [class*="raisedCuff"]')].map(part => {
        const box = part.getBoundingClientRect();
        return { part: part.getAttribute("data-rig") ?? "cuff", left: box.left >= svg.left - 1,
          right: box.right <= svg.right + 1, top: box.top >= svg.top - 1, bottom: box.bottom <= svg.bottom + 1 };
      });
    });
    expect(geometry.some(({ part }) => part === "forearm")).toBe(true);
    for (const { part, ...bounds } of geometry) expect(Object.values(bounds).every(Boolean), part).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("female-" + viewport.width + ".png"), fullPage: true });
  });
}

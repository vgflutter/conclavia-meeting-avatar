import { expect, test, type Page } from "@playwright/test";

const moods = ["neutral", "friendly", "focused", "confident"];
const shapes = ["rest", "mbp", "fv", "a", "e", "o", "u", "consonant"];
const classes = ["mouthRest", "mouthMbp", "mouthFv", "mouthA", "mouthE", "mouthO", "mouthU", "mouthConsonant"];

test.beforeEach(async ({ request, page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  const { profile } = await (await request.get("/api/avatar")).json();
  expect((await request.patch("/api/avatar", { data: {
    displayName: profile.displayName, role: profile.role, appearance: "business_clay_female",
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate,
  } })).status()).toBe(200);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

async function openStudio(page: Page) {
  await page.goto("/avatar/test");
  await expect(page.locator('svg[data-appearance="business_clay_female"]')).toBeVisible();
}

test("female rig: all 64 expression, mouth and hand combinations", async ({ page }, testInfo) => {
  await openStudio(page);
  const avatar = page.locator('svg[data-appearance="business_clay_female"]');
  // Controlled CSS rig inspection, separate from the React/audio integration below.
  for (const mood of moods) for (const gesture of ["rest", "hand_raise"]) for (const shape of shapes) {
    await avatar.evaluate((svg, pose) => {
      svg.dataset.mood = pose.mood;
      svg.dataset.gesture = pose.gesture;
      svg.dataset.viseme = pose.shape;
      svg.style.setProperty("--jaw-open", pose.shape === "rest" ? "0" : ".8");
    }, { mood, gesture, shape });
    const visible = await avatar.locator('g[class*="mouthShape"]').evaluateAll((nodes) =>
      nodes.filter((node) => Number(getComputedStyle(node).opacity) > .9).map((node) => node.getAttribute("class")));
    expect(visible).toHaveLength(1);
    expect(visible[0]).toContain(classes[shapes.indexOf(shape)]);
    await expect(avatar.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", gesture === "rest" ? "0" : "1");
    expect(await avatar.locator('[data-testid="female-hair"]').count()).toBe(1);
    const head = await avatar.locator('path[class*="avatarHead"]').getAttribute("d");
    expect(await avatar.locator("#avatar-face-clip path").getAttribute("d")).toBe(head);
  }
  // Inspect eight representative poses on one board, retaining actual SVG/CSS.
  await avatar.evaluate((svg) => {
    const board = document.createElement("div");
    board.id = "pose-board";
    Object.assign(board.style, { display: "grid", gridTemplateColumns: "repeat(4, 240px)", gap: "16px", padding: "24px", background: "#101d17", color: "#e7eddf" });
    for (const gesture of ["rest", "hand_raise"]) for (const mood of ["neutral", "friendly", "focused", "confident"]) {
      const cell = document.createElement("div");
      const clone = svg.cloneNode(true) as SVGElement;
      clone.dataset.mood = mood; clone.dataset.gesture = gesture; clone.dataset.viseme = "rest";
      clone.style.cssText = "width:240px;height:280px;--jaw-open:0";
      const label = document.createElement("p"); label.textContent = mood + " · " + (gesture === "rest" ? "rest" : "hand raised");
      cell.append(clone, label); board.append(cell);
    }
    document.body.replaceChildren(board);
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
      else animation.finish();
    }
  });
  await page.locator("#pose-board").screenshot({ path: testInfo.outputPath("female-pose-board.png") });
});

test("female rig: breathing, blink, eye movement and reduced motion", async ({ page }) => {
  await openStudio(page);
  const parts = [
    { selector: 'g[class*="avatarBody"]', times: [0, 2900] },
    { selector: 'g[class*="avatarEyes"]', times: [0, 2490] },
    { selector: 'g[class*="pupils"]', times: [0, 4200] },
  ];
  for (const { selector, times } of parts) {
    const transforms = await page.locator(selector).evaluate((node, times) => {
      const animation = node.getAnimations()[0]; if (!animation) return [];
      animation.pause();
      return times.map((time) => { animation.currentTime = time; return getComputedStyle(node).transform; });
    }, times);
    expect(transforms).toHaveLength(2);
    expect(transforms[0]).not.toBe(transforms[1]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const { selector } of parts) await expect(page.locator(selector)).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(page.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", "1");
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
  await expect(page.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", "1");
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
  await expect(page.locator("svg[data-viseme]")).toHaveCSS("--jaw-open", "0");
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test("female viewport " + viewport.width + ": raised hand remains inside SVG", async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openStudio(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(page.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", "1");
    const geometry = await page.locator('g[class*="raisedHand"]').evaluate((hand) => {
      const box = hand.getBoundingClientRect();
      const svg = hand.closest("svg")!.getBoundingClientRect();
      return { left: box.left >= svg.left - 1, right: box.right <= svg.right + 1, top: box.top >= svg.top - 1, bottom: box.bottom <= svg.bottom + 1 };
    });
    expect(Object.values(geometry).every(Boolean)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("female-" + viewport.width + ".png"), fullPage: true });
  });
}

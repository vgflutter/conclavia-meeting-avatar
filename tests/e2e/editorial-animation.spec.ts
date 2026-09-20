import { expect, test, type Locator } from "@playwright/test";
import { advanceEditorialMouth, advanceEditorialSpring, editorialMouthPaths, editorialMouthTarget, editorialPresence, editorialArmPose } from "../../src/lib/editorial-motion";
import { installVoiceProbe } from "./voice-probe";

// Sample the rendered filled silhouette in SVG space, including nested sleeve
// transforms. A path bounding box alone misses a shoulder that flares locally.
async function jacketSilhouette(avatar: Locator) {
  return avatar.evaluate(svg => {
    const root = svg as SVGSVGElement;
    const paths = [...root.querySelectorAll<SVGPathElement>(
      '[class*="suitBack"], [class*="leftArm"], [data-rig="upper-arm"], [data-rig="forearm"]',
    )].map(path => ({ path, inverse: path.getScreenCTM()!.inverse() }));
    const matrix = root.getScreenCTM()!;
    return [515, 540, 570, 620, 700, 740].map(y => {
      const filled: number[] = [];
      for (let x = 0; x < 680; x++) {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        if (paths.some(({ path, inverse }) => path.isPointInFill(point.matrixTransform(inverse)))) filled.push(x);
      }
      return { y, left: filled[0], right: filled[filled.length - 1] };
    });
  });
}

test("editorial rig: phonemes scale with finite audio energy and close in the same update", () => {
  for (const viseme of ["rest", "mbp", "a", "e", "o", "u", "fv", "consonant"] as const) {
    for (const energy of [0, .01, .025, Number.NaN, Number.POSITIVE_INFINITY]) expect(editorialMouthTarget(viseme, energy).open).toBe(0);
    const target = editorialMouthTarget(viseme, .35);
    const quiet = editorialMouthTarget(viseme, .06);
    expect(quiet.open).toBeLessThanOrEqual(target.open);
    const transition = advanceEditorialMouth(editorialMouthTarget("rest", 0), target, .022);
    expect(transition.open).toBeCloseTo(target.open * (1 - Math.exp(-1)), 6);
    expect(advanceEditorialMouth(transition, editorialMouthTarget(viseme, 0), 0).open).toBe(0);
  }
  // Coordinated upper-lip mobility stays under one SVG unit; the lower lip
  // carries the opening, instead of the entire mouth sliding down the face.
  const coordinates = (open: number) => editorialMouthPaths({ open, width: 1, round: .2 }).upper.match(/-?\d+(?:\.\d+)?/gu)!.map(Number);
  const quiet = coordinates(.1), loud = coordinates(1);
  quiet.forEach((value, index) => expect(Math.abs(value - loud[index])).toBeLessThan(1));
  expect(quiet).not.toEqual(loud);
});

test("editorial rig: continuous arm reversals and frame-rate independent settling", () => {
  const samples = [];
  for (const fps of [15, 30, 120]) {
    let state = { value: 0, velocity: 0 };
    for (let i = 0; i < fps / 5; i++) state = advanceEditorialSpring(state, 1, 1 / fps, false);
    samples.push(state.value);
    const previous = state.value;
    state = advanceEditorialSpring(state, 0, 1 / fps, false);
    expect(Math.abs(state.value - previous)).toBeLessThan(.19);
    for (let i = 0; i < fps * 2; i++) state = advanceEditorialSpring(state, 0, 1 / fps, false);
    expect(state).toEqual({ value: 0, velocity: 0 });
  }
  expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(.0001);
  expect(advanceEditorialSpring({ value: .4, velocity: 3 }, 1, .016, true)).toEqual({ value: 1, velocity: 0 });
});

test("editorial presence: stable torso, eyes anticipate finite head actions and sustained pauses", () => {
  for (let t = 0; t <= 90; t += .1) {
    for (const speaking of [0, .7, 1]) expect(editorialPresence(t, speaking, .5, false).body).toBe(0);
  }
  expect(editorialPresence(3.4, 0, 0, false).gaze).toBeGreaterThan(2);
  expect(editorialPresence(3.4, 0, 0, false).head).toBe(0);
  expect(editorialPresence(3.9, 0, 0, false).head).toBeGreaterThan(1);
  for (const t of [0, 1, 2, 6, 7, 8, 9, 15, 16, 17, 18, 23, 24, 29, 31, 35, 40]) {
    const frame = editorialPresence(t, 0, 0, false);
    expect([frame.head, frame.gaze, frame.nod, frame.settle]).toEqual([0, 0, 0, 0]);
  }
  expect(editorialPresence(1, 0, 0, true)).toEqual(editorialPresence(12, 1, 0, true));
  const rest = editorialArmPose(0);
  expect(rest.wrist.y).toBeGreaterThan(760);
  expect(rest.wrist.x).toBeGreaterThan(520);
  for (let r = 0; r <= 1; r += .01) {
    const pose = editorialArmPose(r);
    expect(Number.isFinite(pose.angle)).toBe(true);
    expect(pose.wrist.x).toBeGreaterThan(520);
  }
});

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`editorial ${appearance}: one attached arm, one mouth and audio stop with reduced motion`, async ({ page }, info) => {
    const writes: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/avatar" && request.method() !== "GET") writes.push(request.method());
    });
    await installVoiceProbe(page);
    await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const avatar = page.locator('svg[data-design="editorial-comic"]');
    await expect(avatar).toHaveAttribute("data-animation-ready", "true");
    await expect(avatar).toHaveAttribute("data-reduced-motion", "true");
    const restingSilhouette = await jacketSilhouette(avatar);
    for (const row of restingSilhouette) {
      // The torso is centred at x=341. Both relaxed sleeves must have similar
      // bulk at the shoulder, upper arm and cuff, not only the same top edge.
      expect(Math.abs((341 - row.left) - (row.right - 341)), `Uneven sleeves at y=${row.y}`).toBeLessThanOrEqual(4);
    }
    const restingFace = await avatar.locator('[data-rig="face-outline"]').getAttribute("d");
    const resting = await avatar.locator('[data-rig="wrist"]').getAttribute("transform");
    await avatar.screenshot({ path: info.outputPath(`${appearance}-rest.png`) });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(avatar).toHaveAttribute("data-hand-progress", "1.0000");
    await expect(avatar.locator('[data-rig="wrist"]')).not.toHaveAttribute("transform", resting!);
    await expect(page.getByTestId("avatar-resting-arm")).toHaveCSS("opacity", "1");
    const raisedSilhouette = await jacketSilhouette(avatar);
    expect(raisedSilhouette.map(row => row.left)).toEqual(restingSilhouette.map(row => row.left));
    await info.attach("jacket-silhouette.json", { body: JSON.stringify({ restingSilhouette, raisedSilhouette }), contentType: "application/json" });
    await avatar.screenshot({ path: info.outputPath(`${appearance}-raised.png`) });
    await page.getByRole("button", { name: "Listen to voice" }).click();
    await expect.poll(async () => Number(await avatar.getAttribute("data-rendered-mouth-open"))).toBeGreaterThan(.2);
    await expect(avatar.locator('[data-mouth-part="cavity"]')).toHaveCount(1);
    await expect(avatar.locator('[data-rig="face-outline"]')).not.toHaveAttribute("d", restingFace!);
    expect(await avatar.evaluate(svg => svg.querySelector('[data-avatar-face-clip] path')?.getAttribute("d")
      === svg.querySelector('[data-rig="face-outline"]')?.getAttribute("d"))).toBe(true);
    await avatar.screenshot({ path: info.outputPath(`${appearance}-speaking.png`) });
    await page.getByRole("button", { name: "Stop voice" }).click();
    await expect(avatar).toHaveAttribute("data-rendered-mouth-open", "0.0000");
    await expect(avatar.locator('[data-mouth-part="cavity"]')).toHaveAttribute("opacity", "0");
    await expect(avatar.locator('[data-rig="face-outline"]')).toHaveAttribute("d", restingFace!);
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(avatar).toHaveAttribute("data-hand-progress", "0.0000");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(avatar).toHaveAttribute("data-reduced-motion", "false");
    await expect.poll(async () => Math.abs(Number(await avatar.getAttribute("data-head-orientation")))).toBeGreaterThan(.2);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toEqual([]);
  });
}

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`editorial ${appearance}: forty-second rest keeps hands below the waist and torso fixed`, async ({ page }, info) => {
    await page.goto("/avatar/test");
    await page.locator('select').filter({ has: page.locator('option[value="editorial"]') }).selectOption("editorial");
    await page.locator('select').filter({ has: page.locator('option[value="business_clay"]') }).selectOption(appearance);
    const clockStart = new Date("2026-09-19T12:00:00Z");
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.getTime() + 100));
    await page.clock.runFor(32);
    const avatar = page.locator('svg[data-design="editorial-comic"]');
    const torso = await avatar.locator('[class*="suitBack"]').boundingBox();
    const frames: Array<{ second: number; head: string | null; gaze: string | null }> = [];
    for (let second = 0; second < 40; second++) {
      await page.clock.runFor(1000);
      expect(await avatar.locator('[class*="suitBack"]').boundingBox()).toEqual(torso);
      const hand = await avatar.locator('[data-rig="palm"]').evaluate(palm => {
        const svg = palm.closest("svg")!;
        const hand = palm.getBoundingClientRect();
        const matrix = svg.getScreenCTM()!;
        const waist = new DOMPoint(340, 700).matrixTransform(matrix);
        return { handTop: hand.top, waistY: waist.y };
      });
      expect(hand.handTop).toBeGreaterThan(hand.waistY);
      frames.push({ second, head: await avatar.locator('[data-rig="head"]').getAttribute("transform"), gaze: await avatar.locator('[data-rig="pupils"]').getAttribute("transform") });
    }
    expect(new Set(frames.map(frame => frame.head)).size).toBeGreaterThan(2);
    expect(new Set(frames.map(frame => frame.gaze)).size).toBeGreaterThan(2);
    // More than half the observation is a genuinely held pose, rather than an oscillator sampled at its extremes.
    const neutral = frames[8].head;
    expect(frames.filter(frame => frame.head === neutral).length).toBeGreaterThan(25);
    await info.attach("forty-second-presence.json", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
  });
}


test("editorial rounded vowels: cavity and lip contours change while teeth withdraw", async ({ page }) => {
  const phones = ["a", "e", "o", "u"].map((viseme, index) => ({ start: .2 + index * .8, end: .85 + index * .8, viseme }));
  const bytes = Buffer.alloc(24000 * 4 * 2);
  for (let i = 0; i < bytes.length / 2; i++) {
    if (phones.some(phone => i / 24000 >= phone.start && i / 24000 < phone.end)) bytes.writeInt16LE(Math.round(6500 * Math.sin(i / 24000 * Math.PI * 440)), i * 2);
  }
  await page.route("**/api/avatar/speech", route => route.fulfill({ contentType: "application/x-ndjson",
    body: JSON.stringify({ audio: bytes.toString("base64"), phones }) + '\n{"done":true}\n' }));
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
  const avatar = page.locator('svg[data-design="editorial-comic"]');
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    await page.getByRole("button", { name: "Listen to voice" }).click();
    const shapes: string[] = [];
    for (const phone of phones) {
      await expect(avatar).toHaveAttribute("data-viseme", phone.viseme);
      await expect.poll(async () => Number(await avatar.getAttribute("data-rendered-mouth-open"))).toBeGreaterThan(.12);
      if (phone.viseme === "o" || phone.viseme === "u") {
        await expect.poll(async () => Number(await avatar.locator('[data-mouth-part="teeth"]').getAttribute("opacity"))).toBeLessThan(.15);
      }
      shapes.push((await avatar.locator('[data-mouth-part="cavity"]').getAttribute("d"))!);
      expect(await avatar.evaluate(svg => {
        const face = svg.querySelector('[data-rig="face-outline"]')!.getBoundingClientRect();
        return [...svg.querySelectorAll('[data-mouth-part="upperLip"], [data-mouth-part="lowerLip"]')].every(part => {
          const lip = part.getBoundingClientRect();
          return lip.left > face.left && lip.right < face.right && lip.bottom < face.bottom;
        });
      })).toBe(true);
    }
    expect(new Set(shapes).size).toBe(4);
    await page.getByRole("button", { name: "Stop voice" }).click();
    await expect(avatar).toHaveAttribute("data-rendered-mouth-open", "0.0000");
  }
});

import { expect, test } from "@playwright/test";
import { installVoiceProbe } from "./voice-probe";
import { portraitFrame } from "../../src/lib/portrait-animation";
import type { AvatarViseme } from "../../src/lib/avatar-visemes";

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

test("animated portrait: four poses, expressions, no saves or voice calls", async ({ page, request }, info) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const errors: string[] = [];
  const calls: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET") calls.push(r.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/avatar/test");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const voices = await page.getByTestId("preview-voices").innerText();
    await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
    const portrait = page.getByTestId("avatar-portrait");
    await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    await expect(portrait).toHaveAttribute("data-appearance", appearance);
    await expect(portrait).toHaveAttribute("data-lipsync", "audio-visemes");
    await expect(page.locator("#avatar-style-help")).toContainText("simplified audio-driven lip sync");
    await expect(page.getByRole("button", { name: "Change expression" })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    const imageUrl = await portrait.getAttribute("data-asset");
    expect(imageUrl).toMatch(/^\/_next\/static\/media\/portraits-2-5d-adult-v3/);
    expect((await request.get(imageUrl!)).ok()).toBe(true);
    for (const raised of [false, true]) {
      await expect(portrait).toHaveAttribute("data-gesture", raised ? "hand_raise" : "rest");
      await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-hand-raised", String(raised));
      await page.locator("[data-avatar-stage]").screenshot({ path: info.outputPath(`${appearance}-${raised ? "raised" : "rest"}.png`) });
      await page.getByRole("button", { name: "Raise / lower hand" }).click();
    }
    const neutral = await portrait.locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByRole("button", { name: "Change expression" }).click();
    await expect.poll(() => portrait.locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(neutral);
    await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
    await expect(page.getByTestId("preview-voices")).toHaveText(voices);
    await expect(page.getByRole("button", { name: "Change expression" })).toBeVisible();
  }
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("portrait mouth follows synthetic PCM and resets on stop", async ({ page }, info) => {
  await installVoiceProbe(page);
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  const portrait = page.getByTestId("avatar-portrait");
  await expect(portrait).toHaveAttribute("data-speaking", "false");
  const canvas = portrait.getByTestId("portrait-canvas");
  await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(portrait).toHaveAttribute("data-speaking", "true");
  expect(Number(await portrait.getByRole("meter").getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute("data-rendered-viseme", "a");
  await expect.poll(async () => Number(await canvas.getAttribute("data-rendered-mouth-open"))).toBeGreaterThan(.5);
  await portrait.screenshot({ path: info.outputPath("speaking.png") });
  await page.getByRole("button", { name: "Stop voice" }).click();
  await expect(portrait).toHaveAttribute("data-speaking", "false");
  await expect(portrait.locator('[role="meter"]')).toHaveAttribute("aria-valuenow", "0");
  await expect(canvas).toHaveAttribute("data-mouth-open", "0");
});

test("portrait saves, reloads, preserves legacy choices and reaches the meeting renderer through tunnel-safe assets", async ({ page, request }) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const identity = { displayName: before.displayName, role: before.role, appearance: before.appearance,
    responseStyle: before.personality.responseStyle, attitude: before.personality.attitude, voiceStyle: before.voice.style };
  let id: string | undefined;
  try {
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
    await page.getByRole("link", { name: "Identity & behaviour", exact: true }).click();
    await expect(page.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    await page.getByRole("button", { name: "Save avatar", exact: true }).click();
    await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Avatar style", { exact: true })).toHaveValue("portrait_2_5d");
    await expect(page.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    const saved = (await (await request.get("/api/avatar")).json()).profile;
    expect((await request.patch("/api/avatar", { data: identity })).ok()).toBe(true);
    const legacy = (await (await request.get("/api/avatar")).json()).profile;
    expect(legacy.visualStyle).toBe("portrait_2_5d");
    expect(legacy.voice).toEqual(saved.voice);
    const created = await request.post("/api/meetings", { data: {
      title: "E2E portrait trial", objective: "Renderer only", meetingUrl: "https://teams.microsoft.com/l/meetup-join/portrait-test",
      scheduledStart: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 30,
      timezone: "Europe/Rome", language: "en", autoJoin: false, correctionPolicy: "important_only", agenda: [],
    } });
    expect(created.status()).toBe(201);
    const { meeting } = await created.json(); id = meeting.id;
    await page.goto("/meeting-room/" + meeting.bot.outputToken);
    const portrait = page.getByTestId("avatar-portrait");
    await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    const state = await (await request.get(`/api/meeting-room/${meeting.bot.outputToken}/state?after=`)).json();
    expect(state.visualStyle).toBe("portrait_2_5d");
    const asset = await portrait.getAttribute("data-asset");
    const tunnelHeaders = { "x-forwarded-host": "avatar-check.trycloudflare.com" };
    expect((await request.get(asset!, { headers: tunnelHeaders })).status()).toBe(200);
    expect((await request.get((await portrait.getAttribute("data-features-asset"))!, { headers: tunnelHeaders })).status()).toBe(200);
    expect((await request.get((await portrait.getAttribute("data-layers-asset"))!, { headers: tunnelHeaders })).status()).toBe(200);
    expect((await request.get("/api/avatar", { headers: tunnelHeaders })).status()).toBe(404);
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: "editorial" } });
    await expect(page.locator('svg[data-design="editorial-comic"]')).toBeVisible();
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: "portrait_2_5d" } });
    await expect(page.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    expect((await (await request.get("/api/meetings/" + id)).json()).meeting.bot.outputToken).toBe(meeting.bot.outputToken);
  } finally {
    await page.goto("about:blank");
    if (id) await request.delete("/api/meetings/" + id);
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: before.visualStyle || "editorial",
      inworldVoiceIdIt: before.voice.inworldVoiceIdIt, inworldVoiceIdEn: before.voice.inworldVoiceIdEn } });
  }
});

for (const asset of ["portraits-2-5d-adult-v3", "portraits-2-5d-adult-features-v3", "portraits-2-5d-arm-layers-v2"]) test(`portrait image failure shows an explicit fallback: ${asset}`, async ({ page }) => {
  await page.route(new RegExp("/_next/static/media/" + asset + "[^/]*\\.png"), route => route.abort());
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  await expect(page.getByTestId("avatar-portrait")).toHaveAttribute("data-renderer", "fallback-2d");
  await expect(page.getByText("2.5D non disponibile / unavailable · 2D", { exact: true })).toBeVisible();
  await expect(page.locator('svg[data-design="editorial-comic"]')).toBeVisible();
  await expect(page.getByLabel("Avatar style", { exact: true })).toHaveValue("portrait_2_5d");
});

test("portrait respects reduced motion and fits both appearances and poses on small screens", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  const portrait = page.getByTestId("avatar-portrait");
  await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    for (const gesture of ["rest", "hand_raise"]) {
      await expect(portrait).toHaveAttribute("data-gesture", gesture);
      await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-head-tilt", "0.00000");
      await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-blink", "0.000");
      const bounds = await portrait.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("[data-avatar-stage]").screenshot({ path: info.outputPath(`${appearance}-${gesture}-mobile.png`) });
      await page.getByRole("button", { name: "Raise / lower hand" }).click();
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Resuming ambient motion must not restore the removed continuous head sway.
  // The discrete head actions have their own timed checks in portrait-idle.
  await expect(portrait.getByTestId("portrait-canvas")).toHaveAttribute("data-head-tilt", "0.00000");
  await expect.poll(async () => Number(await portrait.getByTestId("portrait-canvas").getAttribute("data-chest-breath"))).toBeGreaterThan(0);
});

test("portrait phonemes are immediate and silence/reduced motion cannot leave an open mouth", () => {
  const pose = { viseme: "a" as AvatarViseme, voiceLevel: .8, mood: "neutral" as const, gesture: "rest" as const };
  for (const viseme of ["rest", "mbp", "fv", "a", "e", "o", "u", "consonant"] as const) {
    const frame = portraitFrame({ ...pose, viseme }, 4.79, true);
    expect(frame.mouthOpen > 0).toBe(!["rest", "mbp"].includes(viseme));
    expect(frame.blink).toBe(0); expect(frame.tilt).toBe(0); expect(frame.breath).toBe(0);
    for (const voiceLevel of [0, .01, Number.NaN]) expect(portraitFrame({ ...pose, viseme, voiceLevel }, 1, false).mouthOpen).toBe(0);
  }
  expect(portraitFrame(pose, 4.79, false).blink).toBeCloseTo(1);
  expect(portraitFrame(pose, 5, false).blink).toBe(0);
});

test("portrait crops the atlas in tall and wide viewports, including both raised poses", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  const portrait = page.getByTestId("avatar-portrait");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    await expect(page.getByTestId("portrait-canvas")).toHaveAttribute("data-renderer-ready", "true");
    for (const raised of [false, true]) {
      await expect(page.getByTestId("portrait-canvas")).toHaveAttribute("data-hand-raised", String(raised));
      for (const tall of [true, false]) {
        await portrait.evaluate((el, tall) => { el.style.width = tall ? "300px" : "600px"; el.style.height = tall ? "600px" : "300px"; }, tall);
        await expect.poll(() => portrait.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width / c.height)).toBeCloseTo(tall ? .5 : 2);
        // The former SVG painted the next portrait in these letterbox regions.
        const pixels = await portrait.locator("canvas").evaluate((c: HTMLCanvasElement, tall) => {
          const copy = document.createElement("canvas"); copy.width = c.width; copy.height = c.height;
          const ctx = copy.getContext("2d")!; ctx.drawImage(c, 0, 0);
          return [.03, .1, .9, .97].flatMap(n => [.03, .25, .5, .75, .97].map(cross => [...ctx.getImageData(Math.floor(c.width * (tall ? cross : n)), Math.floor(c.height * (tall ? n : cross)), 1, 1).data]));
        }, tall);
        expect(pixels).toEqual(Array(20).fill([251, 245, 234, 255]));
        await portrait.screenshot({ path: info.outputPath(`${appearance}-${raised}-${tall ? "tall" : "wide"}.png`) });
      }
      await page.getByRole("button", { name: "Raise / lower hand" }).click();
    }
  }
});

test("portrait blinks without continuous head sway and safely falls back on GPU context loss", async ({ page }, info) => {
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
  const canvas = page.getByTestId("portrait-canvas");
  await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-testid="portrait-canvas"]')?.dataset.blink) > .9);
    await canvas.screenshot({ path: info.outputPath(`${appearance}-blink.png`) });
    await expect(canvas).toHaveAttribute("data-head-tilt", "0.00000");
    await expect(canvas).toHaveAttribute("data-body-lean", "0.00000");
  }
  await canvas.locator("canvas").evaluate((c: HTMLCanvasElement) => c.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.getByTestId("avatar-portrait")).toHaveAttribute("data-renderer", "fallback-2d");
  await expect(page.locator('svg[data-design="editorial-comic"]')).toBeVisible();
});

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`portrait audio-clock sync and vowel textures: ${appearance}`, async ({ page }, info) => {
    const phones = ["a", "e", "o", "u", "fv", "consonant", "mbp"].map((viseme, i) => ({ start: .2 + i, end: .95 + i, viseme }));
    const pcm = Buffer.alloc(24000 * 2 * 7.5);
    for (let i = 0; i < pcm.length / 2; i++) {
      if (phones.some(p => i / 24000 >= p.start && i / 24000 < p.end)) pcm.writeInt16LE(Math.round(6000 * Math.sin(i * Math.PI / 30)), i * 2);
    }
    await page.route("**/api/avatar/speech", route => route.fulfill({ contentType: "application/x-ndjson",
      body: JSON.stringify({ audio: pcm.toString("base64"), phones }) + '\n{"done":true}\n' }));
    await page.addInitScript(() => {
      const probe = { frames: [] as Array<{ shape: string; time: number }> };
      Object.assign(window, { portraitSync: probe });
      let context: AudioContext | undefined; let start = 0;
      const nativeStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        context = this.context as AudioContext; start = args[0] || 0;
        return nativeStart.apply(this, args);
      };
      new MutationObserver(() => {
        const element = document.querySelector<HTMLElement>('[data-testid="portrait-canvas"]');
        if (!context || !element) return;
        const stamp = context.getOutputTimestamp();
        if (stamp.contextTime === undefined || stamp.performanceTime === undefined) return;
        const shape = Number(element.dataset.renderedMouthOpen) > .015 ? element.dataset.renderedViseme! : "rest";
        const time = stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000 - start;
        if (probe.frames.at(-1)?.shape !== shape) probe.frames.push({ shape, time });
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-rendered-viseme", "data-rendered-mouth-open"] });
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const canvas = page.getByTestId("portrait-canvas");
    await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
    const mouthPixels = () => canvas.locator("canvas").evaluate((c: HTMLCanvasElement, female) => {
      const side = Math.min(c.width, c.height);
      const x = (c.width - side) / 2 + ((female ? 325 : 313) - 52) / 627 * side;
      const y = (c.height - side) / 2 + ((female ? 255 : 269) - 25) / 627 * side;
      const copy = document.createElement("canvas");
      copy.width = Math.round(104 / 627 * side); copy.height = Math.round(60 / 627 * side);
      copy.getContext("2d")!.drawImage(c, Math.round(x), Math.round(y), copy.width, copy.height, 0, 0, copy.width, copy.height);
      return copy.toDataURL();
    }, appearance.endsWith("female"));
    const closedMouth = await mouthPixels();
    const restingCorners = await canvas.locator("canvas").evaluate((c: HTMLCanvasElement, female) => {
      const copy = document.createElement("canvas"); copy.width = copy.height = 627;
      const ctx = copy.getContext("2d")!;
      const side = Math.min(c.width, c.height);
      ctx.drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, 627, 627);
      const mx = female ? 325 : 313, my = female ? 255 : 269;
      // Track the actual upper-lip texture beside each corner. Opening the
      // jaw must not pull these landmarks far toward the mouth centre.
      const height = female ? 6 : 4;
      return (female ? [[-34, -8], [27, -16]] : [[-29, -13], [24, -11]]).map(([dx, dy]) => ({
        x: mx + dx, y: my + dy, height, pixels: [...ctx.getImageData(mx + dx, my + dy, 7, height).data],
      }));
    }, appearance.endsWith("female"));
    await page.getByRole("button", { name: "Listen to voice" }).click();
    for (const shape of ["a", "e", "o", "u"]) {
      await expect(canvas).toHaveAttribute("data-rendered-viseme", shape);
      // A changing diagnostic attribute alone cannot prove that the shader
      // drew a speaking mouth. Check the actual rendered lip/jaw pixels too.
      await expect.poll(mouthPixels).not.toBe(closedMouth);
      // Outside the small mouth patch, cheeks must still match the original.
      // This catches inverse-scale warps that sample hair/background into skin.
      const cheekError = await canvas.locator("canvas").evaluate(async (c: HTMLCanvasElement, female) => {
        const source = new Image(); source.src = c.closest<HTMLElement>('[data-testid="avatar-portrait"]')!.dataset.asset!; await source.decode();
        // Raising the arm keeps the exact same resting face texture.
        const mouth = female ? [325, 255] : [313, 269];
        const actual = document.createElement("canvas"); actual.width = c.width; actual.height = c.height;
        const ctx = actual.getContext("2d")!; ctx.drawImage(c, 0, 0);
        const ref = document.createElement("canvas"); ref.width = c.width; ref.height = c.height;
        const refCtx = ref.getContext("2d")!;
        const side = Math.min(c.width, c.height), dx = (c.width - side) / 2, dy = (c.height - side) / 2;
        refCtx.drawImage(source, 0, female ? 627 : 0, 627, 627, dx, dy, side, side);
        let maxError = 0;
        for (const offset of [-70, -62, -55, 55, 62, 70]) {
          const x = Math.floor(dx + (mouth[0] + offset) / 627 * side), y = Math.floor(dy + mouth[1] / 627 * side);
          const a = ctx.getImageData(x, y, 1, 1).data, b = refCtx.getImageData(x, y, 1, 1).data;
          for (let i = 0; i < 3; i++) maxError = Math.max(maxError, Math.abs(a[i] - b[i]));
        }
        return maxError;
      }, appearance.endsWith("female"));
      expect(cheekError, `${shape}: unmodified cheeks`).toBeLessThan(15);
      if (shape === "o" || shape === "u") {
        const shifts = await canvas.locator("canvas").evaluate((c: HTMLCanvasElement, corners) => {
          const copy = document.createElement("canvas"); copy.width = copy.height = 627;
          const ctx = copy.getContext("2d")!;
          const side = Math.min(c.width, c.height);
          ctx.drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, 627, 627);
          return corners.map(corner => {
            let best = { error: Infinity, dx: 0 };
            for (let dx = -18; dx <= 18; dx++) for (let dy = -3; dy <= 3; dy++) {
              const actual = ctx.getImageData(corner.x + dx, corner.y + dy, 7, corner.height).data;
              let error = 0;
              for (let i = 0; i < actual.length; i++) if (i % 4 !== 3) error += (actual[i] - corner.pixels[i]) ** 2;
              if (error < best.error) best = { error, dx };
            }
            return best.dx;
          });
        }, restingCorners);
        expect(Math.max(...shifts.map(Math.abs)), `${shape}: lip corners move at most 5 atlas pixels`).toBeLessThanOrEqual(5);
      }
      await canvas.screenshot({ path: info.outputPath(`${appearance}-${shape}.png`) });
      if (shape === "e") await page.getByRole("button", { name: "Raise / lower hand" }).click();
    }
    await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
    await expect(canvas).toHaveAttribute("data-mouth-open", "0");
    await expect.poll(mouthPixels).toBe(closedMouth);
    const frames = await page.evaluate(() => (window as unknown as { portraitSync: { frames: Array<{ shape: string; time: number }> } }).portraitSync.frames);
    const drifts = phones.filter(p => p.viseme !== "mbp").map(phone => {
      const seen = frames.find(frame => frame.shape === phone.viseme);
      expect(seen, phone.viseme).toBeDefined();
      const driftMs = (seen!.time - phone.start) * 1000;
      expect(Math.abs(driftMs), phone.viseme).toBeLessThan(100);
      expect(frames.some(frame => frame.shape === "rest" && frame.time > phone.end && frame.time < phone.end + .15)).toBe(true);
      return { viseme: phone.viseme, driftMs };
    });
    const metrics = JSON.parse((await page.getByTestId("stream-playback-metrics").getAttribute("data-metrics"))!);
    expect(metrics.underruns).toBe(0);
    await info.attach("portrait-sync.json", { body: JSON.stringify({ appearance, drifts, metrics }), contentType: "application/json" });
    console.log("Portrait browser sync " + JSON.stringify({ appearance, drifts, metrics }));
  });
}

import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createRiggedAvatar } from "../../src/lib/rigged-avatar";
import { loadGeometryOnlyAvatar } from "./rigged-avatar-fixture";
import { installVoiceProbe } from "./voice-probe";

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

test("actual geometry: continuous wrist positions, morph deformation and bounded idle rotation", async () => {
  for (const female of [false, true]) {
    const gltf = await loadGeometryOnlyAvatar(female);
    const rig = createRiggedAvatar(gltf);
    const head = rig.bones.get("Head")!;
    const originalHead = head.quaternion.clone();
    const arm = rig.bones.get("LeftArm")!;
    const anchor = arm.position.clone();
    rig.update({ gesture: "rest" }, 1, 0, false);
    const positions: number[][] = [];
    for (let frame = 0; frame < 60; frame++) {
      positions.push(rig.update({ gesture: "hand_raise" }, 1 + frame / 60, 1 / 60).handPosition);
      expect(arm.position.distanceTo(anchor)).toBeLessThan(.00001);
    }
    expect(new Set(positions.map(p => p.map(v => v.toFixed(4)).join())).size).toBeGreaterThan(30);
    expect(positions.at(-1)![1] - positions[0][1]).toBeGreaterThan(.4);
    expect(Math.max(...positions.slice(1).map((p, i) => new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...positions[i]))))).toBeLessThan(.09);
    for (let frame = 0; frame < 600; frame++) rig.update({}, frame / 60, 1 / 60);
    expect(head.quaternion.angleTo(originalHead)).toBeLessThan(.05);
    let face: THREE.Mesh | undefined;
    rig.root.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.morphTargetDictionary?.eyeBlinkLeft !== undefined && mesh.name === (female ? "ConclaviaFemale" : "ConclaviaMale")) face = mesh; });
    expect(face).toBeDefined();
    const mouthDelta = face!.geometry.morphAttributes.position?.[face!.morphTargetDictionary!.viseme_aa];
    if (!mouthDelta) throw new Error("The actual avatar must contain mouth-deformation vertices");
    let maxDisplacement = 0;
    for (let i = 0; i < mouthDelta.count; i++) maxDisplacement = Math.max(maxDisplacement,
      Math.hypot(mouthDelta.getX(i), mouthDelta.getY(i), mouthDelta.getZ(i)));
    expect(face!.geometry.morphTargetsRelative).toBe(true);
    expect(maxDisplacement).toBeGreaterThan(.01);
    for (let frame = 0; frame < 4; frame++) rig.update({ viseme: "a", voiceLevel: .8 }, .095, 1 / 60);
    expect(face!.morphTargetInfluences![face!.morphTargetDictionary!.viseme_aa]).toBeGreaterThan(.6);
    expect(face!.morphTargetInfluences![face!.morphTargetDictionary!.eyeBlinkLeft]).toBeCloseTo(1, 3);
    rig.update({ viseme: "a", voiceLevel: 0 }, 1, 1 / 60, true);
    expect(face!.morphTargetInfluences![face!.morphTargetDictionary!.viseme_aa]).toBe(0);
    expect(face!.morphTargetInfluences![face!.morphTargetDictionary!.eyeBlinkLeft]).toBe(0);
    rig.dispose();
  }
});

test("browser: both models move through intermediate poses, speak and preserve the saved profile", async ({ page, request }, info) => {
  await installVoiceProbe(page);
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const canvas = page.getByTestId("avatar-3d-canvas");
    await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
    expect(Number(await canvas.getAttribute("data-bone-count"))).toBeGreaterThanOrEqual(52);
    await page.evaluate(() => {
      const points: Array<{ progress: number; wrist: string }> = [];
      Object.assign(window, { riggedFrames: points });
      const until = performance.now() + 2000;
      function sample() {
        const d = (document.querySelector('[data-testid="avatar-3d-canvas"]') as HTMLElement)?.dataset;
        if (d) points.push({ progress: Number(d.raiseProgress), wrist: d.handPosition! });
        if (performance.now() < until) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-hand-raised", "true");
    const frames = await page.evaluate(() => (window as unknown as { riggedFrames: Array<{ progress: number; wrist: string }> }).riggedFrames);
    expect(new Set(frames.filter(f => f.progress > .05 && f.progress < .95).map(f => f.wrist)).size).toBeGreaterThan(5);
    await canvas.screenshot({ path: info.outputPath(`${appearance}-raised.png`) });
    await page.getByRole("button", { name: "Change expression" }).click();
    await page.getByRole("button", { name: "Listen to voice" }).click();
    await expect(canvas).toHaveAttribute("data-mouth-open", "true");
    await expect(canvas).toHaveAttribute("data-rendered-viseme", "a");
    await page.getByRole("button", { name: "Stop voice" }).click();
    await expect(canvas).toHaveAttribute("data-mouth-open", "false");
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-hand-raised", "false");
  }
  expect(errors).toEqual([]);
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
});

test("public tunnel: only the two static models are exposed, not management or build files", async ({ request }) => {
  const headers = { "x-forwarded-host": "rig-check.trycloudflare.com" };
  for (const name of ["male", "female"]) {
    const response = await request.get(`/avatars/rigged-v1/${name}.glb`, { headers });
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    expect(bytes.length).toBeLessThan(12_000_000);
  }
  for (const path of ["/api/avatar", "/avatar", "/context", "/api/meetings", "/avatars/rigged-v1/male.blend", "/avatars/other.glb"]) {
    expect((await request.get(path, { headers })).status()).toBe(404);
  }
});

test("failed model download gives explicit fallback, not an empty canvas", async ({ page }) => {
  await page.route("**/avatars/rigged-v1/*.glb", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
  await expect(page.locator('[data-renderer="fallback-2d"]')).toBeVisible();
  await expect(page.getByText("3D non disponibile / unavailable · 2D", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Avatar style", { exact: true })).toHaveValue("stylized_3d");
});

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`rigged face follows the output audio clock: ${appearance}`, async ({ page }, info) => {
    const phones = ["a", "e", "o", "u", "fv", "consonant", "mbp"].map((viseme, i) => ({ start: .2 + i, end: .95 + i, viseme }));
    const pcm = Buffer.alloc(24000 * 2 * 7.5);
    for (let i = 0; i < pcm.length / 2; i++) if (phones.some(p => i / 24000 >= p.start && i / 24000 < p.end)) {
      pcm.writeInt16LE(Math.round(6000 * Math.sin(i * Math.PI / 30)), i * 2);
    }
    await page.route("**/api/avatar/speech", route => route.fulfill({ contentType: "application/x-ndjson",
      body: JSON.stringify({ audio: pcm.toString("base64"), phones }) + '\n{"done":true}\n' }));
    await page.addInitScript(() => {
      const probe = { frames: [] as Array<{ shape: string; time: number }>, gaps: [] as number[] };
      Object.assign(window, { riggedSync: probe });
      let context: AudioContext | undefined; let start = 0; let last = 0;
      const nativeStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        context = this.context as AudioContext; start = args[0] || 0;
        return nativeStart.apply(this, args);
      };
      function sample(now: number) {
        if (context && context.currentTime - start < 7.5) {
          if (last) probe.gaps.push(now - last);
          last = now;
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      new MutationObserver(() => {
        const element = document.querySelector<HTMLElement>('[data-testid="avatar-3d-canvas"]');
        if (!context || !element) return;
        const stamp = context.getOutputTimestamp();
        if (stamp.contextTime === undefined || stamp.performanceTime === undefined) return;
        const shape = element.dataset.renderedViseme!;
        const time = stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000 - start;
        if (probe.frames.at(-1)?.shape !== shape) probe.frames.push({ shape, time });
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-rendered-viseme"] });
    });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const canvas = page.getByTestId("avatar-3d-canvas");
    await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
    await page.getByRole("button", { name: "Listen to voice" }).click();
    await expect(canvas).toHaveAttribute("data-rendered-viseme", "a");
    await canvas.screenshot({ path: info.outputPath(`${appearance}-speaking-a.png`) });
    await expect(canvas).toHaveAttribute("data-rendered-viseme", "e");
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-rendered-viseme", "o");
    await canvas.screenshot({ path: info.outputPath(`${appearance}-speaking-o.png`) });
    await expect(canvas).toHaveAttribute("data-rendered-viseme", "u");
    await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
    await expect(canvas).toHaveAttribute("data-mouth-open", "false");
    const result = await page.evaluate(() => (window as unknown as { riggedSync: { frames: Array<{ shape: string; time: number }>; gaps: number[] } }).riggedSync);
    const drifts = phones.map(phone => {
      const seen = result.frames.find(frame => frame.shape === phone.viseme);
      expect(seen, phone.viseme).toBeDefined();
      const driftMs = (seen!.time - phone.start) * 1000;
      expect(Math.abs(driftMs), phone.viseme).toBeLessThan(100);
      return { viseme: phone.viseme, driftMs };
    });
    const metrics = JSON.parse((await page.getByTestId("stream-playback-metrics").getAttribute("data-metrics"))!);
    expect(metrics.underruns).toBe(0);
    result.gaps.sort((a, b) => a - b);
    const p95FrameMs = result.gaps[Math.floor(result.gaps.length * .95)];
    expect(p95FrameMs).toBeLessThan(55);
    const report = { appearance, drifts, p95FrameMs, metrics };
    await info.attach("rigged-audio-clock.json", { body: JSON.stringify(report), contentType: "application/json" });
    console.log("Rigged browser sync " + JSON.stringify(report));
  });
}

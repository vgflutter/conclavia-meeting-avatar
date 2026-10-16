import { expect, test } from "@playwright/test";

/** Real pinned WASM/model inference over the existing licensed local welcome clip.
 * Only the camera source is simulated: Worker, MediaPipe and the renderer are real.
 */
test("preflight runs the actual local face model and keeps the rendered guest avatar alive on air", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  const calls = { external: [] as string[], mutations: [] as string[], tracking: [] as string[], errors: [] as string[] };
  page.on("request", request => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3101") calls.external.push(request.url());
    if (request.method() !== "GET") calls.mutations.push(request.url());
    if (request.url().includes("/podcast/tracking-assets/")) calls.tracking.push(request.url().split("/").at(-1)!);
  });
  page.on("pageerror", error => calls.errors.push(error.message));
  await page.addInitScript(() => {
    const fixture = { cameraRequests: 0, audio: undefined as unknown, stopped: false };
    Object.assign(window, { realFaceFixture: fixture });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      fixture.cameraRequests++; fixture.audio = constraints.audio;
      const video = document.createElement("video");
      video.src = "/avatars/host-v1/avatar-welcome-it.mp4"; video.muted = true; video.loop = true; video.playsInline = true;
      await video.play();
      const canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 720;
      const c = canvas.getContext("2d")!;
      let animation = 0, active = true;
      const draw = () => { if (!active) return; if (video.readyState >= 2) c.drawImage(video, 0, 0, 480, 720); animation = requestAnimationFrame(draw); };
      draw();
      const stream = canvas.captureStream(15);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { active = false; cancelAnimationFrame(animation); video.pause(); video.removeAttribute("src"); video.load(); fixture.stopped = true; stop(); };
      }
      return stream;
    } });
  });
  await page.goto("/podcast/preview?style=paper-theatre&scenario=speaker&guest=reserve");
  const program = page.getByTestId("podcast-stage").locator("canvas");
  const fixtureState = () => page.evaluate(() => (window as unknown as { realFaceFixture: { cameraRequests: number; audio: unknown; stopped: boolean } }).realFaceFixture);
  await expect(program).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  expect(calls.tracking).toEqual([]);
  await page.getByTestId("podcast-open-preflight").click();
  expect((await fixtureState()).cameraRequests).toBe(0);
  await page.getByRole("radio", { name: /Avatar animato/u }).check();
  await page.getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(page.getByTestId("podcast-tracking-status")).toHaveAttribute("data-tracking", "tracking", { timeout: 60_000 });
  await expect(program).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  expect((await fixtureState()).audio).toBe(false);
  expect(calls.tracking).toContain("face-worker.js");
  expect(calls.tracking).toContain("vision-bundle.js");
  expect(calls.tracking).toContain("face_landmarker.task");
  expect(calls.tracking.some(name => name.endsWith(".wasm"))).toBe(true);
  const status = await page.getByTestId("podcast-tracking-status").innerText();
  await page.screenshot({ path: testInfo.outputPath("actual-local-face-model-preflight.png") });
  await page.getByTestId("podcast-guest-publish").click();
  await expect(program).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await expect(program).toHaveAttribute("data-podcast-guest-tracking", "tracking");
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    samples.push(Number(await program.getAttribute("data-podcast-guest-jaw")));
    await page.waitForTimeout(100);
  }
  expect(Math.max(...samples)).toBeGreaterThan(.04);
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(.02);
  await page.getByRole("button", { name: /^Vista programma/u }).click();
  await expect(page.locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await expect(page.locator("canvas[data-podcast-stage]")).toHaveAttribute("data-podcast-guest-tracking", "tracking");
  await page.screenshot({ path: testInfo.outputPath("actual-local-face-model-avatar-on-air.png") });
  await testInfo.attach("actual-face-model-summary", { body: JSON.stringify({ status, samples, trackingAssets: [...new Set(calls.tracking)], fixture: await fixtureState() }, null, 2), contentType: "application/json" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Spegni videocamera", exact: true }).click();
  expect((await fixtureState()).stopped).toBe(true);
  await expect(program).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  expect(calls.external).toEqual([]);
  expect(calls.mutations).toEqual([]);
  expect(calls.errors).toEqual([]);
});

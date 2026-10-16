import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3101";
async function installLocalGuestFixture(page: Page, permissionDelay = 0) {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await page.addInitScript(({ permissionDelay }) => {
    const fixture = { calls: 0, audio: undefined as unknown, stopped: 0, workers: 0, terminated: 0, frames: 0, face: "visible", permissionDelay };
    (window as unknown as { guestFixture: typeof fixture }).guestFixture = fixture;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      fixture.calls++; fixture.audio = constraints.audio;
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
      const context = canvas.getContext("2d")!;
      let n = 0;
      const draw = () => { context.fillStyle = n++ % 2 ? "#246b57" : "#256a58"; context.fillRect(0, 0, 320, 180); context.fillStyle = "#ffe0a0"; context.fillRect(110, 30, 100, 130); };
      draw(); const timer = window.setInterval(draw, 40);
      const stream = canvas.captureStream(25);
      for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { fixture.stopped++; window.clearInterval(timer); stop(); }; }
      if (fixture.permissionDelay) await new Promise(resolve => setTimeout(resolve, fixture.permissionDelay));
      return stream;
    } });
    const OriginalWorker = window.Worker;
    class TrackingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      stopped = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        if (!String(url).includes("/podcast/tracking-assets/face-worker.js")) return new OriginalWorker(url, options) as unknown as TrackingWorker;
        fixture.workers++;
      }
      postMessage(message: { type: string; bitmap?: ImageBitmap; capturedAt?: number }) {
        if (this.stopped) return;
        if (message.type === "init") { setTimeout(() => { if (!this.stopped) this.onmessage?.(new MessageEvent("message", { data: { type: "ready" } })); }, 10); return; }
        message.bitmap?.close(); fixture.frames++;
        const data = fixture.face === "error" ? { type: "error", message: "Fixture failure" } : { type: "result", frame: {
          detected: fixture.face === "visible", capturedAt: message.capturedAt,
          blendshapes: fixture.face === "visible" ? { jawOpen: .8, mouthSmileLeft: .6, mouthSmileRight: .6, browInnerUp: .5, eyeBlinkLeft: .1, eyeBlinkRight: .1 } : {},
          head: { yaw: .2, pitch: -.1, roll: .15 }, latencyMs: 12,
        } };
        setTimeout(() => { if (!this.stopped) this.onmessage?.(new MessageEvent("message", { data })); }, 2);
      }
      terminate() { if (!this.stopped) { this.stopped = true; fixture.terminated++; } }
    }
    Object.defineProperty(window, "Worker", { configurable: true, value: TrackingWorker });
  }, { permissionDelay });
}
const fixtureState = (page: Page) => page.evaluate(() => (window as unknown as { guestFixture: { calls: number; audio: unknown; stopped: number; workers: number; terminated: number; frames: number; face: string } }).guestFixture);
const program = (page: Page) => page.getByTestId("podcast-stage").locator("canvas[data-podcast-stage]");
const dialog = (page: Page) => page.getByTestId("podcast-guest-preflight");

// Measured geometry is synthetic here; the separately exercised real model owns inference acceptance.
test("preflight is off air until explicit apply, real video stays unchanged while drafting an avatar", async ({ page }) => {
  await installLocalGuestFixture(page);
  const mutations: string[] = [];
  page.on("request", request => { if (request.method() !== "GET") mutations.push(request.url()); });
  await page.goto("/podcast/preview");
  expect((await fixtureState(page)).calls).toBe(0);
  await page.getByTestId("podcast-open-preflight").click();
  await expect(dialog(page)).toBeVisible();
  expect((await fixtureState(page)).calls).toBe(0);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await expect(dialog(page).getByTestId("podcast-guest-publish")).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Spegni videocamera e togli dalla scena", exact: true })).toBeVisible();
  expect((await fixtureState(page)).audio).toBe(false);
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  await expect(dialog(page).getByTestId("podcast-preflight-preview").locator("canvas")).toHaveAttribute("data-podcast-guest-presentation", "video");
  await dialog(page).getByLabel("Mostra la videocamera privata di controllo", { exact: true }).check();
  await expect(dialog(page).getByTestId("podcast-private-camera")).toBeVisible();
  await dialog(page).getByTestId("podcast-guest-publish").click();
  await expect(dialog(page)).not.toBeVisible();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "video");
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("radio", { name: /Avatar animato/u }).check();
  await expect(dialog(page).getByTestId("podcast-tracking-status")).toHaveAttribute("data-tracking", "tracking");
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "video");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).not.toBeVisible();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "video");
  expect((await fixtureState(page)).stopped).toBe(0);
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("radio", { name: /Avatar animato/u }).check();
  await expect(dialog(page).getByTestId("podcast-tracking-status")).toHaveAttribute("data-tracking", "tracking");
  await dialog(page).getByTestId("podcast-guest-publish").click();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("radio", { name: /Video reale/u }).check();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await dialog(page).getByTestId("podcast-guest-publish").click();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "video");
  await page.getByRole("button", { name: "Spegni videocamera", exact: true }).click();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  expect((await fixtureState(page)).stopped).toBe(1);
  expect(mutations).toEqual([]);
});

test("published tracked avatar keeps draft changes private, neutralizes loss and failure, and survives program view", async ({ page }) => {
  await installLocalGuestFixture(page);
  await page.goto("/podcast/preview?style=paper-theatre&scenario=speaker");
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("radio", { name: /Avatar animato/u }).check();
  await dialog(page).getByLabel("Famiglia del personaggio ospite", { exact: true }).selectOption("expressive");
  await dialog(page).getByLabel("Aspetto del personaggio ospite", { exact: true }).selectOption("female");
  await dialog(page).getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(dialog(page).getByTestId("podcast-tracking-status")).toHaveAttribute("data-tracking", "tracking");
  const privateStage = dialog(page).getByTestId("podcast-preflight-preview").locator("canvas");
  await expect.poll(async () => Number(await privateStage.getAttribute("data-podcast-guest-jaw"))).toBeGreaterThan(.3);
  await dialog(page).getByRole("button", { name: "Centra la posizione della testa", exact: true }).click();
  await expect(dialog(page).getByText("Posizione centrale acquisita.", { exact: false })).toBeVisible();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  await dialog(page).getByTestId("podcast-guest-publish").click();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await expect(program(page)).toHaveAttribute("data-podcast-guest-cast", "expressive");
  await expect(program(page)).toHaveAttribute("data-podcast-guest-appearance", "female");
  await expect.poll(async () => Number(await program(page).getAttribute("data-podcast-guest-jaw"))).toBeGreaterThan(.3);
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByLabel("Famiglia del personaggio ospite", { exact: true }).selectOption("original");
  await expect(program(page)).toHaveAttribute("data-podcast-guest-cast", "expressive");
  await dialog(page).getByRole("radio", { name: /Video reale/u }).check();
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { (window as unknown as { guestFixture: { face: string } }).guestFixture.face = "lost"; });
  await expect(program(page)).toHaveAttribute("data-podcast-guest-tracking", "lost");
  await expect.poll(async () => Number(await program(page).getAttribute("data-podcast-guest-jaw"))).toBeLessThan(.02);
  await page.evaluate(() => { (window as unknown as { guestFixture: { face: string } }).guestFixture.face = "error"; });
  await expect(program(page)).toHaveAttribute("data-podcast-guest-tracking", "error");
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await page.getByRole("button", { name: /^Vista programma/u }).click();
  const output = page.locator("canvas[data-podcast-stage]");
  await expect(output).toHaveCount(1);
  await expect(output).toHaveAttribute("data-podcast-guest-presentation", "avatar");
  await expect(page.locator("video")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(storage).not.toMatch(/blendshapes|jawOpen|calibration|capturedAt/u);
  await page.getByRole("button", { name: "Spegni videocamera", exact: true }).click();
  const state = await fixtureState(page);
  expect(state.stopped).toBe(1); expect(state.terminated).toBe(state.workers);
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
});

test("cancelling an unpublished preparation releases camera and late permission results", async ({ page }) => {
  await installLocalGuestFixture(page, 800);
  await page.goto("/podcast/preview");
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).calls).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).not.toBeVisible();
  await expect.poll(async () => (await fixtureState(page)).stopped).toBe(1);
  await expect(program(page)).toHaveAttribute("data-podcast-guest-presentation", "placeholder");
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Spegni videocamera e togli dalla scena", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await fixtureState(page)).stopped).toBe(2);
  await page.getByTestId("podcast-open-preflight").click();
  await dialog(page).getByRole("button", { name: "Accendi videocamera per la prova", exact: true }).click();
  await expect(dialog(page).getByTestId("podcast-guest-publish")).toBeEnabled();
  await dialog(page).getByTestId("podcast-guest-publish").click();
  await page.getByRole("link", { name: "Confronta stili e scenari", exact: false }).click();
  await expect(page).toHaveURL(/\/podcast\/styles/u);
  await expect.poll(async () => (await fixtureState(page)).stopped).toBe(3);
});

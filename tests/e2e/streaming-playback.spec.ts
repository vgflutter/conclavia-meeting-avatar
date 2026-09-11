import { expect, test } from "@playwright/test";

for (const delay of [620, 1100]) test(`streaming browser: jitter ${delay} ms, continuità o underrun misurato`, async ({ page }) => {
  await page.addInitScript((delay) => {
    const starts: Array<{ start: number; duration: number }> = [];
    Object.assign(window, { scheduledSpeech: starts });
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      starts.push({ start: args[0] || 0, duration: this.buffer?.duration || 0 });
      return originalStart.apply(this, args);
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (String(args[0]) !== "/api/avatar/speech") return originalFetch(...args);
      const bytes = new Uint8Array(24000);
      const data = new DataView(bytes.buffer);
      for (let i = 0; i < 12000; i++) data.setInt16(i * 2, 6000 * Math.sin(i * Math.PI / 30), true);
      const audio = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
      const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + "\n");
      let timer: ReturnType<typeof setTimeout>;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encode({ audio }));
          timer = setTimeout(() => {
            controller.enqueue(encode({ audio }));
            controller.enqueue(encode({ done: true }));
            controller.close();
          }, delay);
        },
        cancel() { clearTimeout(timer); },
      }));
    };
  }, delay);
  await page.goto("/avatar/test?voice=inworld");
  await page.getByRole("button", { name: /Ascolta la voce|Listen to voice/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { scheduledSpeech: unknown[] }).scheduledSpeech.length)).toBe(2);
  const gap = await page.evaluate(() => {
    const [a, b] = (window as unknown as { scheduledSpeech: Array<{ start: number; duration: number }> }).scheduledSpeech;
    return b.start - a.start - a.duration;
  });
  if (delay === 620) expect(gap).toBeCloseTo(0, 5);
  else expect(gap).toBeGreaterThan(0);
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  const metrics = JSON.parse((await page.getByTestId("stream-playback-metrics").getAttribute("data-metrics"))!);
  expect(metrics.underruns).toBe(delay === 620 ? 0 : 1);
  expect(metrics.gapMs).toBeCloseTo(gap * 1000, 3);
});

test("streaming browser: parla mentre arrivano ancora dati, senza scaricare il modello locale", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (String(args[0]) !== "/api/avatar/speech") return originalFetch(...args);
      const samples = new Uint8Array(24000 * 2);
      const data = new DataView(samples.buffer);
      for (let i = 0; i < 24000; i++) data.setInt16(i * 2, 6000 * Math.sin(i * Math.PI * 440 / 24000), true);
      let binary = "";
      for (const byte of samples) binary += String.fromCharCode(byte);
      const audio = btoa(binary);
      const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + "\n");
      let timer: ReturnType<typeof setTimeout>;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encode({ audio, phones: [{ start: 0, end: 1, viseme: "a" }] }));
          timer = setTimeout(() => {
            document.documentElement.dataset.providerFinished = "true";
            controller.enqueue(encode({ audio, phones: [{ start: 1, end: 2, viseme: "o" }] }));
            controller.enqueue(encode({ done: true }));
            controller.close();
          }, 700);
        },
        cancel() { clearTimeout(timer); },
      }), { headers: { "Content-Type": "application/x-ndjson" } });
    };
  });
  let models = 0;
  await page.route("**/*.onnx", async (route) => { models++; await route.abort(); });
  await page.goto("/avatar/test?voice=inworld");
  await page.getByRole("button", { name: /Ascolta la voce|Listen to voice/ }).click();
  await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
  expect(await page.locator("html").getAttribute("data-provider-finished")).toBeNull();
  await expect(page.locator('svg[data-audio-driven="true"]')).toHaveAttribute("data-viseme", "a");
  await expect(page.locator('svg[data-audio-driven="true"]')).toHaveAttribute("data-viseme", "o");
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  expect(models).toBe(0);
});

test("streaming browser: risposta troncata non viene dichiarata completata", async ({ page }) => {
  await page.route("**/api/avatar/speech", async (route) => route.fulfill({
    contentType: "application/x-ndjson", body: '{"audio":"AAAAAA=="}\n',
  }));
  await page.goto("/avatar/test?voice=inworld");
  await page.getByRole("button", { name: /Ascolta la voce|Listen to voice/ }).click();
  await expect(page.locator('[data-streaming-voice-state="error"]')).toBeVisible();
  await expect(page.locator('svg[data-audio-driven="true"]')).toHaveAttribute("data-viseme", "rest");
});

test("streaming GUI: controlli accessibili senza overflow su mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.goto("/avatar/test?voice=inworld");
  await expect(page.getByRole("heading", { name: /^Choose .+’s voice$/u })).toBeVisible();
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(page.locator("svg[data-gesture='hand_raise']")).toBeVisible();
  await page.getByRole("button", { name: "Change expression" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("streaming-voice-mobile-en.png"), fullPage: true });
});

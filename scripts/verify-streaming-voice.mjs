import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Explicit, paid provider smoke test. Never joins Teams or prints credentials.
const origin = process.env.CONCLAVIA_TEST_ORIGIN || "http://127.0.0.1:3000";
const compare = process.argv.includes("--compare");
const female = process.argv.includes("--female");
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
let originalAppearance;
async function readProfile() {
  const response = await fetch(new URL("/api/avatar", origin));
  assert.equal(response.status, 200, "Cannot read avatar profile");
  return (await response.json()).profile;
}
async function setAppearance(appearance) {
  // Read the latest values so restoring appearance does not revert other edits.
  const profile = await readProfile();
  const response = await fetch(new URL("/api/avatar", origin), {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: profile.displayName, role: profile.role,
      responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
      voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate, appearance }),
  });
  assert.equal(response.status, 200, "Cannot update avatar appearance");
  assert.equal((await response.json()).profile.appearance, appearance);
}
try {
  if (female) {
    // Explicit --female changes appearance temporarily, never saved voice choices.
    originalAppearance = (await readProfile()).appearance;
    await setAppearance("business_clay_female");
  }
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error("Preview browser error:", error.message));
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await page.addInitScript(() => {
    window.voiceProbe = { requests: [], playbacks: [], mouthShapes: [] };
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      if (!String(args[0]).includes("/api/avatar/speech")) return originalFetch.apply(this, args);
      const record = { status: 0, started: performance.now(), firstFrameMs: null, audioFrames: 0, phones: 0, alignment: [], done: false, error: false };
      window.voiceProbe.requests.push(record);
      const response = await originalFetch.apply(this, args);
      record.status = response.status;
      if (response.body) {
        const reader = response.clone().body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        void (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
              const lines = pending.split("\n");
              pending = lines.pop();
              if (done && pending) lines.push(pending);
              for (const line of lines) {
                if (!line.trim()) continue;
                const frame = JSON.parse(line);
                if (frame.audio) { record.audioFrames++; record.firstFrameMs ??= performance.now() - record.started; }
                record.phones += frame.phones?.length || 0;
                if (frame.audio) record.alignment.push({
                  audioSeconds: atob(frame.audio).length / 48000,
                  firstPhone: frame.phones?.[0]?.start ?? null,
                  lastPhone: frame.phones?.at(-1)?.end ?? null,
                });
                record.done ||= Boolean(frame.done);
                record.error ||= Boolean(frame.error);
              }
              if (done) break;
            }
          } catch { record.error = true; }
          finally { reader.releaseLock(); }
        })();
      }
      return response;
    };
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const samples = this.buffer?.getChannelData(0);
      let sum = 0;
      if (samples) for (const sample of samples) sum += sample * sample;
      const record = { duration: this.buffer?.duration || 0, rms: samples ? Math.sqrt(sum / samples.length) : 0, ended: false };
      window.voiceProbe.playbacks.push(record);
      this.addEventListener("ended", () => { record.ended = true; }, { once: true });
      return originalStart.apply(this, args);
    };
  });
  await page.goto(new URL("/avatar/test?voice=inworld", origin).href, { waitUntil: "networkidle", timeout: 45000 });
  const studio = page.locator("[data-streaming-voice-state]");
  await studio.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].filter((button) => /Alza|Raise/.test(button.textContent || ""))
    .some((button) => Object.keys(button).some((key) => key.startsWith("__reactProps$"))));
  assert.equal(await page.getByText("La nuova voce non è ancora configurata.", { exact: false }).count(), 0, "Inworld is not configured");
  // Establish that React handlers are mounted; an early click before hydration is not a voice test.
  await page.getByRole("button", { name: "Alza / abbassa la mano", exact: true }).click();
  await page.locator("[data-gesture='hand_raise']").waitFor();
  await page.getByRole("button", { name: "Alza / abbassa la mano", exact: true }).click();
  await page.getByTestId("voice-advanced").locator("summary").click();
  const configuredModel = await page.locator("#stream-model").inputValue();
  const runs = female ? [configuredModel, configuredModel] : compare ? ["inworld-tts-2-flash", "inworld-tts-2-flash", "inworld-tts-2"] : ["inworld-tts-2-flash"];
  if (female) assert.equal(await page.locator("svg[data-appearance='business_clay_female']").count(), 1);
  for (const [index, model] of runs.entries()) {
    await page.evaluate(() => {
      window.voiceProbe = { requests: [], playbacks: [], mouthShapes: [] };
      window.voiceObserver?.disconnect();
      window.voiceObserver = new MutationObserver(() => {
        for (const node of document.querySelectorAll("[data-viseme]")) {
          const shape = node.getAttribute("data-viseme");
          if (!window.voiceProbe.mouthShapes.includes(shape)) window.voiceProbe.mouthShapes.push(shape);
        }
      });
      window.voiceObserver.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-viseme"] });
    });
    await page.locator("#stream-model").selectOption(model);
    if (female) {
      await page.locator("#stream-language").selectOption(index === 0 ? "it" : "en");
      await page.locator("#stream-voice").selectOption(index === 0 ? "Orietta" : "Eleanor");
      await page.locator("#stream-text").fill(index === 0
        ? "Buongiorno, il budget è approvato. Possiamo passare al prossimo punto?"
        : "Good morning. The budget is approved. Shall we move to the next item?");
    } else await page.locator("#stream-text").fill("Ciao, sono Riccardo. Ti sento, dimmi pure.");
    await page.getByRole("button", { name: "Ascolta la voce", exact: true }).click();
    await page.waitForFunction(() => window.voiceProbe.requests.length > 0, null, { timeout: 10000 });
    await page.waitForFunction(() => ["ready", "error"].includes(document.querySelector("[data-streaming-voice-state]")?.getAttribute("data-streaming-voice-state")), null, { timeout: 45000 });
    const metric = page.getByTestId("stream-first-audio");
    const result = {
      run: index + 1, model, state: await studio.getAttribute("data-streaming-voice-state"),
      appearance: await page.locator("svg[data-appearance]").getAttribute("data-appearance"),
      voice: await page.locator("#stream-voice").inputValue(),
      timing: await metric.count() ? await metric.textContent() : null,
      playbackMetrics: await page.getByTestId("stream-playback-metrics").count()
        ? JSON.parse(await page.getByTestId("stream-playback-metrics").getAttribute("data-metrics")) : null,
      probe: await page.evaluate(() => window.voiceProbe),
    };
    console.log(JSON.stringify(result));
    assert.equal(result.state, "ready", "Real voice playback failed");
    assert.equal(result.probe.requests.length, 1, "Unexpected repeated voice request");
    assert(result.probe.requests.every((request) => request.status === 200 && request.done && !request.error && request.phones > 0), "Audio stream or phoneme alignment missing");
    assert(result.probe.playbacks.length > 0 && result.probe.playbacks.every((audio) => audio.ended && audio.duration > 0), "Audio did not finish playback");
    assert(result.probe.playbacks.some((audio) => audio.rms > 0.003), "Audio was silent");
    assert(result.probe.mouthShapes.some((shape) => shape !== "rest"), "Mouth did not follow phonemes");
  }
} finally {
  try {
    if (originalAppearance !== undefined) {
      await setAppearance(originalAppearance);
      console.log(JSON.stringify({ restoredAppearance: originalAppearance }));
    }
  } finally { await browser.close(); }
}

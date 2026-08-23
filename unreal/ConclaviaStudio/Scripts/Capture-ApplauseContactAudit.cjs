/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { chromium } = require(
  process.env.CONCLAVIA_PLAYWRIGHT_PATH
    || "C:/PixelStreamingInfrastructure/node_modules/playwright"
);

const [playerUrl, controlUrl, outputDirectory] = process.argv.slice(2);
if (!playerUrl || !controlUrl || !outputDirectory) {
  throw new Error(
    "Usage: node Capture-ApplauseContactAudit.cjs <player-url> <control-url> <output-directory>"
  );
}

async function health() {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/health`, {
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Health failed: ${response.status}`);
  return response.json();
}

async function cue(bodyGesture, intent) {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/director/cue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: "Mary",
      targetName: "Vincenzo",
      shot: "wide",
      intent,
      bodyGesture,
      listenerSemanticMood: "amused",
      listenerMood: "neutral",
      listenerMoodIntensity: 0,
      expectedDurationMs: 4_500,
      performanceBeats: []
    })
  });
  if (!response.ok) throw new Error(`Cue failed: ${await response.text()}`);
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidate = await health();
    if (predicate(candidate)) return candidate;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Expected applause state was not observed");
}

(async () => {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CONCLAVIA_CHROME_PATH
      || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"]
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.goto(playerUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.mouse.click(960, 540).catch(() => undefined);
    await page.evaluate(() => {
      for (const element of document.querySelectorAll("video")) {
        element.muted = true;
        void element.play().catch(() => undefined);
      }
    });
    await page.waitForFunction(
      () => [...document.querySelectorAll("video")].some(
        (candidate) => candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && candidate.videoWidth >= 1920
      ),
      undefined,
      { timeout: 90_000 }
    );
    const video = page.locator("video").first();
    await cue("lower-hand", "settle");
    const idle = await waitFor((candidate) => candidate.bodyGesturePhase === "idle");
    await video.screenshot({ path: path.join(outputDirectory, "idle.jpg"), type: "jpeg", quality: 94 });

    await cue("applause", "applause");
    const active = await waitFor(
      (candidate) => candidate.bodyGesturePhase === "applauding"
    );
    const startedAt = Date.now();
    const captureTimes = Array.from({ length: 31 }, (_, index) => 100 + (index * 140));
    for (const targetMs of captureTimes) {
      await new Promise((resolve) => setTimeout(
        resolve,
        Math.max(0, targetMs - (Date.now() - startedAt))
      ));
      await video.screenshot({
        path: path.join(outputDirectory, `contact-${String(targetMs).padStart(4, "0")}ms.jpg`),
        type: "jpeg",
        quality: 94
      });
    }
    const settled = await waitFor((candidate) => candidate.bodyGesturePhase === "idle");
    fs.writeFileSync(path.join(outputDirectory, "audit.json"), JSON.stringify({
      ok: true,
      frames: captureTimes.length,
      camera: {
        idle: [idle.cameraCount, idle.activeCamera],
        active: [active.cameraCount, active.activeCamera],
        settled: [settled.cameraCount, settled.activeCamera]
      }
    }, null, 2));
    process.stdout.write(JSON.stringify({ ok: true, outputDirectory }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(error.stack ?? String(error));
  process.exitCode = 1;
});

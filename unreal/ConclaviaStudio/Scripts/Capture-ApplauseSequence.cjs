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
    "Usage: node Capture-ApplauseSequence.cjs <player-url> <control-url> <output-directory>"
  );
}

const authorization = process.env.CONCLAVIA_CONTROL_TOKEN;
const controlHeaders = authorization
  ? { Authorization: `Bearer ${authorization}` }
  : {};

async function cue(bodyGesture, intent) {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/director/cue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...controlHeaders },
    body: JSON.stringify({
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: "Mary",
      targetName: "Vincenzo",
      shot: "wide",
      intent,
      bodyGesture,
      listenerSemanticMood: "amused",
      listenerMood: "happiness",
      listenerMoodIntensity: 0.68,
      expectedDurationMs: 4_500,
      performanceBeats: []
    })
  });
  if (!response.ok) {
    throw new Error(
      `Cue ${bodyGesture} failed (${response.status}): ${await response.text()}`
    );
  }
}

async function health() {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/health`, {
    cache: "no-store",
    headers: controlHeaders
  });
  if (!response.ok) {
    throw new Error(`Health failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function waitForHealth(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await health();
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `${label} was not observed before timeout. Latest health: ${JSON.stringify(latest)}`
  );
}

async function captureAfter(video, startedAt, targetMs, filename) {
  const waitMs = Math.max(0, targetMs - (Date.now() - startedAt));
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  await video.screenshot({
    path: path.join(outputDirectory, filename),
    type: "jpeg",
    quality: 96
  });
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
      for (const videoElement of document.querySelectorAll("video")) {
        videoElement.muted = true;
        void videoElement.play().catch(() => undefined);
      }
    });
    await page.waitForFunction(
      () => [...document.querySelectorAll("video")].some(
        (candidate) => candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && candidate.videoWidth >= 1920
          && candidate.videoHeight >= 1080
      ),
      undefined,
      { timeout: 90_000 }
    );
    await page.waitForTimeout(2_000);

    const video = page.locator("video").first();
    const initialHealth = await health();
    if (!initialHealth.applauseGestureReady) {
      throw new Error(
        `Applause gesture is gated: ${initialHealth.applauseGestureDriver || "no validated authored animation"}`
      );
    }
    await cue("lower-hand", "settle");
    const idleHealth = await waitForHealth(
      (candidate) => candidate.bodyGesturePhase === "idle"
        && candidate.bodyGesture === "none",
      "idle body state"
    );
    await video.screenshot({
      path: path.join(outputDirectory, "00-idle.jpg"),
      type: "jpeg",
      quality: 96
    });

    await cue("applause", "applause");
    const applauseStartedAt = Date.now();
    const applauseHealth = await waitForHealth(
      (candidate) => candidate.bodyGesture === "applause"
        && candidate.bodyGesturePhase === "applauding"
        && candidate.commercialMood === "happiness"
        && candidate.performanceSemanticMood === "amused"
        && Number(candidate.commercialMoodIntensity || 0) >= 0.67,
      "authored applause state with a sustained positive smile"
    );
    for (const targetMs of [120, 380, 700, 1_100, 1_600, 2_200, 3_000, 3_900]) {
      await captureAfter(
        video,
        applauseStartedAt,
        targetMs,
        `applause-${String(targetMs).padStart(4, "0")}ms.jpg`
      );
    }
    const settledHealth = await waitForHealth(
      (candidate) => candidate.bodyGesturePhase === "idle"
        && candidate.bodyGesture === "none",
      "settled idle body state"
    );

    fs.writeFileSync(
      path.join(outputDirectory, "sequence.json"),
      JSON.stringify({
        ok: true,
        applauseFrames: 8,
        applauseGestureDriver: initialHealth.applauseGestureDriver,
        phases: {
          idle: idleHealth.bodyGesturePhase,
          applause: applauseHealth.bodyGesturePhase,
          settled: settledHealth.bodyGesturePhase
        },
        applauseMood: applauseHealth.commercialMood,
        applauseSemanticMood: applauseHealth.performanceSemanticMood,
        applauseMoodIntensity: applauseHealth.commercialMoodIntensity
      }, null, 2)
    );
    process.stdout.write(JSON.stringify({ ok: true, outputDirectory }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(error.stack ?? String(error));
  process.exitCode = 1;
});

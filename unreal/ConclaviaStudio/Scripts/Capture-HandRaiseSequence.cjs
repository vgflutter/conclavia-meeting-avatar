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
    "Usage: node Capture-HandRaiseSequence.cjs <player-url> <control-url> <output-directory>"
  );
}

const authorization = process.env.CONCLAVIA_CONTROL_TOKEN;
const controlHeaders = authorization
  ? { Authorization: `Bearer ${authorization}` }
  : {};

async function cue(bodyGesture) {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/director/cue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...controlHeaders },
    body: JSON.stringify({
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: "Mary",
      shot: "wide",
      intent: bodyGesture === "raise-hand" ? "request-to-speak" : "settle",
      bodyGesture,
      expectedDurationMs: 8_000,
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

async function waitForHealth(predicate, label, timeoutMs = 8_000) {
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
    if (!initialHealth.physicalGestureReady) {
      throw new Error(
        `Physical gesture is gated: ${initialHealth.physicalGestureDriver || "no validated authored animation"}`
      );
    }
    await cue("lower-hand");
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

    await cue("raise-hand");
    const raiseStartedAt = Date.now();
    const raisedHealth = await waitForHealth(
      (candidate) => candidate.bodyGesture === "raise-hand"
        && ["raising", "held"].includes(candidate.bodyGesturePhase),
      "authored raise-hand state"
    );
    const raisedPoseSamples = [];
    for (const targetMs of [120, 280, 480, 760, 1_100, 1_650, 2_400]) {
      await captureAfter(
        video,
        raiseStartedAt,
        targetMs,
        `raise-${String(targetMs).padStart(4, "0")}ms.jpg`
      );
      raisedPoseSamples.push(await health());
    }
    const heldPoseSamples = raisedPoseSamples.filter(
      (sample) => sample.bodyGesturePhase === "held"
        || sample.bodyGestureAlpha >= 0.95
    );
    if (!heldPoseSamples.length
        || heldPoseSamples.some((sample) => sample.bodyHandsProjected !== true)) {
      throw new Error("Raised-hand screen projection was not available.");
    }
    const raisedHandScreenX = heldPoseSamples.map(
      (sample) => sample.bodyRightHandScreen?.[0]
    );
    const raisedHandScreenY = heldPoseSamples.map(
      (sample) => sample.bodyRightHandScreen?.[1]
    );
    if (raisedHandScreenX.some((value) => !Number.isFinite(value) || value < 0.10 || value > 0.90)
        || raisedHandScreenY.some((value) => !Number.isFinite(value) || value < 0.08 || value > 0.92)) {
      throw new Error(
        `Raised hand left the meeting safe area: ${JSON.stringify({
          raisedHandScreenX,
          raisedHandScreenY
        })}`
      );
    }

    await cue("lower-hand");
    const lowerStartedAt = Date.now();
    const loweringHealth = await waitForHealth(
      (candidate) => ["lowering", "idle"].includes(candidate.bodyGesturePhase),
      "authored lower-hand state"
    );
    for (const targetMs of [120, 320, 620, 1_000, 1_600]) {
      await captureAfter(
        video,
        lowerStartedAt,
        targetMs,
        `lower-${String(targetMs).padStart(4, "0")}ms.jpg`
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
        raiseFrames: 7,
        lowerFrames: 5,
        physicalGestureDriver: initialHealth.physicalGestureDriver,
        raisedHandScreenX,
        raisedHandScreenY,
        phases: {
          idle: idleHealth.bodyGesturePhase,
          raised: raisedHealth.bodyGesturePhase,
          lowering: loweringHealth.bodyGesturePhase,
          settled: settledHealth.bodyGesturePhase
        }
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

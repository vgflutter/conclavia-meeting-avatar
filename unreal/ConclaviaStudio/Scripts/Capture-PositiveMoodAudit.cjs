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
    "Usage: node Capture-PositiveMoodAudit.cjs <player-url> <control-url> <output-directory>"
  );
}

const candidates = [
  ["happiness", "amused", 0.68],
  ["playfulness", "amused", 0.58],
  ["excitement", "excited", 0.54],
];

async function cue(mood, semanticMood, intensity) {
  const response = await fetch(`${controlUrl.replace(/\/$/u, "")}/director/cue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: "Mary",
      targetName: "Vincenzo",
      shot: "close-up",
      intent: "listen-react",
      bodyGesture: "none",
      listenerSemanticMood: semanticMood,
      listenerMood: mood,
      listenerMoodIntensity: intensity,
      expectedDurationMs: 2_400,
      performanceBeats: [],
    }),
  });
  if (!response.ok) {
    throw new Error(`Cue ${mood} failed (${response.status}): ${await response.text()}`);
  }
}

(async () => {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CONCLAVIA_CHROME_PATH
      || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.goto(playerUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.mouse.click(960, 540).catch(() => undefined);
    await page.evaluate(() => {
      for (const video of document.querySelectorAll("video")) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
    });
    await page.waitForFunction(
      () => [...document.querySelectorAll("video")].some(
        (video) => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && video.videoWidth >= 1920 && video.videoHeight >= 1080
      ),
      undefined,
      { timeout: 90_000 }
    );
    const video = page.locator("video").first();
    for (const [mood, semanticMood, intensity] of candidates) {
      await cue(mood, semanticMood, intensity);
      await page.waitForTimeout(1_400);
      await video.screenshot({
        path: path.join(outputDirectory, `${mood}.jpg`),
        type: "jpeg",
        quality: 96,
      });
      await page.waitForTimeout(1_300);
    }
    process.stdout.write(JSON.stringify({ ok: true, candidates: candidates.length }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(error.stack ?? String(error));
  process.exitCode = 1;
});

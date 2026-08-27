/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { chromium } = require(
  process.env.CONCLAVIA_PLAYWRIGHT_PATH
    || "C:/PixelStreamingInfrastructure/node_modules/playwright"
);

const [playerUrl, controlUrl, pcmPath, outputDirectory] = process.argv.slice(2);
if (!playerUrl || !controlUrl || !pcmPath || !outputDirectory) {
  throw new Error(
    "Usage: node Audit-TwelveMoods.cjs <player-url> <control-url> <pcm-path> <output-directory>"
  );
}

const baseControlUrl = controlUrl.replace(/\/$/u, "");
const authorization = process.env.CONCLAVIA_CONTROL_TOKEN;
const headers = authorization ? { Authorization: `Bearer ${authorization}` } : {};
const cases = [
  { mood: "neutral", intensity: 0.00, intent: "argument" },
  { mood: "happiness", intensity: 0.54, intent: "answer" },
  { mood: "sadness", intensity: 0.48, intent: "reflect" },
  { mood: "disgust", intensity: 0.46, intent: "challenge" },
  { mood: "anger", intensity: 0.50, intent: "challenge" },
  { mood: "surprise", intensity: 0.52, intent: "react" },
  { mood: "fear", intensity: 0.44, intent: "warn" },
  { mood: "confidence", intensity: 0.50, intent: "answer" },
  { mood: "excitement", intensity: 0.52, intent: "answer" },
  { mood: "boredom", intensity: 0.38, intent: "reflect" },
  { mood: "playfulness", intensity: 0.48, intent: "react" },
  { mood: "confusion", intensity: 0.48, intent: "question" },
];

async function requestJson(route, init = {}) {
  const response = await fetch(`${baseControlUrl}${route}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${route} failed (${response.status}): ${text}`);
  }
  return payload;
}

async function health() {
  return requestJson("/health", { headers });
}

async function cue(testCase) {
  return requestJson("/director/cue", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      speakerId: "mood-audit",
      speakerName: "Mary",
      shot: "close-up",
      intent: testCase.intent,
      expectedDurationMs: 6_000,
      performanceBeats: [{
        atMs: 0,
        semanticMood: testCase.mood,
        mood: testCase.mood,
        intensity: testCase.intensity,
        focus: "camera",
        gesture: "none",
      }],
    }),
  });
}

async function speak(pcm) {
  let lastError;
  // A mood switch creates a fresh commercial generator. On a cold model the
  // route can correctly answer commercial_model_warming for a short period;
  // production TTS naturally hides that warm-up, while the direct-PCM audit
  // used to fail immediately. Retry the same immutable PCM instead of turning
  // a transient solver state into a false regression.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await requestJson("/audio/speech", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/octet-stream" },
        body: pcm,
      });
    } catch (error) {
      lastError = error;
      if (!String(error).includes("commercial_model_warming")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
}

async function observePerformance(video, previousCompletedCount, testCase) {
  const deadline = Date.now() + 25_000;
  const samples = [];
  let observedActive = false;
  let peakUpperFace = -1;
  let peakFrame;

  while (Date.now() < deadline) {
    const sample = await health();
    const compact = {
      active: Boolean(sample.commercialSpeechActive),
      mood: String(sample.commercialMood || "").toLowerCase(),
      semanticMood: String(sample.performanceSemanticMood || "").toLowerCase(),
      moodIntensity: Number(sample.commercialMoodIntensity || 0),
      targetIntensity: Number(sample.performanceTargetIntensity || 0),
      mouth: Number(sample.commercialMaxMouthControl || 0),
      upperFace: Number(sample.commercialMaxUpperFaceControl || 0),
      upperFaceControl: sample.commercialMaxUpperFaceControlName,
      appliedBeatCount: Number(sample.performanceAppliedBeatCount || 0),
      completedSpeechCount: Number(sample.commercialCompletedSpeechCount || 0),
    };
    samples.push(compact);
    observedActive ||= compact.active;

    if (compact.active && compact.upperFace > peakUpperFace) {
      peakUpperFace = compact.upperFace;
      peakFrame = path.join(outputDirectory, `${testCase.mood}-peak.jpg`);
      await video.screenshot({ path: peakFrame, type: "jpeg", quality: 96 });
    }

    if (
      observedActive
      && !compact.active
      && compact.completedSpeechCount > previousCompletedCount
    ) {
      return { samples, peakFrame, completedSpeechCount: compact.completedSpeechCount };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for the ${testCase.mood} performance.`);
}

(async () => {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const pcm = fs.readFileSync(pcmPath);
  const browser = await chromium.launch({
    executablePath: process.env.CONCLAVIA_CHROME_PATH
      || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
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
          && video.videoWidth >= 1920
          && video.videoHeight >= 1080
      ),
      undefined,
      { timeout: 90_000 }
    );
    const video = page.locator("video").first();
    const baseline = await health();
    if (!baseline.stageReady || !baseline.commercialLipSyncReady) {
      throw new Error(`Mood runtime is not ready: ${JSON.stringify(baseline)}`);
    }

    let completedSpeechCount = Number(baseline.commercialCompletedSpeechCount || 0);
    const results = [];
    for (const testCase of cases) {
      const cueResult = await cue(testCase);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const speechResult = await speak(pcm);
      const observed = await observePerformance(
        video,
        completedSpeechCount,
        testCase
      );
      completedSpeechCount = observed.completedSpeechCount;
      const active = observed.samples.filter((sample) => sample.active);
      const applied = [...active].reverse().find(
        (sample) => sample.semanticMood === testCase.mood
          || sample.mood === testCase.mood
      ) || active.at(-1) || observed.samples.at(-1);
      results.push({
        ...testCase,
        cueAccepted: cueResult.ok !== false,
        speechAccepted: speechResult.ok !== false,
        peakFrame: observed.peakFrame,
        appliedMood: applied?.mood,
        appliedSemanticMood: applied?.semanticMood,
        appliedBeatCount: Math.max(
          0,
          ...observed.samples.map((sample) => sample.appliedBeatCount)
        ),
        peakMouth: Math.max(0, ...active.map((sample) => sample.mouth)),
        peakUpperFace: Math.max(0, ...active.map((sample) => sample.upperFace)),
        upperFaceControls: [...new Set(
          active.map((sample) => sample.upperFaceControl).filter(Boolean)
        )],
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    const expressive = results.filter((result) => result.mood !== "neutral");
    const validation = {
      allTwelveCovered: results.length === 12
        && new Set(results.map((result) => result.mood)).size === 12,
      allRequestsAccepted: results.every(
        (result) => result.cueAccepted && result.speechAccepted
      ),
      allBeatsApplied: results.every((result) => result.appliedBeatCount >= 1),
      correctSemanticMoods: results.every(
        (result) => result.appliedSemanticMood === result.mood
          || result.appliedMood === result.mood
      ),
      lipSyncPreserved: results.every((result) => result.peakMouth >= 0.10),
      expressiveUpperFaceActive: expressive.every(
        (result) => result.peakUpperFace >= 0.02
      ),
      variedUpperFaceResponse: new Set(
        expressive.flatMap((result) => result.upperFaceControls)
      ).size >= 4,
    };
    const report = {
      ok: Object.values(validation).every(Boolean),
      validation,
      engineVersion: baseline.engineVersion,
      runtimeRevision: baseline.runtimeRevision,
      avatarId: baseline.avatarId,
      results,
    };
    fs.writeFileSync(
      path.join(outputDirectory, "twelve-moods-audit.json"),
      JSON.stringify(report, null, 2)
    );
    process.stdout.write(JSON.stringify(report));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(error.stack ?? String(error));
  process.exitCode = 1;
});

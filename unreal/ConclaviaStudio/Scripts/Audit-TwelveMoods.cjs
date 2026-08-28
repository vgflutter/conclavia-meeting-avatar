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
  { mood: "neutral", rendererMood: "neutral", intensity: 0.00, intent: "argument" },
  { mood: "attentive", rendererMood: "excitement", intensity: 0.58, intent: "answer" },
  { mood: "curious", rendererMood: "confusion", intensity: 0.68, intent: "question" },
  { mood: "amused", rendererMood: "playfulness", intensity: 0.64, intent: "react" },
  { mood: "confident", rendererMood: "happiness", intensity: 0.62, intent: "answer" },
  { mood: "skeptical", rendererMood: "disgust", intensity: 0.60, intent: "challenge" },
  { mood: "concerned", rendererMood: "fear", intensity: 0.62, intent: "warn" },
  { mood: "surprised", rendererMood: "surprise", intensity: 0.72, intent: "react" },
  { mood: "empathetic", rendererMood: "sadness", intensity: 0.58, intent: "reflect" },
  { mood: "assertive", rendererMood: "confidence", intensity: 0.68, intent: "answer" },
  { mood: "frustrated", rendererMood: "anger", intensity: 0.66, intent: "challenge" },
  { mood: "reflective", rendererMood: "boredom", intensity: 0.54, intent: "reflect" },
];

function meanAbsoluteDifference(left, right) {
  if (!left || !right || left.length !== right.length || left.length === 0) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length / 255;
}

function medianSignature(signatures) {
  if (signatures.length === 0) return [];
  return signatures[0].map((_, index) => {
    const values = signatures
      .map((signature) => signature[index])
      .sort((left, right) => left - right);
    return values[Math.floor(values.length / 2)];
  });
}

async function captureFaceSignature(page) {
  const samples = [];
  for (let sample = 0; sample < 3; sample += 1) {
    samples.push(await page.evaluate(() => {
      const video = [...document.querySelectorAll("video")].find(
        (candidate) => candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && candidate.videoWidth > 0
          && candidate.videoHeight > 0
      );
      if (!video) throw new Error("No active Pixel Streaming video found.");

      const cropWidth = Math.round(video.videoWidth * 0.34);
      const cropHeight = Math.round(video.videoHeight * 0.58);
      const cropX = Math.round((video.videoWidth - cropWidth) * 0.50);
      const cropY = Math.round(video.videoHeight * 0.12);
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(
        video,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const signature = [];
      // Brows/eyes and mouth carry the affective signal. Sampling only those
      // regions rejects background, breathing and hand-gesture noise.
      const regions = [
        [20, 25, 108, 68],
        [30, 78, 98, 112],
      ];
      for (const [left, top, right, bottom] of regions) {
        for (let y = top; y < bottom; y += 2) {
          for (let x = left; x < right; x += 2) {
            const offset = (y * canvas.width + x) * 4;
            signature.push(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
          }
        }
      }
      return signature;
    }));
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return medianSignature(samples);
}

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
      intent: "listen-react",
      listenerSemanticMood: testCase.mood,
      listenerMood: testCase.rendererMood,
      listenerMoodIntensity: testCase.intensity,
      expectedDurationMs: 4_500,
      performanceBeats: [{
        atMs: 0,
        semanticMood: testCase.mood,
        mood: testCase.rendererMood,
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
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const listeningFrame = path.join(
        outputDirectory,
        `${testCase.mood}-listening.jpg`
      );
      await video.screenshot({ path: listeningFrame, type: "jpeg", quality: 96 });
      const visualSignature = await captureFaceSignature(page);
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
          || sample.mood === testCase.rendererMood
      ) || active.at(-1) || observed.samples.at(-1);
      results.push({
        ...testCase,
        cueAccepted: cueResult.ok !== false,
        speechAccepted: speechResult.ok !== false,
        listeningFrame,
        visualSignature,
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

    const neutralSignature = results.find((result) => result.mood === "neutral")
      ?.visualSignature;
    for (const result of results) {
      result.visualDeltaFromNeutral = result.mood === "neutral"
        ? 0
        : meanAbsoluteDifference(neutralSignature, result.visualSignature);
      delete result.visualSignature;
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
          || result.appliedMood === result.rendererMood
      ),
      lipSyncPreserved: results.every((result) => result.peakMouth >= 0.10),
      expressiveUpperFaceActive: expressive.every(
        (result) => result.peakUpperFace >= 0.02
      ),
      variedUpperFaceResponse: new Set(
        expressive.flatMap((result) => result.upperFaceControls)
      ).size >= 4,
      expressiveFacesVisiblyDifferFromNeutral: expressive.every(
        (result) => result.visualDeltaFromNeutral >= 0.0025
      ),
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

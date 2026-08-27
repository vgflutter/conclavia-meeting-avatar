#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const WebSocket = require("ws");

const runtimeUrl = process.env.CONCLAVIA_WEB_RUNTIME_URL
  || "http://127.0.0.1:4310/web-output";
const chromePath = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debuggingPort = Number.parseInt(
  process.env.CONCLAVIA_CHROME_DEBUG_PORT || "9335",
  10,
);
const expectsCleanOutput = new URL(runtimeUrl).searchParams.get("conclaviaOutput") === "obs";
const screenshotPath = process.env.CONCLAVIA_WEB_RUNTIME_SCREENSHOT || "";
const actionText = process.env.CONCLAVIA_WEB_RUNTIME_ACTION || "";
const followupActionText = process.env.CONCLAVIA_WEB_RUNTIME_FOLLOWUP_ACTION || "";
const followupActionDelay = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_FOLLOWUP_DELAY_MS || "1800",
  10,
);
const actionChannel = process.env.CONCLAVIA_WEB_RUNTIME_ACTION_CHANNEL || "chat";
const actionAsync = process.env.CONCLAVIA_WEB_RUNTIME_ACTION_ASYNC === "1";
const armRenderer = process.env.CONCLAVIA_WEB_RUNTIME_ARM_RENDERER !== "0";
const actionDelay = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_ACTION_DELAY_MS || "900",
  10,
);
const sampleInterval = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_SAMPLE_INTERVAL_MS || "0",
  10,
);
const sampleCount = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_SAMPLE_COUNT || "0",
  10,
);
const sampleScreenshotDirectory =
  process.env.CONCLAVIA_WEB_RUNTIME_SAMPLE_SCREENSHOT_DIR || "";
const viewportWidth = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_VIEWPORT_WIDTH || "1920",
  10,
);
const viewportHeight = Number.parseInt(
  process.env.CONCLAVIA_WEB_RUNTIME_VIEWPORT_HEIGHT || "1080",
  10,
);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function expectedMissingManifest(url) {
  return /\/api\/performance\/avatar\/[a-z0-9_-]+$/u.test(url || "");
}

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Chrome DevTools HTTP ${response.status}`);
  return response.json();
}

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      return await json(`http://127.0.0.1:${debuggingPort}/json/version`);
    } catch {
      await delay(200);
    }
  }
  throw new Error("Chrome DevTools did not become ready");
}

async function main() {
  const userDataDirectory = await mkdtemp(join(tmpdir(), "conclavia-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--window-size=${viewportWidth},${viewportHeight}`,
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDirectory}`,
    "--autoplay-policy=no-user-gesture-required",
    "--enable-unsafe-swiftshader",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    runtimeUrl,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const chromeErrors = [];
  chrome.stderr.on("data", (chunk) => {
    const message = chunk.toString("utf8").trim();
    if (message && !/GCM|cloud_policy|DevTools listening/u.test(message)) {
      chromeErrors.push(message);
    }
  });

  try {
    await waitForChrome();
    const targets = await json(`http://127.0.0.1:${debuggingPort}/json/list`);
    const page = targets.find((target) => target.type === "page" && target.url.startsWith(runtimeUrl));
    if (!page?.webSocketDebuggerUrl) throw new Error("Web runtime Chrome target not found");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    let commandId = 0;
    const pending = new Map();
    const runtimeErrors = [];
    const failedResources = [];
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString("utf8"));
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        runtimeErrors.push(
          message.params.exceptionDetails.exception?.description
          || message.params.exceptionDetails.text,
        );
      }
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
        if (expectedMissingManifest(message.params.entry.url)) return;
        runtimeErrors.push(
          `${message.params.entry.text}${message.params.entry.url ? ` (${message.params.entry.url})` : ""}`,
        );
      }
      if (
        message.method === "Network.responseReceived"
        && message.params.response.status >= 400
      ) {
        failedResources.push({
          status: message.params.response.status,
          url: message.params.response.url,
        });
      }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++commandId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await command("Runtime.enable");
    await command("Log.enable");
    await command("Network.enable");
    await command("Page.enable");
    await command("Emulation.setDeviceMetricsOverride", {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await command("Page.reload", { ignoreCache: true });
    // High-fidelity portable bundles can exceed 100 MB. Wait for the actual
    // performer/stream contract instead of sampling after a fixed delay, which
    // could report a false failure while Chrome was still decoding the GLBs.
    let runtimeReady = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const probe = await command("Runtime.evaluate", {
        expression: `(() => {
          const runtime = document.querySelector('#runtime');
          return {
            state: runtime?.dataset.state || null,
            performer: runtime?.dataset.performer || null,
            streamReady: window.conclaviaPerformanceStream instanceof MediaStream,
          };
        })()`,
        returnByValue: true,
      });
      const value = probe.result.value;
      if (
        value?.state === "live"
        && new Set(["photo", "three"]).has(value?.performer)
        && value?.streamReady === true
      ) {
        runtimeReady = true;
        break;
      }
      await delay(100);
    }
    if (!runtimeReady) {
      throw new Error("Web performer did not become live within 30 seconds");
    }
    if (actionText && armRenderer) {
      const armed = await command("Runtime.evaluate", {
        expression: `(async () => {
          const start = await fetch('/api/renderer/start', { method: 'POST' });
          const startBody = await start.json();
          if (![200, 202].includes(start.status)) {
            return { ok: false, status: start.status, body: startBody };
          }
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const statusResponse = await fetch('/api/renderer/status', { cache: 'no-store' });
            const status = await statusResponse.json();
            if (statusResponse.ok && status.armed === true) {
              return { ok: true, status: statusResponse.status, body: status };
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return { ok: false, status: 408, body: { error: 'renderer arm timeout' } };
        })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (armed.result.value?.ok !== true) {
        throw new Error(`Runtime renderer arm failed: ${JSON.stringify(armed.result.value)}`);
      }
    }
    if (actionText) {
      const action = await command("Runtime.evaluate", {
        expression: `(async () => {
          const channel = ${JSON.stringify(actionChannel)};
          const sendAction = (text) => fetch(channel === 'voice' ? '/api/simulate' : '/api/chat/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(channel === 'voice'
              ? { speakerName: 'Vincenzo', text }
              : {
                platform: 'generic',
                meetingId: 'runtime-audit',
                messageId: crypto.randomUUID(),
                speakerName: 'Vincenzo',
                text,
                capturedAt: new Date().toISOString(),
              }),
          });
          const request = sendAction(${JSON.stringify(actionText)});
          const scheduleFollowup = () => {
            const text = ${JSON.stringify(followupActionText)};
            if (!text) return;
            window.setTimeout(() => {
              window.__conclaviaRuntimeAuditFollowup = sendAction(text).then(async (response) => ({
                status: response.status,
                body: await response.json(),
              }));
            }, ${JSON.stringify(followupActionDelay)});
          };
          if (${JSON.stringify(actionAsync)}) {
            window.__conclaviaRuntimeAuditAction = request.then(async (response) => ({
              status: response.status,
              body: await response.json(),
            }));
            scheduleFollowup();
            return { status: 202, body: { started: true } };
          }
          const response = await request;
          scheduleFollowup();
          return { status: response.status, body: await response.json() };
        })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (![200, 202].includes(action.result.value?.status)) {
        throw new Error(`Runtime action failed: ${JSON.stringify(action.result.value)}`);
      }
      if (!(sampleInterval > 0 && sampleCount > 0)) {
        await delay(Number.isFinite(actionDelay) ? actionDelay : 900);
      }
    }
    const playbackSamples = [];
    if (sampleInterval > 0 && sampleCount > 0) {
      if (sampleScreenshotDirectory) {
        await mkdir(sampleScreenshotDirectory, { recursive: true });
      }
      for (let index = 0; index < sampleCount; index += 1) {
        await delay(sampleInterval);
        const sample = await command("Runtime.evaluate", {
          expression: `(() => ({
            atMs: ${sampleInterval * (index + 1)},
            playback: window.conclaviaPlaybackDiagnostics?.() || null,
            avatar: window.conclaviaAvatarDiagnostics?.() || null,
          }))()`,
          returnByValue: true,
        });
        playbackSamples.push(sample.result.value);
        if (sampleScreenshotDirectory) {
          const screenshot = await command("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
            captureBeyondViewport: false,
          });
          await writeFile(
            join(sampleScreenshotDirectory, `${String(index + 1).padStart(3, "0")}.png`),
            Buffer.from(screenshot.data, "base64"),
          );
        }
      }
    }
    const evaluation = await command("Runtime.evaluate", {
      expression: `(async () => {
        const runtime = document.querySelector('#runtime');
        const canvas = document.querySelector('#stage');
        const performanceStatus = await fetch('/api/performance/status', { cache: 'no-store' })
          .then((response) => response.json());
        return {
          state: runtime?.dataset.state || null,
          performer: runtime?.dataset.performer || null,
          output: runtime?.dataset.output || null,
          readyState: document.readyState,
          canvasWidth: canvas?.width || 0,
          canvasHeight: canvas?.height || 0,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          streamReady: window.conclaviaPerformanceStream instanceof MediaStream,
          videoTracks: window.conclaviaPerformanceStream?.getVideoTracks().length || 0,
          audioTracks: window.conclaviaPerformanceStream?.getAudioTracks().length || 0,
          runtimeStatus: document.querySelector('#runtime-status')?.textContent || null,
          avatarReady: performanceStatus.webAvatar?.ready ?? null,
          avatarAuditError: performanceStatus.webAvatar?.error ?? null,
          avatarDiagnostics: window.conclaviaAvatarDiagnostics?.() || null,
          playbackDiagnostics: window.conclaviaPlaybackDiagnostics?.() || null,
          overlaysHidden: ['.runtime-badges', '.runtime-card', '#diagnostics'].every((selector) => {
            const element = document.querySelector(selector);
            return element && getComputedStyle(element).display === 'none';
          })
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (screenshotPath) {
      const screenshot = await command("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
    }
    socket.close();
    const result = evaluation.result.value;
    result.playbackSamples = playbackSamples;
    const failures = [];
    if (result.state !== "live") failures.push(`state=${result.state}`);
    if (!new Set(["photo", "three"]).has(result.performer)) {
      failures.push(`performer=${result.performer}`);
    }
    if (result.performer === "three" && result.avatarReady !== true) {
      failures.push(`3D performer was served without readiness: ${result.avatarAuditError}`);
    }
    if (result.canvasWidth < 2 || result.canvasHeight < 2) failures.push("canvas not rendered");
    if (expectsCleanOutput && (result.output !== "clean" || !result.overlaysHidden)) {
      failures.push("OBS output overlays are visible");
    }
    if (!result.streamReady || result.videoTracks !== 1 || result.audioTracks !== 1) {
      failures.push("combined MediaStream not ready");
    }
    if (runtimeErrors.length) failures.push(`runtime errors: ${runtimeErrors.join(" | ")}`);
    if (failures.length) {
      throw new Error(`${failures.join("; ")}; resources=${JSON.stringify(failedResources)}`);
    }
    console.log(JSON.stringify({
      ok: true,
      ...result,
      failedResources,
      chromeWarnings: chromeErrors.length,
      ...(screenshotPath ? { screenshotPath } : {}),
      ...(actionText ? { actionText } : {}),
      ...(followupActionText ? { followupActionText, followupActionDelay } : {}),
      ...(actionText ? { actionChannel } : {}),
      ...(actionText ? { actionAsync } : {}),
      ...(actionText ? { rendererArmedByAudit: armRenderer } : {}),
    }, null, 2));
  } finally {
    chrome.kill("SIGTERM");
    await delay(250);
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

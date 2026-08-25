#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
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
    await command("Page.reload", { ignoreCache: true });
    await delay(4_000);
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
          streamReady: window.conclaviaPerformanceStream instanceof MediaStream,
          videoTracks: window.conclaviaPerformanceStream?.getVideoTracks().length || 0,
          audioTracks: window.conclaviaPerformanceStream?.getAudioTracks().length || 0,
          runtimeStatus: document.querySelector('#runtime-status')?.textContent || null,
          avatarReady: performanceStatus.webAvatar?.ready ?? null,
          avatarAuditError: performanceStatus.webAvatar?.error ?? null,
          overlaysHidden: ['.runtime-badges', '.runtime-card', '#diagnostics'].every((selector) => {
            const element = document.querySelector(selector);
            return element && getComputedStyle(element).display === 'none';
          })
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    socket.close();
    const result = evaluation.result.value;
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

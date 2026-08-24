const stage = document.querySelector("#stage");
const status = document.querySelector("#status");
let playerFrame = null;
let mountedStreamKey = null;
let mountedPlayerUrl = null;
let mountedStreamId = null;
let playerMountedAt = 0;
let lastFrameHeartbeatAt = 0;
let lastReconnectAt = 0;
let reconnectAttempt = 0;

const FRAME_START_GRACE_MS = 18_000;
const FRAME_STALL_TIMEOUT_MS = 8_000;
const RECONNECT_COOLDOWN_MS = 15_000;

function playerUrl(value, attempt) {
  const url = new URL(value);
  url.searchParams.set("AutoConnect", "true");
  url.searchParams.set("AutoPlayVideo", "true");
  url.searchParams.set("conclaviaOutput", "obs");
  url.searchParams.set("conclaviaReconnect", String(attempt));
  return url.toString();
}

function requestAudioUnlock() {
  playerFrame?.contentWindow?.postMessage({ type: "conclavia:unmute" }, "*");
}

function mountPlayer(url, streamId, force = false) {
  const streamKey = `${url}|${streamId || "unknown"}`;
  if (!force && mountedStreamKey === streamKey && playerFrame) return;
  mountedStreamKey = streamKey;
  mountedPlayerUrl = url;
  mountedStreamId = streamId;
  playerMountedAt = Date.now();
  lastFrameHeartbeatAt = 0;
  if (force) reconnectAttempt += 1;
  const frame = document.createElement("iframe");
  frame.title = "Conclavia MetaHuman";
  frame.src = playerUrl(url, reconnectAttempt);
  frame.allow = "autoplay; fullscreen";
  frame.addEventListener("load", () => {
    window.setTimeout(requestAudioUnlock, 500);
    window.setTimeout(requestAudioUnlock, 2_000);
  });
  playerFrame?.remove();
  playerFrame = frame;
  stage.prepend(frame);
  status.textContent = "Collegamento Pixel Streaming…";
}

function reconnectStalledPlayer() {
  if (!playerFrame || !mountedPlayerUrl) return;
  const now = Date.now();
  const connectionAge = now - playerMountedAt;
  const heartbeatAge = lastFrameHeartbeatAt === 0
    ? Number.POSITIVE_INFINITY
    : now - lastFrameHeartbeatAt;
  if (connectionAge < FRAME_START_GRACE_MS || heartbeatAge <= FRAME_STALL_TIMEOUT_MS) return;
  if (now - lastReconnectAt < RECONNECT_COOLDOWN_MS) return;
  lastReconnectAt = now;
  status.className = "";
  status.textContent = "Riconnessione automatica del video…";
  mountPlayer(mountedPlayerUrl, mountedStreamId, true);
}

async function refresh() {
  try {
    const response = await fetch("/api/renderer/status", { cache: "no-store" });
    const renderer = await response.json();
    if (!response.ok) throw new Error(renderer.error || `HTTP ${response.status}`);
    if (!renderer.playerUrl) {
      status.className = "";
      status.textContent = "MetaHuman non ancora avviato.";
      return;
    }
    mountPlayer(renderer.playerUrl, renderer.streamId);
  } catch (error) {
    status.className = "";
    status.textContent = `Output non disponibile: ${error.message}`;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== playerFrame?.contentWindow) return;
  if (event.data?.type === "conclavia:frame-heartbeat") {
    lastFrameHeartbeatAt = Date.now();
    status.className = "connected";
    return;
  }
  if (event.data?.type !== "conclavia:media-ready" && event.data?.type !== "conclavia:audio-state") return;
  if (event.data.mediaReady) status.className = "connected";
  if (!event.data.audioReady) requestAudioUnlock();
});
document.addEventListener("pointerdown", requestAudioUnlock, { capture: true });
document.addEventListener("keydown", requestAudioUnlock, { capture: true });
window.setInterval(requestAudioUnlock, 3_000);
window.setInterval(reconnectStalledPlayer, 2_000);
window.setInterval(refresh, 5_000);
void refresh();

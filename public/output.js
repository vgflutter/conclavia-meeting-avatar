const stage = document.querySelector("#stage");
const status = document.querySelector("#status");
let playerFrame = null;
let mountedPlayerUrl = null;

function playerUrl(value) {
  const url = new URL(value);
  url.searchParams.set("AutoConnect", "true");
  url.searchParams.set("AutoPlayVideo", "true");
  url.searchParams.set("conclaviaOutput", "obs");
  return url.toString();
}

function requestAudioUnlock() {
  playerFrame?.contentWindow?.postMessage({ type: "conclavia:unmute" }, "*");
}

function mountPlayer(url) {
  if (mountedPlayerUrl === url && playerFrame) return;
  mountedPlayerUrl = url;
  const frame = document.createElement("iframe");
  frame.title = "Conclavia MetaHuman";
  frame.src = playerUrl(url);
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
    mountPlayer(renderer.playerUrl);
  } catch (error) {
    status.className = "";
    status.textContent = `Output non disponibile: ${error.message}`;
  }
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "conclavia:media-ready" && event.data?.type !== "conclavia:audio-state") return;
  if (event.data.mediaReady) status.className = "connected";
  if (!event.data.audioReady) requestAudioUnlock();
});
document.addEventListener("pointerdown", requestAudioUnlock, { capture: true });
document.addEventListener("keydown", requestAudioUnlock, { capture: true });
window.setInterval(requestAudioUnlock, 3_000);
window.setInterval(refresh, 5_000);
void refresh();

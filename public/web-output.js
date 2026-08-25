const runtime = document.querySelector("#runtime");
const canvas = document.querySelector("#stage");
const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
const liveBadge = document.querySelector("#live-badge");
const actionBadge = document.querySelector("#action-badge");
const avatarName = document.querySelector("#avatar-name");
const runtimeStatus = document.querySelector("#runtime-status");
const sequenceLabel = document.querySelector("#sequence");
const clockLabel = document.querySelector("#clock");
const moodLabel = document.querySelector("#mood");
const visemeLabel = document.querySelector("#viseme");
const image = new Image();
image.src = "/assets/web-avatar.jpg";

let audioContext = null;
let mediaDestination = null;
let activeSource = null;
let activePacket = null;
let activeStartedAt = 0;
let activeStartedAtAudio = 0;
let currentMood = "neutral";
let currentMoodLevel = 0;
let currentViseme = "-";
let handRaised = false;
let applauseUntil = 0;
let latestSequence = 0;
let lastHeartbeat = 0;
let animationStarted = false;

const moodTints = {
  neutral: [18, 35, 61],
  attentive: [45, 105, 152],
  curious: [74, 76, 165],
  amused: [52, 145, 119],
  confident: [30, 122, 161],
  skeptical: [100, 80, 135],
  concerned: [102, 67, 75],
  surprised: [124, 99, 47],
  empathetic: [52, 85, 132],
  assertive: [33, 91, 145],
  frustrated: [125, 51, 52],
  reflective: [47, 70, 105],
};

function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext({ latencyHint: "interactive" });
    mediaDestination = audioContext.createMediaStreamDestination();
    const videoStream = canvas.captureStream(30);
    window.conclaviaPerformanceStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...mediaDestination.stream.getAudioTracks(),
    ]);
  }
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function elapsedMs() {
  if (!activePacket) return 0;
  if (activePacket.clock.source === "audio" && audioContext) {
    return Math.max(0, (audioContext.currentTime - activeStartedAtAudio) * 1000);
  }
  return Math.max(0, performance.now() - activeStartedAt);
}

function latestAt(track, elapsed) {
  let value = null;
  for (const candidate of track) {
    if (candidate.atMs > elapsed) break;
    value = candidate;
  }
  return value;
}

function updatePerformanceState(elapsed) {
  if (!activePacket) return;
  const expression = latestAt(activePacket.tracks.expressions, elapsed);
  const viseme = latestAt(activePacket.tracks.visemes, elapsed);
  if (expression) {
    currentMood = expression.semanticMood;
    currentMoodLevel = expression.level;
  }
  currentViseme = viseme?.value || "-";
  const gesture = latestAt(activePacket.tracks.gestures, elapsed);
  if (gesture?.clip === "raise-hand") handRaised = true;
  if (gesture?.clip === "lower-hand") handRaised = false;
  if (gesture?.clip === "applause") applauseUntil = activeStartedAt + activePacket.clock.durationMs;
  moodLabel.textContent = `${currentMood} ${currentMoodLevel.toFixed(2)}`;
  visemeLabel.textContent = `viseme ${currentViseme}`;
  clockLabel.textContent = `${Math.round(elapsed)} ms`;
}

function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight, zoom) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function drawFrame(now) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const elapsed = elapsedMs();
  updatePerformanceState(elapsed);
  const idle = Math.sin(now / 3100) * 0.0025;
  const applause = now < applauseUntil;
  const gestureLift = handRaised ? -0.012 : applause ? -0.006 : 0;
  const zoom = 1.035 + idle + Math.abs(gestureLift);
  context.fillStyle = "#071026";
  context.fillRect(0, 0, width, height);
  if (image.complete && image.naturalWidth) {
    const rect = coverRect(image.naturalWidth, image.naturalHeight, width, height, zoom);
    context.save();
    context.translate(0, gestureLift * height);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.restore();
  }
  const tint = moodTints[currentMood] || moodTints.neutral;
  const alpha = Math.min(0.16, 0.035 + currentMoodLevel * 0.09);
  context.fillStyle = `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha})`;
  context.fillRect(0, 0, width, height);

  const performanceRunning = activePacket
    && (activePacket.clock.durationMs === 0 || elapsed < activePacket.clock.durationMs);
  if (handRaised || applause) {
    actionBadge.textContent = handRaised ? "CHIEDE PAROLA" : "APPLAUSO";
  } else if (performanceRunning && activePacket?.kind === "speech") {
    actionBadge.textContent = "IN RISPOSTA";
  } else if (performanceRunning && activePacket?.kind === "listening") {
    actionBadge.textContent = "IN ASCOLTO";
  } else {
    actionBadge.textContent = "WEB RUNTIME";
  }

  if (activePacket && elapsed >= activePacket.clock.durationMs && activePacket.kind !== "gesture") {
    runtimeStatus.textContent = "In ascolto";
  }
  if (now - lastHeartbeat > 1000) {
    lastHeartbeat = now;
    window.parent?.postMessage({ type: "conclavia:frame-heartbeat" }, "*");
  }
  requestAnimationFrame(drawFrame);
}

function stopActiveAudio() {
  if (!activeSource) return;
  try { activeSource.stop(); } catch { }
  activeSource.disconnect();
  activeSource = null;
}

async function playSpeech(packet) {
  const audio = ensureAudio();
  const response = await fetch(packet.audio.url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
  const buffer = await audio.decodeAudioData(await response.arrayBuffer());
  if (packet.sequence < latestSequence) return;
  stopActiveAudio();
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.destination);
  source.connect(mediaDestination);
  activeSource = source;
  activeStartedAtAudio = audio.currentTime + 0.04;
  activeStartedAt = performance.now() + 40;
  source.start(activeStartedAtAudio);
  source.addEventListener("ended", () => {
    if (activeSource === source) activeSource = null;
  });
}

async function acceptPacket(packet) {
  if (!packet || packet.schema !== "conclavia.performance" || packet.version !== 1) return;
  if (packet.sequence <= latestSequence) return;
  latestSequence = packet.sequence;
  sequenceLabel.textContent = `packet ${packet.sequence}`;
  avatarName.textContent = packet.avatar.name;
  const interrupt = packet.events.some((event) => event.type === "interrupt");
  if (interrupt) {
    stopActiveAudio();
    activePacket = null;
    currentViseme = "-";
    runtimeStatus.textContent = "Interruzione ricevuta";
    return;
  }

  activePacket = packet;
  activeStartedAt = performance.now();
  activeStartedAtAudio = audioContext?.currentTime || 0;
  runtimeStatus.textContent = `${packet.kind} sincronizzata`;
  if (packet.events.some((event) => event.type === "lower-hand")) handRaised = false;
  if (packet.audio) {
    try {
      await playSpeech(packet);
    } catch (error) {
      runtimeStatus.textContent = `Audio non disponibile: ${error.message}`;
    }
  }
}

async function connectEvents() {
  let after = 0;
  try {
    const response = await fetch("/api/performance/status", { cache: "no-store" });
    if (response.ok) {
      const status = await response.json();
      after = Number.isFinite(status.latestSequence) ? status.latestSequence : 0;
      latestSequence = after;
      sequenceLabel.textContent = `packet ${after}`;
    }
  } catch { }
  const events = new EventSource(`/api/performance/events?after=${after}`);
  events.addEventListener("open", () => {
    runtime.dataset.state = "live";
    liveBadge.textContent = "LIVE";
    runtimeStatus.textContent = "Performance packet in attesa";
    ensureAudio();
    window.parent?.postMessage({
      type: "conclavia:media-ready",
      mediaReady: true,
      audioReady: audioContext?.state === "running",
    }, "*");
  });
  events.addEventListener("performance", (event) => {
    void acceptPacket(JSON.parse(event.data));
  });
  events.addEventListener("error", () => {
    runtime.dataset.state = "connecting";
    liveBadge.textContent = "RICONNESSIONE";
  });
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "conclavia:unmute") ensureAudio();
});
document.addEventListener("pointerdown", ensureAudio, { capture: true });
document.addEventListener("keydown", ensureAudio, { capture: true });
function startAnimation() {
  if (animationStarted) return;
  animationStarted = true;
  requestAnimationFrame(drawFrame);
}

image.addEventListener("load", startAnimation, { once: true });
if (image.complete) startAnimation();
void connectEvents();

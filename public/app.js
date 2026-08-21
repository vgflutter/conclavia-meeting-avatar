const preflightButton = document.querySelector("#preflight-button");
const preflightResults = document.querySelector("#preflight-results");
const simulationForm = document.querySelector("#simulation-form");
const simulationResult = document.querySelector("#simulation-result");
const decisionStatus = document.querySelector("#decision-status");
const contextCount = document.querySelector("#context-count");
const contextResults = document.querySelector("#context-results");
const providerStatus = document.querySelector("#provider-status");
const speakerNameInput = document.querySelector("#speaker-name");
const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const recordingStatus = document.querySelector("#recording-status");
const maryResponse = document.querySelector("#mary-response");
const rendererStartButton = document.querySelector("#renderer-start-button");
const rendererStopButton = document.querySelector("#renderer-stop-button");
const rendererStatus = document.querySelector("#renderer-status");
const rendererPreview = document.querySelector("#renderer-preview");
const rendererOutputLink = document.querySelector("#renderer-output-link");
const listenerStartButton = document.querySelector("#listener-start-button");
const listenerStopButton = document.querySelector("#listener-stop-button");
const listenerStatus = document.querySelector("#listener-status");
const listenerPartial = document.querySelector("#listener-partial");
const listenerTurnCount = document.querySelector("#listener-turn-count");

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let lastListenerSegmentId = null;

function renderCheck(check) {
  const action = check.action ? `<p class="action">${escapeHtml(check.action)}</p>` : "";
  return `<article class="check">
    <header><span>${escapeHtml(check.label)}</span><span class="status ${check.level}">${escapeHtml(check.level)}</span></header>
    <p>${escapeHtml(check.detail)}</p>${action}
  </article>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character]);
}

function renderContext(context) {
  const count = context.retainedSegmentCount ?? 0;
  contextCount.textContent = `${count} ${count === 1 ? "frase" : "frasi"}`;
  if (!context.recentSegments?.length) {
    contextResults.innerHTML = '<p class="empty">La conversazione è ancora vuota.</p>';
    return;
  }
  contextResults.innerHTML = context.recentSegments.map((segment) => `
    <article class="context-turn">
      <strong>${escapeHtml(segment.speakerName)}</strong>
      <p>${escapeHtml(segment.text)}</p>
    </article>
  `).join("");
}

async function refreshContext() {
  try {
    const response = await fetch("/api/context");
    if (response.ok) renderContext(await response.json());
  } catch {
    // The simulation still works if the optional context refresh fails.
  }
}

function renderMaryResponse(decision) {
  const sentences = decision.cue?.sentences;
  if (!decision.activated || !sentences?.length) {
    maryResponse.innerHTML = "";
    return;
  }

  const provider = decision.cue.provider === "openai" ? "OPENAI" : "DIAGNOSTICA";
  maryResponse.innerHTML = `
    <div class="mary-response-heading">
      <strong>Mary</strong>
      <span>${provider}${decision.cue.model ? ` · ${escapeHtml(decision.cue.model)}` : ""}</span>
    </div>
    ${sentences.map((sentence) => `
      <article class="mary-sentence">
        <p>${escapeHtml(sentence.text)}</p>
        <span>${escapeHtml(sentence.mood)}</span>
      </article>
    `).join("")}
  `;
}

function renderTurn(result) {
  renderContext(result.llmContext);
  renderMaryResponse(result.decision);
  decisionStatus.className = `decision-status ${result.decision.activated ? "responding" : "listening"}`;

  if (result.decision.activated && result.decision.cue?.provider === "openai") {
    decisionStatus.textContent = "Ascoltata e aggiunta al contesto. Mary ha letto la conversazione e ha risposto.";
  } else if (result.decision.activated) {
    decisionStatus.textContent = "Mary è stata chiamata, ma sta usando la risposta diagnostica: configura OpenAI per la risposta reale.";
  } else {
    decisionStatus.textContent = "Ascoltata e aggiunta al contesto. Mary continua ad ascoltare senza rispondere.";
  }

  if (result.warning) decisionStatus.textContent += ` ${result.warning}`;
  if (result.renderer?.delivery) {
    rendererStatus.className = "decision-status responding";
    rendererStatus.textContent = `Mary è in onda sul MetaHuman · ${Math.round(result.renderer.delivery.durationMs / 100) / 10}s · ${result.renderer.delivery.sentenceCount} ${result.renderer.delivery.sentenceCount === 1 ? "frase" : "frasi"}.`;
  }
  simulationResult.textContent = JSON.stringify({
    transcription: result.segment.text,
    decision: result.decision,
  }, null, 2);
}

function renderListenerStatus(status) {
  const active = status.phase === "running" || status.phase === "starting";
  listenerStartButton.disabled = active || status.phase === "unavailable";
  listenerStopButton.disabled = !active;
  listenerTurnCount.textContent = `${status.completedTurns ?? 0} ${status.completedTurns === 1 ? "turno" : "turni"}`;
  listenerPartial.textContent = status.partialTranscript
    ? `In ascolto: “${status.partialTranscript}”`
    : "";

  if (status.phase === "running") {
    listenerStatus.className = `recording-status ${status.speechDetected ? "active" : "listening"}`;
    listenerStatus.textContent = status.speechDetected
      ? "Voce rilevata: trascrizione in corso…"
      : `Mary sta leggendo l’audio da ${status.resolvedAudioDevice || status.audioDevice}.`;
  } else if (status.phase === "starting") {
    listenerStatus.className = "recording-status listening";
    listenerStatus.textContent = "Connessione a OpenAI Realtime e apertura del bus Teams…";
  } else if (status.phase === "error") {
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = `Ascolto fermato per errore: ${status.lastError || "errore sconosciuto"}`;
  } else if (status.phase === "unavailable") {
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = status.lastError || "OpenAI non configurato.";
  } else {
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = status.lastError
      ? `Ascolto continuo fermo. Ultimo dettaglio: ${status.lastError}`
      : "Ascolto continuo fermo.";
  }

  const result = status.lastResult;
  if (result?.segment?.id && result.segment.id !== lastListenerSegmentId) {
    lastListenerSegmentId = result.segment.id;
    renderTurn(result);
  }
}

async function refreshListenerStatus() {
  try {
    const response = await fetch("/api/listener/status");
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `HTTP ${response.status}`);
    renderListenerStatus(status);
  } catch (error) {
    listenerStartButton.disabled = true;
    listenerStopButton.disabled = true;
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = `Controllo ascolto fallito: ${error.message}`;
  }
}

listenerStartButton.addEventListener("click", async () => {
  listenerStartButton.disabled = true;
  listenerStatus.className = "recording-status listening";
  listenerStatus.textContent = "Avvio ascolto continuo…";
  try {
    const response = await fetch("/api/listener/start", { method: "POST" });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `HTTP ${response.status}`);
    renderListenerStatus(status);
  } catch (error) {
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = `Avvio ascolto fallito: ${error.message}`;
    listenerStartButton.disabled = false;
  }
});

listenerStopButton.addEventListener("click", async () => {
  listenerStopButton.disabled = true;
  listenerStatus.className = "recording-status listening";
  listenerStatus.textContent = "Arresto dell’ascolto continuo…";
  try {
    const response = await fetch("/api/listener/session", { method: "DELETE" });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `HTTP ${response.status}`);
    renderListenerStatus(status);
  } catch (error) {
    listenerStatus.className = "recording-status";
    listenerStatus.textContent = `Arresto ascolto fallito: ${error.message}`;
    listenerStopButton.disabled = false;
  }
});

function pixelStreamingUrl(value) {
  const url = new URL(value, window.location.origin);
  url.searchParams.set("AutoConnect", "true");
  url.searchParams.set("AutoPlayVideo", "true");
  url.searchParams.set("conclaviaMeeting", String(Date.now()));
  return url.toString();
}

function mountRendererPlayer(playerUrl) {
  if (!playerUrl) return;
  const outputUrl = pixelStreamingUrl(playerUrl);
  const currentFrame = rendererPreview.querySelector("iframe");
  if (!currentFrame || currentFrame.dataset.source !== playerUrl) {
    rendererPreview.innerHTML = `<iframe title="Conclavia MetaHuman" src="${escapeHtml(outputUrl)}" data-source="${escapeHtml(playerUrl)}" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>`;
  }
  rendererOutputLink.href = outputUrl;
  rendererOutputLink.hidden = false;
}

function renderRendererStatus(status) {
  const reachable = status.serverStatus !== "unreachable";
  rendererStartButton.disabled = !status.configured || !reachable || status.armed;
  rendererStopButton.disabled = !status.armed;

  if (!status.configured) {
    rendererStatus.className = "decision-status";
    rendererStatus.textContent = "Bridge Conclavia non configurato.";
  } else if (!reachable) {
    rendererStatus.className = "decision-status";
    rendererStatus.textContent = "Avvia conclavia-frontend sulla porta 3000 per raggiungere le API Unreal.";
  } else if (status.armed && status.available) {
    rendererStatus.className = "decision-status responding";
    rendererStatus.textContent = "MetaHuman pronto e armato: la prossima risposta di Mary andrà in onda.";
  } else if (status.armed) {
    rendererStatus.className = "decision-status listening";
    rendererStatus.textContent = "MetaHuman armato; il renderer sta completando l’avvio.";
  } else if (status.available) {
    rendererStatus.className = "decision-status listening";
    rendererStatus.textContent = "Renderer già online. Premi “Avvia MetaHuman” per collegarlo a Mary.";
  } else {
    rendererStatus.className = "decision-status listening";
    rendererStatus.textContent = `Renderer ${status.serverStatus || "non ancora avviato"}. L’avvio può accendere l’host GPU.`;
  }
  if (status.playerUrl) mountRendererPlayer(status.playerUrl);
}

async function refreshRendererStatus() {
  try {
    const response = await fetch("/api/renderer/status");
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `HTTP ${response.status}`);
    renderRendererStatus(status);
  } catch (error) {
    rendererStartButton.disabled = true;
    rendererStopButton.disabled = true;
    rendererStatus.className = "decision-status";
    rendererStatus.textContent = `Controllo MetaHuman fallito: ${error.message}`;
  }
}

rendererStartButton.addEventListener("click", async () => {
  rendererStartButton.disabled = true;
  rendererStatus.className = "decision-status listening";
  rendererStatus.textContent = "Avvio del MetaHuman e verifica del flusso Pixel Streaming… può richiedere alcuni minuti.";
  try {
    const response = await fetch("/api/renderer/start", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    renderRendererStatus({
      configured: true,
      available: true,
      armed: true,
      serverStatus: result.serverStatus,
      playerUrl: result.playerUrl,
    });
  } catch (error) {
    rendererStatus.className = "decision-status";
    rendererStatus.textContent = `Avvio MetaHuman fallito: ${error.message}`;
    rendererStartButton.disabled = false;
  }
});

rendererStopButton.addEventListener("click", async () => {
  rendererStopButton.disabled = true;
  rendererStatus.className = "decision-status listening";
  rendererStatus.textContent = "Arresto del renderer…";
  try {
    const response = await fetch("/api/renderer/session", { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    rendererPreview.innerHTML = '<p class="empty">Renderer fermato.</p>';
    rendererOutputLink.hidden = true;
    renderRendererStatus({
      configured: true,
      available: false,
      armed: false,
      serverStatus: "off",
    });
  } catch (error) {
    rendererStatus.className = "decision-status";
    rendererStatus.textContent = `Arresto MetaHuman fallito: ${error.message}`;
    rendererStopButton.disabled = false;
  }
});

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const health = await response.json();
    providerStatus.className = `provider-status ${health.openaiConfigured ? "ready" : "missing"}`;
    providerStatus.textContent = health.openaiConfigured
      ? `OpenAI pronto · ${health.transcriptionModel}`
      : "OpenAI non configurato";
    recordButton.disabled = !health.openaiConfigured || !window.MediaRecorder;
    if (!health.openaiConfigured) {
      recordingStatus.textContent = "Aggiungi OPENAI_API_KEY a .env e riavvia il server.";
    } else if (!window.MediaRecorder) {
      recordingStatus.textContent = "Questo browser non supporta la registrazione MediaRecorder.";
    }
  } catch (error) {
    providerStatus.className = "provider-status missing";
    providerStatus.textContent = "Server non raggiungibile";
    recordButton.disabled = true;
    recordingStatus.textContent = `Controllo fallito: ${error.message}`;
  }
}

function preferredAudioMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function releaseMicrophone() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

recordButton.addEventListener("click", async () => {
  const speakerName = speakerNameInput.value.trim();
  if (!speakerName) {
    recordingStatus.textContent = "Inserisci prima il nome del partecipante.";
    speakerNameInput.focus();
    return;
  }

  recordButton.disabled = true;
  audioChunks = [];
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredAudioMimeType();
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", async () => {
      const recordedMimeType = mediaRecorder.mimeType || audioChunks[0]?.type || "audio/webm";
      const audio = new Blob(audioChunks, { type: recordedMimeType });
      releaseMicrophone();
      stopButton.disabled = true;
      recordingStatus.className = "recording-status";
      recordingStatus.textContent = "Trascrizione e analisi in corso…";
      try {
        const response = await fetch(`/api/transcribe?speakerName=${encodeURIComponent(speakerName)}`, {
          method: "POST",
          headers: { "content-type": recordedMimeType },
          body: audio,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        renderTurn(result);
        recordingStatus.textContent = `Trascritto: “${result.segment.text}”`;
      } catch (error) {
        recordingStatus.textContent = `Errore: ${error.message}`;
      } finally {
        recordButton.disabled = false;
        mediaRecorder = null;
        audioChunks = [];
      }
    }, { once: true });
    mediaRecorder.start();
    stopButton.disabled = false;
    recordingStatus.className = "recording-status active";
    recordingStatus.textContent = "Registrazione attiva: parla, poi premi “Stop e invia”.";
  } catch (error) {
    releaseMicrophone();
    recordButton.disabled = false;
    recordingStatus.textContent = `Microfono non disponibile: ${error.message}`;
  }
});

stopButton.addEventListener("click", () => {
  if (mediaRecorder?.state === "recording") {
    stopButton.disabled = true;
    mediaRecorder.stop();
  }
});

preflightButton.addEventListener("click", async () => {
  preflightButton.disabled = true;
  preflightButton.textContent = "Controllo…";
  preflightResults.innerHTML = '<p class="empty">Analisi del Mac in corso…</p>';
  try {
    const response = await fetch("/api/preflight");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    preflightResults.innerHTML = report.checks.map(renderCheck).join("");
  } catch (error) {
    preflightResults.innerHTML = `<p class="empty">Controllo fallito: ${escapeHtml(error.message)}</p>`;
  } finally {
    preflightButton.disabled = false;
    preflightButton.textContent = "Controlla";
  }
});

simulationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(simulationForm);
  simulationResult.textContent = "Elaborazione…";
  try {
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        speakerName: data.get("speakerName"),
        text: data.get("text"),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    renderTurn(result);
  } catch (error) {
    decisionStatus.className = "decision-status";
    decisionStatus.textContent = "La frase non è stata acquisita.";
    simulationResult.textContent = `Errore: ${error.message}`;
  }
});

void refreshContext();
void refreshHealth();
void refreshRendererStatus();
void refreshListenerStatus();
window.setInterval(refreshRendererStatus, 8_000);
window.setInterval(refreshListenerStatus, 1_000);

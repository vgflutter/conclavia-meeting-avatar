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
const configForm = document.querySelector("#avatar-config-form");
const configSummary = document.querySelector("#config-summary");
const configStatus = document.querySelector("#config-status");
const configSaveButton = document.querySelector("#config-save-button");
const avatarProfileInput = document.querySelector("#avatar-profile");
const meetingPlatformInput = document.querySelector("#meeting-platform");
const meetingPlatformName = document.querySelector("#meeting-platform-name");
const avatarNameInput = document.querySelector("#avatar-name");
const responseModelInput = document.querySelector("#response-model");
const voiceStyleInput = document.querySelector("#voice-style");
const italianVoiceInput = document.querySelector("#italian-voice");
const englishVoiceInput = document.querySelector("#english-voice");
const meetingAudioDeviceInput = document.querySelector("#meeting-audio-device");
const meetingSpeakerNameInput = document.querySelector("#meeting-speaker-name");
const apiKeyInput = document.querySelector("#openai-api-key");
const apiKeyState = document.querySelector("#api-key-state");
const purposeInput = document.querySelector("#avatar-purpose");
const personalityInput = document.querySelector("#avatar-personality");
const systemPromptInput = document.querySelector("#avatar-system-prompt");
const webSearchInput = document.querySelector("#web-search-enabled");
const requestToSpeakInput = document.querySelector("#request-to-speak-enabled");
const avatarChatTitle = document.querySelector("#avatar-chat-title");
const activationNote = document.querySelector("#activation-note");
const participationRequest = document.querySelector("#participation-request");
const participationTitle = document.querySelector("#participation-title");
const participationReason = document.querySelector("#participation-reason");
const participationGrant = document.querySelector("#participation-grant");
const participationDismiss = document.querySelector("#participation-dismiss");

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let lastListenerSegmentId = null;
let avatarName = "Mary";

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

function applyAvatarName(name, requestToSpeakEnabled = true) {
  avatarName = name || "Mary";
  avatarChatTitle.textContent = `Parla con ${avatarName}`;
  activationNote.textContent = requestToSpeakEnabled
    ? `Ogni frase finale entra nel contesto. ${avatarName} risponde quando viene chiamata o chiede prima la parola.`
    : `Ogni frase finale entra nel contesto. ${avatarName} risponde quando viene chiamata.`;
}

function applyMeetingPlatform(platform) {
  meetingPlatformName.textContent = platform === "google-meet"
    ? "Google Meet"
    : platform === "teams"
      ? "Microsoft Teams"
      : "Meeting";
}

function renderConfig(payload) {
  const { config, options } = payload;
  avatarProfileInput.innerHTML = options.avatarProfiles.map((profile) =>
    `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`
  ).join("");
  avatarProfileInput.value = config.avatarProfile;
  meetingPlatformInput.innerHTML = options.meetingPlatforms.map((platform) => {
    const label = platform === "google-meet"
      ? "Google Meet"
      : platform === "teams"
        ? "Microsoft Teams"
        : "Generica";
    return `<option value="${escapeHtml(platform)}">${escapeHtml(label)}</option>`;
  }).join("");
  meetingPlatformInput.value = config.meetingPlatform;
  avatarNameInput.value = config.name;
  responseModelInput.value = config.responseModel;
  voiceStyleInput.value = config.voiceStyle;
  italianVoiceInput.innerHTML = options.italianVoices.map((voice) =>
    `<option value="${escapeHtml(voice.id)}">${escapeHtml(voice.label)}</option>`
  ).join("");
  italianVoiceInput.value = config.italianVoice;
  englishVoiceInput.innerHTML = options.englishVoices.map((voice) =>
    `<option value="${escapeHtml(voice.id)}">${escapeHtml(voice.label)}</option>`
  ).join("");
  englishVoiceInput.value = config.englishVoice;
  meetingAudioDeviceInput.value = config.meetingAudioDevice;
  meetingSpeakerNameInput.value = config.meetingSpeakerName;
  purposeInput.value = config.purpose;
  personalityInput.value = config.personality;
  systemPromptInput.value = config.systemPrompt;
  webSearchInput.checked = config.webSearchEnabled;
  requestToSpeakInput.checked = config.requestToSpeakEnabled;
  apiKeyInput.value = "";
  apiKeyState.textContent = config.apiKeyConfigured
    ? `Chiave configurata (${config.apiKeySource === "environment" ? "ambiente" : "archivio locale protetto"}). Lascia vuoto per mantenerla.`
    : "Nessuna chiave configurata. La chiave non viene mai restituita al browser.";
  configSummary.textContent = `${config.name} · ${config.responseModel}`;
  applyAvatarName(config.name, config.requestToSpeakEnabled);
  applyMeetingPlatform(config.meetingPlatform);
}

async function refreshConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    renderConfig(payload);
  } catch (error) {
    configStatus.textContent = `Configurazione non disponibile: ${error.message}`;
  }
}

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  configSaveButton.disabled = true;
  configStatus.textContent = "Salvataggio e applicazione in corso…";
  try {
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        avatarProfile: avatarProfileInput.value,
        meetingPlatform: meetingPlatformInput.value,
        name: avatarNameInput.value,
        responseModel: responseModelInput.value,
        voiceStyle: voiceStyleInput.value,
        italianVoice: italianVoiceInput.value,
        englishVoice: englishVoiceInput.value,
        meetingAudioDevice: meetingAudioDeviceInput.value,
        meetingSpeakerName: meetingSpeakerNameInput.value,
        apiKey: apiKeyInput.value,
        purpose: purposeInput.value,
        personality: personalityInput.value,
        systemPrompt: systemPromptInput.value,
        webSearchEnabled: webSearchInput.checked,
        requestToSpeakEnabled: requestToSpeakInput.checked,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    await refreshConfig();
    await refreshHealth();
    await refreshListenerStatus();
    configStatus.textContent = result.listenerWarning
      ? `Configurazione salvata; ascolto non riavviato: ${result.listenerWarning}`
      : result.listenerRestarted
        ? "Configurazione salvata. L’ascolto del meeting è stato riavviato."
        : "Configurazione salvata e applicata.";
  } catch (error) {
    configStatus.textContent = `Salvataggio fallito: ${error.message}`;
  } finally {
    configSaveButton.disabled = false;
  }
});

function renderParticipationRequest(request) {
  participationRequest.hidden = !request;
  if (!request) return;
  participationTitle.textContent = `${request.speakerName || avatarName} chiede la parola`;
  participationReason.textContent = request.reason || "Ha un contributo utile alla conversazione.";
}

async function refreshParticipation() {
  try {
    const response = await fetch("/api/participation", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) renderParticipationRequest(payload.request);
  } catch {
    // The request also remains visible in the most recent turn result.
  }
}

participationGrant.addEventListener("click", async () => {
  participationGrant.disabled = true;
  participationDismiss.disabled = true;
  participationReason.textContent = `Sto dando la parola a ${avatarName}…`;
  try {
    const response = await fetch("/api/participation/grant", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    renderParticipationRequest(null);
    renderMaryResponse({ activated: true, cue: result.cue });
    decisionStatus.className = "decision-status responding";
    decisionStatus.textContent = `${avatarName} ha ricevuto la parola e sta rispondendo.`;
    if (result.delivery) {
      rendererStatus.className = "decision-status responding";
      rendererStatus.textContent = `${avatarName} è in onda sul MetaHuman.`;
    }
    await refreshContext();
  } catch (error) {
    participationReason.textContent = `Impossibile dare la parola: ${error.message}`;
  } finally {
    participationGrant.disabled = false;
    participationDismiss.disabled = false;
  }
});

participationDismiss.addEventListener("click", async () => {
  participationGrant.disabled = true;
  participationDismiss.disabled = true;
  try {
    const response = await fetch("/api/participation", { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    renderParticipationRequest(null);
  } catch (error) {
    participationReason.textContent = `Chiusura non riuscita: ${error.message}`;
  } finally {
    participationGrant.disabled = false;
    participationDismiss.disabled = false;
  }
});

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
  const sources = decision.cue.webSources ?? [];
  maryResponse.innerHTML = `
    <div class="mary-response-heading">
      <strong>${escapeHtml(decision.cue.speakerName || avatarName)}</strong>
      <span>${provider}${decision.cue.model ? ` · ${escapeHtml(decision.cue.model)}` : ""}</span>
    </div>
    ${sentences.map((sentence) => `
      <article class="mary-sentence">
        <p>${escapeHtml(sentence.text)}</p>
        <span>${escapeHtml(sentence.mood)} · L${escapeHtml(sentence.level ?? 3)}</span>
      </article>
    `).join("")}
    ${sources.length ? `<ul class="web-sources">${sources.map((source) =>
      `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`
    ).join("")}</ul>` : ""}
  `;
}

function renderTurn(result) {
  renderContext(result.llmContext);
  renderMaryResponse(result.decision);
  renderParticipationRequest(result.decision.request ?? result.llmContext?.participationRequest ?? null);
  decisionStatus.className = `decision-status ${result.decision.activated ? "responding" : "listening"}`;

  if (result.decision.activated && result.decision.cue?.provider === "openai") {
    decisionStatus.textContent = `Ascoltata e aggiunta al contesto. ${avatarName} ha letto la conversazione e ha risposto${result.usedWebSearch ? " usando la ricerca web" : ""}.`;
  } else if (result.decision.activated) {
    decisionStatus.textContent = `${avatarName} è stata chiamata, ma sta usando la risposta diagnostica: configura OpenAI per la risposta reale.`;
  } else if (result.decision.reason === "autonomous-request") {
    decisionStatus.textContent = `${avatarName} ha un contributo e ha chiesto la parola senza interrompere.`;
  } else {
    decisionStatus.textContent = `Ascoltata e aggiunta al contesto. ${avatarName} continua ad ascoltare senza rispondere.`;
  }

  if (result.warning) decisionStatus.textContent += ` ${result.warning}`;
  if (result.renderer?.delivery) {
    rendererStatus.className = "decision-status responding";
    rendererStatus.textContent = `${avatarName} è in onda sul MetaHuman · ${Math.round(result.renderer.delivery.durationMs / 100) / 10}s · ${result.renderer.delivery.sentenceCount} ${result.renderer.delivery.sentenceCount === 1 ? "frase" : "frasi"}.`;
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
      : `${avatarName} sta leggendo l’audio da ${status.resolvedAudioDevice || status.audioDevice}.`;
  } else if (status.phase === "starting") {
    listenerStatus.className = "recording-status listening";
    listenerStatus.textContent = "Connessione a OpenAI Realtime e apertura del bus del meeting…";
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
    rendererStatus.textContent = `MetaHuman pronto e armato: la prossima risposta di ${avatarName} andrà in onda.`;
  } else if (status.armed) {
    rendererStatus.className = "decision-status listening";
    rendererStatus.textContent = "MetaHuman armato; il renderer sta completando l’avvio.";
  } else if (status.available) {
    rendererStatus.className = "decision-status listening";
    rendererStatus.textContent = `Renderer già online. Premi “Avvia MetaHuman” per collegarlo a ${avatarName}.`;
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
      ? `OpenAI pronto · ${health.responseModel}${health.webSearchEnabled ? " · web" : ""}`
      : "OpenAI non configurato";
    recordButton.disabled = !health.openaiConfigured || !window.MediaRecorder;
    if (!health.openaiConfigured) {
      recordingStatus.textContent = "Inserisci la OpenAI API key nel pannello di configurazione.";
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

void refreshConfig().then(refreshHealth);
void refreshContext();
void refreshRendererStatus();
void refreshListenerStatus();
void refreshParticipation();
window.setInterval(refreshRendererStatus, 8_000);
window.setInterval(refreshListenerStatus, 1_000);
window.setInterval(refreshParticipation, 750);

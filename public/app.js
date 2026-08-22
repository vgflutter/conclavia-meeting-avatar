const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  providerStatus: $("#provider-status"),
  rendererPill: $("#renderer-pill"),
  listenerPill: $("#listener-pill"),
  meetingClock: $("#meeting-clock"),
  meetingPlatformBadge: $("#meeting-platform-badge"),
  participantCount: $("#participant-count"),
  resetMeetingButton: $("#reset-meeting-button"),
  rendererPreview: $("#renderer-preview"),
  stageAvatarName: $("#stage-avatar-name"),
  stageSpeakerName: $("#stage-speaker-name"),
  stageSpeakerDetail: $("#stage-speaker-detail"),
  stageLiveState: $("#stage-live-state"),
  stageListeningState: $("#stage-listening-state"),
  stageMood: $("#stage-mood"),
  recordButton: $("#record-button"),
  stopButton: $("#stop-button"),
  recordingStatus: $("#recording-status"),
  listenerStartButton: $("#listener-start-button"),
  listenerStopButton: $("#listener-stop-button"),
  listenerStatus: $("#listener-status"),
  listenerPartial: $("#listener-partial"),
  listenerTurnCount: $("#listener-turn-count"),
  rendererStartButton: $("#renderer-start-button"),
  rendererStopButton: $("#renderer-stop-button"),
  rendererStatus: $("#renderer-status"),
  rendererOutputLink: $("#renderer-output-link"),
  meetingAvatarSelect: $("#meeting-avatar-select"),
  meetingAvatarSwitchButton: $("#meeting-avatar-switch-button"),
  avatarSwitchStatus: $("#avatar-switch-status"),
  activeAvatarLabel: $("#active-avatar-label"),
  meetingComposerForm: $("#meeting-composer-form"),
  meetingMessage: $("#meeting-message"),
  meetingSendButton: $("#meeting-send-button"),
  speakerName: $("#speaker-name"),
  composerLabel: $("#composer-label"),
  composerHint: $("#composer-hint"),
  quickCommands: $("#quick-commands"),
  contextCount: $("#context-count"),
  dialogueState: $("#dialogue-state"),
  contextResults: $("#context-results"),
  sidebarChatComposer: $("#sidebar-chat-composer"),
  sidebarChatText: $("#sidebar-chat-text"),
  sidebarChatSend: $("#sidebar-chat-send"),
  decisionIndicator: $("#decision-indicator"),
  decisionStatus: $("#decision-status"),
  latencySummary: $("#latency-summary"),
  maryResponse: $("#mary-response"),
  chatTestStatus: $("#chat-test-status"),
  participationRequest: $("#participation-request"),
  participationTitle: $("#participation-title"),
  participationReason: $("#participation-reason"),
  participationGrant: $("#participation-grant"),
  participationDismiss: $("#participation-dismiss"),
  configForm: $("#avatar-config-form"),
  configSummary: $("#config-summary"),
  configStatus: $("#config-status"),
  configSaveButton: $("#config-save-button"),
  avatarChoiceGrid: $("#avatar-choice-grid"),
  avatarProfile: $("#avatar-profile"),
  meetingPlatform: $("#meeting-platform"),
  avatarName: $("#avatar-name"),
  responseModel: $("#response-model"),
  voiceStyle: $("#voice-style"),
  italianVoice: $("#italian-voice"),
  englishVoice: $("#english-voice"),
  meetingAudioDevice: $("#meeting-audio-device"),
  meetingSpeakerName: $("#meeting-speaker-name"),
  apiKey: $("#openai-api-key"),
  apiKeyState: $("#api-key-state"),
  purpose: $("#avatar-purpose"),
  personality: $("#avatar-personality"),
  systemPrompt: $("#avatar-system-prompt"),
  webSearch: $("#web-search-enabled"),
  requestToSpeak: $("#request-to-speak-enabled"),
  chatEnabled: $("#chat-enabled"),
  commandRaiseHand: $("#command-raise-hand"),
  commandLowerHand: $("#command-lower-hand"),
  commandSummarizeChat: $("#command-summarize-chat"),
  commandReplyChat: $("#command-reply-chat"),
  commandSpeak: $("#command-speak"),
  preflightButton: $("#preflight-button"),
  preflightResults: $("#preflight-results"),
  simulationResult: $("#simulation-result"),
  chatTestResultLabel: $("#chat-test-result-label"),
};

let avatarName = "Mary";
let currentConfig = null;
let currentContext = { retainedSegmentCount: 0, recentSegments: [], dialogue: { active: false } };
let currentChannel = "voice";
let currentSidePanel = "transcript";
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let lastListenerSegmentId = null;
let stageModeTimer = null;
let meetingStartedAt = Date.now();
let activeAvatarProfile = null;
let rendererActionInProgress = false;
let rendererActionProfile = null;
let rendererWasAvailable = false;
let rendererStatusRefreshInFlight = false;
const meetingId = `conclavia-gui-${crypto.randomUUID()}`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character]);
}

function initials(value) {
  return String(value || "?")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function platformLabel(platform) {
  if (platform === "google-meet") return "Google Meet";
  if (platform === "teams") return "Microsoft Teams";
  return "Meeting generico";
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderDebug(value, label = "ULTIMO TURNO") {
  elements.chatTestResultLabel.textContent = label;
  elements.simulationResult.textContent = JSON.stringify(value, null, 2);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function setDecision(message, state = "listening") {
  elements.decisionStatus.textContent = message;
  elements.decisionIndicator.className = `decision-indicator ${state}`;
}

function setStageMode(mode, detail) {
  window.clearTimeout(stageModeTimer);
  elements.stageSpeakerDetail.textContent = detail;
  elements.stageListeningState.className = "stage-badge muted-badge";
  if (mode === "speaking") {
    elements.stageListeningState.textContent = "STA PARLANDO";
    elements.stageListeningState.classList.add("active");
  } else if (mode === "requesting") {
    elements.stageListeningState.textContent = "CHIEDE PAROLA";
    elements.stageListeningState.classList.add("active");
  } else {
    elements.stageListeningState.textContent = "IN ASCOLTO";
  }
}

function settleStageAfter(durationMs = 4_000) {
  window.clearTimeout(stageModeTimer);
  stageModeTimer = window.setTimeout(() => {
    if (currentContext.avatarHandRaised) return;
    setStageMode("listening", "Partecipante virtuale");
    elements.stageMood.hidden = true;
  }, Math.max(1_000, durationMs));
}

function applyAvatarIdentity(config) {
  avatarName = config.name || "Mary";
  elements.stageAvatarName.textContent = avatarName;
  elements.stageSpeakerName.textContent = avatarName;
  elements.composerHint.textContent = config.requestToSpeakEnabled
    ? `Ogni intervento viene letto e aggiunto alla memoria. Interpella ${avatarName} per una risposta; in autonomia alzerà prima la mano.`
    : `Ogni intervento viene letto e aggiunto alla memoria. Interpella ${avatarName} per ottenere una risposta.`;
  elements.meetingPlatformBadge.textContent = platformLabel(config.meetingPlatform);
}

function renderCommandAliases(input, aliases) {
  input.value = (aliases ?? []).join(", ");
}

function parseCommandAliases(input) {
  return [...new Set(input.value
    .split(",")
    .map((alias) => alias.trim().replace(/\s+/gu, " "))
    .filter(Boolean))];
}

function updateAvatarChoiceSelection(profile) {
  $$(".avatar-choice").forEach((button) => {
    button.classList.toggle("selected", button.dataset.profile === profile);
  });
}

function renderAvatarChoices(profiles, selectedProfile) {
  elements.meetingAvatarSelect.innerHTML = profiles.map((profile) =>
    `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`
  ).join("");
  elements.meetingAvatarSelect.value = selectedProfile;
  elements.avatarChoiceGrid.innerHTML = profiles.map((profile) => `
    <button class="avatar-choice ${profile.id === selectedProfile ? "selected" : ""}" type="button" data-profile="${escapeHtml(profile.id)}">
      <span class="avatar-choice-portrait" aria-hidden="true">${escapeHtml(initials(profile.label.split("·")[0]))}</span>
      <span><strong>${escapeHtml(profile.label.split("·")[0].trim())}</strong><small>MetaHuman disponibile</small></span>
    </button>
  `).join("");
}

function renderConfig(payload) {
  const { config, options } = payload;
  currentConfig = config;
  elements.avatarProfile.innerHTML = options.avatarProfiles.map((profile) =>
    `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`
  ).join("");
  elements.avatarProfile.value = config.avatarProfile;
  renderAvatarChoices(options.avatarProfiles, config.avatarProfile);
  elements.meetingPlatform.innerHTML = options.meetingPlatforms.map((platform) =>
    `<option value="${escapeHtml(platform)}">${escapeHtml(platformLabel(platform))}</option>`
  ).join("");
  elements.meetingPlatform.value = config.meetingPlatform;
  elements.avatarName.value = config.name;
  elements.responseModel.value = config.responseModel;
  elements.voiceStyle.value = config.voiceStyle;
  elements.italianVoice.innerHTML = options.italianVoices.map((voice) =>
    `<option value="${escapeHtml(voice.id)}">${escapeHtml(voice.label)}</option>`
  ).join("");
  elements.italianVoice.value = config.italianVoice;
  elements.englishVoice.innerHTML = options.englishVoices.map((voice) =>
    `<option value="${escapeHtml(voice.id)}">${escapeHtml(voice.label)}</option>`
  ).join("");
  elements.englishVoice.value = config.englishVoice;
  elements.meetingAudioDevice.value = config.meetingAudioDevice;
  elements.meetingSpeakerName.value = config.meetingSpeakerName;
  elements.purpose.value = config.purpose;
  elements.personality.value = config.personality;
  elements.systemPrompt.value = config.systemPrompt;
  elements.webSearch.checked = config.webSearchEnabled;
  elements.requestToSpeak.checked = config.requestToSpeakEnabled;
  elements.chatEnabled.checked = config.chatEnabled;
  renderCommandAliases(elements.commandRaiseHand, config.chatCommandAliases.raiseHand);
  renderCommandAliases(elements.commandLowerHand, config.chatCommandAliases.lowerHand);
  renderCommandAliases(elements.commandSummarizeChat, config.chatCommandAliases.summarizeInChat);
  renderCommandAliases(elements.commandReplyChat, config.chatCommandAliases.replyInChat);
  renderCommandAliases(elements.commandSpeak, config.chatCommandAliases.speak);
  elements.apiKey.value = "";
  elements.apiKeyState.textContent = config.apiKeyConfigured
    ? `Chiave configurata (${config.apiKeySource === "environment" ? "ambiente" : "archivio locale"}). Lascia vuoto per mantenerla.`
    : "Nessuna chiave configurata. La chiave non viene mai restituita al browser.";
  elements.configSummary.textContent = `${config.name} · ${config.avatarProfile} · ${config.responseModel}`;
  applyAvatarIdentity(config);
  renderSidePanel();
}

async function refreshConfig() {
  try {
    renderConfig(await requestJson("/api/config"));
  } catch (error) {
    elements.configStatus.textContent = `Configurazione non disponibile: ${error.message}`;
  }
}

function sourceLabel(segment) {
  if (segment.source === "chat") return `Chat · ${platformLabel(segment.platform)}`;
  if (segment.source === "manual") return "Parlato simulato";
  return "Voce trascritta";
}

function isAvatarSegment(segment) {
  return segment.speakerName?.localeCompare(avatarName, undefined, { sensitivity: "accent" }) === 0;
}

function eventMarkup(segment) {
  const avatar = isAvatarSegment(segment);
  const className = avatar ? "avatar-event" : segment.source === "chat" ? "chat-event" : "";
  return `<article class="timeline-event ${className}">
    <span class="timeline-avatar" aria-hidden="true">${escapeHtml(initials(segment.speakerName))}</span>
    <div class="timeline-copy">
      <div class="timeline-heading"><strong>${escapeHtml(segment.speakerName)}</strong><span>${escapeHtml(formatTime(segment.capturedAt))}</span></div>
      <p>${escapeHtml(segment.text)}</p>
      <span class="timeline-source">${escapeHtml(sourceLabel(segment))}</span>
    </div>
  </article>`;
}

function participantMarkup(name, detail, isAvatar = false) {
  const hand = isAvatar && currentContext.avatarHandRaised ? "✋" : "●";
  return `<article class="participant-row">
    <span class="timeline-avatar" style="${isAvatar ? "background:var(--accent)" : ""}" aria-hidden="true">${escapeHtml(initials(name))}</span>
    <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>
    <span class="participant-state" aria-label="${isAvatar && currentContext.avatarHandRaised ? "Mano alzata" : "Connesso"}">${hand}</span>
  </article>`;
}

function meetingParticipants() {
  const names = new Map();
  names.set(avatarName.toLocaleLowerCase(), { name: avatarName, isAvatar: true });
  const localSpeaker = elements.speakerName.value.trim();
  if (localSpeaker && localSpeaker.localeCompare(avatarName, undefined, { sensitivity: "accent" }) !== 0) {
    names.set(localSpeaker.toLocaleLowerCase(), { name: localSpeaker, isAvatar: false });
  }
  for (const segment of currentContext.recentSegments ?? []) {
    const key = segment.speakerName.toLocaleLowerCase();
    if (!names.has(key)) names.set(key, { name: segment.speakerName, isAvatar: isAvatarSegment(segment) });
  }
  return [...names.values()];
}

function renderSidePanel() {
  if (!elements.contextResults) return;
  const segments = currentContext.recentSegments ?? [];
  if (currentSidePanel === "participants") {
    elements.contextResults.innerHTML = meetingParticipants().map((participant) => participantMarkup(
      participant.name,
      participant.isAvatar ? "Avatar Conclavia · audio e video" : "Partecipante di prova",
      participant.isAvatar,
    )).join("");
    return;
  }

  const visible = currentSidePanel === "chat"
    ? segments.filter((segment) => segment.source === "chat")
    : segments;
  if (!visible.length) {
    const title = currentSidePanel === "chat" ? "La chat è vuota" : "La riunione è pronta";
    const copy = currentSidePanel === "chat"
      ? "Scrivi qui o usa un comando rapido. L’avatar leggerà il messaggio attraverso lo stesso endpoint usato dagli adapter."
      : "Parla, scrivi in chat o usa un comando rapido per iniziare il test.";
    elements.contextResults.innerHTML = `<div class="feed-empty"><strong>${title}</strong><p>${copy}</p></div>`;
  } else {
    elements.contextResults.innerHTML = visible.map(eventMarkup).join("");
    elements.contextResults.scrollTop = elements.contextResults.scrollHeight;
  }
}

function renderContext(context) {
  currentContext = context;
  const count = context.retainedSegmentCount ?? 0;
  const participants = meetingParticipants();
  elements.participantCount.textContent = `${participants.length} ${participants.length === 1 ? "partecipante" : "partecipanti"}`;
  elements.contextCount.textContent = `${count} ${count === 1 ? "intervento" : "interventi"}`;
  elements.dialogueState.textContent = context.dialogue?.active
    ? `${avatarName} con ${context.dialogue.speakerName || "partecipante"} · ${context.dialogue.remainingFollowUps} follow-up`
    : context.avatarHandRaised
      ? `${avatarName} chiede la parola`
      : `${avatarName} in ascolto`;
  if (context.avatarHandRaised) setStageMode("requesting", "In attesa del permesso");
  else if (elements.stageListeningState.textContent === "CHIEDE PAROLA") setStageMode("listening", "Partecipante virtuale");
  const listeningReaction = context.listeningReaction;
  const reactionIsCurrent = listeningReaction?.holdUntil &&
    Date.parse(listeningReaction.holdUntil) > Date.now();
  if (!context.avatarHandRaised && reactionIsCurrent) {
    elements.stageMood.textContent = `ascolto · ${listeningReaction.mood} · L${listeningReaction.level}`;
    elements.stageMood.hidden = false;
  } else if (elements.stageListeningState.textContent !== "STA PARLANDO") {
    elements.stageMood.hidden = true;
  }
  renderParticipationRequest(context.participationRequest ?? null);
  renderSidePanel();
}

async function refreshContext() {
  try {
    renderContext(await requestJson("/api/context"));
  } catch {
    // A failed background refresh must not interrupt an active meeting control.
  }
}

function renderParticipationRequest(request) {
  elements.participationRequest.hidden = !request;
  if (!request) return;
  elements.participationTitle.textContent = `${request.speakerName || avatarName} chiede la parola`;
  elements.participationReason.textContent = request.reason || "Ha un contributo utile alla conversazione.";
  setStageMode("requesting", "In attesa del permesso");
  setDecision(`${avatarName} ha alzato la mano: scegli se darle la parola.`, "requesting");
}

function renderMaryResponse(decision) {
  const sentences = decision?.cue?.sentences;
  if (!decision?.activated || !sentences?.length) {
    elements.maryResponse.innerHTML = "";
    return;
  }
  const provider = decision.cue.provider === "openai" ? "OPENAI" : "DIAGNOSTICA";
  const sources = decision.cue.webSources ?? [];
  elements.maryResponse.innerHTML = `
    <div class="mary-response-heading"><strong>${escapeHtml(decision.cue.speakerName || avatarName)}</strong><span>${provider}${decision.cue.model ? ` · ${escapeHtml(decision.cue.model)}` : ""}</span></div>
    ${sentences.map((sentence) => `<article class="mary-sentence"><p>${escapeHtml(sentence.text)}</p><span>${escapeHtml(sentence.mood)} · L${escapeHtml(sentence.level ?? 3)} · ${escapeHtml(sentence.language)}</span></article>`).join("")}
    ${sources.length ? `<ul class="web-sources">${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul>` : ""}`;
  const lastSentence = sentences.at(-1);
  elements.stageMood.textContent = `${lastSentence.mood} · L${lastSentence.level ?? 3}`;
  elements.stageMood.hidden = false;
  setStageMode("speaking", `Risponde a ${decision.cue.addressedTo || "meeting"}`);
}

function renderTurn(result) {
  if (result.llmContext) renderContext(result.llmContext);
  renderMaryResponse(result.decision);
  renderParticipationRequest(result.decision?.request ?? result.llmContext?.participationRequest ?? null);

  if (result.decision?.activated && result.decision.cue?.provider === "openai") {
    setDecision(`${avatarName} ha letto la conversazione e sta rispondendo${result.usedWebSearch ? " con ricerca web" : ""}.`, "responding");
  } else if (result.decision?.activated) {
    setDecision(`${avatarName} è stata chiamata, ma usa la risposta diagnostica: configura OpenAI per la risposta reale.`, "responding");
  } else if (result.decision?.reason === "autonomous-request") {
    setDecision(`${avatarName} ha un contributo e ha chiesto la parola senza interrompere.`, "requesting");
  } else {
    setDecision(`Intervento acquisito. ${avatarName} continua ad ascoltare senza rispondere.`, "listening");
  }
  if (result.warning) elements.decisionStatus.textContent += ` ${result.warning}`;

  const llm = result.latency?.llmMs == null ? "—" : `${result.latency.llmMs} ms`;
  const renderer = result.latency?.rendererMs == null ? "—" : `${result.latency.rendererMs} ms`;
  const total = result.latency?.totalMs == null ? "—" : `${result.latency.totalMs} ms`;
  elements.latencySummary.textContent = `LLM ${llm} · Avatar ${renderer} · Totale ${total}`;
  if (result.renderer?.delivery) {
    elements.rendererStatus.textContent = `${avatarName} in onda · ${Math.round(result.renderer.delivery.durationMs / 100) / 10}s · ${result.renderer.delivery.sentenceCount} frasi.`;
  }
  const speakingDuration = result.renderer?.delivery?.durationMs ?? 4_000;
  if (result.decision?.activated) settleStageAfter(speakingDuration + 800);
  renderDebug(result);
}

async function sendVoiceMessage(text) {
  return requestJson("/api/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ speakerName: elements.speakerName.value.trim(), text }),
  });
}

async function sendChatMessage(text) {
  return requestJson("/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: currentConfig?.meetingPlatform ?? "generic",
      meetingId,
      messageId: crypto.randomUUID(),
      speakerName: elements.speakerName.value.trim(),
      text,
      capturedAt: new Date().toISOString(),
    }),
  });
}

function describeChatResult(result) {
  const outbound = result.outboundMessages?.[0];
  if (outbound) return `${outbound.speakerName} ha scritto nella chat.`;
  if (result.action === "raise-hand") return `${avatarName} ha chiesto la parola.`;
  if (result.action === "lower-hand") return `${avatarName} ha abbassato la mano.`;
  if (result.turn?.decision?.activated) return `${avatarName} interviene a voce.`;
  if (result.reason === "chat-disabled") return "La lettura chat è disattivata nella configurazione.";
  if (result.reason === "self-message") return "Messaggio dell’avatar ignorato per evitare un loop.";
  return `Messaggio letto e conservato. ${avatarName} resta in ascolto.`;
}

async function submitMeetingMessage(channel, text) {
  const speakerName = elements.speakerName.value.trim();
  const cleanText = text.trim();
  if (!speakerName || !cleanText) throw new Error("Inserisci il partecipante e un messaggio.");
  elements.meetingSendButton.disabled = true;
  setDecision(channel === "chat" ? "Invio nella chat del meeting…" : "Trascrizione simulata inviata all’ascolto…", "listening");
  try {
    if (channel === "chat") {
      const result = await sendChatMessage(cleanText);
      if (result.turn) renderTurn(result.turn);
      else {
        setDecision(describeChatResult(result), result.action === "raise-hand" ? "requesting" : "listening");
        renderDebug(result, "EVENTO CHAT");
      }
      elements.chatTestStatus.textContent = describeChatResult(result);
      await refreshContext();
      return result;
    }
    const result = await sendVoiceMessage(cleanText);
    renderTurn(result);
    await refreshContext();
    return result;
  } finally {
    elements.meetingSendButton.disabled = false;
  }
}

function selectChannel(channel) {
  currentChannel = channel;
  $$(".channel-button").forEach((button) => button.classList.toggle("active", button.dataset.channel === channel));
  elements.composerLabel.textContent = channel === "chat" ? "Messaggio nella chat del meeting" : "Intervento nella riunione";
  elements.meetingMessage.placeholder = channel === "chat"
    ? `Scrivi in chat. ${avatarName} leggerà anche i messaggi non indirizzati…`
    : `Scrivi come se stessi parlando nel meeting. Interpella ${avatarName} per una risposta…`;
}

elements.meetingComposerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitMeetingMessage(currentChannel, elements.meetingMessage.value);
    elements.meetingMessage.value = "";
  } catch (error) {
    setDecision(`Invio non riuscito: ${error.message}`, "listening");
  }
});

elements.meetingMessage.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    elements.meetingComposerForm.requestSubmit();
  }
});

$$('.channel-button').forEach((button) => button.addEventListener("click", () => selectChannel(button.dataset.channel)));

elements.avatarChoiceGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-profile]");
  if (!button) return;
  elements.avatarProfile.value = button.dataset.profile;
  elements.meetingAvatarSelect.value = button.dataset.profile;
  updateAvatarChoiceSelection(button.dataset.profile);
  elements.configStatus.textContent = "Avatar selezionato. Salva per applicarlo.";
});

elements.avatarProfile.addEventListener("change", () => {
  elements.meetingAvatarSelect.value = elements.avatarProfile.value;
  updateAvatarChoiceSelection(elements.avatarProfile.value);
});

elements.meetingAvatarSelect.addEventListener("change", () => {
  updateAvatarChoiceSelection(elements.meetingAvatarSelect.value);
});

async function sendSidebarChat() {
  const text = elements.sidebarChatText.value.trim();
  if (!text) return;
  elements.sidebarChatSend.disabled = true;
  try {
    await submitMeetingMessage("chat", text);
    elements.sidebarChatText.value = "";
  } catch (error) {
    setDecision(`Chat non inviata: ${error.message}`, "listening");
  } finally {
    elements.sidebarChatSend.disabled = false;
  }
}

elements.sidebarChatSend.addEventListener("click", sendSidebarChat);
elements.sidebarChatText.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendSidebarChat();
  }
});

function quickCommandText(kind) {
  const aliases = currentConfig?.chatCommandAliases?.[kind] ?? [];
  const alias = aliases[0];
  if (!alias) return null;
  const argument = {
    summarizeInChat: "i punti principali emersi finora",
    replyInChat: "con il punto più utile per proseguire",
    speak: "riportando la discussione sul punto principale",
  }[kind];
  return `${avatarName}, ${alias}${argument ? ` ${argument}` : ""}`;
}

elements.quickCommands.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-command]");
  if (!button) return;
  const text = quickCommandText(button.dataset.command);
  if (!text) {
    setDecision("Questo comando non ha alias configurati.", "listening");
    return;
  }
  $$("#quick-commands button").forEach((candidate) => { candidate.disabled = true; });
  try {
    await submitMeetingMessage("chat", text);
  } catch (error) {
    setDecision(`Comando non riuscito: ${error.message}`, "listening");
  } finally {
    $$("#quick-commands button").forEach((candidate) => { candidate.disabled = false; });
  }
});

$$('.sidebar-tab').forEach((button) => button.addEventListener("click", () => {
  currentSidePanel = button.dataset.sidePanel;
  $$(".sidebar-tab").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  elements.sidebarChatComposer.hidden = currentSidePanel !== "chat";
  renderSidePanel();
}));

$$('.nav-button').forEach((button) => button.addEventListener("click", () => {
  const view = button.dataset.view;
  $$(".nav-button").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  $$('[data-view-panel]').forEach((panel) => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}));

elements.speakerName.addEventListener("input", renderSidePanel);

elements.participationGrant.addEventListener("click", async () => {
  elements.participationGrant.disabled = true;
  elements.participationDismiss.disabled = true;
  elements.participationReason.textContent = `Sto dando la parola a ${avatarName}…`;
  try {
    const result = await requestJson("/api/participation/grant", { method: "POST" });
    renderParticipationRequest(null);
    renderMaryResponse({ activated: true, cue: result.cue });
    setDecision(`${avatarName} ha ricevuto la parola e sta rispondendo.`, "responding");
    settleStageAfter(result.delivery?.durationMs ? result.delivery.durationMs + 800 : 4_000);
    renderDebug(result, "PAROLA CONCESSA");
    await refreshContext();
  } catch (error) {
    elements.participationReason.textContent = `Impossibile dare la parola: ${error.message}`;
  } finally {
    elements.participationGrant.disabled = false;
    elements.participationDismiss.disabled = false;
  }
});

elements.participationDismiss.addEventListener("click", async () => {
  elements.participationGrant.disabled = true;
  elements.participationDismiss.disabled = true;
  try {
    const result = await requestJson("/api/participation", { method: "DELETE" });
    renderParticipationRequest(null);
    setStageMode("listening", "Partecipante virtuale");
    setDecision(`${avatarName} ha ritirato la richiesta e continua ad ascoltare.`, "listening");
    renderDebug(result, "RICHIESTA IGNORATA");
    await refreshContext();
  } catch (error) {
    elements.participationReason.textContent = `Chiusura non riuscita: ${error.message}`;
  } finally {
    elements.participationGrant.disabled = false;
    elements.participationDismiss.disabled = false;
  }
});

elements.resetMeetingButton.addEventListener("click", async () => {
  if (!window.confirm("Azzerare trascrizione, chat e richiesta di parola di questa sessione di prova?")) return;
  elements.resetMeetingButton.disabled = true;
  try {
    const context = await requestJson("/api/context", { method: "DELETE" });
    meetingStartedAt = Date.now();
    elements.maryResponse.innerHTML = "";
    elements.stageMood.hidden = true;
    elements.simulationResult.textContent = "Nuova sessione avviata.";
    renderContext(context);
    setStageMode("listening", "Partecipante virtuale");
    setDecision("Nuova sessione pronta. La memoria del meeting è vuota.", "listening");
  } catch (error) {
    setDecision(`Reset non riuscito: ${error.message}`, "listening");
  } finally {
    elements.resetMeetingButton.disabled = false;
  }
});

function renderListenerStatus(status) {
  const active = status.phase === "running" || status.phase === "starting";
  elements.listenerStartButton.disabled = active || status.phase === "unavailable";
  elements.listenerStopButton.disabled = !active;
  elements.listenerTurnCount.textContent = `${status.completedTurns ?? 0} ${status.completedTurns === 1 ? "turno" : "turni"}`;
  elements.listenerPartial.textContent = status.partialTranscript ? `“${status.partialTranscript}”` : "";
  elements.listenerPill.className = `status-pill ${active ? "live" : ""}`;
  if (status.phase === "running") {
    elements.listenerPill.textContent = status.speechDetected ? "Ascolto: voce" : "Ascolto: live";
    elements.listenerStatus.textContent = status.speechDetected
      ? "Voce rilevata, trascrizione in corso."
      : `${avatarName} legge ${status.resolvedAudioDevice || status.audioDevice}.`;
  } else if (status.phase === "starting") {
    elements.listenerPill.textContent = "Ascolto: avvio";
    elements.listenerStatus.textContent = "Connessione Realtime e apertura del bus audio.";
  } else if (status.phase === "error") {
    elements.listenerPill.className = "status-pill warning";
    elements.listenerPill.textContent = "Ascolto: errore";
    elements.listenerStatus.textContent = status.lastError || "Errore di ascolto.";
  } else if (status.phase === "unavailable") {
    elements.listenerPill.className = "status-pill warning";
    elements.listenerPill.textContent = "Ascolto: non disponibile";
    elements.listenerStatus.textContent = status.lastError || "OpenAI non configurato.";
  } else {
    elements.listenerPill.textContent = "Ascolto: fermo";
    elements.listenerStatus.textContent = status.lastError ? `Fermo: ${status.lastError}` : "Ascolto continuo fermo.";
  }
  const result = status.lastResult;
  if (result?.segment?.id && result.segment.id !== lastListenerSegmentId) {
    lastListenerSegmentId = result.segment.id;
    renderTurn(result);
    void refreshContext();
  }
}

async function refreshListenerStatus() {
  try {
    renderListenerStatus(await requestJson("/api/listener/status"));
  } catch (error) {
    elements.listenerStartButton.disabled = true;
    elements.listenerStopButton.disabled = true;
    elements.listenerPill.className = "status-pill warning";
    elements.listenerPill.textContent = "Ascolto: offline";
    elements.listenerStatus.textContent = `Controllo fallito: ${error.message}`;
  }
}

elements.listenerStartButton.addEventListener("click", async () => {
  elements.listenerStartButton.disabled = true;
  elements.listenerStatus.textContent = "Avvio ascolto continuo…";
  try {
    renderListenerStatus(await requestJson("/api/listener/start", { method: "POST" }));
  } catch (error) {
    elements.listenerStatus.textContent = `Avvio fallito: ${error.message}`;
    elements.listenerStartButton.disabled = false;
  }
});

elements.listenerStopButton.addEventListener("click", async () => {
  elements.listenerStopButton.disabled = true;
  elements.listenerStatus.textContent = "Arresto dell’ascolto…";
  try {
    renderListenerStatus(await requestJson("/api/listener/session", { method: "DELETE" }));
  } catch (error) {
    elements.listenerStatus.textContent = `Arresto fallito: ${error.message}`;
    elements.listenerStopButton.disabled = false;
  }
});

function pixelStreamingUrl(value) {
  const url = new URL(value, window.location.origin);
  url.searchParams.set("AutoConnect", "true");
  url.searchParams.set("AutoPlayVideo", "true");
  url.searchParams.set("conclaviaMeeting", String(Date.now()));
  return url.toString();
}

function renderRendererPlaceholder(message, { loading = false } = {}) {
  const label = rendererActionProfile || currentConfig?.avatarProfile || activeAvatarProfile || "MetaHuman";
  elements.rendererPreview.innerHTML = `
    <div class="stage-placeholder ${loading ? "loading" : ""}">
      <div class="avatar-orbit" aria-hidden="true"><span>${loading ? "◌" : "C"}</span></div>
      <strong id="stage-avatar-name">${escapeHtml(avatarName)}</strong>
      <p>${escapeHtml(message)}</p>
      ${loading ? `<small>Profilo ${escapeHtml(label)} · il primo avvio può richiedere 1–2 minuti</small>` : ""}
    </div>`;
  elements.stageAvatarName = $("#stage-avatar-name");
}

function mountRendererPlayer(playerUrl, force = false, streamId = "") {
  if (!playerUrl) return;
  const outputUrl = pixelStreamingUrl(playerUrl);
  const frame = elements.rendererPreview.querySelector("iframe");
  if (
    force ||
    !frame ||
    frame.dataset.source !== playerUrl ||
    frame.dataset.stream !== streamId
  ) {
    elements.rendererPreview.innerHTML = `
      <div class="renderer-frame-shell">
        <iframe title="Conclavia MetaHuman" src="${escapeHtml(outputUrl)}" data-source="${escapeHtml(playerUrl)}" data-stream="${escapeHtml(streamId)}" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>
        <div class="renderer-frame-state" aria-live="polite"><span class="renderer-spinner" aria-hidden="true"></span>Collegamento al video…</div>
      </div>`;
    const mountedFrame = elements.rendererPreview.querySelector("iframe");
    const frameState = elements.rendererPreview.querySelector(".renderer-frame-state");
    mountedFrame?.addEventListener("load", () => frameState?.remove(), { once: true });
    window.setTimeout(() => frameState?.remove(), 8_000);
    mountedFrame?.addEventListener("error", () => {
      if (!frameState) return;
      frameState.classList.add("error");
      frameState.innerHTML = "Il video non ha risposto. La riconnessione è automatica.";
    }, { once: true });
  }
  elements.rendererOutputLink.href = outputUrl;
  elements.rendererOutputLink.hidden = false;
}

function renderRendererStatus(status) {
  const reachable = status.serverStatus !== "unreachable";
  const starting = rendererActionInProgress || status.starting === true;
  elements.rendererStartButton.disabled = rendererActionInProgress || !status.configured || !reachable || status.armed;
  elements.rendererStopButton.disabled = rendererActionInProgress || (!status.armed && !starting);
  elements.meetingAvatarSwitchButton.disabled = starting;
  elements.rendererStartButton.disabled = starting || elements.rendererStartButton.disabled;
  elements.rendererStartButton.innerHTML = starting
    ? '<span class="control-icon">◌</span><span>Avvio…</span>'
    : status.armed
    ? '<span class="control-icon">✓</span><span>Avatar attivo</span>'
    : '<span class="control-icon">▶</span><span>Avvia avatar</span>';
  elements.rendererPill.className = `status-pill ${status.armed && status.available ? "ready" : status.configured ? "" : "warning"}`;
  elements.stageLiveState.className = `stage-badge ${status.armed && status.available ? "ready" : ""}`;
  elements.stageLiveState.textContent = starting ? "AVVIO…" : status.armed && status.available ? "LIVE" : "OFFLINE";
  const displayedProfile = starting
    ? status.targetAvatarProfile || rendererActionProfile || currentConfig?.avatarProfile
    : status.avatarProfile;
  if (displayedProfile) {
    activeAvatarProfile = displayedProfile;
    const label = displayedProfile.charAt(0).toUpperCase() + displayedProfile.slice(1);
    elements.activeAvatarLabel.textContent = `${label} · ${avatarName}`;
    elements.meetingAvatarSelect.value = displayedProfile;
    elements.stageSpeakerDetail.textContent = `MetaHuman ${label}`;
  } else if (!activeAvatarProfile) {
    elements.activeAvatarLabel.textContent = `${currentConfig?.avatarProfile ?? "Avatar"} · configurato`;
  }

  if (starting) {
    elements.rendererPill.textContent = "Avatar: avvio";
    elements.rendererStatus.textContent = "Cambio già in corso: Unreal e Pixel Streaming verranno collegati automaticamente, senza un secondo avvio.";
    elements.avatarSwitchStatus.className = "switching";
    elements.avatarSwitchStatus.textContent = `Sto caricando ${status.targetAvatarProfile || rendererActionProfile || currentConfig?.avatarProfile || "il MetaHuman"}; non premere altro, passerà automaticamente a LIVE.`;
  } else if (status.lastError && !status.available) {
    elements.rendererPill.className = "status-pill warning";
    elements.rendererPill.textContent = "Avatar: avvio incompleto";
    elements.rendererStatus.textContent = status.lastError;
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = "Il renderer resta monitorato; puoi riprovare senza dover riselezionare l’avatar.";
  } else if (!status.configured) {
    elements.rendererPill.textContent = "Avatar: non configurato";
    elements.rendererStatus.textContent = "Bridge Conclavia non configurato.";
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = "Configura il bridge Conclavia per usare il MetaHuman.";
  } else if (!reachable) {
    elements.rendererPill.className = "status-pill warning";
    elements.rendererPill.textContent = "Avatar: bridge offline";
    elements.rendererStatus.textContent = "Avvia conclavia-frontend sulla porta 3000 per raggiungere le API Unreal.";
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = "Il bridge del renderer non è raggiungibile.";
  } else if (status.armed && status.available) {
    elements.rendererPill.textContent = `Avatar: ${status.avatarProfile ?? activeAvatarProfile ?? "pronto"}`;
    elements.rendererStatus.textContent = `MetaHuman pronto: la prossima risposta di ${avatarName} andrà in onda.`;
    if (!elements.avatarSwitchStatus.classList.contains("switching")) {
      elements.avatarSwitchStatus.className = "ready";
      elements.avatarSwitchStatus.textContent = `${avatarName} è attiva: audio, labiale e mood verranno inviati al meeting.`;
    }
  } else if (status.armed) {
    elements.rendererPill.textContent = "Avatar: avvio";
    elements.rendererStatus.textContent = "MetaHuman armato; il renderer sta completando l’avvio.";
  } else if (status.available) {
    elements.rendererPill.textContent = `Avatar: ${status.avatarProfile ?? activeAvatarProfile ?? "online"}`;
    elements.rendererStatus.textContent = `Renderer online. Premi “Avvia avatar” per collegarlo a ${avatarName}.`;
    if (!elements.avatarSwitchStatus.classList.contains("switching")) {
      elements.avatarSwitchStatus.className = "";
      elements.avatarSwitchStatus.textContent = `Il video è online, ma premi “Avvia avatar” per abilitare voce e animazioni.`;
    }
  } else {
    elements.rendererPill.textContent = "Avatar: fermo";
    elements.rendererStatus.textContent = `Renderer ${status.serverStatus || "non avviato"}. L’avvio può accendere l’host GPU.`;
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = "Avvia il renderer per caricare il MetaHuman selezionato.";
  }
  if (!starting && status.available && status.playerUrl) {
    mountRendererPlayer(status.playerUrl, !rendererWasAvailable, status.streamId || "");
    rendererWasAvailable = true;
  } else {
    rendererWasAvailable = false;
    elements.rendererOutputLink.hidden = true;
    renderRendererPlaceholder(
      starting
        ? "Cambio avatar in corso: un solo avvio, collegamento automatico appena Unreal è pronto…"
        : "Il renderer video è fermo. Premi “Avvia avatar” per collegarlo.",
      { loading: starting },
    );
  }
}

async function refreshRendererStatus() {
  if (rendererStatusRefreshInFlight) return;
  rendererStatusRefreshInFlight = true;
  try {
    renderRendererStatus(await requestJson("/api/renderer/status"));
  } catch (error) {
    elements.rendererStartButton.disabled = true;
    elements.rendererStopButton.disabled = true;
    elements.rendererPill.className = "status-pill warning";
    elements.rendererPill.textContent = "Avatar: offline";
    elements.rendererStatus.textContent = `Controllo fallito: ${error.message}`;
  } finally {
    rendererStatusRefreshInFlight = false;
  }
}

elements.rendererStartButton.addEventListener("click", async () => {
  rendererActionInProgress = true;
  rendererActionProfile = currentConfig?.avatarProfile || activeAvatarProfile;
  elements.rendererStartButton.disabled = true;
  elements.rendererStartButton.innerHTML = '<span class="control-icon">◌</span><span>Avvio…</span>';
  elements.rendererStatus.textContent = "Avvio MetaHuman e Pixel Streaming; può richiedere alcuni minuti.";
  elements.rendererPill.textContent = "Avatar: avvio";
  elements.stageLiveState.className = "stage-badge";
  elements.stageLiveState.textContent = "AVVIO…";
  elements.avatarSwitchStatus.className = "switching";
  elements.avatarSwitchStatus.textContent = "Collegamento del renderer e abilitazione delle risposte in corso…";
  renderRendererPlaceholder("Sto avviando Unreal Engine e preparando il collegamento video…", { loading: true });
  setDecision(`Sto attivando ${avatarName}.`, "listening");
  try {
    const result = await requestJson("/api/renderer/start", { method: "POST" });
    rendererActionInProgress = false;
    renderRendererStatus({
      configured: true,
      available: result.available === true,
      armed: result.armed === true,
      starting: result.starting === true,
      targetAvatarProfile: result.avatarProfile || currentConfig?.avatarProfile,
      serverStatus: result.serverStatus,
      playerUrl: result.playerUrl,
    });
    elements.avatarSwitchStatus.className = result.starting ? "switching" : "ready";
    elements.avatarSwitchStatus.textContent = result.starting
      ? "Avvio affidato al renderer: la pagina passerà automaticamente a LIVE."
      : `${avatarName} è attiva e pronta a parlare.`;
    setDecision(
      result.starting
        ? `${avatarName} si sta collegando; non serve premere di nuovo Avvia avatar.`
        : `${avatarName} è attiva: il prossimo intervento verrà riprodotto dal MetaHuman.`,
      result.starting ? "listening" : "responding",
    );
    renderDebug(result, result.starting ? "AVATAR IN AVVIO" : "AVATAR ATTIVATO");
    if (result.starting) window.setTimeout(refreshRendererStatus, 1_000);
  } catch (error) {
    rendererActionInProgress = false;
    elements.rendererStatus.textContent = `Avvio fallito: ${error.message}`;
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = `Avvio non riuscito: ${error.message}`;
    elements.stageLiveState.textContent = "OFFLINE";
    elements.rendererStartButton.innerHTML = '<span class="control-icon">▶</span><span>Riprova</span>';
    elements.rendererStartButton.disabled = false;
    renderRendererPlaceholder(`Avvio non riuscito: ${error.message}`);
  } finally {
    rendererActionProfile = null;
  }
});

elements.meetingAvatarSwitchButton.addEventListener("click", async () => {
  const avatarProfile = elements.meetingAvatarSelect.value;
  rendererActionInProgress = true;
  rendererActionProfile = avatarProfile;
  elements.meetingAvatarSwitchButton.disabled = true;
  elements.avatarSwitchStatus.className = "switching";
  elements.avatarSwitchStatus.textContent = `Sto caricando ${avatarProfile}. Il renderer può impiegare alcuni minuti…`;
  elements.stageLiveState.className = "stage-badge";
  elements.stageLiveState.textContent = "AVVIO…";
  renderRendererPlaceholder("Cambio MetaHuman: riavvio di Unreal Engine e del collegamento video…", { loading: true });
  setDecision(`Cambio MetaHuman in corso: ${avatarProfile}.`, "listening");
  try {
    const result = await requestJson("/api/renderer/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatarProfile }),
    });
    currentConfig = result.config;
    activeAvatarProfile = avatarProfile;
    await refreshConfig();
    rendererActionInProgress = false;
    renderRendererStatus({
      configured: true,
      available: result.available === true,
      armed: result.armed === true,
      starting: result.starting === true,
      serverStatus: result.serverStatus,
      playerUrl: result.playerUrl,
      targetAvatarProfile: avatarProfile,
    });
    elements.avatarSwitchStatus.className = result.starting ? "switching" : "ready";
    elements.avatarSwitchStatus.textContent = result.starting
      ? `${avatarProfile} è in caricamento; diventerà attivo automaticamente.`
      : `${avatarProfile} è ora il MetaHuman attivo.`;
    setDecision(
      result.starting
        ? `Cambio verso ${avatarProfile} avviato; non serve premere Avvia avatar.`
        : `${avatarName} ora usa il MetaHuman ${avatarProfile}.`,
      result.starting ? "listening" : "responding",
    );
    renderDebug(result, result.starting ? "CAMBIO AVATAR IN CORSO" : "CAMBIO AVATAR");
    if (result.starting) window.setTimeout(refreshRendererStatus, 1_000);
  } catch (error) {
    rendererActionInProgress = false;
    elements.avatarSwitchStatus.className = "";
    elements.avatarSwitchStatus.textContent = `Cambio non riuscito: ${error.message}`;
    setDecision(`Cambio avatar non riuscito: ${error.message}`, "listening");
    await refreshRendererStatus();
  } finally {
    rendererActionInProgress = false;
    rendererActionProfile = null;
  }
});

elements.rendererStopButton.addEventListener("click", async () => {
  elements.rendererStopButton.disabled = true;
  elements.rendererStatus.textContent = "Arresto del renderer…";
  try {
    await requestJson("/api/renderer/session", { method: "DELETE" });
    rendererWasAvailable = false;
    renderRendererPlaceholder("Renderer fermato. Riavvialo quando vuoi riprendere il test.");
    elements.rendererOutputLink.hidden = true;
    renderRendererStatus({ configured: true, available: false, armed: false, serverStatus: "off" });
  } catch (error) {
    elements.rendererStatus.textContent = `Arresto fallito: ${error.message}`;
    elements.rendererStopButton.disabled = false;
  }
});

function preferredAudioMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function releaseMicrophone() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

elements.recordButton.addEventListener("click", async () => {
  const speakerName = elements.speakerName.value.trim();
  if (!speakerName) {
    elements.recordingStatus.textContent = "Inserisci prima il nome del partecipante.";
    elements.speakerName.focus();
    return;
  }
  elements.recordButton.disabled = true;
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
      elements.stopButton.disabled = true;
      elements.recordingStatus.textContent = "Trascrizione e analisi in corso…";
      try {
        const result = await requestJson(`/api/transcribe?speakerName=${encodeURIComponent(speakerName)}`, {
          method: "POST",
          headers: { "content-type": recordedMimeType },
          body: audio,
        });
        renderTurn(result);
        elements.recordingStatus.textContent = `Trascritto: “${result.segment.text}”`;
        await refreshContext();
      } catch (error) {
        elements.recordingStatus.textContent = `Errore: ${error.message}`;
      } finally {
        elements.recordButton.disabled = false;
        mediaRecorder = null;
        audioChunks = [];
      }
    }, { once: true });
    mediaRecorder.start();
    elements.stopButton.disabled = false;
    elements.recordingStatus.textContent = "Registrazione attiva: parla, poi premi Stop e invia.";
  } catch (error) {
    releaseMicrophone();
    elements.recordButton.disabled = false;
    elements.recordingStatus.textContent = `Microfono non disponibile: ${error.message}`;
  }
});

elements.stopButton.addEventListener("click", () => {
  if (mediaRecorder?.state === "recording") {
    elements.stopButton.disabled = true;
    mediaRecorder.stop();
  }
});

async function refreshHealth() {
  try {
    const health = await requestJson("/api/health");
    elements.providerStatus.className = `status-pill ${health.openaiConfigured ? "ready" : "warning"}`;
    elements.providerStatus.textContent = health.openaiConfigured
      ? `OpenAI: ${health.responseModel}${health.webSearchEnabled ? " + web" : ""}`
      : "OpenAI: non configurato";
    elements.recordButton.disabled = !health.openaiConfigured || !window.MediaRecorder;
    if (!health.openaiConfigured) elements.recordingStatus.textContent = "Configura OpenAI per usare il microfono.";
    else if (!window.MediaRecorder) elements.recordingStatus.textContent = "MediaRecorder non supportato dal browser.";
  } catch (error) {
    elements.providerStatus.className = "status-pill warning";
    elements.providerStatus.textContent = "Server: offline";
    elements.recordButton.disabled = true;
    elements.recordingStatus.textContent = `Server non raggiungibile: ${error.message}`;
  }
}

elements.configForm.addEventListener("input", () => {
  elements.configStatus.textContent = "Modifiche non ancora salvate.";
});

elements.configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.configSaveButton.disabled = true;
  elements.configStatus.textContent = "Salvataggio e applicazione in corso…";
  try {
    const result = await requestJson("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        avatarProfile: elements.avatarProfile.value,
        meetingPlatform: elements.meetingPlatform.value,
        name: elements.avatarName.value,
        responseModel: elements.responseModel.value,
        voiceStyle: elements.voiceStyle.value,
        italianVoice: elements.italianVoice.value,
        englishVoice: elements.englishVoice.value,
        meetingAudioDevice: elements.meetingAudioDevice.value,
        meetingSpeakerName: elements.meetingSpeakerName.value,
        apiKey: elements.apiKey.value,
        purpose: elements.purpose.value,
        personality: elements.personality.value,
        systemPrompt: elements.systemPrompt.value,
        webSearchEnabled: elements.webSearch.checked,
        requestToSpeakEnabled: elements.requestToSpeak.checked,
        chatEnabled: elements.chatEnabled.checked,
        chatCommandAliases: {
          raiseHand: parseCommandAliases(elements.commandRaiseHand),
          lowerHand: parseCommandAliases(elements.commandLowerHand),
          summarizeInChat: parseCommandAliases(elements.commandSummarizeChat),
          replyInChat: parseCommandAliases(elements.commandReplyChat),
          speak: parseCommandAliases(elements.commandSpeak),
        },
      }),
    });
    await refreshConfig();
    await Promise.all([refreshHealth(), refreshListenerStatus(), refreshRendererStatus(), refreshContext()]);
    const statusMessages = ["Configurazione salvata e applicata."];
    if (result.listenerRestarted) statusMessages.push("Ascolto riavviato.");
    if (result.listenerWarning) statusMessages.push(`Ascolto non riavviato: ${result.listenerWarning}`);
    if (result.rendererRestarted) statusMessages.push("Nuovo MetaHuman caricato nel renderer.");
    if (result.rendererWarning) statusMessages.push(`Cambio MetaHuman non riuscito: ${result.rendererWarning}`);
    elements.configStatus.textContent = statusMessages.join(" ");
  } catch (error) {
    elements.configStatus.textContent = `Salvataggio fallito: ${error.message}`;
  } finally {
    elements.configSaveButton.disabled = false;
  }
});

function renderCheck(check) {
  const action = check.action ? `<p class="action">${escapeHtml(check.action)}</p>` : "";
  return `<article class="check"><header><span>${escapeHtml(check.label)}</span><span class="status ${escapeHtml(check.level)}">${escapeHtml(check.level)}</span></header><p>${escapeHtml(check.detail)}</p>${action}</article>`;
}

elements.preflightButton.addEventListener("click", async () => {
  elements.preflightButton.disabled = true;
  elements.preflightButton.textContent = "Controllo…";
  elements.preflightResults.innerHTML = '<p class="empty">Analisi del Mac in corso…</p>';
  try {
    const report = await requestJson("/api/preflight");
    elements.preflightResults.innerHTML = report.checks.map(renderCheck).join("");
    renderDebug(report, "PREFLIGHT");
  } catch (error) {
    elements.preflightResults.innerHTML = `<p class="empty">Controllo fallito: ${escapeHtml(error.message)}</p>`;
  } finally {
    elements.preflightButton.disabled = false;
    elements.preflightButton.textContent = "Esegui preflight";
  }
});

function updateMeetingClock() {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - meetingStartedAt) / 1_000));
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  elements.meetingClock.textContent = `${minutes}:${seconds}`;
}

await refreshConfig();
await Promise.all([refreshHealth(), refreshContext(), refreshRendererStatus(), refreshListenerStatus()]);
updateMeetingClock();
window.setInterval(updateMeetingClock, 1_000);
window.setInterval(refreshListenerStatus, 900);
window.setInterval(refreshContext, 1_500);
window.setInterval(refreshRendererStatus, 4_000);

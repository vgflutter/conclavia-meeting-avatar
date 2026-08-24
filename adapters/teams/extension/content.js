(function runConclaviaTeamsBridge() {
  const dom = globalThis.ConclaviaTeamsDom;
  if (!dom || globalThis.__conclaviaTeamsBridgeInstalled) return;
  globalThis.__conclaviaTeamsBridgeInstalled = true;

  const seenMessageIds = new Set();
  const pendingMessageIds = new Set();
  const avatarEchoes = new Map();
  let enabled = true;
  let baselineComplete = false;
  let scanTimer = null;
  let statusTimer = null;
  let outboundTimer = null;
  let outboundPollInFlight = false;
  let observer = null;
  let lastState = "offline";

  function meetingId() {
    const url = new URL(location.href);
    for (const key of ["threadId", "meetingId", "conversationId", "chatId"]) {
      const value = url.searchParams.get(key);
      if (value) return value.slice(0, 240);
    }

    const context = url.searchParams.get("context");
    if (context) {
      try {
        const parsed = JSON.parse(context);
        for (const key of ["Tid", "threadId", "meetingId", "chatId"]) {
          if (typeof parsed?.[key] === "string" && parsed[key]) return parsed[key].slice(0, 240);
        }
      } catch {
        // Teams also uses opaque context values. The stable URL fallback below handles them.
      }
    }

    const stableLocation = `${location.hostname}${location.pathname}${location.hash}`;
    return `teams-${dom.fnv1a(stableLocation)}`;
  }

  function runtimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response ?? { ok: false, error: "No response from bridge service worker." });
      });
    });
  }

  function reportState(state) {
    if (state === lastState) return;
    lastState = state;
    void runtimeMessage({ type: "conclavia:bridge-state", state });
  }

  function showToast(text, tone = "ok") {
    const existing = document.getElementById("conclavia-teams-bridge-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.id = "conclavia-teams-bridge-toast";
    toast.textContent = text;
    Object.assign(toast.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "20px",
      bottom: "92px",
      maxWidth: "360px",
      padding: "11px 15px",
      borderRadius: "12px",
      background: tone === "error" ? "#4b1717" : "#092920",
      border: `1px solid ${tone === "error" ? "#d95050" : "#48dcb2"}`,
      color: "#f3faf7",
      font: "600 13px/1.35 system-ui, sans-serif",
      boxShadow: "0 8px 30px rgba(0,0,0,.35)",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 4_500);
  }

  function rememberEcho(text) {
    avatarEchoes.set(dom.normalizeText(text), Date.now() + 30_000);
  }

  function isAvatarEcho(text) {
    const now = Date.now();
    for (const [candidate, expiresAt] of avatarEchoes) {
      if (expiresAt <= now) avatarEchoes.delete(candidate);
    }
    const normalized = dom.normalizeText(text);
    if (!avatarEchoes.has(normalized)) return false;
    avatarEchoes.delete(normalized);
    return true;
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else if ("value" in element) element.value = value;
    else element.textContent = value;
  }

  function dispatchComposerInput(composer, text) {
    composer.focus();
    if (composer.getAttribute("contenteditable") === "true") {
      const selection = globalThis.getSelection?.();
      selection?.selectAllChildren(composer);
      selection?.deleteFromDocument();
      const inserted = document.execCommand?.("insertText", false, text);
      if (!inserted) composer.textContent = text;
    } else {
      setNativeValue(composer, text);
    }
    composer.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton(composer) {
    let container = composer.parentElement;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const direct = container.querySelector([
        "button[data-tid='send-message-button']",
        "button[data-tid='send-button']",
        "[role='button'][data-tid='send-message-button']",
      ].join(","));
      if (direct) return direct;
      const buttons = Array.from(container.querySelectorAll("button[aria-label],[role='button'][aria-label]"));
      const labelled = buttons.find((candidate) => {
        const label = dom.normalizeText(candidate.getAttribute("aria-label"));
        return /^(?:invia(?: un)? messaggio|send(?: a)? message)$/i.test(label);
      });
      if (labelled) return labelled;
      container = container.parentElement;
    }
    return null;
  }

  async function postToTeamsChat(text) {
    const panel = dom.findChatPanel(document);
    const composer = panel ? dom.findComposer(panel) : dom.findComposer(document);
    if (!composer) throw new Error("Apri la chat della riunione Teams per consentire a Mary di rispondere.");
    rememberEcho(text);
    dispatchComposerInput(composer, text);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const sendButton = findSendButton(composer);
    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      return;
    }
    for (const type of ["keydown", "keypress", "keyup"]) {
      composer.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
    }
  }

  async function forwardMessage(message) {
    if (pendingMessageIds.has(message.messageId) || seenMessageIds.has(message.messageId)) return;
    if (isAvatarEcho(message.text)) {
      seenMessageIds.add(message.messageId);
      return;
    }
    pendingMessageIds.add(message.messageId);
    const response = await runtimeMessage({
      type: "conclavia:chat-message",
      payload: {
        platform: "teams",
        meetingId: meetingId(),
        messageId: message.messageId,
        speakerId: message.speakerName,
        speakerName: message.speakerName,
        text: message.text,
        capturedAt: new Date().toISOString(),
        senderIsAvatar: false,
      },
    });
    pendingMessageIds.delete(message.messageId);
    if (!response.ok) {
      reportState("offline");
      showToast(`Mary non riceve la chat Teams: ${response.error}`, "error");
      return;
    }
    seenMessageIds.add(message.messageId);
    reportState("connected");
    const outboundMessages = Array.isArray(response.result?.outboundMessages)
      ? response.result.outboundMessages
      : [];
    for (const outbound of outboundMessages) {
      if (typeof outbound?.text === "string" && outbound.text.trim()) {
        try {
          await postToTeamsChat(outbound.text.trim());
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), "error");
        }
      }
    }
  }

  async function scan() {
    scanTimer = null;
    if (!enabled) return;
    const panel = dom.findChatPanel(document);
    if (!panel) {
      reportState("hidden");
      return;
    }
    const messages = dom.collectMessages(panel);
    if (!baselineComplete) {
      baselineComplete = true;
      for (const message of messages) seenMessageIds.add(message.messageId);
      reportState("connected");
      showToast("Mary è collegata. I nuovi messaggi della chat Teams arriveranno al companion.");
      return;
    }
    for (const message of messages) void forwardMessage(message);
  }

  function scheduleScan(delay = 180) {
    if (scanTimer !== null) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => void scan(), delay);
  }

  async function refreshStatus() {
    const response = await runtimeMessage({ type: "conclavia:status" });
    if (!response.ok) {
      reportState("offline");
      return;
    }
    if (response.status?.enabled !== true) {
      enabled = false;
      reportState("disabled");
      return;
    }
    if (enabled) scheduleScan(0);
  }

  async function pollOutboundMessages() {
    if (!enabled || outboundPollInFlight || !dom.findChatPanel(document)) return;
    outboundPollInFlight = true;
    try {
      const currentMeetingId = meetingId();
      const response = await runtimeMessage({
        type: "conclavia:chat-outbound",
        meetingId: currentMeetingId,
      });
      if (!response.ok) return;
      const messages = Array.isArray(response.result?.messages) ? response.result.messages : [];
      const postedIds = [];
      for (const outbound of messages) {
        if (typeof outbound?.id !== "string" || typeof outbound?.text !== "string" || !outbound.text.trim()) continue;
        try {
          await postToTeamsChat(outbound.text.trim());
          postedIds.push(outbound.id);
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), "error");
          break;
        }
      }
      if (postedIds.length) {
        await runtimeMessage({
          type: "conclavia:chat-outbound-ack",
          meetingId: currentMeetingId,
          messageIds: postedIds,
        });
      }
    } finally {
      outboundPollInFlight = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "conclavia:toggle") return false;
    enabled = !enabled;
    baselineComplete = false;
    reportState(enabled ? "hidden" : "disabled");
    showToast(enabled ? "Lettura chat Teams attivata." : "Lettura chat Teams sospesa.");
    if (enabled) scheduleScan(0);
    sendResponse({ ok: true, enabled });
    return false;
  });

  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  void refreshStatus();
  statusTimer = setInterval(() => void refreshStatus(), 10_000);
  outboundTimer = setInterval(() => void pollOutboundMessages(), 1_500);
  globalThis.addEventListener("pagehide", () => {
    observer?.disconnect();
    if (scanTimer !== null) clearTimeout(scanTimer);
    if (statusTimer !== null) clearInterval(statusTimer);
    if (outboundTimer !== null) clearInterval(outboundTimer);
  }, { once: true });
})();

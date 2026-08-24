(function runConclaviaMeetBridge() {
  const dom = globalThis.ConclaviaMeetDom;
  if (!dom || globalThis.__conclaviaMeetBridgeInstalled) return;
  globalThis.__conclaviaMeetBridgeInstalled = true;

  const seenMessageIds = new Set();
  const pendingMessageIds = new Set();
  const avatarEchoes = new Map();
  let enabled = true;
  let baselineComplete = false;
  let scanTimer = null;
  let statusTimer = null;
  let observer = null;
  let lastState = "offline";

  function meetingId() {
    const path = location.pathname.replace(/^\/+|\/+$/g, "");
    return path || `meet-${dom.fnv1a(location.href)}`;
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
    const existing = document.getElementById("conclavia-meet-bridge-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.id = "conclavia-meet-bridge-toast";
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
    for (let depth = 0; container && depth < 6; depth += 1) {
      const buttons = Array.from(container.querySelectorAll("button[aria-label],[role='button'][aria-label]"));
      const button = buttons.find((candidate) => {
        const label = dom.normalizeText(candidate.getAttribute("aria-label"));
        return /^(invia|send)(?: un)? messaggio$|^send message$/i.test(label);
      });
      if (button) return button;
      container = container.parentElement;
    }
    return null;
  }

  async function postToMeetChat(text) {
    const panel = dom.findChatPanel(document);
    const composer = panel ? dom.findComposer(panel) : dom.findComposer(document);
    if (!composer) throw new Error("Open the Google Meet chat panel to let Mary reply.");
    rememberEcho(text);
    dispatchComposerInput(composer, text);
    await new Promise((resolve) => setTimeout(resolve, 80));
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
        platform: "google-meet",
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
      showToast(`Mary non riceve la chat: ${response.error}`, "error");
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
          await postToMeetChat(outbound.text.trim());
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
      showToast("Mary è collegata. I nuovi messaggi della chat arriveranno al companion.");
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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "conclavia:toggle") return false;
    enabled = !enabled;
    baselineComplete = false;
    reportState(enabled ? "hidden" : "disabled");
    showToast(enabled ? "Lettura chat Meet attivata." : "Lettura chat Meet sospesa.");
    if (enabled) scheduleScan(0);
    sendResponse({ ok: true, enabled });
    return false;
  });

  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  void refreshStatus();
  statusTimer = setInterval(() => void refreshStatus(), 10_000);
  globalThis.addEventListener("pagehide", () => {
    observer?.disconnect();
    if (scanTimer !== null) clearTimeout(scanTimer);
    if (statusTimer !== null) clearInterval(statusTimer);
  }, { once: true });
})();

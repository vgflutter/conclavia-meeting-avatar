const companionOrigin = "http://127.0.0.1:4310";

const badgeStates = {
  connected: { text: "ON", color: "#48dcb2", title: "Mary is reading Google Meet chat" },
  disabled: { text: "OFF", color: "#6f7f79", title: "Conclavia Meet bridge is paused" },
  hidden: { text: "OPEN", color: "#d8a928", title: "Open the Google Meet chat panel" },
  offline: { text: "ERR", color: "#d95050", title: "The local Conclavia companion is offline" },
};

function setBadge(tabId, state) {
  const badge = badgeStates[state] ?? badgeStates.offline;
  void chrome.action.setBadgeText({ tabId, text: badge.text });
  void chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  void chrome.action.setTitle({ tabId, title: badge.title });
}

function isMeetSender(sender) {
  return typeof sender.tab?.url === "string" && sender.tab.url.startsWith("https://meet.google.com/");
}

function validText(value, maximum) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum;
}

function validChatPayload(payload) {
  return payload && typeof payload === "object" &&
    payload.platform === "google-meet" &&
    validText(payload.meetingId, 240) &&
    validText(payload.messageId, 240) &&
    validText(payload.speakerName, 80) &&
    validText(payload.text, 4_000);
}

async function companionRequest(path, init) {
  const response = await fetch(`${companionOrigin}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
  }
  return body;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isMeetSender(sender)) {
    sendResponse({ ok: false, error: "Rejected non-Meet sender." });
    return false;
  }

  const tabId = sender.tab?.id;
  if (message?.type === "conclavia:bridge-state") {
    if (typeof tabId === "number") setBadge(tabId, message.state);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "conclavia:status") {
    void companionRequest("/api/chat/status", { method: "GET" })
      .then((status) => {
        sendResponse({ ok: true, status });
      })
      .catch((error) => {
        if (typeof tabId === "number") setBadge(tabId, "offline");
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "conclavia:chat-message") {
    if (!validChatPayload(message.payload)) {
      sendResponse({ ok: false, error: "Invalid chat payload." });
      return false;
    }
    void companionRequest("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify(message.payload),
    })
      .then((result) => {
        if (typeof tabId === "number") setBadge(tabId, "connected");
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        if (typeof tabId === "number") setBadge(tabId, "offline");
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return;
  void chrome.tabs.sendMessage(tab.id, { type: "conclavia:toggle" });
});

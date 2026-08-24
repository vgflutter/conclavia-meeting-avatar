(function installMeetDomAdapter(globalScope) {
  const knownMessageSelector = [
    ".oIy2qc",
    "[data-message-text]",
    "[data-chat-message-text]",
  ].join(",");
  const groupSelectors = [
    ".GDhqjd",
    "[data-message-id]",
    "[data-chat-message-id]",
    "[role='listitem']",
  ];
  const speakerSelector = [
    ".poVWob",
    "[data-sender-name]",
    "[data-participant-name]",
    "[data-chat-sender]",
  ].join(",");
  const timeSelector = [
    ".MuzmKe",
    "time",
    "[data-timestamp]",
    "[data-message-time]",
  ].join(",");
  const composerSelector = [
    "textarea[placeholder*='Invia un messaggio' i]",
    "textarea[placeholder*='Send a message' i]",
    "textarea[aria-label*='Invia un messaggio' i]",
    "textarea[aria-label*='Send a message' i]",
    "[contenteditable='true'][aria-label*='Invia un messaggio' i]",
    "[contenteditable='true'][aria-label*='Send a message' i]",
  ].join(",");
  const panelHeadingPattern = /messaggi nella chiamata|in-call messages|call messages|chat con tutti|chat with everyone/i;
  const ignoredTextPatterns = [
    /^consenti ai partecipanti di inviare messaggi$/i,
    /^allow participants to send messages$/i,
    /^la chat continua è disattivata$/i,
    /^continuous meeting chat is off$/i,
    /^invia un messaggio$/i,
    /^send a message$/i,
    /^\d{1,2}[:.]\d{2}(?:\s?[ap]m)?$/i,
  ];

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function isIgnoredText(text) {
    return !text || ignoredTextPatterns.some((pattern) => pattern.test(text));
  }

  function firstAttribute(element, names) {
    for (const name of names) {
      const value = normalizeText(element?.getAttribute?.(name));
      if (value) return value;
    }
    return "";
  }

  function closestMessageGroup(element) {
    for (const selector of groupSelectors) {
      const group = element.closest?.(selector);
      if (group) return group;
    }
    return element.parentElement ?? element;
  }

  function elementText(element) {
    return normalizeText(element?.innerText ?? element?.textContent);
  }

  function speakerFor(element, group) {
    const localSpeaker = elementText(group.querySelector?.(speakerSelector));
    if (localSpeaker) return localSpeaker.slice(0, 80);

    const labelledSpeaker = firstAttribute(group, [
      "data-sender-name",
      "data-participant-name",
      "aria-label",
    ]);
    if (labelledSpeaker && labelledSpeaker.length <= 80 && !panelHeadingPattern.test(labelledSpeaker)) {
      return labelledSpeaker;
    }

    let previous = group.previousElementSibling;
    for (let attempts = 0; previous && attempts < 4; attempts += 1) {
      const previousSpeaker = elementText(previous.querySelector?.(speakerSelector));
      if (previousSpeaker) return previousSpeaker.slice(0, 80);
      previous = previous.previousElementSibling;
    }
    return "Partecipante Meet";
  }

  function timeFor(group) {
    return elementText(group.querySelector?.(timeSelector)).slice(0, 40);
  }

  function fnv1a(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  function stableElementId(element, group) {
    return firstAttribute(element, ["data-message-id", "data-id", "id"]) ||
      firstAttribute(group, ["data-message-id", "data-chat-message-id", "data-id", "id"]);
  }

  function collectKnownMessages(panel) {
    const elements = Array.from(panel.querySelectorAll?.(knownMessageSelector) ?? []);
    const occurrences = new Map();
    const records = [];
    for (const element of elements) {
      const text = elementText(element);
      if (isIgnoredText(text) || text.length > 4_000) continue;
      const group = closestMessageGroup(element);
      const speakerName = speakerFor(element, group);
      const timeLabel = timeFor(group);
      const occurrenceKey = `${speakerName}\u0000${timeLabel}\u0000${text}`;
      const occurrence = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const nativeId = stableElementId(element, group);
      records.push({
        element,
        group,
        speakerName,
        text,
        timeLabel,
        messageId: nativeId || `meet-${fnv1a(`${occurrenceKey}\u0000${occurrence}`)}`,
      });
    }
    return records;
  }

  function leafTextCandidates(group) {
    const candidates = Array.from(group.querySelectorAll?.("div,span,p") ?? [])
      .filter((element) => (element.children?.length ?? 0) === 0)
      .map((element) => ({ element, text: elementText(element) }))
      .filter(({ element, text }) =>
        !isIgnoredText(text) &&
        text.length <= 4_000 &&
        element.getAttribute?.("role") !== "button" &&
        !element.closest?.("button"),
      );
    return candidates;
  }

  function collectAccessibleMessages(panel) {
    const groups = Array.from(panel.querySelectorAll?.("[role='listitem'],[data-message-id],[data-chat-message-id]") ?? []);
    const occurrences = new Map();
    const records = [];
    for (const group of groups) {
      if (group.querySelector?.(knownMessageSelector)) continue;
      const speakerName = speakerFor(group, group);
      const timeLabel = timeFor(group);
      const candidates = leafTextCandidates(group).filter(({ text }) =>
        text !== speakerName && text !== timeLabel && !panelHeadingPattern.test(text),
      );
      const message = candidates.at(-1);
      if (!message) continue;
      const occurrenceKey = `${speakerName}\u0000${timeLabel}\u0000${message.text}`;
      const occurrence = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const nativeId = stableElementId(message.element, group);
      records.push({
        element: message.element,
        group,
        speakerName,
        text: message.text,
        timeLabel,
        messageId: nativeId || `meet-${fnv1a(`${occurrenceKey}\u0000${occurrence}`)}`,
      });
    }
    return records;
  }

  function collectMessages(panel) {
    const known = collectKnownMessages(panel);
    return known.length ? known : collectAccessibleMessages(panel);
  }

  function findComposer(root) {
    return root.querySelector?.(composerSelector) ?? null;
  }

  function findChatPanel(root) {
    const composer = findComposer(root);
    if (!composer) return null;

    const dialog = composer.closest?.("[role='dialog']");
    if (dialog && panelHeadingPattern.test(elementText(dialog))) return dialog;

    let current = composer.parentElement;
    for (let depth = 0; current && depth < 12; depth += 1) {
      const text = elementText(current);
      if (panelHeadingPattern.test(text)) return current;
      current = current.parentElement;
    }
    return dialog ?? composer.parentElement;
  }

  globalScope.ConclaviaMeetDom = Object.freeze({
    collectMessages,
    findChatPanel,
    findComposer,
    fnv1a,
    normalizeText,
  });
})(globalThis);

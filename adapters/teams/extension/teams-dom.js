(function installTeamsDomAdapter(globalScope) {
  const knownMessageSelector = [
    "[data-tid='message-body']",
    "[data-tid='chat-message-body']",
    "[data-message-body]",
    ".fui-ChatMessage__body",
  ].join(",");
  const groupSelectors = [
    "[data-tid='chat-pane-message']",
    "[data-tid='chat-message']",
    "[data-message-id]",
    "[data-messageid]",
    "[role='listitem']",
  ];
  const speakerSelector = [
    "[data-tid='message-author-name']",
    "[data-tid='message-author']",
    "[data-author-name]",
    "[data-sender-name]",
    "[data-tid='author']",
  ].join(",");
  const timeSelector = [
    "[data-tid='message-timestamp']",
    "[data-tid='timestamp']",
    "time",
    "[data-timestamp]",
  ].join(",");
  const composerSelector = [
    "[data-tid='ckeditor'][contenteditable='true']",
    "[data-tid='chat-pane-compose-message'][contenteditable='true']",
    "[data-tid='compose-message-area'][contenteditable='true']",
    "[contenteditable='true'][data-lexical-editor='true']",
    "textarea[placeholder*='Digita un nuovo messaggio' i]",
    "textarea[placeholder*='Digita un messaggio' i]",
    "textarea[placeholder*='Type a new message' i]",
    "textarea[placeholder*='Type a message' i]",
    "[contenteditable='true'][aria-label*='Digita un nuovo messaggio' i]",
    "[contenteditable='true'][aria-label*='Digita un messaggio' i]",
    "[contenteditable='true'][aria-label*='Type a new message' i]",
    "[contenteditable='true'][aria-label*='Type a message' i]",
    "[contenteditable='true'][aria-label*='Invia un messaggio' i]",
    "[contenteditable='true'][aria-label*='Send a message' i]",
  ].join(",");
  const explicitPanelSelector = [
    "[data-tid='chat-pane']",
    "[data-tid='meeting-chat-pane']",
    "[data-tid='side-panel-chat']",
  ].join(",");
  const panelHeadingPattern = /chat della riunione|chat riunione|meeting chat|messaggi nella riunione|messages in meeting|chat/i;
  const panelHeadingOnlyPattern = /^(?:chat|chat della riunione|chat riunione|meeting chat|messaggi nella riunione|messages in meeting)$/i;
  const ignoredTextPatterns = [
    /^chat$/i,
    /^chat della riunione$/i,
    /^meeting chat$/i,
    /^digita un nuovo messaggio$/i,
    /^type a new message$/i,
    /^invia un messaggio$/i,
    /^send a message$/i,
    /^nuovi messaggi$/i,
    /^new messages$/i,
    /^rispondi$/i,
    /^reply$/i,
    /^altre opzioni$/i,
    /^more options$/i,
    /^modificato$/i,
    /^edited$/i,
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

  function elementText(element) {
    return normalizeText(element?.innerText ?? element?.textContent);
  }

  function closestMessageGroup(element) {
    for (const selector of groupSelectors) {
      const group = element.closest?.(selector);
      if (group) return group;
    }
    return element.parentElement ?? element;
  }

  function speakerFor(group) {
    const localSpeaker = elementText(group.querySelector?.(speakerSelector));
    if (localSpeaker && localSpeaker.length <= 80) return localSpeaker;

    const attributedSpeaker = firstAttribute(group, [
      "data-author-name",
      "data-sender-name",
      "data-display-name",
    ]);
    if (attributedSpeaker && attributedSpeaker.length <= 80) return attributedSpeaker;

    let previous = group.previousElementSibling;
    for (let attempts = 0; previous && attempts < 4; attempts += 1) {
      const previousSpeaker = elementText(previous.querySelector?.(speakerSelector));
      if (previousSpeaker && previousSpeaker.length <= 80) return previousSpeaker;
      previous = previous.previousElementSibling;
    }
    return "Partecipante Teams";
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
    return firstAttribute(element, ["data-message-id", "data-messageid", "data-id", "id"]) ||
      firstAttribute(group, ["data-message-id", "data-messageid", "data-id", "id"]);
  }

  function makeRecord(element, group, text, occurrences) {
    const speakerName = speakerFor(group);
    const timeLabel = timeFor(group);
    const occurrenceKey = `${speakerName}\u0000${timeLabel}\u0000${text}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    const nativeId = stableElementId(element, group);
    return {
      element,
      group,
      speakerName,
      text,
      timeLabel,
      messageId: nativeId || `teams-${fnv1a(`${occurrenceKey}\u0000${occurrence}`)}`,
    };
  }

  function collectKnownMessages(panel) {
    const elements = Array.from(panel.querySelectorAll?.(knownMessageSelector) ?? []);
    const occurrences = new Map();
    const records = [];
    const visitedGroups = new Set();
    for (const element of elements) {
      const group = closestMessageGroup(element);
      if (visitedGroups.has(group)) continue;
      const text = elementText(element);
      if (isIgnoredText(text) || text.length > 4_000) continue;
      visitedGroups.add(group);
      records.push(makeRecord(element, group, text, occurrences));
    }
    return records;
  }

  function leafTextCandidates(group) {
    return Array.from(group.querySelectorAll?.("div,span,p") ?? [])
      .filter((element) => (element.children?.length ?? 0) === 0)
      .map((element) => ({ element, text: elementText(element) }))
      .filter(({ element, text }) =>
        !isIgnoredText(text) &&
        text.length <= 4_000 &&
        element.getAttribute?.("role") !== "button" &&
        !element.closest?.("button"),
      );
  }

  function collectAccessibleMessages(panel) {
    const groups = Array.from(panel.querySelectorAll?.(groupSelectors.join(",")) ?? []);
    const occurrences = new Map();
    const records = [];
    for (const group of groups) {
      const speakerName = speakerFor(group);
      const timeLabel = timeFor(group);
      const candidates = leafTextCandidates(group).filter(({ text }) =>
        text !== speakerName && text !== timeLabel && !panelHeadingOnlyPattern.test(text),
      );
      const message = candidates.at(-1);
      if (!message) continue;
      records.push(makeRecord(message.element, group, message.text, occurrences));
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

    const explicit = composer.closest?.(explicitPanelSelector);
    if (explicit) return explicit;

    const dialog = composer.closest?.("[role='dialog'],[role='region']");
    if (dialog && panelHeadingPattern.test(elementText(dialog))) return dialog;

    let current = composer.parentElement;
    for (let depth = 0; current && depth < 14; depth += 1) {
      if (current.querySelector?.(groupSelectors.join(","))) return current;
      current = current.parentElement;
    }
    return dialog ?? composer.parentElement;
  }

  globalScope.ConclaviaTeamsDom = Object.freeze({
    collectMessages,
    findChatPanel,
    findComposer,
    fnv1a,
    normalizeText,
  });
})(globalThis);

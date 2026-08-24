import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

interface ExtractedMessage {
  messageId: string;
  speakerName: string;
  text: string;
  timeLabel: string;
}

interface TeamsDomAdapter {
  collectMessages(panel: FakeElement): ExtractedMessage[];
  findChatPanel(root: FakeElement): FakeElement | null;
  fnv1a(value: string): string;
  normalizeText(value: unknown): string;
}

class FakeElement {
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  innerText = "";
  parentElement: FakeElement | null = null;
  previousElementSibling: FakeElement | null = null;
  queryAllResult: FakeElement[] = [];
  querySelectorHandler: (selector: string) => FakeElement | null = () => null;
  closestHandler: (selector: string) => FakeElement | null = () => null;

  constructor(text = "") {
    this.innerText = text;
  }

  get textContent(): string {
    return this.innerText;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorHandler(selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    void selector;
    return this.queryAllResult;
  }

  closest(selector: string): FakeElement | null {
    return this.closestHandler(selector);
  }
}

function loadAdapter(): TeamsDomAdapter {
  const source = readFileSync(
    new URL("../../adapters/teams/extension/teams-dom.js", import.meta.url),
    "utf8",
  );
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename: "teams-dom.js" });
  return context.ConclaviaTeamsDom as TeamsDomAdapter;
}

void test("normalizes Teams text and creates stable compact hashes", () => {
  const adapter = loadAdapter();
  assert.equal(adapter.normalizeText("  Mary,\n  alza   la mano "), "Mary, alza la mano");
  assert.equal(adapter.fnv1a("same"), adapter.fnv1a("same"));
  assert.notEqual(adapter.fnv1a("same"), adapter.fnv1a("different"));
});

void test("extracts current Teams message markup and preserves native message IDs", () => {
  const adapter = loadAdapter();
  const speaker = new FakeElement("Vincenzo");
  const time = new FakeElement("12:06");
  const group = new FakeElement("Vincenzo 12:06 Mary, applaudi");
  group.attributes.set("data-message-id", "teams-native-42");
  group.querySelectorHandler = (selector) => {
    if (selector.includes("message-author-name")) return speaker;
    if (selector.includes("message-timestamp")) return time;
    return null;
  };
  const body = new FakeElement("Mary, applaudi");
  body.closestHandler = (selector) => selector.includes("chat-pane-message") ? group : null;
  const panel = new FakeElement();
  panel.queryAllResult = [body];

  const messages = adapter.collectMessages(panel);

  assert.equal(messages.length, 1);
  assert.deepEqual(
    {
      messageId: messages[0]?.messageId,
      speakerName: messages[0]?.speakerName,
      text: messages[0]?.text,
      timeLabel: messages[0]?.timeLabel,
    },
    {
      messageId: "teams-native-42",
      speakerName: "Vincenzo",
      text: "Mary, applaudi",
      timeLabel: "12:06",
    },
  );
});

void test("does not emit duplicate records when Teams renders nested body nodes", () => {
  const adapter = loadAdapter();
  const group = new FakeElement("Mary, alza la mano");
  group.attributes.set("data-message-id", "message-1");
  const first = new FakeElement("Mary, alza la mano");
  const nested = new FakeElement("Mary, alza la mano");
  first.closestHandler = () => group;
  nested.closestHandler = () => group;
  const panel = new FakeElement();
  panel.queryAllResult = [first, nested];

  assert.equal(adapter.collectMessages(panel).length, 1);
});

void test("finds the explicit Teams chat pane from its composer", () => {
  const adapter = loadAdapter();
  const root = new FakeElement();
  const panel = new FakeElement("Chat della riunione");
  const composer = new FakeElement();
  composer.closestHandler = (selector) => selector.includes("chat-pane") ? panel : null;
  root.querySelectorHandler = () => composer;

  assert.equal(adapter.findChatPanel(root), panel);
});

void test("Teams bridge is restricted to Teams pages and emits canonical Teams events", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../../adapters/teams/extension/manifest.json", import.meta.url),
    "utf8",
  )) as {
    content_scripts: Array<{ matches: string[] }>;
    host_permissions: string[];
  };
  const contentSource = readFileSync(
    new URL("../../adapters/teams/extension/content.js", import.meta.url),
    "utf8",
  );
  const backgroundSource = readFileSync(
    new URL("../../adapters/teams/extension/background.js", import.meta.url),
    "utf8",
  );

  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1/*"]);
  assert.deepEqual(manifest.content_scripts[0]?.matches, [
    "https://teams.microsoft.com/*",
    "https://teams.cloud.microsoft/*",
    "https://teams.live.com/*",
  ]);
  assert.match(contentSource, /platform: "teams"/);
  assert.match(contentSource, /conclavia:chat-outbound/u);
  assert.match(contentSource, /1_500/u);
  assert.match(backgroundSource, /payload\.platform === "teams"/);
  assert.match(backgroundSource, /api\/chat\/outbound/u);
  assert.doesNotMatch(contentSource, /https?:\/\//);
});

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

interface MeetDomAdapter {
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

function loadAdapter(): MeetDomAdapter {
  const source = readFileSync(
    new URL("../../adapters/google-meet/extension/meet-dom.js", import.meta.url),
    "utf8",
  );
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename: "meet-dom.js" });
  return context.ConclaviaMeetDom as MeetDomAdapter;
}

void test("normalizes Meet text and creates stable compact hashes", () => {
  const adapter = loadAdapter();
  assert.equal(adapter.normalizeText("  Mary,\n  alza   la mano "), "Mary, alza la mano");
  assert.equal(adapter.fnv1a("same"), adapter.fnv1a("same"));
  assert.notEqual(adapter.fnv1a("same"), adapter.fnv1a("different"));
});

void test("extracts current Meet message markup and keeps repeated messages distinct", () => {
  const adapter = loadAdapter();
  const speaker = new FakeElement("Vincenzo");
  const time = new FakeElement("11:13");
  const group = new FakeElement("Vincenzo 11:13 Mary, alza la mano");
  group.querySelectorHandler = (selector) => {
    if (selector.includes(".poVWob")) return speaker;
    if (selector.includes(".MuzmKe")) return time;
    return null;
  };

  const first = new FakeElement("Mary, alza la mano");
  const second = new FakeElement("Mary, alza la mano");
  first.closestHandler = (selector) => selector === ".GDhqjd" ? group : null;
  second.closestHandler = first.closestHandler;

  const panel = new FakeElement();
  panel.queryAllResult = [first, second];
  const messages = adapter.collectMessages(panel);

  assert.equal(messages.length, 2);
  assert.deepEqual(
    { speakerName: messages[0]?.speakerName, text: messages[0]?.text, timeLabel: messages[0]?.timeLabel },
    { speakerName: "Vincenzo", text: "Mary, alza la mano", timeLabel: "11:13" },
  );
  assert.notEqual(messages[0]?.messageId, messages[1]?.messageId);
});

void test("identifies the smallest confident in-call chat panel from its composer", () => {
  const adapter = loadAdapter();
  const root = new FakeElement();
  const panel = new FakeElement("Messaggi nella chiamata Mary, alza la mano");
  const composer = new FakeElement();
  composer.parentElement = panel;
  root.querySelectorHandler = () => composer;

  assert.equal(adapter.findChatPanel(root), panel);
});

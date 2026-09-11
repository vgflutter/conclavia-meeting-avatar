import type { Page } from "@playwright/test";

/** Synthetic streaming PCM, not provider-quality or Teams receiver verification. */
export async function installVoiceProbe(page: Page) {
  const bytes = Buffer.alloc(24000 * 2);
  for (let i = 0; i < 24000; i++) bytes.writeInt16LE(Math.round(6000 * Math.sin(i * Math.PI / 30)), i * 2);
  const body = JSON.stringify({ audio: bytes.toString("base64"), phones: [{ start: 0, end: 1, viseme: "a" }] }) + "\n" + JSON.stringify({ done: true }) + "\n";
  await page.route(/\/api\/(?:avatar|meeting-room\/[^/]+)\/speech$/, (route) => route.fulfill({
    contentType: "application/x-ndjson", body,
  }));
  await page.addInitScript(() => {
    const audio: Array<{ ended: boolean; seconds: number; muted: boolean }> = [];
    Object.assign(window, { voiceProbe: { audio } });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const entry = { ended: false, seconds: this.buffer?.duration || 0, muted: false };
      audio.push(entry);
      this.addEventListener("ended", () => { entry.ended = true; });
      return start.apply(this, args);
    };
  });
}

export async function voiceProbeStats(page: Page) {
  return page.evaluate(() => ({
    playbacks: (window as unknown as { voiceProbe: { audio: Array<{ ended: boolean; seconds: number; muted: boolean }> } }).voiceProbe.audio,
  }));
}

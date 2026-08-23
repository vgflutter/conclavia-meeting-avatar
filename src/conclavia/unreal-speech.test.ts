import assert from "node:assert/strict";
import test from "node:test";

import { preferredPollyEngine } from "./unreal-speech.js";

await test("uses low-latency neural Polly for voices that support it", () => {
  assert.equal(preferredPollyEngine("Bianca"), "neural");
  assert.equal(preferredPollyEngine("Danielle"), "neural");
  assert.equal(preferredPollyEngine("Joanna"), "neural");
  assert.equal(preferredPollyEngine("Stephen"), "neural");
});

await test("keeps generative Polly for voices without neural support", () => {
  assert.equal(preferredPollyEngine("Beatrice"), "generative");
  assert.equal(preferredPollyEngine("Lorenzo"), "generative");
  assert.equal(preferredPollyEngine("Tiffany"), "generative");
});

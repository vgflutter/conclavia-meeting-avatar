import assert from "node:assert/strict";
import test from "node:test";

import {
  preferredPollyEngine,
  speechRateFor,
  speechSsmlForText,
} from "./unreal-speech.js";

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

await test("keeps programme speech close to a natural human pace", () => {
  assert.equal(speechRateFor("it-IT", "naturale"), "100%");
  assert.equal(speechRateFor("it-IT", "vivace"), "104%");
  assert.equal(speechRateFor("en-US", "vivace"), "102%");
  assert.equal(speechRateFor("it-IT", "autorevole"), "98%");
});

await test("marks English technical terms inside Italian speech", () => {
  assert.equal(
    speechSsmlForText(
      "Il deployment di Kubernetes gira su AWS e Microsoft Teams.",
      "it-IT",
    ),
    "Il <lang xml:lang=\"en-US\">deployment</lang> di " +
      "<lang xml:lang=\"en-US\">Kubernetes</lang> gira su " +
      "<lang xml:lang=\"en-US\">AWS</lang> e " +
      "<lang xml:lang=\"en-US\">Microsoft Teams</lang>.",
  );
});

await test("does not add language tags to native English speech", () => {
  assert.equal(
    speechSsmlForText("Kubernetes is ready.", "en-US"),
    "Kubernetes is ready.",
  );
});

await test("escapes text while adding safe inline pronunciation tags", () => {
  assert.equal(
    speechSsmlForText("OpenAI & AWS", "it-IT"),
    "<lang xml:lang=\"en-US\">OpenAI</lang> &amp; " +
      "<lang xml:lang=\"en-US\">AWS</lang>",
  );
});

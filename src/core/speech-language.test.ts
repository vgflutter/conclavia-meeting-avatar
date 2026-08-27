import assert from "node:assert/strict";
import test from "node:test";

import { resolveSpeechLanguage } from "./speech-language.js";

await test("repairs an Italian label on a clearly English sentence", () => {
  assert.equal(
    resolveSpeechLanguage(
      "it-IT",
      "The Kubernetes deployment is ready and the team can start.",
    ),
    "en-US",
  );
});

await test("keeps an Italian sentence Italian when it contains technical English", () => {
  assert.equal(
    resolveSpeechLanguage(
      "it-IT",
      "Il deployment Kubernetes e pronto per il team.",
    ),
    "it-IT",
  );
});

await test("keeps a reliable language label for an ambiguous short sentence", () => {
  assert.equal(resolveSpeechLanguage("en-US", "Kubernetes ready."), "en-US");
  assert.equal(resolveSpeechLanguage("it-IT", "Kubernetes pronto."), "it-IT");
});

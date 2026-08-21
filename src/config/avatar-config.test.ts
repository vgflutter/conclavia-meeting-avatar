import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AvatarConfigStore, type AvatarConfig } from "./avatar-config.js";

const defaults: AvatarConfig = {
  avatarProfile: "aera",
  name: "Mary",
  apiKey: "environment-key",
  responseModel: "gpt-5.4-mini",
  purpose: "Aiutare la riunione.",
  personality: "Curiosa e concreta.",
  systemPrompt: "Distingui fatti e opinioni.",
  webSearchEnabled: true,
  requestToSpeakEnabled: true,
  voiceStyle: "natural",
  italianVoice: "Bianca",
  englishVoice: "Danielle",
  meetingPlatform: "teams",
  meetingAudioDevice: "BlackHole 16ch",
  meetingSpeakerName: "Partecipante meeting",
};

await test("never exposes the API key in public configuration", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);

  assert.equal(store.publicConfig.apiKeyConfigured, true);
  assert.equal(store.publicConfig.apiKeySource, "environment");
  assert.equal("apiKey" in store.publicConfig, false);
});

await test("persists a locally supplied key but preserves an environment key on blank updates", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  store.update({ personality: "Analitica.", apiKey: "" });
  assert.equal(readFileSync(path, "utf8").includes("environment-key"), false);

  store.update({ apiKey: "local-key" });
  assert.equal(readFileSync(path, "utf8").includes("local-key"), true);
  assert.equal(store.publicConfig.apiKeySource, "local");
});

await test("rejects an unsupported avatar profile", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  assert.throws(() => store.update({ avatarProfile: "unknown" }), /non supportato/u);
});

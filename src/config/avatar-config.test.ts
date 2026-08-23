import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AvatarConfigStore,
  defaultChatCommandAliases,
  type AvatarConfig,
} from "./avatar-config.js";

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
  chatEnabled: true,
  chatCommandAliases: defaultChatCommandAliases,
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

await test("accepts Vivian as a selectable MetaHuman profile", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  assert.equal(store.update({ avatarProfile: "vivian" }).avatarProfile, "vivian");
  assert.equal(store.publicConfig.avatarProfile, "vivian");
});

await test("accepts Jelena as a selectable MetaHuman profile", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  assert.equal(store.update({ avatarProfile: "jelena" }).avatarProfile, "jelena");
  assert.equal(store.publicConfig.avatarProfile, "jelena");
});

await test("accepts the Jelena-derived Cine showcase profile", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  assert.equal(store.update({ avatarProfile: "showcase" }).avatarProfile, "showcase");
  assert.equal(store.publicConfig.avatarProfile, "showcase");
});

await test("persists configurable chat commands and returns defensive copies", () => {
  const path = join(mkdtempSync(join(tmpdir(), "conclavia-config-")), "avatar.json");
  const store = new AvatarConfigStore(path, defaults);
  store.update({
    chatCommandAliases: {
      ...defaultChatCommandAliases,
      raiseHand: ["fai un cenno"],
    },
  });

  const config = store.current;
  assert.deepEqual(config.chatCommandAliases.raiseHand, ["fai un cenno"]);
  config.chatCommandAliases.raiseHand.push("mutazione esterna");
  assert.deepEqual(store.current.chatCommandAliases.raiseHand, ["fai un cenno"]);
});

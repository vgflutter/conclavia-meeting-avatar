import { expect, test } from "@playwright/test";
import { AVATAR_VOICES, isAvatarVoice, compatibleAvatarVoice, voicesForAppearance } from "../../src/lib/avatar-voice-catalog";
import { meetingTtsConfig, selectedMeetingVoices } from "../../src/lib/meeting-tts-config";
import { inworldSpeechResponse } from "../../src/lib/inworld-tts";

test("voice catalog: native language validation and per-language saved overrides", () => {
  expect(AVATAR_VOICES.filter(v => v.language === "it")).toHaveLength(6);
  expect(AVATAR_VOICES.filter(v => v.language === "it" && v.source === "system")).toHaveLength(2);
  expect(AVATAR_VOICES.filter(v => v.language === "it" && v.source === "community")).toHaveLength(4);
  expect(AVATAR_VOICES.every(v => v.provider === "inworld")).toBe(true);
  expect(AVATAR_VOICES.filter(v => v.language === "en")).toHaveLength(6);
  expect(isAvatarVoice("Dennis", "it")).toBe(false);
  expect(isAvatarVoice("Orietta", "en")).toBe(false);
  expect(isAvatarVoice("invented", "it")).toBe(false);
  expect(voicesForAppearance("business_clay", "it").map(v => v.id)).toEqual(["Gianni", "community-rxgdeftvn9dc", "community-wogdp7fnk36a", "community-kvd4dbkrdpds"]);
  expect(voicesForAppearance("business_clay", "en").map(v => v.id)).toEqual(["Dennis", "Edward", "Alex", "Alistair"]);
  expect(voicesForAppearance("business_clay_female", "it").map(v => v.id)).toEqual(["Orietta", "community-detz4fjemm8q"]);
  expect(voicesForAppearance("business_clay_female", "en").map(v => v.id)).toEqual(["Olivia", "Eleanor"]);
  expect(compatibleAvatarVoice("Edward", "en", "business_clay")).toBe("Edward");
  expect(compatibleAvatarVoice("Dennis", "en", "business_clay_female")).toBe("Eleanor");
  expect(compatibleAvatarVoice("CustomIT", "it", "business_clay_female")).toBe("Orietta");
  expect(compatibleAvatarVoice("community-wogdp7fnk36a", "it", "business_clay")).toBe("community-wogdp7fnk36a");
  expect(compatibleAvatarVoice("community-wogdp7fnk36a", "it", "business_clay_female")).toBe("Orietta");
  expect(isAvatarVoice("community-wogdp7fnk36a", "en")).toBe(false);
  expect(isAvatarVoice("community-wogdp7fnk36a", "it", "unconfigured-provider")).toBe(false);
  const config = meetingTtsConfig({ INWORLD_VOICE_ID_IT: "CustomIT", INWORLD_VOICE_ID: "CustomEN" });
  expect(selectedMeetingVoices({}, config)).toEqual({it: "CustomIT", en: "CustomEN"});
  expect(selectedMeetingVoices({inworldVoiceIdIt: "Orietta"}, config)).toEqual({it: "Orietta", en: "CustomEN"});
});

test("voice routing: the selected voice reaches synthesis without changing language or rate", async () => {
  const config = meetingTtsConfig({INWORLD_API_KEY: "fake-test-key"});
  for (const language of ["it", "en"] as const) {
    const voiceId = selectedMeetingVoices({inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Eleanor"}, config)[language];
    const response = await inworldSpeechResponse({text: "Voice test", language, voiceId, speakingRate: 1.04, signal: new AbortController().signal}, {
      config, fetcher: async (_url, options) => {
        expect(JSON.parse(String(options?.body))).toMatchObject({voiceId, language: language === "it" ? "it-IT" : "en-GB", audioConfig: {speakingRate: 1.04}});
        return new Response(JSON.stringify({result: {audioContent: "AAAAAA=="}}) + "\n");
      },
    });
    expect(await response.text()).toContain('"done":true');
  }
});

test("voice API: persists separately, profile edits preserve selections, rejects invalid and cross-site requests", async ({request}) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/u);
  const endpoint = "/api/avatar/voices";
  expect((await request.patch(endpoint, {data: {language: "it", voiceId: "Orietta"}})).status()).toBe(200);
  expect((await request.patch(endpoint, {data: {language: "en", voiceId: "Eleanor"}})).status()).toBe(200);
  const {profile} = await (await request.get("/api/avatar")).json();
  const update = await request.patch("/api/avatar", {data: {displayName: profile.displayName, role: profile.role,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate}});
  expect(update.status()).toBe(200);
  const saved = await (await request.get(endpoint)).json();
  expect(saved.selected).toEqual({it: "Orietta", en: "Eleanor"});
  expect(JSON.stringify(saved)).not.toContain("apiKey");
  for (const data of [{language: "it", voiceId: "Dennis"}, {language: "en", voiceId: "bad"}, {language: "it", voiceId: "Gianni", displayName: "Changed"}]) {
    expect((await request.patch(endpoint, {data})).status()).toBe(400);
  }
  expect((await request.patch(endpoint, {data: {language: "it", voiceId: "Gianni"}, headers: {origin: "https://attacker.example"}})).status()).toBe(403);
  expect((await request.post("/api/avatar/speech", {data: {text: "Ciao", language: "it", model: "inworld-tts-2", voiceId: "Dennis"}})).status()).toBe(400);
  expect((await (await request.get(endpoint)).json()).selected).toEqual(saved.selected);
});

test("voice GUI: preview does not save, explicit save survives reload and preserves the other language", async ({page, request}) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/u);
  const {profile} = await (await request.get("/api/avatar")).json();
  await request.patch("/api/avatar", {data: {displayName: profile.displayName, role: profile.role, appearance: "business_clay",
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude, voiceStyle: profile.voice.style}});
  await request.patch("/api/avatar/voices", {data: {language: "it", voiceId: "Gianni"}});
  await request.patch("/api/avatar/voices", {data: {language: "en", voiceId: "Dennis"}});
  await page.context().addCookies([{name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101"}]);
  let preview: Record<string, unknown> | undefined;
  await page.route("**/api/avatar/speech", async route => {
    preview = route.request().postDataJSON();
    const pcm = Buffer.alloc(12_000);
    for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
    await route.fulfill({contentType: "application/x-ndjson", body: JSON.stringify({audio: pcm.toString("base64")}) + '\n{"done":true}\n'});
  });
  await page.goto("/avatar/test?voice=inworld");
  await page.getByLabel("Aspetto dell’avatar").selectOption("business_clay_female");
  await expect(page.getByLabel("Voce")).toHaveValue("Orietta");
  await page.getByRole("button", {name: "Ascolta la voce", exact: true}).click();
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  expect(preview).toMatchObject({language: "it", voiceId: "Orietta"});
  expect((await (await request.get("/api/avatar/voices")).json()).selected.it).toBe("Gianni");
  await page.getByRole("button", {name: "Salva avatar", exact: true}).click();
  await expect(page.getByTestId("saved-voices")).toContainText("Italiano — Orietta; English — Eleanor");
  await page.reload();
  await expect(page.getByLabel("Voce")).toHaveValue("Orietta");
  await page.getByLabel("Lingua", {exact: true}).selectOption("en");
  await expect(page.getByLabel("Testo da leggere")).toHaveValue(/^Hello,/u);
  await expect(page.getByLabel("Voce").locator("option")).toHaveCount(2);
  await page.getByLabel("Voce").selectOption("Olivia");
  await page.getByRole("button", {name: "Salva avatar", exact: true}).click();
  await expect(page.getByTestId("saved-voices")).toContainText("Italiano — Orietta; English — Olivia");
});

test("voice GUI: failed save leaves the configured voice unchanged", async ({page, request}) => {
  await request.patch("/api/avatar/voices", {data: {language: "it", voiceId: "Gianni"}});
  await page.context().addCookies([{name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101"}]);
  await page.goto("/avatar/test?voice=inworld");
  await page.getByLabel("Language", {exact: true}).selectOption("it");
  await page.getByLabel("Voice").selectOption("Orietta");
  await page.route("**/api/avatar", route => route.fulfill({status: 503, json: {error: "Unavailable"}}));
  await page.getByRole("button", {name: "Save avatar", exact: true}).click();
  await expect(page.getByText(/Could not save/)).toBeVisible();
  await expect(page.getByTestId("saved-voices")).toContainText("Italiano — Gianni");
});

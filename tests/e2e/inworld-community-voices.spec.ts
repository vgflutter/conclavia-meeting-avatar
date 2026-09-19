import { expect, test } from "@playwright/test";
import { avatarVoiceName } from "../../src/lib/avatar-voice-catalog";

const identity = { displayName: "Riccardo", role: "Digital colleague", appearance: "business_clay",
  responseStyle: "balanced", attitude: "collaborative", voiceStyle: "executive_warm",
  speakingRate: 1, inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis" };

test.beforeEach(async ({ page, request }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  expect((await request.patch("/api/avatar", { data: identity })).status()).toBe(200);
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
});

for (const [voiceId, name, appearance] of [
  ["community-rxgdeftvn9dc", "Capitano", "business_clay"],
  ["community-wogdp7fnk36a", "Ingegnere", "business_clay"],
  ["community-kvd4dbkrdpds", "Cuoco", "business_clay"],
  ["community-detz4fjemm8q", "Voce Sistema", "business_clay_female"],
]) {
  test(`Inworld ${name}: origin, preview payload, save and reload with a readable name`, async ({ page, request }) => {
    let payload: Record<string, unknown> | undefined;
    const pcm = Buffer.alloc(12000);
    for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
    await page.route("**/api/avatar/speech", route => {
      payload = route.request().postDataJSON();
      return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ audio: pcm.toString("base64") }) + '\n{"done":true}\n' });
    });
    await page.goto("/avatar/test");
    await page.getByLabel("Aspetto dell’avatar").selectOption(appearance);
    const voice = page.getByLabel("Voce");
    await voice.selectOption(voiceId);
    await expect(page.getByTestId("voice-provider")).toContainText("Fornitore della voce: Inworld");
    await expect(voice.locator('optgroup[label="Inworld · Community"] option:checked')).toHaveAttribute("value", voiceId);
    await expect(page.getByTestId("voice-origin")).toContainText("Inworld · Community");
    await expect(page.getByTestId("preview-voices")).toContainText(`Italiano — ${name}`);
    await expect(page.getByTestId("preview-voices")).not.toContainText("community-");
    await page.getByRole("button", { name: "Ascolta la voce", exact: true }).click();
    await expect.poll(() => payload).toMatchObject({ provider: "inworld", language: "it", voiceId });
    await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
    expect((await (await request.get("/api/avatar/voices")).json()).selected.it).toBe("Gianni");
    await page.getByRole("button", { name: "Salva avatar", exact: true }).click();
    await expect(page.getByText("Avatar aggiornato.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(voice).toHaveValue(voiceId);
    await expect(page.getByTestId("saved-voices")).toContainText(`Italiano — ${name}`);
    await expect(page.getByRole("button", { name: "Salva avatar", exact: true })).toBeDisabled();
    expect((await (await request.get("/api/avatar/voices")).json()).selected.it).toBe(voiceId);
  });
}

test("catalog metadata is explicit; unknown voices, languages and providers fail closed", async ({ request }) => {
  const catalog = await (await request.get("/api/avatar/voices")).json();
  expect(catalog.provider).toEqual({ id: "inworld", name: "Inworld" });
  expect(catalog.catalogVerifiedAt).toBe("2026-09-13");
  expect(catalog.voices.filter((voice: { language: string }) => voice.language === "it")).toHaveLength(6);
  expect(avatarVoiceName("community-wogdp7fnk36a")).toBe("Ingegnere");
  expect(avatarVoiceName("LegacyUnknownVoice")).toBe("LegacyUnknownVoice");
  for (const data of [
    { language: "en", voiceId: "community-wogdp7fnk36a" },
    { language: "it", voiceId: "community-unverified" },
    { language: "it", voiceId: "Gianni", provider: "another-provider" },
  ]) {
    expect((await request.post("/api/avatar/speech", { data: { text: "Ciao", model: "inworld-tts-2-flash", ...data } })).status()).toBe(400);
    expect((await request.patch("/api/avatar/voices", { data })).status()).toBe(400);
  }
  expect((await (await request.get("/api/avatar/voices")).json()).selected).toEqual(catalog.selected);
});

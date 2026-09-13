import { expect, test } from "@playwright/test";

const identity = { displayName: "Riccardo", role: "Digital colleague", appearance: "business_clay",
  responseStyle: "balanced", attitude: "collaborative", voiceStyle: "executive_warm",
  speakingRate: 1, inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Edward" };

test.beforeEach(async ({ page, request }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  expect((await request.patch("/api/avatar", { data: identity })).status()).toBe(200);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

test("both tabs: only compatible voices, automatic pairing and remembered choices for either appearance", async ({ page, request }) => {
  await page.goto("/avatar");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  const nav = page.getByRole("navigation", { name: "Avatar configuration" });
  await nav.getByRole("link", { name: "Test avatar · voice & movement" }).click();
  const voice = page.getByLabel("Voice to preview");
  const language = page.getByLabel("Language", { exact: true });
  const options = () => voice.locator("option").evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
  await expect(voice).toHaveValue("Eleanor");
  expect(await options()).toEqual(["Olivia", "Eleanor"]);
  await expect(page.getByTestId("preview-voices")).toContainText("Italiano — Orietta; English — Eleanor");
  await voice.selectOption("Olivia");
  await language.selectOption("it");
  await expect(voice).toHaveValue("Orietta");
  expect(await options()).toEqual(["Orietta", "community-detz4fjemm8q"]);
  await page.getByLabel("Avatar appearance").selectOption("business_clay");
  await expect(voice).toHaveValue("Gianni");
  expect(await options()).toEqual(["Gianni", "community-rxgdeftvn9dc", "community-wogdp7fnk36a", "community-kvd4dbkrdpds"]);
  await language.selectOption("en");
  await expect(voice).toHaveValue("Edward");
  expect(await options()).toEqual(["Dennis", "Edward", "Alex", "Alistair"]);
  await voice.selectOption("Alistair");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await expect(voice).toHaveValue("Olivia");
  await nav.getByRole("link", { name: "Identity & behaviour" }).click();
  await expect(page.getByLabel("Name and call phrase")).toHaveValue("Riccardo");
  await page.getByLabel("Avatar appearance").selectOption("business_clay");
  await nav.getByRole("link", { name: "Test avatar · voice & movement" }).click();
  await expect(voice).toHaveValue("Alistair");
  expect((await (await request.get("/api/avatar")).json()).profile.voice.inworldVoiceIdEn).toBe("Edward");
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(voice).toHaveValue("Alistair");
  await expect(page.getByLabel("Avatar appearance")).toHaveValue("business_clay");
  await expect(page.getByRole("button", { name: "Save avatar", exact: true })).toBeDisabled();
});

test("speech preview routes the matching voice for all four appearance and language combinations", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  const pcm = Buffer.alloc(12000);
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
  await page.route("**/api/avatar/speech", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ audio: pcm.toString("base64") }) + '\n{"done":true}\n' });
  });
  await page.goto("/avatar/test");
  for (const [appearance, language, voiceId] of [
    ["business_clay", "en", "Edward"], ["business_clay", "it", "Gianni"],
    ["business_clay_female", "en", "Eleanor"], ["business_clay_female", "it", "Orietta"],
  ]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    await page.getByLabel("Language", { exact: true }).selectOption(language);
    await page.getByRole("button", { name: "Listen to voice", exact: true }).click();
    await expect.poll(() => requests.at(-1)).toMatchObject({ language, voiceId });
    await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  }
  expect(requests).toHaveLength(4);
});

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`legacy mismatched ${appearance}: safe preview, explicit correction, no hidden writes`, async ({ page, request }) => {
    const female = appearance === "business_clay_female";
    const oldVoices = female ? { inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis" }
      : { inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Eleanor" };
    const expectedVoices = female ? { inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Eleanor" }
      : { inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis" };
    await request.patch("/api/avatar", { data: { ...identity, appearance, ...oldVoices } });
    const before = (await (await request.get("/api/avatar")).json()).profile;
    await page.goto("/avatar/test");
    await expect(page.getByLabel("Voice to preview")).toHaveValue(expectedVoices.inworldVoiceIdEn);
    await expect(page.getByTestId("voice-compatibility-notice")).toBeVisible();
    await expect(page.getByRole("button", { name: "Discard changes" })).toHaveCount(0);
    // Discarding other preview edits must not restore an incompatible voice.
    await page.getByTestId("voice-advanced").locator("summary").click();
    await page.getByLabel("Speaking rate", { exact: true }).fill("0.9");
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByLabel("Voice to preview")).toHaveValue(expectedVoices.inworldVoiceIdEn);
    expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
    await page.getByRole("button", { name: "Save avatar", exact: true }).click();
    await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("voice-compatibility-notice")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save avatar", exact: true })).toBeDisabled();
    expect((await (await request.get("/api/avatar")).json()).profile).toMatchObject({ appearance, voice: expectedVoices });
  });
}

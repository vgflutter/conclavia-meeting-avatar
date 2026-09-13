import { expect, test } from "@playwright/test";
import { installVoiceProbe } from "./voice-probe";

test.beforeEach(async ({ page, request }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  expect((await request.patch("/api/avatar", { data: {
    displayName: "Riccardo", role: "Digital colleague", appearance: "business_clay",
    responseStyle: "balanced", attitude: "collaborative", voiceStyle: "executive_warm",
    speakingRate: 1, inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis",
  } })).status()).toBe(200);
});

test("unsaved female identity follows both tabs, both voices save together and survive reload", async ({ page, request }, testInfo) => {
  await installVoiceProbe(page);
  const profileBefore = (await (await request.get("/api/avatar")).json()).profile;
  await page.goto("/avatar");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await page.getByLabel("Name and call phrase").fill("Sofia");
  const nav = page.getByRole("navigation", { name: "Avatar configuration" });
  await nav.getByRole("link", { name: "Test avatar · voice & movement" }).click();
  const avatar = page.locator("svg[data-appearance]");
  await expect(avatar).toHaveAttribute("data-appearance", "business_clay_female");
  await expect(page.getByLabel("Test phrase")).toHaveValue(/Hello, I'm Sofia/);
  await page.getByLabel("Voice to preview").selectOption("Eleanor");
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await page.getByLabel("Voice to preview").selectOption("Orietta");
  await page.getByTestId("voice-advanced").locator("summary").click();
  await page.getByLabel("Speaking rate", { exact: true }).fill("0.95");
  await page.getByLabel("Test phrase").fill("Buongiorno, questa è la mia prova.");
  await page.getByLabel("Language", { exact: true }).selectOption("en");
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await expect(page.getByLabel("Test phrase")).toHaveValue("Buongiorno, questa è la mia prova.");
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(avatar).toHaveAttribute("data-viseme", "a");
  await expect(page.getByRole("button", { name: "Save avatar", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(avatar).toHaveAttribute("data-gesture", "hand_raise");
  await page.getByRole("button", { name: "Stop voice" }).click();
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(profileBefore);

  await nav.getByRole("link", { name: "Identity & behaviour" }).click();
  await expect(page.getByLabel("Avatar appearance")).toHaveValue("business_clay_female");
  await expect(page.getByLabel("Name and call phrase")).toHaveValue("Sofia");
  await page.goBack();
  await expect(avatar).toHaveAttribute("data-appearance", "business_clay_female");
  await expect(page.getByTestId("avatar-save-controls")).toContainText("Italian voice, English voice, speaking rate");
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
  const saved = (await (await request.get("/api/avatar")).json()).profile;
  expect(saved).toMatchObject({ displayName: "Sofia", appearance: "business_clay_female",
    voice: { inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Eleanor", speakingRate: .95 } });
  await page.reload();
  await expect(avatar).toHaveAttribute("data-appearance", "business_clay_female");
  await expect(page.getByTestId("saved-voices")).toContainText("Italiano — Orietta; English — Eleanor");
  await expect(page.getByRole("button", { name: "Save avatar", exact: true })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("avatar-unified-preview-en.png"), fullPage: true });
});

test("test page switches either appearance; global discard restores identity and both languages", async ({ page, request }) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  await page.goto("/avatar/test");
  for (const appearance of ["business_clay_female", "business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-appearance", appearance);
  }
  await page.getByLabel("Voice to preview").selectOption("Eleanor");
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await page.getByLabel("Voice to preview").selectOption("Orietta");
  await page.getByTestId("voice-advanced").locator("summary").click();
  await page.getByLabel("Speaking rate", { exact: true }).fill("0.9");
  await page.getByRole("navigation", { name: "Avatar configuration" }).getByRole("link", { name: "Identity & behaviour" }).click();
  await page.getByLabel("Name and call phrase").fill("Sofia");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Avatar appearance")).toHaveValue("business_clay");
  await expect(page.getByLabel("Name and call phrase")).toHaveValue("Riccardo");
  await page.getByRole("navigation", { name: "Avatar configuration" }).getByRole("link", { name: "Test avatar · voice & movement" }).click();
  await expect(page.getByLabel("Voice to preview")).toHaveValue("Dennis");
  await expect(page.getByLabel("Speaking rate", { exact: true })).toHaveValue("1");
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await expect(page.getByLabel("Voice to preview")).toHaveValue("Gianni");
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
});

test("unified save validates all voices before changing identity and rejects cross-site writes", async ({ request }) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const data = { displayName: "Sofia", role: "Digital colleague", appearance: "business_clay_female",
    responseStyle: "balanced", attitude: "collaborative", voiceStyle: "executive_warm", speakingRate: .9,
    inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Gianni" };
  expect((await request.patch("/api/avatar", { data })).status()).toBe(400);
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
  expect((await request.patch("/api/avatar", { data: { ...data, inworldVoiceIdEn: "Eleanor" },
    headers: { origin: "https://attacker.example" } })).status()).toBe(403);
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
});

test("mobile: lip sync stays on screen during playback and navigating stops the audio", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installVoiceProbe(page);
  await page.addInitScript(() => {
    const contexts: BaseAudioContext[] = [];
    Object.assign(window, { previewContexts: contexts });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (!contexts.includes(this.context)) contexts.push(this.context);
      return start.apply(this, args);
    };
  });
  // Long enough to distinguish cancellation from naturally reaching the end.
  const bytes = Buffer.alloc(24000 * 2 * 5);
  for (let i = 0; i < bytes.length / 2; i++) bytes.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
  await page.route("**/api/avatar/speech", route => route.fulfill({ contentType: "application/x-ndjson",
    body: JSON.stringify({ audio: bytes.toString("base64"), phones: [{ start: 0, end: 5, viseme: "a" }] }) + '\n{"done":true}\n' }));
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(page.locator('svg[data-viseme="a"]')).toBeVisible();
  await expect(page.getByTestId("speech-preview")).toHaveCSS("position", "fixed");
  const visible = await page.locator("svg[data-appearance]").evaluate(svg => {
    const box = svg.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
  });
  expect(visible).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("avatar-mobile-speaking-en.png") });
  await page.getByRole("button", { name: "Stop voice" }).click();
  await expect(page.getByTestId("speech-preview")).not.toHaveCSS("position", "fixed");
  await expect(page.locator("svg[data-viseme]")).toHaveAttribute("data-viseme", "rest");
  await page.getByRole("button", { name: "Listen to voice" }).click();
  await expect(page.locator('svg[data-viseme="a"]')).toBeVisible();
  await page.getByRole("navigation", { name: "Avatar configuration" }).getByRole("link", { name: "Identity & behaviour" }).click();
  // Closing the device is the decisive assertion, not a node's optional ended notification.
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { previewContexts: BaseAudioContext[] }).previewContexts.map(context => context.state)),
  { timeout: 1000 }).toEqual(["closed", "closed"]);
  await expect(page.getByLabel("Avatar appearance")).toHaveValue("business_clay_female");
  await page.getByRole("navigation", { name: "Avatar configuration" }).getByRole("link", { name: "Test avatar · voice & movement" }).click();
  await expect(page.locator("svg[data-viseme]")).toHaveAttribute("data-viseme", "rest");
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
});

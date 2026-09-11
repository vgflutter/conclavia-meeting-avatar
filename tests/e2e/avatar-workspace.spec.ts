import { expect, test } from "@playwright/test";

test("avatar workspace: rate preview, discard, explicit save and identity edits preserve voice settings", async ({ page, request }, testInfo) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await request.patch("/api/avatar/voices", { data: { language: "en", voiceId: "Dennis", speakingRate: 1 } });
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.goto("/avatar");
  await expect(page.locator("#speaking-rate")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Avatar configuration" });
  await expect(nav.getByRole("link", { name: "Identity & behaviour" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Test avatar · voice & movement" }).click();
  await expect(page.getByLabel("Speaking rate", { exact: true })).toHaveValue("1");
  await expect(page.getByTestId("voice-advanced")).not.toHaveAttribute("open");
  await expect(page.locator("#stream-model")).not.toBeVisible();
  const save = page.getByRole("button", { name: "Save voice & rate" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Speaking rate", { exact: true }).fill("0.9");
  await expect(page.getByText("Unsaved changes: listen before confirming.")).toBeVisible();
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/avatar/speech", async (route) => {
    payload = route.request().postDataJSON();
    const pcm = Buffer.alloc(24000);
    for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ audio: pcm.toString("base64") }) + '\n{"done":true}\n' });
  });
  await page.getByRole("button", { name: "Listen to voice", exact: true }).click();
  await expect.poll(() => payload?.speakingRate).toBe(0.9);
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  expect((await (await request.get("/api/avatar/voices")).json()).speakingRate).toBe(1);
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Speaking rate", { exact: true })).toHaveValue("1");
  await page.getByLabel("Speaking rate", { exact: true }).fill("1.08");
  // A failed save must retain the persisted rate and allow retry.
  await page.route("**/api/avatar/voices", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await save.click();
  await expect(page.getByText(/Could not save/)).toBeVisible();
  await expect(page.getByTestId("saved-voices")).toContainText("1.00×");
  await page.unroute("**/api/avatar/voices");
  await save.click();
  await expect(page.getByTestId("saved-voices")).toContainText("1.08×");
  await page.reload();
  await expect(page.getByLabel("Speaking rate", { exact: true })).toHaveValue("1.08");
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await expect(page.getByLabel("Speaking rate", { exact: true })).toHaveValue("1.08");
  // All four expressions remain available without opening technical settings.
  for (const mood of ["focused", "confident", "neutral", "friendly"]) {
    await page.getByRole("button", { name: "Change expression" }).click();
    await expect(page.locator("svg[data-mood]")).toHaveAttribute("data-mood", mood);
  }
  await page.screenshot({ path: testInfo.outputPath("avatar-studio-desktop-en.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("avatar-studio-mobile-en.png"), fullPage: true });
  await page.getByRole("navigation", { name: "Avatar configuration" }).getByRole("link", { name: "Identity & behaviour" }).click();
  // Simulate a newer rate saved in another tab before this identity form submits.
  await request.patch("/api/avatar/voices", { data: { language: "en", voiceId: "Eleanor", speakingRate: 1.02 } });
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
  const final = await (await request.get("/api/avatar/voices")).json();
  expect(final.speakingRate).toBe(1.02);
  expect(final.selected.en).toBe("Eleanor");
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("avatar-settings-mobile-en.png"), fullPage: true });
});

test("voice rate: both APIs reject invalid values and old voice clients preserve the rate", async ({ request }) => {
  await request.patch("/api/avatar/voices", { data: { language: "it", voiceId: "Orietta", speakingRate: 0.96 } });
  for (const speakingRate of [null, "1", 0.79, 1.11, {}, false]) {
    const voice = { language: "it", voiceId: "Gianni", speakingRate };
    expect((await request.patch("/api/avatar/voices", { data: voice })).status()).toBe(400);
    expect((await request.post("/api/avatar/speech", { data: { ...voice, text: "Ciao", model: "inworld-tts-2" } })).status()).toBe(400);
  }
  expect((await request.patch("/api/avatar/voices", { data: { language: "it", voiceId: "Gianni" } })).status()).toBe(200);
  expect((await (await request.get("/api/avatar/voices")).json()).speakingRate).toBe(0.96);
  const before = (await (await request.get("/api/avatar/voices")).json()).selected;
  expect((await request.patch("/api/avatar/voices", { data: { language: "it", speakingRate: 1.01 } })).status()).toBe(200);
  const rateOnly = await (await request.get("/api/avatar/voices")).json();
  expect(rateOnly.selected).toEqual(before);
  expect(rateOnly.speakingRate).toBe(1.01);
  expect((await request.patch("/api/avatar/voices", { data: { language: "it" } })).status()).toBe(400);
  expect((await request.patch("/api/avatar/voices", { data: { language: "it", voiceId: "Gianni", speakingRate: 1 }, headers: { origin: "https://attacker.example" } })).status()).toBe(403);
});

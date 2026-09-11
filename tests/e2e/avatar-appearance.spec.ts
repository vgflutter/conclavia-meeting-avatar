import { expect, test } from "@playwright/test";
import { installVoiceProbe } from "./voice-probe";

test("appearance: female preview, persistence, independent voices and animated speech", async ({ page, request }, testInfo) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  const { profile } = await (await request.get("/api/avatar")).json();
  const body = { displayName: profile.displayName, role: profile.role,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate };
  await installVoiceProbe(page);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  try {
    await page.goto("/avatar");
    await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
    const avatar = page.locator('svg[data-appearance="business_clay_female"]');
    await expect(avatar).toBeVisible();
    await expect(page.getByTestId("female-hair")).toBeVisible();
    await expect(page.getByTestId("female-blouse")).toBeVisible();
    expect((await (await request.get("/api/avatar")).json()).profile.appearance).toBe(profile.appearance);
    await page.getByRole("button", { name: "Save avatar", exact: true }).click();
    await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Avatar appearance")).toHaveValue("business_clay_female");
    const saved = (await (await request.get("/api/avatar")).json()).profile;
    expect(saved.voice).toEqual(profile.voice);
    expect(saved.displayName).toBe(profile.displayName);
    expect((await request.patch("/api/avatar", { data: { ...body, appearance: "invalid" } })).status()).toBe(400);
    // An older client that omits appearance must not revert the chosen variant.
    expect((await request.patch("/api/avatar", { data: body })).status()).toBe(200);
    expect((await (await request.get("/api/avatar")).json()).profile.appearance).toBe("business_clay_female");
    await page.goto("/avatar/test");
    await expect(page.locator('svg[data-appearance="business_clay_female"]')).toBeVisible();
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(page.locator('svg[data-gesture="hand_raise"]')).toBeVisible();
    await page.getByRole("button", { name: "Change expression" }).click();
    await page.screenshot({ path: testInfo.outputPath("female-avatar-en.png"), fullPage: true });
    await page.getByRole("button", { name: "Listen to voice" }).click();
    await expect(page.locator('svg[data-appearance="business_clay_female"][data-viseme="a"]')).toBeVisible();
    await page.getByRole("button", { name: "Stop voice" }).click();
    await expect(page.locator('svg[data-appearance="business_clay_female"]')).toHaveAttribute("data-viseme", "rest");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await request.patch("/api/avatar", { data: { ...body, appearance: profile.appearance } });
  }
});

test("appearance: meeting output follows saved changes without replacing the participant", async ({ page, request }) => {
  const { profile } = await (await request.get("/api/avatar")).json();
  const body = { displayName: profile.displayName, role: profile.role,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate };
  const created = await request.post("/api/meetings", { data: {
    title: "E2E appearance " + crypto.randomUUID(), objective: "Appearance only",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/appearance-test",
    scheduledStart: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "en", autoJoin: false, correctionPolicy: "important_only", agenda: [],
  } });
  expect(created.status()).toBe(201);
  const { meeting } = await created.json();
  try {
    await page.goto("/meeting-room/" + meeting.bot.outputToken);
    for (const appearance of ["business_clay_female", "business_clay"]) {
      expect((await request.patch("/api/avatar", { data: { ...body, appearance } })).status()).toBe(200);
      await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-appearance", appearance);
      const state = await (await request.get("/api/meeting-room/" + meeting.bot.outputToken + "/state?after=")).json();
      expect(state.appearance).toBe(appearance);
    }
  } finally {
    await page.goto("about:blank");
    await request.delete("/api/meetings/" + meeting.id);
    await request.patch("/api/avatar", { data: { ...body, appearance: profile.appearance } });
  }
});

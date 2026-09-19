import { expect, test } from "@playwright/test";
import { installVoiceProbe } from "./voice-probe";
import { createRiggedAvatar } from "../../src/lib/rigged-avatar";
import { loadGeometryOnlyAvatar } from "./rigged-avatar-fixture";

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
});

test("styles: 2D/3D and male/female preview without writes; real WebGL and PCM speech", async ({ page, request }, info) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  await installVoiceProbe(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/avatar/test");
  for (const appearance of ["business_clay", "business_clay_female"]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const voices = await page.getByTestId("preview-voices").innerText();
    for (const style of ["editorial", "stylized_3d"]) {
      await page.getByLabel("Avatar style", { exact: true }).selectOption(style);
      if (style === "editorial") {
        await expect(page.locator('svg[data-appearance]')).toHaveAttribute("data-appearance", appearance);
        await page.getByRole("button", { name: "Raise / lower hand" }).click();
        await expect(page.locator('svg[data-design="editorial-comic"]')).toHaveAttribute("data-hand-progress", "1.0000");
        await expect(page.getByTestId("editorial-articulated-arm")).toBeVisible();
      } else {
        const canvas = page.getByTestId("avatar-3d-canvas");
        await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
        await expect(canvas.locator("canvas")).toBeVisible();
        await expect(canvas).toHaveAttribute("data-hand-raised", "true");
        await page.getByRole("button", { name: "Change expression" }).click();
        await page.getByRole("button", { name: "Listen to voice" }).click();
        await expect(canvas).toHaveAttribute("data-rendered-viseme", "a");
        await expect(canvas).toHaveAttribute("data-mouth-open", "true");
        await page.getByRole("button", { name: "Stop voice" }).click();
        await expect(canvas).toHaveAttribute("data-mouth-open", "false");
        await expect(canvas).toHaveAttribute("data-rendered-viseme", "rest");
      }
      await expect(page.getByTestId("preview-voices")).toHaveText(voices);
      await page.locator("[data-avatar-stage]").screenshot({ path: info.outputPath(`${appearance}-${style}-raised.png`) });
    }
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
  }
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
});

test("style save: persists across tabs/reload, legacy clients preserve it, meeting renderer switches in place", async ({ page, request }) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const identity = { displayName: before.displayName, role: before.role, appearance: before.appearance,
    responseStyle: before.personality.responseStyle, attitude: before.personality.attitude,
    voiceStyle: before.voice.style };
  let id: string | undefined;
  try {
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
    await page.getByRole("link", { name: "Identity & behaviour", exact: true }).click();
    await expect(page.getByLabel("Avatar style", { exact: true })).toHaveValue("stylized_3d");
    await page.getByRole("button", { name: "Save avatar", exact: true }).click();
    await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
    const saved = (await (await request.get("/api/avatar")).json()).profile;
    await page.reload();
    await expect(page.getByTestId("avatar-3d-canvas")).toHaveAttribute("data-renderer-ready", "true");
    for (const visualStyle of [null, "unknown", {}, []]) {
      expect((await request.patch("/api/avatar", { data: { ...identity, visualStyle } })).status()).toBe(400);
    }
    expect((await request.patch("/api/avatar", { data: identity })).status()).toBe(200);
    const legacy = (await (await request.get("/api/avatar")).json()).profile;
    expect(legacy.visualStyle).toBe("stylized_3d");
    expect(legacy.voice).toEqual(saved.voice);
    const created = await request.post("/api/meetings", { data: {
      title: "E2E visual style", objective: "Renderer only", meetingUrl: "https://teams.microsoft.com/l/meetup-join/style-test",
      scheduledStart: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 30,
      timezone: "Europe/Rome", language: "en", autoJoin: false, correctionPolicy: "important_only", agenda: [],
    } });
    expect(created.status()).toBe(201);
    const { meeting } = await created.json(); id = meeting.id;
    await page.goto("/meeting-room/" + meeting.bot.outputToken);
    await expect(page.getByTestId("avatar-3d-canvas")).toHaveAttribute("data-renderer-ready", "true");
    const state = await (await request.get(`/api/meeting-room/${meeting.bot.outputToken}/state?after=`)).json();
    expect(state.visualStyle).toBe("stylized_3d");
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: "editorial" } });
    await expect(page.locator('svg[data-design="editorial-comic"]')).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect((await (await request.get("/api/meetings/" + id)).json()).meeting.bot.outputToken).toBe(meeting.bot.outputToken);
  } finally {
    await page.goto("about:blank");
    if (id) await request.delete("/api/meetings/" + id);
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: before.visualStyle || "editorial",
      inworldVoiceIdIt: before.voice.inworldVoiceIdIt, inworldVoiceIdEn: before.voice.inworldVoiceIdEn } });
  }
});

test("an identity-only save preserves a style selected in another tab", async ({ page, request }) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const identity = { displayName: before.displayName, role: before.role, appearance: before.appearance,
    responseStyle: before.personality.responseStyle, attitude: before.personality.attitude, voiceStyle: before.voice.style };
  try {
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: "editorial" } });
    await page.goto("/avatar");
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: "stylized_3d" } });
    await page.getByLabel("Displayed role").fill("Updated role");
    await page.getByRole("button", { name: "Save avatar", exact: true }).click();
    await expect(page.getByText("Avatar updated.", { exact: true })).toBeVisible();
    expect((await (await request.get("/api/avatar")).json()).profile.visualStyle).toBe("stylized_3d");
  } finally {
    await page.goto("about:blank");
    await request.patch("/api/avatar", { data: { ...identity, visualStyle: before.visualStyle || "editorial" } });
  }
});

test("3D mobile and context loss: fitted canvas, attached hand, explicit fallback", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
  const canvas = page.getByTestId("avatar-3d-canvas");
  await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
  await page.getByRole("button", { name: "Raise / lower hand" }).click();
  await expect(canvas).toHaveAttribute("data-hand-raised", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("3d-mobile.png"), fullPage: true });
  await canvas.locator("canvas").evaluate(node => {
    (node as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator('[data-renderer="fallback-2d"]')).toBeVisible();
  await expect(page.locator('svg[data-gesture="hand_raise"]')).toBeVisible();
});

test("3D rig: both actual GLBs support all 128 poses with one attached skinned arm", async () => {
  for (const female of [false, true]) {
    const rig = createRiggedAvatar(await loadGeometryOnlyAvatar(female));
    const shoulder = rig.bones.get("LeftArm")!;
    const elbow = rig.bones.get("LeftForeArm")!;
    expect(elbow.parent).toBe(shoulder);
    const anchor = shoulder.position.toArray();
    for (const mood of ["neutral", "friendly", "focused", "confident"] as const)
      for (const gesture of ["rest", "hand_raise"] as const)
        for (const viseme of ["rest", "mbp", "fv", "a", "e", "o", "u", "consonant"] as const) {
          const result = rig.update({ mood, gesture, viseme, voiceLevel: .8 }, 1, .016, true);
          expect(result.raise).toBe(gesture === "hand_raise" ? 1 : 0);
          expect(result.mouthOpen).toBe(viseme !== "rest" && viseme !== "mbp");
          shoulder.position.toArray().forEach((value, i) => expect(value).toBeCloseTo(anchor[i], 5));
          expect(elbow.parent).toBe(shoulder);
        }
    expect(rig.update({ mood: "neutral", gesture: "rest", viseme: "a", voiceLevel: 0 }, 1, .016, false).mouthOpen).toBe(false);
    rig.dispose();
  }
});

test("3D failure: visible 2D fallback without changing the selected style", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === "webgl2" || kind === "webgl") return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("stylized_3d");
  await expect(page.locator('[data-renderer="fallback-2d"]')).toBeVisible();
  await expect(page.locator('svg[data-appearance]')).toBeVisible();
  await expect(page.getByLabel("Avatar style", { exact: true })).toHaveValue("stylized_3d");
  await expect(page.getByText("3D non disponibile / unavailable · 2D", { exact: true })).toBeVisible();
});

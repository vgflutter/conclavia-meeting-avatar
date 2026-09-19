import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Locator } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { meetingDocumentData } from "../../src/lib/meeting-factory";
import { MeetingModel } from "../../src/models/Meeting";
import { MeetingSeriesModel } from "../../src/models/MeetingSeries";
import type { MeetingResponse, MeetingSummary } from "../../src/types/meeting";

test("capture current README screens with isolated demonstration data", async ({ page, request }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_docs_/);
  expect(process.env.MEETING_BOT_PROVIDER).toBe("preview");
  expect(process.env.MEETING_AI_ENABLED).toBe("false");
  expect(process.env.INWORLD_API_KEY).toBe("");
  loadEnvConfig(process.cwd());
  await connectToDatabase();
  const owned: string[] = [];
  const seriesIds: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Never follow an external meeting link or request paid speech in this capture.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname !== "127.0.0.1" || url.pathname.endsWith("/speech") ? route.abort() : route.continue();
  });
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const at = (days: number) => {
    const date = new Date(); date.setDate(date.getDate() + days); date.setHours(10, 0, 0, 0); return date.toISOString();
  };
  const input = (title: string, days = 1) => ({
    title, objective: "Agree the Aurora pilot scope, owners and next steps.",
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/readme-demo-${randomUUID()}`,
    scheduledStart: at(days), durationMinutes: 45, timezone: "Europe/Rome", language: "en" as const,
    autoJoin: false, correctionPolicy: "important_only" as const,
    agenda: [{ title: "Pilot scope and success criteria", mandatory: true }, { title: "Owners and next steps", mandatory: true }],
  });
  const { profile } = await (await request.get("/api/avatar")).json();
  const originalContext = await (await request.get("/api/context")).json();
  const profileInput = {
    displayName: profile.displayName, role: profile.role, appearance: profile.appearance, visualStyle: profile.visualStyle,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate,
    inworldVoiceIdIt: profile.voice.inworldVoiceIdIt, inworldVoiceIdEn: profile.voice.inworldVoiceIdEn,
  };
  async function capture(name: string, target?: Locator) {
    await page.evaluate(() => document.fonts.ready);
    if (!target) {
      // Form fills can scroll the page; reset before capturing a sticky header.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const options = { path: resolve("docs/images", name), animations: "disabled" as const, caret: "hide" as const,
      style: "nextjs-portal { display: none !important; }", scale: "css" as const };
    if (target) await target.screenshot(options);
    else await page.screenshot({ ...options, fullPage: true });
  }
  try {
    expect((await request.patch("/api/avatar", { data: { ...profileInput, displayName: "Riccardo", role: "Digital colleague",
      appearance: "business_clay", visualStyle: "editorial", inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis", speakingRate: 1 } })).ok()).toBe(true);
    const general = "Aurora is a fictional customer onboarding product.\nMVP means the first version customers can use.\nKeep answers brief; distinguish proposals from confirmed decisions.\nDo not infer an approved budget from planning notes.";
    expect((await request.patch("/api/context", { data: { context: general, version: originalContext.version } })).ok()).toBe(true);
    const seriesResponse = await request.post("/api/meeting-series", { data: {
      ...input("Aurora · Customer pilot"), context: "Pilot for the Italian market. Success means onboarding three demo teams.\nTrack scope, owners and feedback across appointments.",
      appointments: [
        { ...input("Kickoff", -2), label: "Kickoff" },
        { ...input("Pilot review", 1), label: "Pilot review" },
        { ...input("Next steps", 4), label: "Next steps" },
      ],
    } });
    expect(seriesResponse.status()).toBe(201);
    const seriesData = await seriesResponse.json();
    seriesIds.push(seriesData.series.id);
    const meetings = seriesData.meetings as MeetingResponse[];
    owned.push(...meetings.map(meeting => meeting.id));
    const summary: MeetingSummary = {
      overview: "The team agreed a three-team pilot. Elena will prepare the onboarding checklist; Marco will gather feedback before the next review.",
      rememberedFacts: ["The pilot covers three demonstration teams."],
      decisions: ["Start with onboarding and feedback collection; defer advanced reporting."],
      actionItems: [{ owner: "Elena", description: "Prepare the onboarding checklist", dueAt: new Date(at(1)), completed: false }],
      openQuestions: ["Which feedback questions should be prioritised?"], participantNotes: [],
    };
    await MeetingModel.updateOne({ _id: meetings[0].id }, { $set: {
      status: "completed", summary, "bot.status": "left", "bot.leftAt": new Date(at(-2)),
    } }, { runValidators: true });
    const next = meetings[1];
    await MeetingModel.updateOne({ _id: next.id }, { $set: {
      context: "Focus on onboarding feedback in this appointment.\nConfirm the checklist owner before discussing reporting.",
    } });
    const standalone = await MeetingModel.create(meetingDocumentData(input("Design review · First-time experience", 2), { assistantName: "Riccardo" }));
    owned.push(String(standalone._id));

    await page.goto("/meetings");
    await expect(page.getByRole("heading", { name: "Meetings", exact: true })).toBeVisible();
    await capture("meetings.png");
    await page.goto("/meetings/new");
    await page.getByLabel("Microsoft Teams link").fill("https://teams.microsoft.com/l/meetup-join/readme-demo");
    await page.getByLabel("Meeting title", { exact: true }).fill("Aurora · Pilot review");
    await page.getByLabel("Meeting objective").fill("Review onboarding feedback and agree the next iteration.");
    await page.getByLabel("Language", { exact: true }).selectOption("en");
    await page.getByLabel("Date and time").fill(`${at(1).slice(0, 10)}T10:00`);
    await capture("new-meeting.png");

    await page.goto(`/meetings/series/${seriesData.series.id}`);
    await expect(page.getByRole("heading", { name: "Aurora · Customer pilot", exact: true })).toBeVisible();
    await capture("meeting-series.png");
    await page.goto("/memory");
    await expect(page.getByText(summary.overview, { exact: true })).toBeVisible();
    await capture("memory.png");

    await page.goto("/avatar");
    await expect(page.getByLabel("Name and call phrase")).toHaveValue("Riccardo");
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-appearance", "business_clay");
    await capture("avatar-settings-en.png");
    await page.goto("/avatar/test");
    await expect(page.getByTestId("voice-provider")).toContainText("Inworld");
    await expect(page.getByLabel("Voice", { exact: true })).toHaveValue("Dennis");
    await capture("avatar-studio-en.png");
    expect((await request.patch("/api/avatar", { data: { ...profileInput, displayName: "Nora", role: "Digital colleague",
      appearance: "business_clay_female", visualStyle: "editorial", inworldVoiceIdIt: "Orietta", inworldVoiceIdEn: "Eleanor", speakingRate: 1 } })).ok()).toBe(true);
    await page.reload();
    await page.getByLabel("Language", { exact: true }).selectOption("it");
    await expect(page.getByLabel("Voice", { exact: true })).toHaveValue("Orietta");
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-gesture", "hand_raise");
    await expect(page.locator("svg[data-appearance]")).toHaveAttribute("data-hand-progress", "1.0000");
    await capture("avatar-studio-female-en.png");
    // Keep the named-turn example consistent with the meetings created as Riccardo.
    expect((await request.patch("/api/avatar", { data: { ...profileInput, displayName: "Riccardo", role: "Digital colleague",
      appearance: "business_clay", visualStyle: "editorial", inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis", speakingRate: 1 } })).ok()).toBe(true);

    await page.goto("/context");
    await expect(page.getByLabel("General context", { exact: true })).toHaveValue(general);
    await capture("assistant-context-en.png");
    await page.goto(`/meetings/${next.id}`);
    const meetingContext = page.getByTestId("meeting-context");
    await meetingContext.locator("summary").first().click();
    await meetingContext.getByText("Already included context", { exact: true }).click();
    await expect(meetingContext.getByLabel("Notes for this meeting")).toHaveValue(/Focus on onboarding/);
    await capture("meeting-context-en.png", meetingContext);

    // This screenshot documents an injected caption example, not a recorded Teams conversation.
    await MeetingModel.updateOne({ _id: next.id }, { $set: {
      transcript: [
        { sequence: 1, speakerName: "Elena · Demo", text: "Secondo me tre per tre fa 12.", source: "participant", createdAt: new Date(Date.now() - 8000) },
        { sequence: 2, speakerName: "Elena · Demo", text: "Ehi Riccardo, dimmi.", source: "participant", createdAt: new Date(Date.now() - 3000) },
      ],
      commandHistory: [{ id: randomUUID(), kind: "correct", prompt: "Secondo me tre per tre fa 12.", response: "Sì, 3 per 3 fa 9, non 12.", createdAt: new Date(Date.now() - 2000) }],
    } });
    await page.reload();
    await page.getByRole("switch", { name: "Debug mode" }).click();
    await expect(page.getByRole("log").getByText("Sì, 3 per 3 fa 9, non 12.", { exact: true })).toBeVisible();
    await capture("meeting-debug-en.png", page.locator("section").filter({ has: page.getByRole("switch", { name: "Debug mode" }) }));
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    for (const id of owned) await MeetingModel.deleteOne({ _id: id });
    for (const id of seriesIds) await MeetingSeriesModel.deleteOne({ _id: id });
    expect((await request.patch("/api/avatar", { data: profileInput })).ok()).toBe(true);
    const context = await (await request.get("/api/context")).json();
    expect((await request.patch("/api/context", { data: { context: originalContext.context, version: context.version } })).ok()).toBe(true);
  }
});

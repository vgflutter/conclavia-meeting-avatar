import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { defaultPodcast } from "../../src/components/podcast/podcast-defaults";
import { createInitialDiscussionState } from "../../src/lib/podcast/talk-director";
import type { TalkResponse } from "../../src/types/podcast";
import type { TalkRunMessageResponse, TalkRunResponse, TalkRunSentencePerformance } from "../../src/types/podcast-run";

const origin = "http://127.0.0.1:3101";
const talkId = "c".repeat(24), runId = "d".repeat(24);
const sentences: TalkRunSentencePerformance[] = [
  { text: "Quale scelta vorresti tenere nelle mani delle persone?", mood: "curiosity", intensity: .8, listenerMood: "attention", listenerIntensity: .4 },
  { text: "Qui non concordo: il giudizio umano resta una responsabilità concreta.", mood: "disagreement", intensity: .85, listenerMood: "empathy", listenerIntensity: .55 },
];
const guestText = "La mia esperienza è diversa: decido io quali compiti delegare.";

test.beforeAll(() => {
  if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27018" || !process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_") ||
      process.env.PODCAST_AI_ENABLED !== "false" || process.env.PODCAST_SPEECH_ENABLED !== "false") {
    throw new Error("Studio acting acceptance requires isolated MongoDB and disabled paid features");
  }
});

/** All podcast data and PCM are in-process fixtures. No provider or persistent write is permitted. */
async function installStudioFixture(context: BrowserContext, laterHuman = false) {
  const initial = defaultPodcast();
  const talk: TalkResponse = { ...initial, id: talkId, title: "Regia e mood senza provider", settings: { ...initial.settings, studioTheme: "anime", studioLayout: "lounge", voiceProvider: "kokoro" }, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
  const ai: TalkRunMessageResponse = { sequence: 1, speakerType: "participant", participantIndex: 0, speakerName: talk.participants[0].name,
    intent: "question", threadLabel: "Una scelta umana", arcPhase: "positions", preparationMode: "reactive", referenceStyle: "idea_first",
    wordCount: 22, estimatedAirtimeSeconds: 4, origin: "ai", provider: "openai", model: "openai-default", content: sentences.map(sentence => sentence.text).join(" "),
    performance: { version: 1, source: "ai", sentences }, createdAt: new Date(1000).toISOString() };
  const human: TalkRunMessageResponse = { sequence: 2, speakerType: "participant", participantIndex: 2, speakerName: talk.participants[2].name,
    intent: "answer", threadLabel: ai.threadLabel, arcPhase: "positions", preparationMode: "reactive", referenceStyle: "idea_first",
    wordCount: 12, estimatedAirtimeSeconds: 3, origin: "human", content: guestText, createdAt: new Date(2000).toISOString() };
  const run: TalkRunResponse = { id: runId, talkId, status: "idle", phase: "discussion", participantTurnCount: laterHuman ? 2 : 1, maxTurns: 8,
    targetDurationMinutes: 2, estimatedAirtimeSeconds: 7, nextParticipantIndex: 1, hasPreparedTurn: false,
    discussionState: createInitialDiscussionState(talk), talkSnapshot: talk, messages: laterHuman ? [ai, human] : [ai],
    startedAt: new Date(0).toISOString(), createdAt: new Date(0).toISOString(), updatedAt: new Date(2000).toISOString() };
  const duration = 3.2;
  const bytes = Buffer.alloc(24_000 * duration * 2);
  for (let index = 0; index < bytes.length / 2; index++) bytes.writeInt16LE(Math.round(6000 * Math.sin(index * Math.PI / 30)), index * 2);
  const pcm = JSON.stringify({ audio: bytes.toString("base64"), phones: [{ start: 0, end: duration, viseme: "a" }],
    cues: [{ index: 0, start: 0, end: duration / 2 }, { index: 1, start: duration / 2, end: duration }] }) + '\n{"done":true}\n';
  const calls = { speech: [] as number[], unexpected: [] as string[] };
  await context.addCookies([{ name: "conclavia_locale", value: "it", url: origin }]);
  await context.route("**/api/podcast/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      if (path === "/api/podcast/config") return route.fulfill({ json: {
        ai: { enabled: true, ready: true, providers: { openai: true, gemini: false } },
        speech: { enabled: true, ready: true, providers: { kokoro: true, inworld: false } },
      } });
      if (path === "/api/podcast/talks") return route.fulfill({ json: { talks: [talk] } });
      if (path === `/api/podcast/talks/${talkId}`) return route.fulfill({ json: { talk } });
      if (path === `/api/podcast/talks/${talkId}/runs`) return route.fulfill({ json: { run, runs: [run] } });
      if (path === `/api/podcast/runs/${runId}`) return route.fulfill({ json: { run } });
    }
    if (request.method() === "POST" && path === `/api/podcast/runs/${runId}/speech`) {
      expect(request.postDataJSON()).toEqual({ sequence: 1 });
      calls.speech.push(1);
      return route.fulfill({ contentType: "application/x-ndjson", body: pcm });
    }
    calls.unexpected.push(`${request.method()} ${path}`);
    return route.abort("blockedbyclient");
  });
  return calls;
}

const studioCanvas = (page: Page) => page.getByTestId("podcast-stage").locator("canvas[data-podcast-stage]");

test("studio preserves the final sentence mood after actual PCM ends and a manual strength change takes control", async ({ page, context }) => {
  const calls = await installStudioFixture(context);
  await page.goto(`/podcast/${talkId}/studio`);
  const stage = studioCanvas(page), play = page.getByTestId("podcast-voice-play");
  await expect(stage).toHaveAttribute("data-podcast-layout", "lounge");
  await expect(play).toBeEnabled();
  expect(calls.speech).toEqual([]);
  await play.click();
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:0");
  await expect(stage).toHaveAttribute("data-podcast-moods", "curiosity,attention");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "true,false");
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:1");
  await expect(stage).toHaveAttribute("data-podcast-moods", "disagreement,empathy");
  await expect(play).toContainText("Ascolta ultimo intervento AI");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
  await expect(stage).toHaveAttribute("data-podcast-visemes", "rest,rest");
  await expect(stage).toHaveAttribute("data-podcast-phase", "settle");
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:1");
  await page.waitForTimeout(350);
  await expect(stage).toHaveAttribute("data-podcast-moods", "disagreement,empathy");
  await play.click();
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:0");
  await page.getByTestId("podcast-intensity-0").fill("20");
  await expect(page.getByRole("checkbox", { name: "Regia automatica", exact: true })).not.toBeChecked();
  await expect(stage).toHaveAttribute("data-podcast-intensities", /^0\.2,/u);
  await expect(stage).not.toHaveAttribute("data-podcast-cue");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "true,false");
  await play.click();
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
  expect(calls.speech).toEqual([1, 1]);
  expect(calls.unexpected).toEqual([]);
});

test("direct broadcast restores the saved scene, follows the spoken AI sentence over newer human text, and clears acting when the control room leaves", async ({ page: output, context }) => {
  const calls = await installStudioFixture(context, true);
  await output.goto(`/podcast/${talkId}/broadcast`);
  expect(await output.evaluate(id => localStorage.getItem(`conclavia-podcast-direction-${id}`), talkId)).toBeNull();
  const stage = output.locator("canvas[data-podcast-stage]");
  await expect(stage).toHaveAttribute("data-podcast-layout", "lounge");
  await expect(stage).toHaveAttribute("data-podcast-guest", "true");
  await expect(output.getByText(guestText, { exact: true })).toBeVisible();
  const studio = await context.newPage();
  try {
    await studio.goto(`/podcast/${talkId}/studio`);
    await expect(studio.getByTestId("podcast-human-text")).toHaveText(guestText);
    await expect(studio.getByTestId("podcast-human-text").getByTestId("podcast-performance-sentence")).toHaveCount(0);
    await expect(studio.getByTestId("podcast-voice-play")).toBeEnabled();
    expect(calls.speech).toEqual([]);
    await studio.getByTestId("podcast-voice-play").click();
    await expect(stage).toHaveAttribute("data-podcast-cue", "1:0");
    await expect(stage).toHaveAttribute("data-podcast-focus", "host-1");
    await expect(stage).toHaveAttribute("data-podcast-moods", "curiosity,attention");
    await expect(output.getByText(sentences[0].text, { exact: true })).toBeVisible();
    await expect(output.getByText(guestText, { exact: true })).toHaveCount(0);
    await expect(stage).toHaveAttribute("data-podcast-cue", "1:1");
    await expect(output.getByText(sentences[1].text, { exact: true })).toBeVisible();
    await studio.getByRole("link", { name: /Tutti i podcast/u }).click();
    await expect(studio).toHaveURL(/\/podcast$/u);
    await expect(stage).not.toHaveAttribute("data-podcast-cue");
    await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
    expect(calls.speech).toEqual([1]);
    expect(calls.unexpected).toEqual([]);
  } finally { await studio.close(); }
});

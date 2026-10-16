import { expect, test, type Page } from "@playwright/test";
import { defaultPodcast } from "../../src/components/podcast/podcast-defaults";
import { createInitialDiscussionState } from "../../src/lib/podcast/talk-director";
import type { TalkInput, TalkResponse } from "../../src/types/podcast";
import type { TalkRunMessageResponse, TalkRunResponse } from "../../src/types/podcast-run";

const talkId = "a".repeat(24);
const runId = "b".repeat(24);

async function installRehearsalFixture(page: Page, options: { completeAt?: number; truncated?: boolean; audioSeconds?: number } = {}) {
  const defaults = defaultPodcast();
  let talk: TalkResponse = { ...defaults, id: talkId, title: "Prova breve senza provider", participants: defaults.participants.slice(0, 2),
    settings: { ...defaults.settings, maxTurns: 8, targetDurationMinutes: 2 }, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
  let run: TalkRunResponse = { id: runId, talkId, status: "idle", phase: "discussion", participantTurnCount: 0, maxTurns: 8,
    targetDurationMinutes: 2, estimatedAirtimeSeconds: 0, nextParticipantIndex: 0, hasPreparedTurn: false,
    discussionState: createInitialDiscussionState(talk), talkSnapshot: talk, messages: [], startedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
  const calls = { prepare: 0, runs: 0, next: 0, speech: [] as number[], stop: 0 };
  const bytes = Buffer.alloc(Math.floor(24_000 * (options.audioSeconds ?? 0.65)) * 2);
  for (let i = 0; i < bytes.length / 2; i++) bytes.writeInt16LE(Math.round(6000 * Math.sin(i * Math.PI / 30)), i * 2);
  const audio = JSON.stringify({ audio: bytes.toString("base64"), phones: [{ start: 0, end: options.audioSeconds ?? 0.65, viseme: "a" }] }) + "\n";
  const pcm = audio + (options.truncated ? "" : '{"done":true}\n');
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.addInitScript(() => {
    const events = { nextAt: [] as number[], audio: [] as Array<{ startedAt: number; endedAt: number | null }> };
    Object.assign(window, { rehearsalAudioFixture: events });
    const fetcher = window.fetch.bind(window);
    window.fetch = (...args) => {
      if (/\/api\/podcast\/runs\/[^/]+\/next$/u.test(String(args[0]))) events.nextAt.push(performance.now());
      return fetcher(...args);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const event = { startedAt: performance.now(), endedAt: null as number | null };
      events.audio.push(event);
      this.addEventListener("ended", () => { event.endedAt = performance.now(); }, { once: true });
      return start.apply(this, args);
    };
  });
  await page.route("**/api/podcast/config", route => route.fulfill({ json: {
    ai: { enabled: true, ready: true, providers: { openai: true, gemini: false } },
    speech: { enabled: true, ready: true, model: "kokoro", provider: "kokoro", providers: { kokoro: true, inworld: true } },
  } }));
  await page.route("**/api/podcast/talks", route => {
    expect(route.request().method()).toBe("POST"); calls.prepare++;
    const submitted = route.request().postDataJSON() as TalkInput;
    expect(submitted.participants).toHaveLength(2);
    expect(submitted.participants.every(person => person.kind === "ai")).toBe(true);
    expect(submitted.settings.voiceProvider).toBe("kokoro");
    expect(submitted.participants.map(person => person.voiceId)).toEqual(["im_nicola", "if_sara"]);
    talk = { ...talk, ...submitted };
    run = { ...run, talkSnapshot: talk };
    return route.fulfill({ status: 201, json: { talk } });
  });
  await page.route(`**/api/podcast/talks/${talkId}/runs`, route => {
    calls.runs++;
    return route.fulfill({ status: 201, json: { run } });
  });
  await page.route(`**/api/podcast/runs/${runId}`, route => route.fulfill({ json: { run } }));
  await page.route(`**/api/podcast/runs/${runId}/next`, route => {
    calls.next++;
    const sequence = calls.next;
    const participantIndex = (sequence - 1) % 2;
    const message: TalkRunMessageResponse = { sequence, participantIndex, speakerType: "participant", speakerName: talk.participants[participantIndex].name,
      intent: sequence === 1 ? "question" : "reply", threadLabel: "Prova", arcPhase: "positions", preparationMode: "reactive", referenceStyle: "idea_first",
      wordCount: 12, estimatedAirtimeSeconds: 1, origin: "ai", provider: "openai", model: "openai-default",
      content: `Intervento sintetico ${sequence}: una domanda e una risposta per verificare i tempi.`, createdAt: new Date(sequence * 1000).toISOString() };
    run = { ...run, status: sequence === options.completeAt ? "completed" : "idle", messages: [...run.messages, message],
      participantTurnCount: sequence, nextParticipantIndex: (participantIndex + 1) % 2 };
    return route.fulfill({ json: { run } });
  });
  await page.route(`**/api/podcast/runs/${runId}/speech`, route => {
    const body = route.request().postDataJSON() as { sequence: number };
    calls.speech.push(body.sequence);
    expect(Object.keys(body)).toEqual(["sequence"]);
    return route.fulfill({ contentType: "application/x-ndjson", body: pcm });
  });
  await page.route(`**/api/podcast/runs/${runId}/stop`, route => {
    calls.stop++; run = { ...run, status: "completed" };
    return route.fulfill({ json: { run } });
  });
  return calls;
}

const audioEvents = (page: Page) => page.evaluate(() => (window as unknown as {
  rehearsalAudioFixture: { nextAt: number[]; audio: Array<{ startedAt: number; endedAt: number | null }> };
}).rehearsalAudioFixture);

test("short rehearsal has no paid actions on load and never overlaps voices across at most eight turns", async ({ page }) => {
  const calls = await installRehearsalFixture(page);
  await page.goto("/podcast/rehearsal");
  await expect(page.getByTestId("rehearsal-prepare")).toBeEnabled();
  expect(calls).toEqual({ prepare: 0, runs: 0, next: 0, speech: [], stop: 0 });
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  expect(calls.next).toBe(0);
  expect(calls.speech).toEqual([]);
  await page.getByTestId("rehearsal-start").click();
  await expect.poll(() => calls.speech.length, { timeout: 25_000 }).toBe(8);
  await expect.poll(async () => (await audioEvents(page)).audio.filter(event => event.endedAt !== null).length, { timeout: 10_000 }).toBe(8);
  await page.waitForTimeout(600);
  expect(calls.next).toBe(8);
  expect(calls.speech).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  const observed = await audioEvents(page);
  for (let i = 1; i < observed.audio.length; i++) {
    expect(observed.audio[i - 1].endedAt).not.toBeNull();
    expect(observed.audio[i].startedAt - observed.audio[i - 1].endedAt!).toBeGreaterThanOrEqual(490);
    // A next turn may be prepared during speech, after its first audible frame.
    expect(observed.nextAt[i]).toBeGreaterThanOrEqual(observed.audio[i - 1].startedAt);
  }
});

test("the last completed AI turn is voiced before rehearsal finishes", async ({ page }) => {
  const calls = await installRehearsalFixture(page, { completeAt: 2 });
  await page.goto("/podcast/rehearsal");
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  await page.getByTestId("rehearsal-start").click();
  await expect.poll(() => calls.speech.length).toBe(2);
  await expect.poll(async () => (await audioEvents(page)).audio.filter(event => event.endedAt !== null).length).toBe(2);
  await page.waitForTimeout(650);
  expect(calls.next).toBe(2);
  expect(calls.speech).toEqual([1, 2]);
});

test("stop cancels current audio and does not continue its permitted one-turn lookahead", async ({ page }) => {
  const calls = await installRehearsalFixture(page, { audioSeconds: 2 });
  await page.goto("/podcast/rehearsal");
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  await page.getByTestId("rehearsal-start").click();
  await expect.poll(async () => (await audioEvents(page)).audio.length).toBe(1);
  await page.getByTestId("rehearsal-stop").click();
  await expect(page.getByTestId("rehearsal-phase")).toHaveAttribute("data-phase", "stopped");
  const requestedBeforeStopSettled = calls.next;
  await expect.poll(async () => (await audioEvents(page)).audio[0]?.endedAt).not.toBeNull();
  await page.waitForTimeout(800);
  expect(calls.next).toBe(requestedBeforeStopSettled);
  expect(calls.next).toBeLessThanOrEqual(2);
  expect(calls.speech.length).toBeLessThanOrEqual(2);
  expect((await audioEvents(page)).audio).toHaveLength(1);
});

test("a truncated voice stream stops the rehearsal instead of advancing silently", async ({ page }) => {
  const calls = await installRehearsalFixture(page, { truncated: true });
  await page.goto("/podcast/rehearsal");
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  await page.getByTestId("rehearsal-start").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.waitForTimeout(800);
  expect(calls.next).toBe(1);
  expect(calls.speech).toEqual([1]);
});

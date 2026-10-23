import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { defaultPodcast } from "../../src/components/podcast/podcast-defaults";
import { createInitialDiscussionState } from "../../src/lib/podcast/talk-director";
import type { TalkInput, TalkResponse } from "../../src/types/podcast";
import type { TalkRunMessageResponse, TalkRunResponse } from "../../src/types/podcast-run";

const talkId = "a".repeat(24);
const runId = "b".repeat(24);

async function installRehearsalFixture(page: Page, options: { completeAt?: number; truncated?: boolean; audioSeconds?: number; heated?: boolean; topics?: string[] } = {}) {
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
  const duration = options.audioSeconds ?? 0.65;
  const audio = JSON.stringify({ audio: bytes.toString("base64"), phones: [{ start: 0, end: duration, viseme: "a" }],
    cues: [{ index: 0, start: 0, end: duration / 2 }, { index: 1, start: duration / 2, end: duration }] }) + "\n";
  const pcm = audio + (options.truncated ? "" : '{"done":true}\n');
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.addInitScript(() => {
    const events = { nextAt: [] as number[], audio: [] as Array<{ startedAt: number; endedAt: number | null; startTime:number; endTime:number }> };
    Object.assign(window, { rehearsalAudioFixture: events });
    const fetcher = window.fetch.bind(window);
    window.fetch = (...args) => {
      if (/\/api\/podcast\/runs\/[^/]+\/next(?:\/stream)?$/u.test(String(args[0]))) events.nextAt.push(performance.now());
      return fetcher(...args);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const startTime=args[0]??this.context.currentTime;
      const event = { startedAt: performance.now(), endedAt: null as number | null, startTime, endTime:startTime+(this.buffer?.duration??0) };
      Object.assign(window,{rehearsalAudioContext:this.context});
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
  await page.route(`**/api/podcast/runs/${runId}/next/stream`, route => {
    calls.next++;
    const sequence = calls.next;
    const participantIndex = (sequence - 1) % 2;
    const sentences = [
      { text: `Intervento ${sequence}: che cosa cambia quando deleghiamo una scelta?`, mood: options.heated ? "disagreement" as const : participantIndex === 0 ? "curiosity" as const : "amusement" as const,
        intensity: .78, listenerMood: participantIndex === 0 ? "attention" as const : "curiosity" as const, listenerIntensity: .54 },
      { text: "Capisco il vantaggio, ma vorrei preservare il giudizio umano.", mood: participantIndex === 0 ? "disagreement" as const : "agreement" as const,
        intensity: .72, listenerMood: participantIndex === 0 ? "empathy" as const : "doubt" as const, listenerIntensity: .61 },
    ];
    const message: TalkRunMessageResponse = { sequence, participantIndex, speakerType: "participant", speakerName: talk.participants[participantIndex].name,
      intent: options.heated ? "challenge" : sequence === 1 ? "question" : "reply", threadLabel: options.topics?.[sequence - 1] ?? "Prova", arcPhase: "positions", preparationMode: "reactive", referenceStyle: "idea_first",
      wordCount: 12, estimatedAirtimeSeconds: 1, origin: "ai", provider: "openai", model: "openai-default",
      content: sentences.map(sentence => sentence.text).join(" "), performance: { version: 1, source: "ai", sentences }, createdAt: new Date(sequence * 1000).toISOString() };
    run = { ...run, status: sequence === options.completeAt ? "completed" : "idle", messages: [...run.messages, message],
      participantTurnCount: sequence, nextParticipantIndex: (participantIndex + 1) % 2 };
    return route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ type: "speech_stored", run: { ...run, status: "generating" } })}\n\ndata: ${JSON.stringify({ type: "complete", run })}\n\n` });
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

test("lively heated replies overlap actual audio and animate both faces; Stop releases both voices", async ({ page }, testInfo) => {
  const calls = await installRehearsalFixture(page, { heated: true, audioSeconds: 3.2 });
  await page.goto("/podcast/rehearsal");
  await page.getByTestId("rehearsal-pace").selectOption("lively");
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  const stage = page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]");
  await stage.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled || canvas.dataset.podcastSpeaking !== "true,true" || canvas.dataset.podcastVisemes !== "a,a") return;
      scheduled = true;
      // `ended` belongs to the render thread and may precede the audible
      // tail on a high-latency output device. Probe the scheduled intervals
      // on the actual OUTPUT clock, the same clock that drives the mouths.
      const heardAt = performance.now(),context=(window as unknown as {rehearsalAudioContext:AudioContext}).rehearsalAudioContext;
      const stamp=context.getOutputTimestamp();
      const outputTime=typeof stamp.performanceTime==='number'&&typeof stamp.contextTime==='number'&&stamp.performanceTime>0&&stamp.performanceTime<=heardAt&&heardAt-stamp.performanceTime<1000
        ?Math.max(0,Math.min(context.currentTime,stamp.contextTime+(heardAt-stamp.performanceTime)/1000))
        :Math.max(0,context.currentTime-(context.outputLatency||0)-(context.baseLatency||0));
      const heard = structuredClone((window as unknown as { rehearsalAudioFixture: { audio: Array<{ startedAt: number; endedAt: number | null }> } }).rehearsalAudioFixture.audio);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (canvas.dataset.podcastSpeaking !== "true,true" || canvas.dataset.podcastVisemes !== "a,a") { scheduled = false; return; }
        Object.assign(window, { overlapProbe: { image: canvas.toDataURL("image/png"), moods: canvas.dataset.podcastMoods, focus: canvas.dataset.podcastFocus,
          caption: document.querySelector('[data-testid="rehearsal-caption"]')?.textContent,
          heardAt, outputTime, paintedAt: performance.now(), events: heard } });
        observer.disconnect();
        // Stop in the captured overlap frame; screenshot tooling otherwise outlasts this short handoff.
        (document.querySelector('[data-testid="rehearsal-stop"]') as HTMLButtonElement).click();
      }));
    });
    observer.observe(canvas, { attributes: true });
  });
  await page.getByTestId("rehearsal-start").click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { overlapProbe?: unknown }).overlapProbe)), { timeout: 12_000 }).toBe(true);
  const overlap = await page.evaluate(() => (window as unknown as { overlapProbe: { image: string; moods: string; focus: string; caption: string; outputTime:number; events: Array<{ startedAt: number; endedAt: number | null; startTime:number;endTime:number }> } }).overlapProbe);
  const requestsAtStop = calls.next;
  expect(overlap.moods).toBe("disagreement,disagreement");
  expect(overlap.focus).toBe("all");
  expect(overlap.caption).toContain("Riccardo"); expect(overlap.caption).toContain("Sofia");
  expect(overlap.events.length).toBeGreaterThanOrEqual(2);
  await writeFile(testInfo.outputPath("audible-overlap.json"), JSON.stringify({outputTime:overlap.outputTime,events:overlap.events}, null, 2));
  expect(overlap.events.filter(event => event.startTime<=overlap.outputTime&&overlap.outputTime<event.endTime)).toHaveLength(2);
  await writeFile(testInfo.outputPath("two-voices-overlap.png"), Buffer.from(overlap.image.split(",")[1], "base64"));
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
  await expect.poll(async () => (await audioEvents(page)).audio.every(event => event.endedAt !== null)).toBe(true);
  await page.waitForTimeout(500);
  expect(calls.next).toBe(requestsAtStop);
});

for (const locale of ["it", "en"] as const) {
  test(`personality setup stays simple, optional and separate from voice in ${locale}`, async ({ page }, testInfo) => {
    const calls = await installRehearsalFixture(page);
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: "http://127.0.0.1:3101" }]);
    await page.goto("/podcast/rehearsal");
    const it = locale === "it";
    const host = page.getByTestId("personality-card-0");
    const profile = page.getByTestId("personality-profile-0");
    const advanced = page.getByTestId("personality-advanced-0");
    const description = host.getByLabel(it ? "Descrizione del carattere" : "Personality description", { exact: true });
    const viewpoint = host.getByLabel(it ? "Punto di vista nella puntata" : "Viewpoint for this episode", { exact: true });
    await expect(profile).toHaveValue("curious");
    await expect(page.getByTestId("personality-profile-1")).toHaveValue("analytical");
    await expect(advanced).not.toHaveAttribute("open");
    await expect(host.getByRole("slider")).toHaveCount(0);
    await expect(viewpoint).toBeEmpty();
    await expect(page.getByTestId("rehearsal-prepare")).toBeEnabled();
    for (const id of ["analytical", "playful", "empathetic", "curious"]) {
      await profile.selectOption(id);
      await expect(description).not.toBeEmpty();
      await expect(profile).toHaveValue(id);
      await expect(page.getByTestId("rehearsal-voice-0")).toHaveValue("im_nicola");
      await expect(page.getByTestId("personality-profile-1")).toHaveValue("analytical");
    }
    await description.fill("Ascolta con calma e chiede un esempio prima di formulare un giudizio.");
    await expect(profile).toHaveValue("custom");
    await viewpoint.fill("Voglio capire quando l'AI riduce gli errori.");
    await profile.selectOption("empathetic");
    await expect(viewpoint).toHaveValue("Voglio capire quando l'AI riduce gli errori.");
    await viewpoint.fill("");
    await advanced.locator("summary").click();
    await expect(host.getByRole("slider")).toHaveCount(4);
    await expect(host.getByLabel(it ? "Interpretazione vocale" : "Voice delivery", { exact: true })).toHaveCount(0);
    await host.getByLabel(it ? "Pazienza" : "Patience", { exact: false }).fill("80");
    await expect(profile).toHaveValue("custom");
    await advanced.locator("summary").click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await host.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await host.screenshot({ path: testInfo.outputPath(`personality-${locale}-${width}.png`) });
    }
    const submitted = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/api/podcast/talks"));
    await page.getByTestId("rehearsal-prepare").click();
    const payload = (await submitted).postDataJSON() as TalkInput;
    expect(payload.participants[0].personalityPrompt).toContain("Ascolta con attenzione");
    expect(payload.participants[0].patience).toBe(80);
    expect(payload.participants[0].perspectiveMode).toBe("automatic");
    expect(payload.participants[0].perspectivePrompt).toBe("");
    await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
    expect(calls.next).toBe(0);
    expect(calls.speech).toEqual([]);
    await profile.selectOption("curious");
    await expect(page.getByTestId("rehearsal-start")).toBeDisabled();
    expect(calls.prepare).toBe(1);
  });
}

test("short rehearsal has no paid actions on load and never overlaps voices across at most eight turns", async ({ page }) => {
  const calls = await installRehearsalFixture(page);
  await page.goto("/podcast/rehearsal");
  await page.getByTestId("rehearsal-pace").selectOption("natural");
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
    expect(observed.audio[i].startedAt - observed.audio[i - 1].endedAt!).toBeGreaterThanOrEqual(90);
    expect(observed.audio[i].startedAt - observed.audio[i - 1].endedAt!).toBeLessThan(450);
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

test("sentence PCM cues switch the actual speaker and listener moods during audio, and Stop prevents later cue changes", async ({ page }) => {
  const calls = await installRehearsalFixture(page, { audioSeconds: 3.6 });
  await page.goto("/podcast/rehearsal?style=anime&scenario=lounge");
  const stage = page.getByTestId("rehearsal-stage").locator("canvas[data-podcast-stage]");
  await page.getByTestId("rehearsal-prepare").click();
  await expect(page.getByTestId("rehearsal-start")).toBeEnabled();
  await page.getByTestId("rehearsal-start").click();
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:0");
  await expect(stage).toHaveAttribute("data-podcast-moods", "curiosity,attention");
  await expect(stage).toHaveAttribute("data-podcast-intensities", "0.78,0.54");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "true,false");
  await expect(stage).toHaveAttribute("data-podcast-visemes", "a,rest");
  await expect(page.getByTestId("podcast-mood-readout")).toHaveAttribute("data-sentence-index", "0");
  await expect(page.getByTestId("podcast-mood-readout")).toContainText("che cosa cambia quando deleghiamo una scelta?");
  expect((await audioEvents(page)).audio[0]?.endedAt).toBeNull();
  await expect(stage).toHaveAttribute("data-podcast-cue", "1:1");
  await expect(stage).toHaveAttribute("data-podcast-moods", "disagreement,empathy");
  await expect(stage).toHaveAttribute("data-podcast-intensities", "0.72,0.61");
  await expect(page.getByTestId("podcast-mood-readout")).toHaveAttribute("data-sentence-index", "1");
  await expect(page.getByTestId("podcast-mood-readout")).toContainText("preservare il giudizio umano.");
  expect((await audioEvents(page)).audio[0]?.endedAt).toBeNull();
  await expect(stage).toHaveAttribute("data-podcast-cue", "2:0", { timeout: 7000 });
  await expect(stage).toHaveAttribute("data-podcast-moods", "curiosity,amusement");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,true");
  await expect(stage).toHaveAttribute("data-podcast-visemes", "rest,a");
  await expect(page.getByTestId("podcast-performance-text").first().getByTestId("podcast-performance-sentence")).toHaveCount(2);
  await page.getByTestId("rehearsal-stop").click();
  await expect(page.getByTestId("rehearsal-phase")).toHaveAttribute("data-phase", "stopped");
  await expect(stage).toHaveAttribute("data-podcast-speaking", "false,false");
  await expect(stage).toHaveAttribute("data-podcast-visemes", "rest,rest");
  const stopped = { cue: await stage.getAttribute("data-podcast-cue"), moods: await stage.getAttribute("data-podcast-moods"), next: calls.next };
  await page.waitForTimeout(2100);
  expect(await stage.getAttribute("data-podcast-cue")).toBe(stopped.cue);
  expect(await stage.getAttribute("data-podcast-moods")).toBe(stopped.moods);
  expect(calls.next).toBe(stopped.next);
  expect((await audioEvents(page)).audio).toHaveLength(2);
});

test("dynamic topic follows the audible turn while the next turn is prepared", async ({ page }) => {
  const calls = await installRehearsalFixture(page, { audioSeconds: 3, completeAt: 2, topics: ["Le scelte umane", "Le prove concrete"] });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/podcast/rehearsal?topicMode=conversation");
  const stage = page.locator('canvas[data-podcast-stage]').first();
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", "L’AI nel lavoro: aiuto o delega eccessiva?");
  await page.getByTestId("rehearsal-prepare").click();
  await page.getByTestId("rehearsal-start").click();
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", "Le scelte umane");
  await expect.poll(() => calls.next).toBe(2);
  // The prepared next turn must not put its headline on the current voice.
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", "Le scelte umane");
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", "Le prove concrete");
  await page.getByTestId("rehearsal-stop").click();
});

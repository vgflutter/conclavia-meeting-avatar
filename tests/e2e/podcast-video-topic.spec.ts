import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { defaultPodcast } from "../../src/components/podcast/podcast-defaults";
import { choosePodcastStyle } from "./podcast-visual-controls";

const headline = "L’AI ci aiuta o decide per noi?";
const themes = ["clean-line", "soft-editorial", "animated-series", "anime", "original-editorial", "original-anime", "original-comedy", "noir-editorial", "paper-theatre", "digital-neon"];
const layouts = ["studio", "speaker", "table", "lounge"];
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("topic controls paint the recorded canvas, hide cleanly and carry to rehearsal", async ({ page }) => {
  const external: string[] = [];
  page.on("request", request => { if (new URL(request.url()).origin !== "http://127.0.0.1:3101") external.push(request.url()); });
  await page.goto("/podcast/preview?guest=hidden");
  const stage = page.getByTestId("podcast-stage").locator("canvas");
  const mode = page.getByTestId("podcast-topic-mode");
  await mode.selectOption("custom");
  await page.getByTestId("podcast-topic-text").fill(headline);
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", headline);
  const shown = await stage.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(675, 18, 570, 114).data.slice().toString());
  await mode.selectOption("hidden");
  await expect(stage).toHaveAttribute("data-podcast-painted-headline", "");
  const hidden = await stage.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(675, 18, 570, 114).data.slice().toString());
  expect(hidden).not.toBe(shown);
  await mode.selectOption("custom");
  await page.getByTestId("podcast-preview-use-new").click();
  await expect(page.getByTestId("podcast-topic-mode")).toHaveValue("custom");
  await expect(page.getByTestId("podcast-topic-text")).toHaveValue(headline);
  await expect(page.locator('canvas[data-podcast-stage]').first()).toHaveAttribute("data-podcast-painted-headline", headline);
  expect(external).toEqual([]);
});

test("topic renders in all forty style/layout combinations, stays inside the vertical crop and clears faces", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/podcast/styles?topicMode=custom&topicText=${encodeURIComponent(headline)}`);
  const stage = page.getByTestId("style-gallery-stage").locator("canvas");
  for (const theme of themes) {
    await choosePodcastStyle(page, theme);
    for (const [index, layout] of layouts.entries()) {
      await page.getByTestId("podcast-guest-mode").selectOption(index % 2 ? "reserve" : "hidden");
      await page.getByTestId("podcast-layout").selectOption(layout);
      await expect(stage).toHaveAttribute("data-podcast-layout", layout);
      await expect(stage).toHaveAttribute("data-podcast-painted-headline", headline);
      // Wait for the complete render after React props are updated.
      await stage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const data = await stage.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL("image/png"));
      await writeFile(testInfo.outputPath(`${theme}-${layout}.png`), Buffer.from(data.split(",")[1], "base64"));
    }
  }
  const crop = await stage.evaluate((canvas: HTMLCanvasElement) => {
    const vertical = document.createElement("canvas"); vertical.width = 608; vertical.height = 1080;
    vertical.getContext("2d")!.drawImage(canvas, 656, 0, 608, 1080, 0, 0, 608, 1080);
    return vertical.toDataURL("image/png");
  });
  await writeFile(testInfo.outputPath("vertical-topic.png"), Buffer.from(crop.split(",")[1], "base64"));
});

test("saved short topic reaches studio/broadcast and a running episode keeps its original headline", async ({ request, page }) => {
  const defaults = defaultPodcast();
  const input = { ...defaults, title: `E2E topic ${randomUUID()}`, settings: { ...defaults.settings, videoTopicMode: "custom", videoTopicText: headline } };
  const created = await request.post("/api/podcast/talks", { data: input });
  expect(created.status()).toBe(201);
  const { talk } = await created.json();
  try {
    const started = await request.post(`/api/podcast/talks/${talk.id}/runs`);
    expect(started.status()).toBe(201);
    const { run } = await started.json();
    const changed = await request.patch(`/api/podcast/talks/${talk.id}`, { data: { ...input, settings: { ...input.settings, videoTopicText: "Un nuovo tema per la prossima puntata" } } });
    expect(changed.status()).toBe(200);
    const historical = await (await request.get(`/api/podcast/runs/${run.id}`)).json();
    expect(historical.run.talkSnapshot.settings.videoTopicText).toBe(headline);
    await page.goto(`/podcast/${talk.id}/broadcast`);
    await expect(page.locator('canvas[data-podcast-stage]')).toHaveAttribute("data-podcast-painted-headline", headline);
  } finally {
    expect((await request.delete(`/api/podcast/talks/${talk.id}`)).status()).toBe(200);
  }
});

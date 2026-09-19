import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`portrait visual reel and stable face: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const writes: string[] = [];
    page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const canvas = page.getByTestId("portrait-canvas");
    await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
    // Record the actual WebGL canvas at normal speed, not a reconstructed
    // animation or a fake clock. This silent reel is visual evidence only.
    await canvas.locator("canvas").evaluate((element: HTMLCanvasElement) => {
      const stream = element.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm", videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const result = new Promise<string>(resolve => {
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        };
      });
      Object.assign(window, { portraitRecording: { recorder, result } });
      recorder.start();
    });
    await page.getByRole("button", { name: "Play animation", exact: true }).click();
    await expect(page.getByTestId("portrait-rehearsal")).toHaveAttribute("data-state", "playing");
    await expect(page.getByTestId("portrait-rehearsal")).toHaveAttribute("data-state", "idle", { timeout: 12_000 });
    await expect(canvas).toHaveAttribute("data-rendered-mouth-open", "0.0000");
    const recording = await page.evaluate(async () => {
      const { recorder, result } = (window as unknown as { portraitRecording: { recorder: MediaRecorder; result: Promise<string> } }).portraitRecording;
      recorder.stop();
      return result;
    });
    const videoPath = info.outputPath(`${appearance}-motion.webm`);
    await writeFile(videoPath, Buffer.from(recording, "base64"));
    await info.attach("Actual canvas, silent motion rehearsal", { path: videoPath, contentType: "video/webm" });

    // Exclude intended idle motion, then compare the entire central face, not
    // only metadata: raising the separate arm must not change facial pixels.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(canvas).toHaveAttribute("data-head-tilt", "0.00000");
    const facePixels = () => canvas.locator("canvas").evaluate((element: HTMLCanvasElement) => {
      const copy = document.createElement("canvas"); copy.width = element.width; copy.height = element.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(element, 0, 0);
      const side = Math.min(element.width, element.height);
      const x = Math.round((element.width - side) / 2 + 235 / 627 * side);
      const y = Math.round((element.height - side) / 2 + 90 / 627 * side);
      return [...ctx.getImageData(x, y, Math.round(170 / 627 * side), Math.round(250 / 627 * side)).data];
    });
    const restingFace = await facePixels();
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-hand-raised", "true");
    expect(await facePixels()).toEqual(restingFace);
    await canvas.screenshot({ path: info.outputPath(`${appearance}-raised.png`) });
    expect(writes).toEqual([]);
  });
}

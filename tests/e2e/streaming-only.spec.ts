import { expect, test } from "@playwright/test";

test("retired voice links cannot enable browser synthesis or download a model", async ({ page, request }) => {
  const downloads: string[] = [];
  page.on("request", (request) => {
    if (/voice-assets|\\.onnx(?:$|\\?)|conclavia-voice|supertonic/i.test(request.url())) downloads.push(request.url());
  });
  await page.goto("/avatar/test?voice=local");
  await expect(page.locator("[data-streaming-voice-state]")).toBeVisible();
  await expect(page.getByRole("link", { name: /Confronta con la voce locale|Compare with local voice/ })).toHaveCount(0);
  let calls = 0;
  await page.route("**/api/avatar/speech", (route) => {
    calls++;
    return route.fulfill({ status: 503, json: { error: "Voice unavailable" } });
  });
  await page.getByRole("button", { name: /Ascolta la voce|Listen to voice/ }).click();
  await expect(page.locator('[data-streaming-voice-state="error"]')).toBeVisible();
  await expect(page.locator('svg[data-audio-driven="true"]')).toHaveAttribute("data-viseme", "rest");
  expect(calls).toBe(1);
  expect(downloads).toEqual([]);
  for (const file of ["tts.json", "vocoder.onnx", "M1.json"]) {
    const response = await request.get(`/api/avatar/voice-assets/${file}`);
    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  }
  await page.goto("/avatar");
  await expect(page.locator("#voice-style")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Prova avatar · voce e movimenti|Test avatar · voice & movement/ })).toBeVisible();
});

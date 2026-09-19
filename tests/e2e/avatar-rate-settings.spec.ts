import { expect, test } from "@playwright/test";
import { DEFAULT_ASSISTANT_PROFILE } from "../../src/lib/assistant-profile";
import { DEFAULT_SPEAKING_RATE } from "../../src/lib/avatar-voice-catalog";

test("new avatar profiles start at normal speaking rate", () => {
  expect(DEFAULT_SPEAKING_RATE).toBe(1);
  expect(DEFAULT_ASSISTANT_PROFILE.voice.speakingRate).toBe(DEFAULT_SPEAKING_RATE);
});

for (const locale of ["it", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`advanced rate: ${locale}, ${width}px, reset stays a draft and preserves voices`, async ({ page, request }, testInfo) => {
      expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
      const it = locale === "it";
      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: "http://127.0.0.1:3101" }]);
      expect((await request.patch("/api/avatar", { data: {
        displayName: "Riccardo", role: "Digital colleague", appearance: "business_clay",
        responseStyle: "balanced", attitude: "collaborative", voiceStyle: "executive_warm",
        speakingRate: 0.8, inworldVoiceIdIt: "Gianni", inworldVoiceIdEn: "Dennis",
      } })).status()).toBe(200);
      const before = (await (await request.get("/api/avatar")).json()).profile;
      await page.goto("/avatar/test");
      const advanced = page.getByTestId("voice-advanced");
      const summary = advanced.locator("summary");
      const rate = page.getByLabel(it ? "Ritmo del parlato" : "Speaking rate", { exact: true });
      const reset = page.getByRole("button", { name: it ? "Ripristina · 1,00×" : "Reset · 1.00×", exact: true });
      const voice = page.getByLabel(it ? "Voce" : "Voice");
      const save = page.getByRole("button", { name: it ? "Salva avatar" : "Save avatar", exact: true });
      await expect(summary).toHaveText(it ? "Regolazioni avanzate" : "Advanced settings");
      await expect(advanced).not.toHaveAttribute("open");
      await expect(rate).not.toBeVisible();
      await expect(reset).not.toBeVisible();
      await expect(rate).toHaveValue("0.8");
      await expect(save).toBeDisabled();
      await expect(page.getByTestId("preview-voices")).toContainText(it ? "0,80×" : "0.80×");
      expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);

      await voice.selectOption(it ? "community-rxgdeftvn9dc" : "Edward");
      await summary.click();
      await expect(rate).toBeVisible();
      await reset.click();
      await expect(rate).toHaveValue("1");
      await expect(rate).toHaveAttribute("aria-valuetext", it ? "1,00×" : "1.00×");
      await expect(reset).toBeDisabled();
      await expect(voice).toHaveValue(it ? "community-rxgdeftvn9dc" : "Edward");
      expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
      // The native range remains keyboard-accessible, with the existing bounds.
      await rate.focus();
      await rate.press("ArrowRight");
      await expect(rate).toHaveValue("1.01");
      await rate.press("Home");
      await expect(rate).toHaveValue("0.8");
      await rate.press("End");
      await expect(rate).toHaveValue("1.1");
      await page.getByRole("button", { name: it ? "Annulla modifiche" : "Discard changes" }).click();
      await expect(rate).toHaveValue("0.8");
      await expect(voice).toHaveValue(it ? "Gianni" : "Dennis");

      // No paid synthesis: inspect the exact preview payload using controlled PCM.
      const payloads: Record<string, unknown>[] = [];
      const pcm = Buffer.alloc(24000 * 2 * 8);
      for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 20)), i * 2);
      await page.route("**/api/avatar/speech", route => {
        payloads.push(route.request().postDataJSON());
        return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ audio: pcm.toString("base64") }) + '\n{"done":true}\n' });
      });
      await page.getByRole("button", { name: it ? "Ascolta la voce" : "Listen to voice" }).click();
      await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
      await expect(rate).toBeDisabled();
      await expect(reset).toBeDisabled();
      await page.getByRole("button", { name: it ? "Ferma la voce" : "Stop voice" }).click();
      await expect(reset).toBeEnabled();
      await reset.click();
      await summary.click();
      await expect(rate).not.toBeVisible();
      await page.getByRole("button", { name: it ? "Ascolta la voce" : "Listen to voice" }).click();
      await expect.poll(() => payloads.at(-1)?.speakingRate).toBe(1);
      await page.getByRole("button", { name: it ? "Ferma la voce" : "Stop voice" }).click();
      expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
      await save.click();
      await expect(page.getByText(it ? "Avatar aggiornato." : "Avatar updated.", { exact: true })).toBeVisible();
      const after = (await (await request.get("/api/avatar")).json()).profile;
      expect(after.voice).toEqual({ ...before.voice, speakingRate: 1 });
      await page.reload();
      await expect(advanced).not.toHaveAttribute("open");
      await expect(rate).toHaveValue("1");
      await expect(save).toBeDisabled();
      await summary.click();
      await expect(reset).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (!it) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath(`avatar-rate-advanced-${width}-en.png`), fullPage: true });
        await summary.click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath(`avatar-rate-simple-${width}-en.png`), fullPage: true });
      }
    });
  }
}

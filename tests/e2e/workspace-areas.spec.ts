import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3101";
for (const locale of ["it", "en"] as const) {
  test(`three workspace areas keep their own navigation in ${locale}`, async ({ page }, testInfo) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: locale, url: origin }]);
    const it = locale === "it", mutations: string[] = [];
    page.on("request", request => { if (request.method() !== "GET") mutations.push(request.url()); });
    const main = page.getByRole("navigation", { name: it ? "Navigazione principale" : "Primary navigation", exact: true });
    const header = page.getByTestId("workspace-header");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(it ? "Da dove iniziamo?" : "Where shall we begin?");
    await expect(main.getByRole("link")).toHaveCount(3);
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByTestId("workspace-area-meeting")).toBeVisible();
      await expect(page.getByTestId("workspace-area-podcast")).toBeVisible();
      await expect(page.getByTestId("workspace-area-onboarding")).toBeVisible();
      await page.evaluate(() => { window.scrollTo(0, 0); return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
      if (width !== 768) await page.screenshot({ path: testInfo.outputPath(`workspace-${locale}-${width}.png`), fullPage: true });
    }
    await main.getByRole("link", { name: it ? "Meeting" : "Meetings", exact: true }).click();
    const meetingNav = page.getByRole("navigation", { name: it ? "Navigazione meeting" : "Meeting navigation", exact: true });
    await expect(header).toHaveAttribute("data-area", "meeting");
    await expect(meetingNav.getByRole("link")).toHaveCount(4);
    await meetingNav.getByRole("link", { name: it ? "Memoria" : "Memory", exact: true }).click();
    await expect(page).toHaveURL(/\/memory$/u);
    await expect(main.locator('[aria-current="page"]')).toHaveText(it ? "Meeting" : "Meetings");
    await meetingNav.getByRole("link", { name: it ? "Contesto" : "Context", exact: true }).click();
    await expect(page).toHaveURL(/\/context$/u);
    await expect(page.getByText(it ? "Generale: vale per tutti i meeting." : "General: applies to all meetings.", { exact: true })).toBeVisible();
    await header.screenshot({ path: testInfo.outputPath(`meeting-navigation-${locale}-320.png`) });
    await main.getByRole("link", { name: it ? "Podcast" : "Podcasts", exact: true }).click();
    await expect(header).toHaveAttribute("data-area", "podcast");
    await expect(meetingNav).toHaveCount(0);
    const podcastNav = page.getByRole("navigation", { name: it ? "Navigazione podcast" : "Podcast navigation", exact: true });
    await expect(podcastNav.getByRole("link")).toHaveCount(3);
    await expect(header.getByRole("link", { name: it ? "Memoria" : "Memory", exact: true })).toHaveCount(0);
    await expect(header.getByRole("link", { name: it ? "Contesto" : "Context", exact: true })).toHaveCount(0);
    await podcastNav.getByRole("link", { name: it ? "Prova a due" : "Two-host rehearsal", exact: true }).click();
    await expect(page).toHaveURL(/\/podcast\/rehearsal$/u);
    await expect(podcastNav.locator('[aria-current="page"]')).toHaveAttribute("href", "/podcast/rehearsal");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await header.screenshot({ path: testInfo.outputPath(`podcast-navigation-${locale}-320.png`) });
    await podcastNav.getByRole("link", { name: it ? "Stili e mood" : "Styles & moods", exact: true }).click();
    await page.getByTestId("style-gallery-expression-0").focus();
    await expect.poll(async () => {
      const stage = await page.getByTestId("style-gallery-stage").boundingBox(), menu = await header.boundingBox();
      return stage && menu ? stage.y - menu.y - menu.height : -1;
    }, { message: "The sticky video must remain below the full workspace header" }).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`podcast-gallery-sticky-${locale}-320.png`) });
    await main.getByRole("link", { name: "Onboarding", exact: true }).click();
    await expect(header).toHaveAttribute("data-area", "onboarding");
    await expect(podcastNav).toHaveCount(0);
    await expect(meetingNav).toHaveCount(0);
    await expect(page.getByRole("link", { name: it ? "Apri lo Studio Onboarding" : "Open Onboarding Studio", exact: true })).toHaveAttribute("href", "/onboarding/studio");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.screenshot({ path: testInfo.outputPath(`onboarding-area-${locale}-320.png`), fullPage: true });
    expect(mutations).toEqual([]);
  });
}

test("onboarding opens its existing local studio and management stays private on the public tunnel", async ({ request }) => {
  const response = await request.get("/onboarding/studio", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("http://127.0.0.1:3002/studio");
  for (const path of ["/", "/onboarding", "/onboarding/studio"]) {
    expect((await request.get(path, { maxRedirects: 0, headers: { "x-forwarded-host": "workspace-fixture.trycloudflare.com" } })).status()).toBe(404);
  }
});

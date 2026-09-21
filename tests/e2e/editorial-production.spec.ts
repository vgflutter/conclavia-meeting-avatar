import { expect, test, type Page } from "@playwright/test";

async function openEditorial(page: Page, appearance: string, reduced = false) {
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  const start = new Date("2026-09-21T12:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 100));
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar style", { exact: true }).selectOption("editorial");
  await page.getByLabel("Avatar appearance").selectOption(appearance);
  await page.clock.runFor(64);
  const avatar = page.locator('svg[data-design="editorial-comic"]');
  await expect(avatar).toHaveAttribute("data-animation-ready", "true");
  return avatar;
}

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`editorial production ${appearance}: lids occlude round pupils and reduced motion holds them open`, async ({ page }) => {
    const avatar = await openEditorial(page, appearance);
    const initial = await avatar.evaluate(svg => {
      const iris = svg.querySelector('[class*="iris"]')!.getBoundingClientRect();
      return { aperture: svg.querySelector('[data-editorial-eye-clip] path')!.getAttribute("d"), ratio: iris.height / iris.width };
    });
    const apertures = new Set<string | null>();
    await page.clock.runFor(4200);
    for (let frame = 0; frame < 90; frame++) {
      await page.clock.runFor(16);
      const actual = await avatar.evaluate(svg => {
        const iris = svg.querySelector('[class*="iris"]')!.getBoundingClientRect();
        return { aperture: svg.querySelector('[data-editorial-eye-clip] path')!.getAttribute("d"), ratio: iris.height / iris.width };
      });
      apertures.add(actual.aperture);
      expect(actual.ratio).toBeCloseTo(initial.ratio, 4);
    }
    expect(apertures.size).toBeGreaterThan(3);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(32);
    await expect(avatar.locator('[data-editorial-eye-clip] path')).toHaveAttribute("d", initial.aperture!);
    await page.clock.runFor(6500);
    await expect(avatar.locator('[data-editorial-eye-clip] path')).toHaveAttribute("d", initial.aperture!);
  });
}

test("editorial production: rear hair follows the same head after an in-place identity change", async ({ page }) => {
  const avatar = await openEditorial(page, "business_clay");
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await page.clock.runFor(3800);
  const binding = await avatar.evaluate(svg => ({
    head: svg.querySelector('[data-rig="head"]')!.getAttribute("transform"),
    hair: svg.querySelector('[data-rig="hair"]')!.getAttribute("transform"),
  }));
  expect(binding.head).not.toBe("translate(0 0) rotate(0 341 405)");
  expect(binding.hair).toBe(binding.head);
  await page.getByLabel("Avatar appearance").selectOption("business_clay");
  await page.clock.runFor(32);
  await expect(avatar.locator('[data-rig="hair"]')).toHaveCount(0);
  await page.getByLabel("Avatar appearance").selectOption("business_clay_female");
  await page.clock.runFor(32);
  expect(await avatar.evaluate(svg => svg.querySelector('[data-rig="hair"]')?.getAttribute("transform")
    === svg.querySelector('[data-rig="head"]')?.getAttribute("transform"))).toBe(true);
});

test("editorial production: settled reduced-motion pose does not rewrite SVG every frame", async ({ page }) => {
  const avatar = await openEditorial(page, "business_clay", true);
  await page.clock.runFor(200);
  await avatar.evaluate(svg => {
    const state = { mutations: 0 };
    Object.assign(window, { editorialMutationProbe: state });
    new MutationObserver(records => { state.mutations += records.length; }).observe(svg, {
      subtree: true, attributes: true, attributeFilter: ["d", "transform", "opacity", "data-rendered-mouth-open"],
    });
  });
  await page.clock.runFor(2000);
  const count = () => page.evaluate(() => (window as unknown as { editorialMutationProbe: { mutations: number } }).editorialMutationProbe.mutations);
  expect(await count()).toBe(0);
  await page.getByRole("button", { name: "Raise / lower hand" }).evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(32);
  await expect(avatar).toHaveAttribute("data-hand-progress", "1.0000");
  expect(await count()).toBeGreaterThan(0);
  await expect(avatar.locator('[data-rig="body"]')).toHaveAttribute("transform", "translate(0 0)");
});

test("editorial production: expression changes the real lip corners without opening the silent mouth", async ({ page }) => {
  const avatar = await openEditorial(page, "business_clay_female", true);
  const contours = new Set<string | null>();
  for (let mood = 0; mood < 4; mood++) {
    contours.add(await avatar.locator('[data-mouth-part="upper"]').getAttribute("d"));
    await expect(avatar.locator('[data-mouth-part="cavity"]')).toHaveAttribute("opacity", "0");
    await page.getByRole("button", { name: "Change expression" }).evaluate((button: HTMLButtonElement) => button.click());
    await page.clock.runFor(32);
  }
  expect(contours.size).toBe(4);
});

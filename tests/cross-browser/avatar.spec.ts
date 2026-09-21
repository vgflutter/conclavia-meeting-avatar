import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('catalog renders across browser engines and fits a narrow viewport', async ({ page }, info) => {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      writes.push(new URL(route.request().url()).pathname);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/avatar/test');
  for (const style of ['editorial', 'stylized_3d', 'portrait_2_5d']) {
    await page.getByLabel('Avatar style', { exact: true }).selectOption(style);
    for (const appearance of style === 'portrait_2_5d'
      ? ['business_clay', 'business_clay_female', 'portrait_natural_male', 'portrait_natural_female']
      : ['business_clay', 'business_clay_female']) {
      await page.getByLabel('Avatar appearance').selectOption(appearance);
      const renderer = style === 'editorial' ? page.locator('svg[data-design="editorial-comic"]')
        : page.getByTestId(style === 'portrait_2_5d' ? 'portrait-canvas' : 'avatar-3d-canvas');
      await expect(renderer).toHaveAttribute(style === 'editorial' ? 'data-animation-ready' : 'data-renderer-ready', 'true');
      await page.getByRole('button', { name: 'Raise / lower hand' }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(renderer).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByTestId('speech-preview').screenshot({ path: info.outputPath(`${style}-${appearance}.png`) });
      await page.getByRole('button', { name: 'Raise / lower hand' }).click();
    }
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('synthetic audio starts and stop closes the lips on the same browser update', async ({ page }) => {
  await page.route('**/api/avatar/speech', route => {
    const samples = Buffer.alloc(48_000 * 2);
    for (let i = 0; i < samples.length / 2; i++) samples.writeInt16LE(Math.round(6000 * Math.sin(i * .06)), i * 2);
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ audio: samples.toString('base64'), phones: [{ start: 0, end: 2, viseme: 'a' }] }) + '\n{"done":true}\n' });
  });
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('editorial');
  await page.getByRole('button', { name: 'Listen to voice', exact: true }).click();
  const avatar = page.locator('svg[data-design="editorial-comic"]');
  await expect(avatar).toHaveAttribute('data-viseme', 'a');
  await page.getByRole('button', { name: 'Stop voice', exact: true }).click();
  await expect(avatar).toHaveAttribute('data-viseme', 'rest');
  await expect(avatar).toHaveAttribute('data-rendered-mouth-open', '0.0000');
});

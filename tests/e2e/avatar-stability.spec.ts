import { expect, test } from '@playwright/test';

test('all avatar families survive repeated identity/style changes without stranded canvases or context warnings', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/too many active webgl|invalid_operation|context creation failed/i.test(message.text())) errors.push(message.text());
  });
  await page.route('**/*', route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      writes.push(route.request().method() + ' ' + new URL(route.request().url()).pathname);
      return route.abort();
    }
    return route.continue();
  });
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/avatar/test');
  const stage = page.getByTestId('speech-preview');
  for (let round = 0; round < 3; round++) {
    for (const visualStyle of ['portrait_2_5d', 'stylized_3d', 'editorial']) {
      await page.getByLabel('Avatar style', { exact: true }).selectOption(visualStyle);
      const identities = visualStyle === 'portrait_2_5d'
        ? ['business_clay', 'business_clay_female', 'portrait_natural_male', 'portrait_natural_female']
        : ['business_clay', 'business_clay_female'];
      for (const appearance of identities) {
        await page.getByLabel('Avatar appearance').selectOption(appearance);
        if (visualStyle === 'editorial') {
          await expect(stage.locator('svg[data-design="editorial-comic"]')).toHaveAttribute('data-animation-ready', 'true');
          await expect(stage.locator('canvas')).toHaveCount(0);
        } else {
          await expect(page.getByTestId(visualStyle === 'portrait_2_5d' ? 'portrait-canvas' : 'avatar-3d-canvas')).toHaveAttribute('data-renderer-ready', 'true');
          await expect(stage.locator('canvas')).toHaveCount(1);
        }
      }
    }
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

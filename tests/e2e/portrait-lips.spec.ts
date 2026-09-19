import { expect, test } from '@playwright/test';

for (const appearance of ['business_clay', 'business_clay_female']) {
  test(`both lips articulate within bounds while the nose stays fixed: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Two sustained A vowels at different levels isolate aperture from width.
    // This exercises the real audio player and shader without paid synthesis.
    const phones = [{ start: .2, end: 1.5, viseme: 'a' }, { start: 1.8, end: 3.5, viseme: 'a' }];
    const pcm = Buffer.alloc(24000 * 2 * 4);
    for (let i = 0; i < pcm.length / 2; i++) {
      const time = i / 24000;
      const amplitude = time >= .2 && time < 1.5 ? 1000 : time >= 1.8 && time < 3.5 ? 4000 : 0;
      pcm.writeInt16LE(Math.round(amplitude * Math.sin(i * Math.PI / 30)), i * 2);
    }
    await page.route('**/api/avatar/speech', route => route.fulfill({ contentType: 'application/x-ndjson',
      body: JSON.stringify({ audio: pcm.toString('base64'), phones }) + '\n{"done":true}\n' }));
    await page.goto('/avatar/test');
    await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
    await page.getByLabel('Avatar appearance').selectOption(appearance);
    const canvas = page.getByTestId('portrait-canvas');
    await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
    const pixels = () => canvas.locator('canvas').evaluate((element: HTMLCanvasElement, female) => {
      // Normalize the portrait cell so that bounded motion is measured in
      // actual atlas pixels, independently of desktop/mobile CSS sizing.
      const copy = document.createElement('canvas'); copy.width = copy.height = 627;
      const ctx = copy.getContext('2d')!;
      const side = Math.min(element.width, element.height);
      ctx.drawImage(element, (element.width - side) / 2, (element.height - side) / 2, side, side, 0, 0, 627, 627);
      const x = female ? 325 : 313, y = female ? 255 : 269;
      const crop = (dx: number, dy: number, width: number, height: number) => [...ctx.getImageData(x + dx, y + dy, width, height).data];
      return { upper: crop(-8, -7, 16, 3), upperArea: crop(-9, -11, 18, 9),
        lower: crop(-15, 3, 30, 27), nose: crop(-18, -36, 36, 20) };
    }, appearance.endsWith('female'));
    const resting = await pixels();
    await page.getByRole('button', { name: 'Listen to voice', exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-rendered-mouth-open'))).toBeGreaterThan(.35);
    const quiet = await pixels();
    await canvas.screenshot({ path: info.outputPath('quiet.png') });
    await expect.poll(async () => Number(await canvas.getAttribute('data-rendered-mouth-open'))).toBeGreaterThan(.8);
    const strong = await pixels();
    await canvas.screenshot({ path: info.outputPath('strong.png') });
    // The old pinned-upper-lip assertion enforced the visible puppet hinge.
    // Require useful original-texture movement, bounded to a few atlas pixels
    // and explained by displacement rather than replacement/colour flashing.
    const mse = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : (value - b[i]) ** 2), 0) / (a.length / 4 * 3);
    const quietChange = mse(quiet.upper, resting.upper), strongChange = mse(strong.upper, resting.upper);
    expect(quietChange).toBeGreaterThan(1);
    expect(strongChange).toBeGreaterThan(quietChange);
    let match = { error: Infinity, dx: 0, dy: 0 };
    for (let dy = -4; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) {
      const patch: number[] = [];
      for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) {
        const offset = ((y + 4 + dy) * 18 + x + 1 + dx) * 4;
        patch.push(...strong.upperArea.slice(offset, offset + 4));
      }
      const error = mse(patch, resting.upper);
      if (error < match.error) match = { error, dx, dy };
    }
    expect(match.dy).toBeGreaterThanOrEqual(-3);
    expect(match.dy).toBeLessThanOrEqual(-1);
    expect(match.error).toBeLessThan(strongChange * .65);
    expect(strong.lower).not.toEqual(quiet.lower);
    expect(quiet.nose).toEqual(resting.nose);
    expect(strong.nose).toEqual(resting.nose);
    await page.getByRole('button', { name: 'Stop voice', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
    expect(await pixels()).toEqual(resting);
  });
}

import { expect, test } from '@playwright/test';
import { portraitBlink } from '../../src/lib/portrait-animation';
import { advancePortraitExpression } from '../../src/lib/portrait-motion';

test('listening blinks are irregular, close faster than they reopen, and pause cleanly', () => {
  const starts: number[] = [];
  let previous = 0, minimum = 1, maximum = 0, step = 0;
  for (let t = 0; t < 94; t += .001) {
    const blink = portraitBlink(t, false);
    minimum = Math.min(minimum, blink); maximum = Math.max(maximum, blink);
    if (blink > 0 && previous === 0) starts.push(t);
    step = Math.max(step, Math.abs(blink - previous));
    previous = blink;
  }
  expect(minimum).toBe(0); expect(maximum).toBe(1); expect(step).toBeLessThan(.023);
  const intervals = starts.slice(1).map((start, i) => start - starts[i]);
  expect(intervals.some(t => t < .5)).toBe(true);
  expect(intervals.some(t => t > 6)).toBe(true);
  expect(portraitBlink(4.79, false)).toBe(1);
  expect(portraitBlink(4.745, false)).toBeCloseTo(.5, 8);
  expect(portraitBlink(4.875, false)).toBeCloseTo(.5, 8);
  for (const t of [0, 4.71, 4.955, 5, 46.999, 47]) expect(portraitBlink(t, false)).toBe(0);
  for (const t of [4.79, 10.99, 31.59, 31.95]) expect(portraitBlink(t, true)).toBe(0);
});

test('expression transitions preserve the current face on interruption and ignore phoneme timing', () => {
  const friendly = { brow: -.004, smile: .004 }, focused = { brow: .003, smile: -.002 };
  const advance = (hz: number) => {
    let frame = friendly;
    for (let i = 0; i < hz; i++) frame = advancePortraitExpression(frame, focused, 1 / hz, false);
    return frame;
  };
  expect(advance(15).brow).toBeCloseTo(advance(120).brow, 6);
  expect(advance(30).smile).toBeCloseTo(advance(120).smile, 6);
  const first = advancePortraitExpression(friendly, focused, 1 / 60, false);
  expect(first.brow).toBeGreaterThan(friendly.brow); expect(first.brow).toBeLessThan(0);
  expect(first.smile).toBeGreaterThan(0); expect(first.smile).toBeLessThan(friendly.smile);
  expect(advancePortraitExpression(first, friendly, 0, false)).toEqual(first);
  const reverse = advancePortraitExpression(first, friendly, 1 / 60, false);
  expect(reverse.brow).toBeLessThan(first.brow); expect(reverse.brow).toBeGreaterThan(friendly.brow);
  expect(advancePortraitExpression(first, focused, 1 / 60, true)).toEqual(focused);
});

for (const appearance of ['business_clay', 'business_clay_female']) {
  test(`expression changes settle while waiting without triggering speech: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
    const writes: string[] = [], errors: string[] = [];
    page.on('request', r => { if (r.method() !== 'GET') writes.push(r.url()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/avatar/test');
    await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
    await page.getByLabel('Avatar appearance').selectOption(appearance);
    const canvas = page.getByTestId('portrait-canvas');
    await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
    const clock = new Date('2026-09-19T12:00:00Z');
    await page.clock.install({ time: clock });
    await page.clock.pauseAt(new Date(clock.getTime() + 100));
    await expect(canvas).toHaveAttribute('data-expression-brow', '-0.004000');
    await page.getByRole('button', { name: 'Change expression', exact: true }).click();
    await page.clock.runFor(32);
    const transition = Number(await canvas.getAttribute('data-expression-brow'));
    expect(transition).toBeGreaterThan(-.004); expect(transition).toBeLessThan(.003);
    await canvas.screenshot({ path: info.outputPath('expression-transition.png') });
    await page.clock.runFor(1200);
    await expect(canvas).toHaveAttribute('data-expression-brow', '0.003000');
    await canvas.screenshot({ path: info.outputPath('expression-focused.png') });
    await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
    await expect(canvas).toHaveAttribute('data-hand-progress', '0.00000');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Change expression', exact: true }).click();
    await page.clock.runFor(32);
    await expect(canvas).toHaveAttribute('data-expression-brow', '-0.002000');
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  });
}

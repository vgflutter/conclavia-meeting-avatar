import { expect, test } from '@playwright/test';
import { portraitIdleFrame, portraitIdleOffset } from '../../src/lib/portrait-idle';
import { initialPortraitPosture, portraitBodyFrame, portraitBodyOffset } from '../../src/lib/portrait-motion';
import { writeFile } from 'node:fs/promises';

test('waiting consists of short local actions with a fixed base and genuine pauses', () => {
  const still = { x: 0, y: 0, roll: 0, shoulder: 0 };
  for (const t of [0, 1, 6, 10, 17, 30, 40, 60, 61]) expect(portraitIdleFrame(t, 0, false)).toEqual(still);
  const peaks = { y: 0, roll: 0, speed: 0, angularSpeed: 0 };
  let headFrames = 0;
  for (let t = 0; t < 122; t += 1 / 120) {
    const a = portraitIdleFrame(t, 0, false), b = portraitIdleFrame(t + 1 / 120, 0, false);
    expect(a.x).toBe(0);
    if (a.y || a.roll) headFrames++;
    peaks.y = Math.max(peaks.y, Math.abs(a.y));
    peaks.roll = Math.max(peaks.roll, Math.abs(a.roll));
    peaks.speed = Math.max(peaks.speed, Math.abs(b.y - a.y) * 120);
    peaks.angularSpeed = Math.max(peaks.angularSpeed, Math.abs(b.roll - a.roll) * 120);
  }
  expect(headFrames / (122 * 120)).toBeLessThan(.1);
  expect(peaks.y).toBeCloseTo(.0052, 6); expect(peaks.roll).toBeCloseTo(.018, 6);
  expect(peaks.speed).toBeLessThan(.031); expect(peaks.angularSpeed).toBeLessThan(.069);
  expect(portraitIdleFrame(4, 0, false)).toEqual(portraitIdleFrame(4.2, 0, false));
  expect(portraitIdleFrame(4, 0, false).roll).toBeLessThan(-.015);
  expect(portraitIdleFrame(24.2, 0, false)).toEqual({ ...still, shoulder: .006 });
  expect(portraitIdleFrame(4, 1, false)).toEqual(still);
  for (const t of [0, 4, 13, 24, 36, 61]) expect(portraitIdleFrame(t, .3, true)).toEqual(still);
  // Idle and sustained speech cannot introduce a lateral sway into the jacket.
  for (const speech of [0, 1]) {
    const posture = { ...initialPortraitPosture(0), speech };
    for (const t of [0, 4, 12, 24, 40]) {
      const body = portraitBodyFrame(posture, t, .0008, false);
      expect(body.lean).toBe(0); expect(body.shoulder).toBe(0);
      expect(body.breath).toBeLessThanOrEqual(.0013);
    }
  }
});

test('local head adjustment preserves facial geometry and pins shoulders and the seated base', () => {
  const idle = { x: 0, y: .0052, roll: .018 };
  const move = (x: number, y: number) => { const d = portraitIdleOffset(x, y, idle); return [x + d[0], y + d[1]]; };
  const a = move(.4, .28), b = move(.57, .43);
  expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(Math.hypot(.17, .15), 10);
  for (const x of [0, .2, .5, .8, 1]) for (const y of [.64, .7, .85, 1]) expect(Math.hypot(...portraitIdleOffset(x, y, idle))).toBe(0);
  const body = { lean: .04, shoulder: .025, breath: .007 };
  const offset = (x: number, y: number) => {
    const a = portraitBodyOffset(x, y, body), b = portraitIdleOffset(x, y, idle);
    return [a[0] + b[0], a[1] + b[1]];
  };
  for (let x = 0; x <= 1; x += .025) for (let y = 0; y <= 1; y += .025) {
    const p = offset(x, y), dx = offset(x + .001, y), dy = offset(x, y + .001);
    const det = (1 + (dx[0] - p[0]) * 1000) * (1 + (dy[1] - p[1]) * 1000)
      - (dy[0] - p[0]) * (dx[1] - p[1]) * 1e6;
    expect(det).toBeGreaterThan(.45); expect(det).toBeLessThan(1.6);
    const target = [x + p[0], y + p[1]];
    let source = target;
    for (let i = 0; i < 5; i++) { const d = offset(source[0], source[1]); source = [target[0] - d[0], target[1] - d[1]]; }
    expect(Math.hypot(source[0] - x, source[1] - y)).toBeLessThan(.0005);
  }
});

for (const appearance of ['business_clay', 'business_clay_female']) {
  test(`waiting moves without controls or speech and freezes when hidden/reduced: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
    await page.setViewportSize({ width: 1440, height: 1100 });
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
    const pixels = () => canvas.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height;
      copy.getContext('2d')!.drawImage(c, 0, 0); return copy.toDataURL();
    });
    const resting = await pixels();
    await canvas.screenshot({ path: info.outputPath('waiting-start.png') });
    await page.clock.runFor(4000);
    await expect(canvas).toHaveAttribute('data-idle-shift-x', '0.00000');
    expect(Number(await canvas.getAttribute('data-idle-roll'))).toBeLessThan(-.015);
    await expect(canvas).toHaveAttribute('data-body-lean', '0.00000');
    expect(await pixels()).not.toBe(resting);
    await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
    await expect(canvas).toHaveAttribute('data-hand-progress', '0.00000');
    await canvas.screenshot({ path: info.outputPath('waiting-shift.png') });
    const time = Number(await canvas.getAttribute('data-animation-seconds'));
    const position = Number(await canvas.getAttribute('data-idle-roll'));
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(8000);
    expect(Number(await canvas.getAttribute('data-animation-seconds'))).toBe(time);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(32);
    expect(Number(await canvas.getAttribute('data-animation-seconds')) - time).toBeLessThan(.04);
    expect(Math.abs(Number(await canvas.getAttribute('data-idle-roll')) - position)).toBeLessThan(.0002);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(32);
    const still = await pixels();
    await page.clock.runFor(6000);
    expect(await pixels()).toBe(still);
    await expect(canvas).toHaveAttribute('data-idle-shift-x', '0.00000');
    await expect(canvas).toHaveAttribute('data-idle-shift-y', '0.00000');
    await expect(canvas).toHaveAttribute('data-idle-roll', '0.00000');
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  });

  test(`normal-speed waiting reel without user-triggered animation: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/avatar/test');
    await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
    await page.getByLabel('Avatar appearance').selectOption(appearance);
    const canvas = page.getByTestId('portrait-canvas');
    await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
    const result = await canvas.locator('canvas').evaluate(async (c: HTMLCanvasElement) => {
      const stream = c.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<string>(resolve => { recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop()); const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      }; });
      recorder.start(); setTimeout(() => recorder.stop(), 40000); return done;
    });
    const path = info.outputPath(`${appearance}-waiting.webm`);
    await writeFile(path, Buffer.from(result, 'base64'));
    await info.attach('Actual waiting animation, no speech', { path, contentType: 'video/webm' });
    await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
    await expect(canvas).toHaveAttribute('data-hand-progress', '0.00000');
  });
}

import { expect, test } from '@playwright/test';
import { advancePortraitGesture, advancePortraitMouth, portraitArmPoint } from '../../src/lib/portrait-motion';
import { portraitFrame } from '../../src/lib/portrait-animation';
import { installVoiceProbe } from './voice-probe';

test('gesture is frame-rate independent, settles, and reverses without position jumps', () => {
  const sample = (hz: number) => {
    let state = { position: 0, velocity: 0 };
    const samples: number[] = [];
    for (let i = 0; i < hz; i++) { state = advancePortraitGesture(state, 1, 1 / hz); samples.push(state.position); }
    expect(samples.every((p, i) => p >= 0 && p <= 1 && (!i || p >= samples[i - 1]))).toBe(true);
    return state;
  };
  expect(sample(30).position).toBeCloseTo(sample(120).position, 4);
  expect(sample(15).position).toBeCloseTo(sample(120).position, 4);
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < 15; i++) state = advancePortraitGesture(state, 1, 1 / 60);
  const reversed = advancePortraitGesture(state, 0, 1 / 60);
  expect(Math.abs(reversed.position - state.position)).toBeLessThan(.05);
  for (let i = 0; i < 150; i++) state = advancePortraitGesture(state, 0, 1 / 60);
  expect(state).toEqual({ position: 0, velocity: 0 });
  expect(advancePortraitGesture(state, 1, 0, true)).toEqual({ position: 1, velocity: 0 });
});

test('quiet syllables open less than strong vowels and never hang open at the noise floor', () => {
  const pose = { viseme: 'a' as const, voiceLevel: 0, mood: 'neutral' as const, gesture: 'rest' as const };
  const openings = [.025, .03, .08, .18, .35, 1].map(voiceLevel => portraitFrame({ ...pose, voiceLevel }, 0, false).mouthOpen);
  expect(openings[0]).toBe(0);
  expect(openings[1]).toBeLessThan(.2);
  expect(openings[2]).toBeLessThan(openings[3]);
  expect(openings[3]).toBeLessThan(openings[4]);
  expect(openings[4]).toBeCloseTo(1, 8);
  expect(openings[5]).toBe(1);
  for (const viseme of ['o', 'u'] as const) {
    const frame = (voiceLevel: number) => portraitFrame({ ...pose, viseme, voiceLevel }, 0, false);
    expect(frame(0).mouthWidth).toBe(1);
    expect(frame(.04).mouthWidth).toBeGreaterThan(frame(.35).mouthWidth);
    expect(frame(.35).mouthWidth).toBeGreaterThanOrEqual(.9);
  }
});

test('speech expression remains engaged across closed consonants and releases on silence', () => {
  const pose = { mood: 'friendly' as const, gesture: 'rest' as const, voiceLevel: .2 };
  const vowel = portraitFrame({ ...pose, viseme: 'a' }, 0, true);
  const closed = portraitFrame({ ...pose, viseme: 'mbp' }, 0, true);
  expect(closed.mouthOpen).toBe(0);
  expect(closed.speechActivity).toBe(vowel.speechActivity);
  expect(closed.speechActivity).toBeGreaterThan(.5);
  for (const voiceLevel of [0, .025, NaN]) {
    expect(portraitFrame({ ...pose, viseme: 'a', voiceLevel }, 0, true).speechActivity).toBe(0);
  }
});

test('mouth coarticulation reaches the new shape within 70ms and closes immediately on stop', () => {
  let state = { open: 0, width: 1 };
  state = advancePortraitMouth(state, { mouthOpen: 1, mouthWidth: .6 }, .016);
  expect(state.open).toBeGreaterThan(.4); expect(state.open).toBeLessThan(.65);
  for (let i = 0; i < 3; i++) state = advancePortraitMouth(state, { mouthOpen: 1, mouthWidth: .6 }, .016);
  expect(state.open).toBeGreaterThan(.94);
  expect(advancePortraitMouth(state, { mouthOpen: 0, mouthWidth: 1 }, 0).open).toBe(0);
  for (const female of [false, true]) for (const raised of [0, .25, .5, .75, 1]) {
    const p = portraitArmPoint(175, 325, raised, female);
    expect(p.every(Number.isFinite)).toBe(true);
  }
});

for (const appearance of ['business_clay', 'business_clay_female']) {
  test(`portrait continuous gesture and rapid reversal: ${appearance}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/avatar/test');
    await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
    await page.getByLabel('Avatar appearance').selectOption(appearance);
    const canvas = page.getByTestId('portrait-canvas');
    await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
    await expect(canvas).toHaveAttribute('data-hand-animation', 'articulated');
    const clockStart = new Date('2026-09-19T12:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.getTime() + 100));
    await canvas.screenshot({ path: info.outputPath('rest.png') });
    await page.getByRole('button', { name: 'Raise / lower hand' }).evaluate((b: HTMLButtonElement) => b.click());
    let before = 0;
    for (const [i, time] of [80, 100, 140, 180, 500].entries()) {
      await page.clock.runFor(time);
      const position = Number(await canvas.getAttribute('data-hand-progress'));
      expect(position).toBeGreaterThan(before); before = position;
      await canvas.screenshot({ path: info.outputPath(`raise-${i}.png`) });
    }
    await page.clock.runFor(500);
    await expect(canvas).toHaveAttribute('data-hand-raised', 'true');
    await page.getByRole('button', { name: 'Raise / lower hand' }).evaluate((b: HTMLButtonElement) => b.click());
    await page.clock.runFor(180);
    const halfway = Number(await canvas.getAttribute('data-hand-progress'));
    expect(halfway).toBeGreaterThan(.1); expect(halfway).toBeLessThan(.9);
    await page.getByRole('button', { name: 'Raise / lower hand' }).evaluate((b: HTMLButtonElement) => b.click());
    await page.clock.runFor(16);
    expect(Math.abs(Number(await canvas.getAttribute('data-hand-progress')) - halfway)).toBeLessThan(.08);
    await page.clock.runFor(1600);
    await expect(canvas).toHaveAttribute('data-hand-raised', 'true');
    expect(errors).toEqual([]);
  });
}

test('silent rehearsal is bounded, cancellable, and never saves or calls a voice provider', async ({ page, request }, info) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  const before = (await (await request.get('/api/avatar')).json()).profile;
  const writes: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET') writes.push(r.url()); });
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
  const canvas = page.getByTestId('portrait-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  const clockStart = new Date('2026-09-19T12:00:00Z');
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 100));
  const start = page.getByRole('button', { name: 'Play animation', exact: true });
  await start.evaluate((b: HTMLButtonElement) => b.click());
  await page.clock.runFor(2400);
  await expect(page.getByTestId('portrait-rehearsal')).toHaveAttribute('data-state', 'playing');
  await expect(canvas).toHaveAttribute('data-hand-raised', 'true');
  expect(Number(await canvas.getAttribute('data-rendered-mouth-open'))).toBeGreaterThan(.05);
  await page.locator('[data-avatar-stage]').screenshot({ path: info.outputPath('rehearsal.png') });
  await page.getByRole('button', { name: 'Stop animation', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await page.clock.runFor(32);
  await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
  await expect(start).toBeVisible();
  await start.evaluate((b: HTMLButtonElement) => b.click());
  await page.clock.runFor(9300);
  await expect(page.getByTestId('portrait-rehearsal')).toHaveAttribute('data-state', 'idle');
  await expect(canvas).toHaveAttribute('data-hand-progress', '0.00000');
  await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
  expect((await (await request.get('/api/avatar')).json()).profile).toEqual(before);
  expect(writes).toEqual([]);
});

test('real audio replaces the silent rehearsal and stop clears the rendered mouth', async ({ page }) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  await installVoiceProbe(page);
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
  const canvas = page.getByTestId('portrait-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect(page.getByTestId('portrait-rehearsal')).toHaveAttribute('data-state', 'playing');
  await page.getByRole('button', { name: 'Listen to voice', exact: true }).click();
  await expect(page.getByTestId('portrait-rehearsal')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await expect(canvas).toHaveAttribute('data-rendered-viseme', 'a');
  await page.getByRole('button', { name: 'Stop voice', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-rendered-mouth-open', '0.0000');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeEnabled();
});

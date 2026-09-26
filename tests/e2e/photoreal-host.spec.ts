import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
});
test('shared host media is available to the public renderer without opening management routes', async ({ request }) => {
  const headers = { host: 'synthetic.trycloudflare.com', range: 'bytes=0-31' };
  const media = await request.get('/avatars/host-v1/avatar-host-listening.mp4', { headers });
  expect(media.status()).toBe(206); expect((await media.body()).length).toBe(32);
  for (const path of ['/avatars/host-v1/manifest.json', '/avatars/host-v1/unknown.mp4', '/api/avatar'])
    expect((await request.get(path, { headers })).status()).toBe(404);
});
test('shared host: preview, motion, audio-clock phonemes, stop and reversible style changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(page.getByLabel('Avatar appearance')).toHaveValue('conclavia_host');
  const canvas = page.getByTestId('photoreal-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  await expect.poll(() => canvas.getAttribute('data-pose-frame')).not.toBe('0');
  await page.route('**/api/avatar/speech', route => {
    const pcm = Buffer.alloc(24000 * 6 * 2);
    for (let i = 0; i < pcm.length/2; i++) pcm.writeInt16LE(Math.round(6500*Math.sin(i/24000*2*Math.PI*190)), i*2);
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ audio: pcm.toString('base64'), phones: [
      { start: 0, end: 1.5, viseme: 'a' }, { start: 1.5, end: 3, viseme: 'mbp' }, { start: 3, end: 4.5, viseme: 'o' }, { start: 4.5, end: 6, viseme: 'fv' },
    ] })+'\n'+JSON.stringify({ done: true })+'\n' });
  });
  await page.getByRole('button', { name: 'Listen to voice' }).click();
  await expect(canvas).toHaveAttribute('data-viseme', 'a');
  await mkdir('.local/screenshots', { recursive: true });
  await page.getByTestId('avatar-photoreal').screenshot({ path: '.local/screenshots/host-speaking.png' });
  await expect(canvas).toHaveAttribute('data-viseme', 'rest'); // bilabial closure
  await expect(canvas).toHaveAttribute('data-mouth-weight', '0');
  await expect(canvas).toHaveAttribute('data-viseme', 'o');
  await page.getByRole('button', { name: /Stop audio|Stop voice|Stop playback|Stop$/ }).click();
  await expect(canvas).toHaveAttribute('data-viseme', 'rest');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('editorial');
  await expect(canvas).toHaveCount(0);
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  expect(errors).toEqual([]);
});

test('shared host: no automatic welcome, explicit play, pause and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const movies: string[] = [];
  page.on('request', r => { if (r.url().includes('.mp4')) movies.push(r.url()); });
  await page.goto('/avatar');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(page.getByTestId('photoreal-canvas')).toHaveAttribute('data-renderer-ready', 'true');
  expect(movies).toEqual([]);
  await page.getByRole('button', { name: 'Hear the welcome' }).click();
  await expect(page.getByTestId('avatar-photoreal')).toHaveAttribute('data-welcome', 'playing');
  await expect.poll(() => page.locator('video[src*=welcome]').evaluate((v: HTMLVideoElement) => !v.muted && v.currentTime > .2)).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: false }).click();
  await expect(page.getByTestId('avatar-photoreal')).toHaveAttribute('data-welcome', 'paused');
  expect(movies.every(url => url.includes('welcome-en'))).toBe(true);
});

test('shared host: failed atlas keeps the same portrait, style remount recovers', async ({ page }) => {
  await page.route('**/avatars/host-v1/mouth-atlas.png', route => route.abort());
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(page.getByTestId('avatar-photoreal')).toHaveAttribute('data-renderer', 'static-fallback');
  await page.unroute('**/avatars/host-v1/mouth-atlas.png');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('editorial');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(page.getByTestId('photoreal-canvas')).toHaveAttribute('data-renderer-ready', 'true');
});

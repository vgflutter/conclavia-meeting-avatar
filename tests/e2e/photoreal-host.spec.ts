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
  await expect(canvas).toHaveAttribute('data-viseme', 'mbp'); // explicit bilabial closure over a smiling listening face
  await expect(canvas).toHaveAttribute('data-mouth-weight', '1');
  await expect(canvas).toHaveAttribute('data-viseme', 'o');
  await page.getByRole('button', { name: /Stop audio|Stop voice|Stop playback|Stop$/ }).click();
  await expect(canvas).toHaveAttribute('data-viseme', 'rest');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('editorial');
  await expect(canvas).toHaveCount(0);
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  expect(errors).toEqual([]);
});

test('shared host: live articulation preserves listening eyes/forehead and quiet bilabials close visible teeth', async ({ page }) => {
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('photoreal_host');
  const avatar = page.getByTestId('avatar-photoreal');
  const canvas = page.getByTestId('photoreal-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  await expect.poll(() => canvas.getAttribute('data-pose-frame')).not.toBe('0');
  await avatar.getByRole('button', { name: /Motion/ }).click();
  await avatar.locator('video').first().evaluate(async (video: HTMLVideoElement) => {
    video.pause();
    await new Promise<void>(resolve => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = 1.2;
    });
  });
  await expect(canvas).toHaveAttribute('data-pose-frame', '30');
  const mouthPixels = () => canvas.evaluate(async (node: HTMLCanvasElement) => {
    const motion = await fetch('/avatars/host-v1/motion.json').then(response => response.json());
    const frame = Number(node.dataset.poseFrame);
    const patch = document.createElement('canvas'); patch.width = 192; patch.height = 144;
    const context = patch.getContext('2d')!;
    context.setTransform(new DOMMatrix(motion.poses[frame]).inverse());
    context.drawImage(node, 0, 0);
    // Inspect the actual inner lip band, not renderer data attributes.
    const pixels = context.getImageData(70, 64, 52, 15).data;
    let teeth = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = [pixels[i], pixels[i+1], pixels[i+2]];
      if (r > 165 && g > 160 && b > 130 && Math.max(r,g,b)-Math.min(r,g,b) < 60 && g > r*.83) teeth++;
    }
    return { teeth, pixels: Array.from(pixels) };
  });
  // Use the SAME paused decoder frame as the canvas base. This catches a live
  // renderer accidentally retaining an old face/poster or painting outside the
  // mouth, without claiming that image equality proves natural eye movement.
  const expectListeningUpperFace = async () => {
    const result = await canvas.evaluate((node: HTMLCanvasElement) => {
      const video = node.closest('[data-testid="avatar-photoreal"]')!.querySelector('video')!;
      const reference = document.createElement('canvas');
      reference.width = node.width; reference.height = node.height;
      const referenceContext = reference.getContext('2d', { alpha: false })!;
      referenceContext.drawImage(video, 0, 0, node.width, node.height);
      const actual = node.getContext('2d')!;
      const regions = [
        { name: 'forehead', x: 215, y: 190, width: 200, height: 75 },
        { name: 'eyes', x: 185, y: 267, width: 260, height: 85 },
      ].map(region => {
        const expected = referenceContext.getImageData(region.x, region.y, region.width, region.height).data;
        const pixels = actual.getImageData(region.x, region.y, region.width, region.height).data;
        let changedChannels = 0, maximumError = 0;
        for (let index = 0; index < pixels.length; index++) {
          const error = Math.abs(pixels[index]-expected[index]);
          changedChannels += Number(error !== 0);
          maximumError = Math.max(maximumError, error);
        }
        return { name: region.name, changedChannels, maximumError };
      });
      return { paused: video.paused, mediaTime: video.currentTime, poseFrame: node.dataset.poseFrame, regions };
    });
    expect(result.paused).toBe(true);
    expect(result.mediaTime).toBeCloseTo(1.2, 4);
    expect(result.poseFrame).toBe('30');
    expect(result.regions, 'Live speech must preserve the decoded listening eyes and forehead exactly').toEqual([
      { name: 'forehead', changedChannels: 0, maximumError: 0 },
      { name: 'eyes', changedChannels: 0, maximumError: 0 },
    ]);
  };
  await expectListeningUpperFace();
  const smiling = await mouthPixels();
  expect(smiling.teeth, 'Fixture frame must show the natural listening smile').toBeGreaterThan(50);
  await page.route('**/api/avatar/speech', route => {
    const pcm = Buffer.alloc(24000*6*2);
    // A sustained vowel permits a real-pixel check before the quiet M/B/P closure.
    for (let i = 0; i < 24000*2; i++) pcm.writeInt16LE(Math.round(6500*Math.sin(i/24000*2*Math.PI*190)), i*2);
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ audio: pcm.toString('base64'),
      phones: [{ start: 0, end: 2, viseme: 'a' }, { start: 2, end: 6, viseme: 'mbp' }] })+'\n'+JSON.stringify({ done: true })+'\n' });
  });
  await page.getByRole('button', { name: 'Listen to voice' }).click();
  await expect(canvas).toHaveAttribute('data-viseme', 'a');
  await expectListeningUpperFace();
  expect((await mouthPixels()).pixels, 'The sustained vowel must actually change the mouth').not.toEqual(smiling.pixels);
  await expect(canvas).toHaveAttribute('data-viseme', 'mbp');
  await expect(canvas).toHaveAttribute('data-mouth-weight', '1');
  await expectListeningUpperFace();
  const closed = await mouthPixels();
  expect(closed.teeth, 'M/B/P must cover the visible teeth with closed lip pixels').toBeLessThan(smiling.teeth*.35);
  expect(closed.pixels).not.toEqual(smiling.pixels);
  await page.getByRole('button', { name: /Stop audio|Stop voice|Stop playback|Stop$/ }).click();
  await expect(canvas).toHaveAttribute('data-viseme', 'rest');
  await expect(canvas).toHaveAttribute('data-pose-frame', '30');
  expect((await mouthPixels()).pixels, 'Silence must restore the unmodified frozen listening smile').toEqual(smiling.pixels);
  await expectListeningUpperFace();
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

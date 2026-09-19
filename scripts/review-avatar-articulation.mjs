import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

// Record the real product's silent sequence at a useful review size. This
// never synthesizes speech, saves an avatar or changes the renderer's props.
const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:3102' },
  output: { type: 'string', default: '/tmp/conclavia-articulation' },
  styles: { type: 'string', default: 'editorial,stylized_3d,portrait_2_5d' },
  appearances: { type: 'string', default: 'business_clay,business_clay_female' },
} });
const origin = new URL(values.url);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use a local review server');
const styles = values.styles.split(',');
const appearances = values.appearances.split(',');
assert(styles.every(s => ['editorial', 'stylized_3d', 'portrait_2_5d'].includes(s)));
assert(appearances.every(s => ['business_clay', 'business_clay_female'].includes(s)));
const output = resolve(values.output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const reports = [];
try {
  for (const style of styles) for (const appearance of appearances) {
    const folder = resolve(output, `${style}-${appearance}`);
    await mkdir(folder, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 720, height: 720 },
      recordVideo: { dir: resolve(folder, 'capture'), size: { width: 720, height: 720 } } });
    const errors = [], writes = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        writes.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
        return route.abort();
      }
      return route.continue();
    });
    await context.addCookies([{ name: 'conclavia_locale', value: 'it', url: origin.origin }]);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/avatar/test', origin).href);
    await page.getByLabel('Stile dell’avatar', { exact: true }).selectOption(style);
    await page.getByLabel('Aspetto dell’avatar').selectOption(appearance);
    const selector = style === 'editorial' ? 'svg[data-design="editorial-comic"]'
      : `[data-testid="${style === 'stylized_3d' ? 'avatar-3d-canvas' : 'portrait-canvas'}"]`;
    await page.waitForFunction(({ selector, style }) => document.querySelector(selector)?.dataset[
      style === 'editorial' ? 'animationReady' : 'rendererReady'] === 'true', { selector, style });
    await page.getByTestId('speech-preview').evaluate(preview => {
      preview.style.cssText = 'position:fixed;inset:0;width:720px;height:720px;z-index:2147483000;background:#f2efe6;';
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: resolve(folder, 'rest.png') });
    await page.getByRole('button', { name: 'Avvia animazione', exact: true }).evaluate(button => button.click());
    await page.evaluate(selector => {
      const started = performance.now(), samples = [];
      const tick = now => {
        samples.push({ time: (now - started) / 1000, values: { ...document.querySelector(selector).dataset } });
        window.reviewFrame = requestAnimationFrame(tick);
      };
      window.reviewSamples = samples;
      window.reviewFrame = requestAnimationFrame(tick);
    }, selector);
    const started = performance.now();
    for (const seconds of [.95, 1.2, 1.6, 2.3, 2.65, 2.9, 3.2, 3.45, 4.3, 4.7, 5.2, 5.75, 6.2, 7.1, 7.35, 8, 9.3]) {
      await page.waitForTimeout(Math.max(0, seconds * 1000 - (performance.now() - started)));
      await page.screenshot({ path: resolve(folder, `${seconds.toFixed(2)}s.png`) });
    }
    const samples = await page.evaluate(() => { cancelAnimationFrame(window.reviewFrame); return window.reviewSamples; });
    const stopped = await page.getByTestId('portrait-rehearsal').getAttribute('data-state');
    assert.equal(stopped, 'idle');
    assert.equal(errors.length, 0, 'Browser errors during review');
    assert.equal(writes.length, 0, 'Preview attempted a write');
    await writeFile(resolve(folder, 'samples.json'), JSON.stringify(samples));
    const video = page.video();
    await context.close();
    await video.saveAs(resolve(folder, 'motion.webm'));
    await video.delete();
    reports.push({ style, appearance, errors, writes, stopped, folder });
    console.log(`${style} ${appearance}: actual sequence recorded`);
  }
  await writeFile(resolve(output, 'review.json'), JSON.stringify(reports, null, 2));
} finally { await browser.close(); }

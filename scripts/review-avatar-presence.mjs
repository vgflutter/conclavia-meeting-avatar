import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

// Visual review only: use an already-running local app. All browser mutation
// requests are blocked; this script never saves a profile or calls speech.
const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:3102' },
  output: { type: 'string', default: '/tmp/conclavia-avatar-presence' },
  styles: { type: 'string', default: 'editorial,stylized_3d,portrait_2_5d' },
  appearances: { type: 'string', default: 'business_clay,business_clay_female' },
  seconds: { type: 'string', default: '45' },
} });
const origin = new URL(values.url);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use the local app');
const styles = values.styles.split(',');
const appearances = values.appearances.split(',');
assert(styles.every(s => ['editorial', 'stylized_3d', 'portrait_2_5d'].includes(s)));
assert(appearances.every(s => ['business_clay', 'business_clay_female'].includes(s)));
const seconds = Number(values.seconds);
assert(Number.isFinite(seconds) && seconds >= 15 && seconds <= 60);
const output = resolve(values.output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const reports = [];
try {
  for (const style of styles) for (const appearance of appearances) {
    const name = `${style}-${appearance}`;
    const folder = resolve(output, name);
    await mkdir(folder, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 720, height: 900 },
      recordVideo: { dir: resolve(folder, 'capture'), size: { width: 720, height: 900 } } });
    const errors = [], writes = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push({ method: request.method(), path: new URL(request.url()).pathname });
        return route.abort();
      }
      return route.continue();
    });
    await context.addCookies([{ name: 'conclavia_locale', value: 'it', url: origin.origin }]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/avatar', origin).href);
    await page.getByLabel('Stile dell’avatar', { exact: true }).selectOption(style);
    await page.getByLabel('Aspetto dell’avatar').selectOption(appearance);
    const selector = style === 'editorial' ? 'svg[data-design="editorial-comic"]'
      : `[data-testid="${style === 'stylized_3d' ? 'avatar-3d-canvas' : 'portrait-canvas'}"]`;
    const ready = style === 'editorial' ? 'data-animation-ready' : 'data-renderer-ready';
    await page.waitForFunction(({ selector, ready }) => document.querySelector(selector)?.getAttribute(ready) === 'true', { selector, ready });
    // Enlarge the real identity preview to the screenshot's 4:5 framing. Keep
    // its original mounted SVG/WebGL renderer, clock and nameplate intact.
    await page.locator('[data-avatar-stage]').evaluate(stage => {
      stage.style.cssText = 'position:fixed;inset:0;width:720px;height:900px;max-height:none;z-index:2147483000;margin:0;border-radius:0;';
    });
    // Resizing a WebGL canvas clears its buffer. Let ResizeObserver and the
    // renderer finish before taking the first reference frame.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(selector => {
      const samples = []; let last = 0;
      const started = performance.now();
      const sample = now => {
        if (now - last >= 50) {
          last = now;
          const node = document.querySelector(selector);
          samples.push({ time: (now - started) / 1000, values: { ...node.dataset } });
        }
        window.presenceFrame = requestAnimationFrame(sample);
      };
      window.presenceSamples = samples;
      window.presenceFrame = requestAnimationFrame(sample);
    }, selector);
    const started = performance.now();
    for (const second of [0, 2, 4, 6, 10, 14, 18, 22, 28, 34, 40, seconds - .5].filter(s => s < seconds)) {
      await page.waitForTimeout(Math.max(0, second * 1000 - (performance.now() - started)));
      await page.screenshot({ path: resolve(folder, `${String(second).padStart(4, '0')}s.png`) });
    }
    await page.waitForTimeout(Math.max(0, seconds * 1000 - (performance.now() - started)));
    const samples = await page.evaluate(() => { cancelAnimationFrame(window.presenceFrame); return window.presenceSamples; });
    assert.equal(writes.length, 0, 'Preview made a mutation request');
    assert.equal(errors.length, 0, 'Browser error during visual review');
    await writeFile(resolve(folder, 'samples.json'), JSON.stringify(samples));
    const video = page.video();
    await context.close();
    await video.saveAs(resolve(folder, 'presence.webm'));
    await video.delete();
    reports.push({ style, appearance, seconds, errors, writes, folder });
    console.log(`${name}: ${seconds}s of actual idle animation recorded`);
  }
  await writeFile(resolve(output, 'review.json'), JSON.stringify(reports, null, 2));
} finally { await browser.close(); }

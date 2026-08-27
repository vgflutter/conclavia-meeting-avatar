import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const timelineUrl = new URL("../../public/web-performance-timeline.js", import.meta.url).href;

async function evaluateTimeline(expression: string): Promise<unknown> {
  const program = `
    import { gestureStateAt, visemeBlendAt } from ${JSON.stringify(timelineUrl)};
    process.stdout.write(JSON.stringify(${expression}));
  `;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    program,
  ]);
  return JSON.parse(stdout) as unknown;
}

await test("co-articulates adjacent visemes and releases the mouth during pauses", async () => {
  const result = await evaluateTimeline(`({
    overlap: visemeBlendAt([
      { atMs: 100, value: 'p', weight: 0.86 },
      { atMs: 155, value: 'a', weight: 0.74 },
    ], 115),
    pause: visemeBlendAt([{ atMs: 100, value: 'a', weight: 0.74 }], 310),
  })`) as { overlap: Array<{ value: string; weight: number }>; pause: unknown[] };

  assert.equal(result.overlap.length, 2);
  assert.deepEqual(new Set(result.overlap.map((viseme) => viseme.value)), new Set(["p", "a"]));
  assert.ok(result.overlap.every((viseme) => viseme.weight > 0));
  assert.deepEqual(result.pause, []);
});

await test("gives short speech gestures an authored envelope instead of holding them", async () => {
  const result = await evaluateTimeline(`({
    entering: gestureStateAt([{
      atMs: 200, clip: 'emphasis', weight: 0.8, blendInMs: 320, blendOutMs: 480,
    }], 280, 4000),
    finished: gestureStateAt([{
      atMs: 200, clip: 'emphasis', weight: 0.8, blendInMs: 320, blendOutMs: 480,
    }], 1700, 4000),
    held: gestureStateAt([{
      atMs: 0, clip: 'raise-hand', weight: 1, blendInMs: 420, blendOutMs: 560,
    }], 5000, 8000),
  })`) as {
    entering: { clip: string; weight: number };
    finished: unknown;
    held: { clip: string; weight: number };
  };

  assert.equal(result.entering.clip, "emphasis");
  assert.ok(result.entering.weight > 0 && result.entering.weight < 0.8);
  assert.equal(result.finished, null);
  assert.equal(result.held.clip, "raise-hand");
  assert.equal(result.held.weight, 1);
});


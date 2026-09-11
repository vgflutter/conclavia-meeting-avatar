import { expect, test } from "@playwright/test";
import { speechBlockStart, speechOutputTime } from "../../src/lib/speech-playback-clock";

test("audio clock: preserva blocchi contigui anche sotto il vecchio margine di 40 ms", () => {
  expect(speechBlockStart(1, 1.02, 0.18)).toBe(1.02);
  expect(speechBlockStart(1, 0.9, 0.28)).toBe(1.28);
  expect(speechBlockStart(0, 0, 0.18)).toBe(0.18);
});

test("audio clock: il labiale segue il dispositivo, non il render anticipato", () => {
  const context = { currentTime: 2, outputLatency: 0.1, baseLatency: 0.02,
    getOutputTimestamp: () => ({ contextTime: 1.8, performanceTime: 1000 }) };
  expect(speechOutputTime(context, 1050)).toBeCloseTo(1.85);
  // A bad/stale timestamp must not move the mouth ahead of the scheduled audio.
  expect(speechOutputTime({ ...context, getOutputTimestamp: () => ({ contextTime: 4, performanceTime: 1000 }) }, 1050)).toBe(2);
  expect(speechOutputTime({ ...context, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 1050)).toBeCloseTo(1.88);
  expect(speechOutputTime({ ...context, currentTime: 0 }, 4000)).toBe(0);
});

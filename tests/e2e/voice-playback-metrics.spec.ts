import { expect, test } from "@playwright/test";
import { parseVoicePlaybackMetrics } from "../../src/lib/voice-playback-metrics";

const metrics = { firstAudioMs: 650, totalMs: 4500, audioChunks: 9, underruns: 0, gapMs: 0, maxAnimationGapMs: 34 };

test("voice metrics: bounded numeric observations, no arbitrary renderer fields", () => {
  expect(parseVoicePlaybackMetrics(metrics)).toEqual(metrics);
  for (const value of [null, [], {}, { ...metrics, secret: "not-allowed" },
    { ...metrics, firstAudioMs: "650" }, { ...metrics, totalMs: Infinity },
    { ...metrics, gapMs: NaN }, { ...metrics, firstAudioMs: -1 },
    { ...metrics, totalMs: 900_001 }, { ...metrics, firstAudioMs: 4501 },
    { ...metrics, audioChunks: 0 }, { ...metrics, audioChunks: 1.5 },
    { ...metrics, underruns: 9 }, { ...metrics, gapMs: 4501 },
    { ...metrics, maxAnimationGapMs: 4501 },
  ]) expect(parseVoicePlaybackMetrics(value)).toBeUndefined();
});

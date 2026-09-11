import { expect, test } from "@playwright/test";
import { audioLipSyncAt, buildAudioLipSync } from "../../src/lib/avatar-lipsync";
import { splitMeetingSpeech } from "../../src/lib/meeting-speech";

function waveform(sampleRate: number) {
  return Float32Array.from({ length: sampleRate * 2 }, (_, i) => {
    const t = i / sampleRate;
    return (t >= 0.3 && t < 0.8) || (t >= 1.2 && t < 1.7) ? 0.2 * Math.sin(2 * Math.PI * 220 * t) : 0;
  });
}

test("avatar: pelle senza rumore rettangolare e geometria del volto intatta", async ({ page }) => {
  await page.goto("/avatar/test");
  const avatar = page.locator("svg[data-mood]").first();
  await expect(avatar).toBeVisible();
  await expect(avatar.locator("feTurbulence")).toHaveCount(0);
  const head = avatar.locator('path[class*="avatarHead"]');
  const clip = avatar.locator("#avatar-face-clip path");
  expect(await head.getAttribute("d")).toBe(await clip.getAttribute("d"));
  expect(await head.getAttribute("filter")).toBeNull();
});

for (const sampleRate of [16000, 24000, 44100, 48000]) {
  test(`labiale: silenzi e clock PCM a ${sampleRate} Hz`, () => {
    const timeline = buildAudioLipSync("Aaaaaa, aaaaaa.", waveform(sampleRate), sampleRate);
    for (const seconds of [-1, 0, 0.2, 0.9, 1, 1.1, 1.85, 2, 20, NaN]) {
      expect(audioLipSyncAt(timeline, seconds)).toEqual({ viseme: "rest", level: 0 });
    }
    for (const seconds of [0.4, 0.6, 1.3, 1.5]) {
      expect(audioLipSyncAt(timeline, seconds).viseme).toBe("a");
      expect(audioLipSyncAt(timeline, seconds).level).toBeGreaterThan(0.5);
    }
    // Sampling backwards (replay/seek) must not rely on a monotonically advancing timer.
    expect(audioLipSyncAt(timeline, 0.4)).toEqual(audioLipSyncAt(timeline, 1.4));
  });
}

test("labiale: audio vuoto, rumore di fondo e testo vuoto non aprono la bocca", () => {
  for (const samples of [new Float32Array(), new Float32Array(44100), new Float32Array(44100).fill(0.0002)]) {
    expect(audioLipSyncAt(buildAudioLipSync("Aaaa", samples, 44100), 0.5)).toEqual({ viseme: "rest", level: 0 });
  }
  expect(audioLipSyncAt(buildAudioLipSync("", waveform(44100), 44100), 0.5)).toEqual({ viseme: "rest", level: 0 });
  expect(buildAudioLipSync("A", waveform(44100), 0).frames).toEqual([]);
});

test("voce: saluti e risposte brevi mantengono una sola intonazione", () => {
  for (const text of ["Ciao! Sono qui, dimmi pure.", "Sì. Il budget è 12.500 euro. La scadenza è il 15 ottobre."]) {
    expect(splitMeetingSpeech(text)).toEqual([text]);
  }
  const text = `${"Il punto della scaletta richiede una verifica con il team, ".repeat(10)}poi possiamo proseguire.`;
  const chunks = splitMeetingSpeech(text);
  expect(chunks.join(" ")).toBe(text);
  expect(chunks.every((chunk) => chunk.length <= 280)).toBe(true);
  expect(chunks.slice(0, -1).every((chunk) => /[,.;:]$/.test(chunk))).toBe(true);
  expect(splitMeetingSpeech("   ")).toEqual([]);
});

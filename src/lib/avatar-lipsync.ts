import type { AvatarViseme } from "@/lib/avatar-visemes";

export type AvatarLipSyncFrame = {
  viseme: AvatarViseme;
  duration: number;
};

function visemeFor(character: string): AvatarViseme {
  const normalized = character.toLocaleLowerCase();
  if (/\s/.test(normalized) || /[.,;:!?]/.test(normalized)) return "rest";
  if (/[mbp]/.test(normalized)) return "mbp";
  if (/[fv]/.test(normalized)) return "fv";
  if (/[aàá]/.test(normalized)) return "a";
  if (/[eèéiyìí]/.test(normalized)) return "e";
  if (/[oòó]/.test(normalized)) return "o";
  if (/[uùú]/.test(normalized)) return "u";
  return "consonant";
}

export function buildAvatarLipSync(text: string): AvatarLipSyncFrame[] {
  const frames: AvatarLipSyncFrame[] = [];
  for (const character of [...text]) {
    const viseme = visemeFor(character);
    const duration = /[.!?]/.test(character)
      ? 3
      : /[,;:]/.test(character)
        ? 2
        : /\s/.test(character)
          ? 0.65
          : 1;
    const previous = frames.at(-1);
    if (previous?.viseme === viseme) previous.duration += duration;
    else frames.push({ viseme, duration });
  }
  return frames;
}

export function avatarVisemeAt(
  frames: AvatarLipSyncFrame[],
  progress: number,
): AvatarViseme {
  const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
  const position = Math.max(0, Math.min(1, progress)) * total;
  let cursor = 0;
  for (const frame of frames) {
    cursor += frame.duration;
    if (position <= cursor) return frame.viseme;
  }
  return "rest";
}

export function avatarVoiceLevelAt(samples: Float32Array, progress: number): number {
  if (!samples.length) return 0;
  const center = Math.floor(Math.max(0, Math.min(1, progress)) * samples.length);
  const from = Math.max(0, center - 384);
  const to = Math.min(samples.length, center + 384);
  let energy = 0;
  for (let index = from; index < to; index += 1) energy += samples[index] ** 2;
  const rms = Math.sqrt(energy / Math.max(1, to - from));
  return Math.min(1, rms * 5.5);
}

export type AudioLipSync = {
  frameSeconds: number;
  durationSeconds: number;
  frames: Array<{ viseme: AvatarViseme; level: number }>;
};

/**
 * Audio determines silence, aperture and timing. Text only approximates mouth
 * shapes over voiced time; these are NOT model-provided phoneme timestamps.
 * Build once, then sample with the media clock (never elapsed wall-clock time).
 */
export function buildAudioLipSync(text: string, samples: Float32Array, sampleRate: number): AudioLipSync {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !samples.length) {
    return { frameSeconds: 0.01, durationSeconds: 0, frames: [] };
  }
  const hop = Math.max(1, Math.round(sampleRate * 0.01));
  const energy: number[] = [];
  for (let start = 0; start < samples.length; start += hop) {
    const end = Math.min(samples.length, start + hop);
    let sum = 0;
    for (let i = start; i < end; i++) sum += (Number.isFinite(samples[i]) ? samples[i] : 0) ** 2;
    energy.push(Math.sqrt(sum / (end - start)));
  }
  const peak = energy.reduce((maximum, value) => Math.max(maximum, value), 0);
  const threshold = Math.max(0.003, peak * 0.035);
  const voiced = energy.filter((value) => value > threshold).sort((a, b) => a - b);
  const reference = Math.max(threshold, voiced[Math.floor(voiced.length * 0.85)] || threshold);
  const shapes = buildAvatarLipSync(text).filter((frame) => frame.viseme !== "rest");
  let spokenFrame = 0;
  const frames = energy.map((value, index) => {
    if (value <= threshold || !shapes.length) return { viseme: "rest" as const, level: 0 };
    // A centered 30 ms envelope smooths amplitude without adding CSS lag.
    const smooth = (energy[index - 1] ?? value) * 0.2 + value * 0.6 + (energy[index + 1] ?? value) * 0.2;
    const viseme = avatarVisemeAt(shapes, (spokenFrame++ + 0.5) / voiced.length);
    const level = Math.min(1, Math.sqrt(smooth / reference));
    return { viseme, level: viseme === "mbp" ? Math.min(0.15, level) : level };
  });
  return { frameSeconds: hop / sampleRate, durationSeconds: samples.length / sampleRate, frames };
}

export function audioLipSyncAt(timeline: AudioLipSync, seconds: number): { viseme: AvatarViseme; level: number } {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= timeline.durationSeconds) return { viseme: "rest", level: 0 };
  return timeline.frames[Math.floor(seconds / timeline.frameSeconds)] ?? { viseme: "rest", level: 0 };
}

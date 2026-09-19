import type { AvatarViseme } from "@/lib/avatar-visemes";
import type { AvatarGesture, AvatarMood } from "@/components/BusinessAvatar";

export type PortraitPose = { viseme: AvatarViseme; voiceLevel: number; mood: AvatarMood; gesture: AvatarGesture };
const mouths: Record<AvatarViseme, readonly [number, number]> = {
  rest: [1, 0], mbp: [1, 0], fv: [.98, .22], a: [1, 1], e: [1.04, .5],
  o: [.94, .82], u: [.90, .55], consonant: [.98, .36],
};

const blinkStarts = [4.71, 10.9, 14.35, 20.65, 27.3, 31.5, 31.86, 39.2, 44.3];

/** Uneven listening blinks, including one occasional double blink. Upper lids
 * fall faster than they reopen; both ends settle without an abrupt reversal. */
export function portraitBlink(seconds: number, reducedMotion: boolean) {
  if (reducedMotion || !Number.isFinite(seconds)) return 0;
  const time = Math.max(0, seconds) % 47;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (const start of blinkStarts) {
    const t = time - start;
    if (t < 0 || t >= .235) continue;
    if (t < .070) return smooth(t / .070);
    if (t < .095) return 1;
    return 1 - smooth((t - .095) / .140);
  }
  return 0;
}

/** Audio frames define the current target. Coarticulation never queues old phonemes. */
export function portraitFrame(pose: PortraitPose, seconds: number, reducedMotion: boolean) {
  const energy = Number.isFinite(pose.voiceLevel) ? Math.max(0, Math.min(1, pose.voiceLevel)) : 0;
  const mouth = mouths[pose.viseme] || mouths.rest;
  // Preserve quiet syllables without opening a whisper as wide as a strong
  // vowel. The same noise floor closes the rendered mouth and audio indicator.
  const amplitude = energy > .025 ? Math.sqrt(Math.min((energy - .025) / .325, 1)) : 0;
  const open = mouth[1] * amplitude;
  const blink = portraitBlink(seconds, reducedMotion);
  return {
    // A portrait cannot reproduce forward lip protrusion. Keep the corners
    // near their resting positions, with less rounding on quiet syllables.
    mouthWidth: 1 + (mouth[0] - 1) * amplitude, mouthOpen: open, speechActivity: amplitude, blink,
    tilt: 0,
    breath: reducedMotion ? 0 : (1 - Math.cos(seconds * 1.08)) * .0004,
    brow: pose.mood === "friendly" ? -.004 : pose.mood === "focused" ? .003 : pose.mood === "confident" ? -.002 : 0,
    smile: pose.mood === "friendly" ? .004 : pose.mood === "focused" ? -.002 : pose.mood === "confident" ? .002 : 0,
  };
}

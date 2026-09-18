import type { AvatarViseme } from "@/lib/avatar-visemes";
import type { AvatarGesture, AvatarMood } from "@/components/BusinessAvatar";

export type PortraitPose = { viseme: AvatarViseme; voiceLevel: number; mood: AvatarMood; gesture: AvatarGesture };
const mouths: Record<AvatarViseme, readonly [number, number]> = {
  rest: [1, 0], mbp: [1, 0], fv: [.92, .22], a: [1, 1], e: [1.1, .5],
  o: [.68, .82], u: [.58, .55], consonant: [.9, .36],
};

/** Audio frames are authoritative: never interpolate/queue phonemes behind PCM. */
export function portraitFrame(pose: PortraitPose, seconds: number, reducedMotion: boolean) {
  const energy = Number.isFinite(pose.voiceLevel) ? Math.max(0, Math.min(1, pose.voiceLevel)) : 0;
  const mouth = mouths[pose.viseme] || mouths.rest;
  const open = energy > .025 ? mouth[1] : 0;
  const phase = seconds % 4.9;
  const blink = !reducedMotion && phase > 4.68 ? Math.sin((phase - 4.68) / .22 * Math.PI) : 0;
  return {
    mouthWidth: mouth[0], mouthOpen: open, blink,
    tilt: reducedMotion ? 0 : Math.sin(seconds * .73) * .012,
    breath: reducedMotion ? 0 : Math.sin(seconds * 1.3) * .0025,
    brow: pose.mood === "friendly" ? -.004 : pose.mood === "focused" ? .003 : pose.mood === "confident" ? -.002 : 0,
    smile: pose.mood === "friendly" ? .004 : pose.mood === "focused" ? -.002 : pose.mood === "confident" ? .002 : 0,
  };
}

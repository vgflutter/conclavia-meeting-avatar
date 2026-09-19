import type { AvatarGesture } from "@/components/BusinessAvatar";
import type { AvatarViseme } from "@/lib/avatar-visemes";

export const AVATAR_PREVIEW_DURATION_MS = 9000;

// A bounded, silent visual rehearsal. It never calls a speech provider and is
// deliberately separate from the PCM-driven mouth used during actual speech.
// Connected phonemes within three short phrases. Only phrase boundaries are
// silent: inserting a hard stop after every vowel makes any rig look hinged.
const cues: readonly (readonly [end: number, viseme: AvatarViseme, level: number])[] = [
  [2180, "mbp", .12], [2340, "u", .19], [2560, "o", .25], [2670, "consonant", .14],
  [2870, "a", .27], [3030, "e", .20], [3140, "fv", .13], [3370, "o", .23],
  [3500, "consonant", .14], [3690, "e", .17], [3960, "rest", 0],
  [4100, "consonant", .12], [4340, "a", .25], [4480, "mbp", .14], [4690, "e", .21],
  [4950, "o", .24], [5140, "fv", .12], [5280, "e", .18], [5500, "rest", 0],
  [5590, "consonant", .12], [5760, "u", .19], [5900, "o", .22], [6030, "consonant", .13],
  [6260, "a", .25], [6420, "e", .20], [6600, "u", .12],
];
const phrases = [[2100, 3690], [3960, 5280], [5500, 6600]] as const;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function avatarPreviewFrame(elapsedMs: number) {
  const phrase = phrases.find(([start, end]) => elapsedMs >= start && elapsedMs < end);
  const index = phrase ? cues.findIndex(([end]) => elapsedMs < end) : -1;
  const cue = cues[index];
  const viseme: AvatarViseme = cue?.[1] ?? "rest";
  let level = 0;
  if (phrase && cue) {
    const previous = cues[index - 1];
    const start = previous?.[0] ?? phrase[0];
    const from = previous && previous[1] !== "rest" ? previous[2] : cue[2];
    level = from + (cue[2] - from) * smooth((elapsedMs - start) / (cue[0] - start));
    level *= smooth((elapsedMs - phrase[0]) / 90) * smooth((phrase[1] - elapsedMs) / 110);
  }
  const gesture: AvatarGesture = elapsedMs >= 800 && elapsedMs < 6900 ? "hand_raise" : "rest";
  return { viseme, level, gesture };
}

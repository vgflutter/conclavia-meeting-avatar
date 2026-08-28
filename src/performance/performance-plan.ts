import type {
  AvatarListeningReaction,
  AvatarMood,
  AvatarSpeechCue,
  AvatarSpeechSentence,
} from "../domain/protocol.js";
import { avatarMoods } from "../domain/protocol.js";

// A diagnostic expression must remain readable after its eased entrance and
// exit. Short spoken labels made the old preview flash for less than a second.
export const moodPreviewStepMs = 3_000;
// Start with a visible reaction. Beginning the diagnostic with neutral made a
// correctly accepted command look broken for almost two seconds.
export const moodPreviewMoods: readonly AvatarMood[] = [
  ...avatarMoods.filter((mood) => mood !== "neutral"),
  "neutral",
];

// Production listening reactions stay restrained. The explicit diagnostic
// must instead expose the whole vocabulary at a glance, without twelve
// near-neutral poses or close-up grimaces.
export const moodPreviewIntensity: Readonly<Record<AvatarMood, number>> = {
  neutral: 0,
  attentive: 0.66,
  curious: 0.76,
  amused: 0.72,
  confident: 0.68,
  skeptical: 0.72,
  concerned: 0.72,
  surprised: 0.82,
  empathetic: 0.68,
  assertive: 0.74,
  frustrated: 0.78,
  reflective: 0.66,
};

export type RendererMood =
  | "neutral"
  | "happiness"
  | "sadness"
  | "disgust"
  | "anger"
  | "surprise"
  | "fear"
  | "confidence"
  | "excitement"
  | "boredom"
  | "playfulness"
  | "confusion";

export type PerformanceFocus = "camera" | "target" | "thought";
export type PerformanceGesture =
  | "none"
  | "nod"
  | "tilt"
  | "emphasis"
  | "settle"
  | "raise-hand"
  | "lower-hand"
  | "applause";

export interface PerformanceBeat {
  atMs: number;
  semanticMood: AvatarMood;
  mood: RendererMood;
  intensity: number;
  focus: PerformanceFocus;
  gesture: PerformanceGesture;
}

export interface MoodPerformanceProfile {
  facialMood: RendererMood;
  speakingScale: number;
  listeningScale: number;
  focus: PerformanceFocus;
  gesture: PerformanceGesture;
}

const moodProfiles: Readonly<Record<AvatarMood, MoodPerformanceProfile>> = {
  neutral: {
    facialMood: "neutral", speakingScale: 0, listeningScale: 0,
    focus: "target", gesture: "settle",
  },
  attentive: {
    facialMood: "excitement", speakingScale: 0.52, listeningScale: 0.48,
    focus: "target", gesture: "nod",
  },
  curious: {
    facialMood: "confusion", speakingScale: 0.90, listeningScale: 0.82,
    focus: "thought", gesture: "tilt",
  },
  amused: {
    facialMood: "playfulness", speakingScale: 0.72, listeningScale: 0.62,
    focus: "camera", gesture: "emphasis",
  },
  confident: {
    facialMood: "happiness", speakingScale: 0.70, listeningScale: 0.56,
    focus: "camera", gesture: "nod",
  },
  skeptical: {
    facialMood: "disgust", speakingScale: 0.62, listeningScale: 0.54,
    focus: "thought", gesture: "tilt",
  },
  concerned: {
    facialMood: "fear", speakingScale: 0.72, listeningScale: 0.68,
    focus: "target", gesture: "settle",
  },
  surprised: {
    facialMood: "surprise", speakingScale: 1, listeningScale: 0.92,
    focus: "camera", gesture: "emphasis",
  },
  empathetic: {
    facialMood: "sadness", speakingScale: 0.55, listeningScale: 0.52,
    focus: "target", gesture: "nod",
  },
  assertive: {
    facialMood: "confidence", speakingScale: 0.90, listeningScale: 0.68,
    focus: "camera", gesture: "emphasis",
  },
  frustrated: {
    facialMood: "anger", speakingScale: 0.86, listeningScale: 0.66,
    focus: "target", gesture: "settle",
  },
  reflective: {
    facialMood: "boredom", speakingScale: 0.42, listeningScale: 0.34,
    focus: "thought", gesture: "tilt",
  },
};

export function performanceProfileForMood(mood: AvatarMood): MoodPerformanceProfile {
  return moodProfiles[mood];
}

export function listeningMoodIntensity(
  semanticMood: AvatarMood,
  level: AvatarListeningReaction["level"],
): number {
  const profile = moodProfiles[semanticMood];
  if (semanticMood === "neutral") return 0;
  // Meeting video needs low-level reactions to remain legible after WebRTC
  // compression. Keep a visible floor, while bounding strong reactions below
  // the exaggerated expressions that read as grimaces on a close-up.
  const base = [0, 0.26, 0.38, 0.50, 0.62, 0.74][level] ?? 0.38;
  const intensity = base * profile.listeningScale;
  return Math.round(Math.min(0.58, Math.max(0.14, intensity)) * 100) / 100;
}

/** A body-neutral timeline that exposes every semantic facial mood once. */
export function moodPreviewBeats(stepMs = moodPreviewStepMs): PerformanceBeat[] {
  const beats = moodPreviewMoods.map((semanticMood, index) => {
    const profile = performanceProfileForMood(semanticMood);
    return {
      atMs: index * stepMs,
      semanticMood,
      mood: profile.facialMood,
      intensity: listeningMoodIntensity(semanticMood, 3),
      focus: profile.focus,
      gesture: "none" as const,
    };
  });
  return [
    ...beats,
    {
      atMs: moodPreviewMoods.length * stepMs,
      semanticMood: "neutral",
      mood: "neutral",
      intensity: 0,
      focus: "camera",
      gesture: "none",
    },
  ];
}

function sentenceWeight(sentence: AvatarSpeechSentence): number {
  return Math.max(1, sentence.text.trim().split(/\s+/u).length);
}

function moodIntensity(
  semanticMood: AvatarMood,
  level: AvatarSpeechSentence["level"],
  sentenceIndex: number,
): number {
  if (semanticMood === "neutral") return 0;
  const base = [0, 0.28, 0.46, 0.66, 0.84, 1][level] ?? 0.66;
  const cadenceScale = sentenceIndex % 2 === 0 ? 1 : 0.96;
  const intensity = base * moodProfiles[semanticMood].speakingScale * cadenceScale;
  return Math.round(Math.min(0.75, Math.max(0.20, intensity)) * 100) / 100;
}

function moodDirection(
  mood: AvatarMood,
): Pick<PerformanceBeat, "focus" | "gesture"> {
  const { focus, gesture } = moodProfiles[mood];
  return { focus, gesture };
}

export function performanceBeatsForCue(
  cue: AvatarSpeechCue,
  durationMs: number,
  sentenceDurationsMs?: readonly number[],
): PerformanceBeat[] {
  const safeDurationMs = Math.max(2_000, Math.min(60_000, durationMs));
  const weights = sentenceDurationsMs?.length === cue.sentences.length
    && sentenceDurationsMs.every((value) => Number.isFinite(value) && value > 0)
    ? [...sentenceDurationsMs]
    : cue.sentences.map(sentenceWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const semanticMoods = cue.sentences.map((sentence) => sentence.mood);
  const moods = semanticMoods.map((mood) => moodProfiles[mood].facialMood);
  const levels = cue.sentences.map((sentence) => sentence.level);
  const firstMood = moods[0] ?? "neutral";
  const firstSemanticMood = semanticMoods[0] ?? "neutral";
  const beats: PerformanceBeat[] = [
    {
      atMs: 0,
      semanticMood: firstSemanticMood,
      mood: firstMood,
      intensity: moodIntensity(firstSemanticMood, levels[0] ?? 3, 0),
      ...moodDirection(firstSemanticMood),
    },
  ];
  let elapsedWeight = 0;

  for (let index = 0; index < weights.length - 1; index += 1) {
    elapsedWeight += weights[index] ?? 0;
    const rawBoundary = Math.round((elapsedWeight / totalWeight) * safeDurationMs);
    const nextMood = moods[index + 1];
    const nextSemanticMood = semanticMoods[index + 1];
    if (!nextMood || !nextSemanticMood) continue;

    const previous = beats.at(-1)!;
    const remainingWeight = weights
      .slice(index + 1)
      .reduce((total, weight) => total + weight, 0);
    const followingBoundary = index + 1 === weights.length - 1
      ? safeDurationMs
      : Math.round(((totalWeight - remainingWeight + (weights[index + 1] ?? 0)) / totalWeight) * safeDurationMs);
    const fadeAtMs = Math.max(previous.atMs + 180, rawBoundary - 420);
    const switchAtMs = Math.max(fadeAtMs + 180, rawBoundary - 70);
    const riseAtMs = Math.min(
      followingBoundary - 260,
      Math.max(switchAtMs + 240, rawBoundary + 260),
    );

    if (riseAtMs <= switchAtMs + 120 || riseAtMs >= safeDurationMs - 180) continue;
    beats.push(
      {
        atMs: fadeAtMs,
        semanticMood: previous.semanticMood,
        mood: previous.mood,
        intensity: 0.18,
        focus: previous.focus,
        gesture: "none",
      },
      {
        atMs: switchAtMs,
        semanticMood: nextSemanticMood,
        mood: nextMood,
        intensity: 0.18,
        focus: moodDirection(nextSemanticMood).focus,
        gesture: "none",
      },
      {
        atMs: riseAtMs,
        semanticMood: nextSemanticMood,
        mood: nextMood,
        intensity: moodIntensity(
          nextSemanticMood,
          levels[index + 1] ?? 3,
          index + 1,
        ),
        ...moodDirection(nextSemanticMood),
      },
    );
  }

  return beats.slice(0, 12);
}

export function speechTextForCue(cue: AvatarSpeechCue): string {
  return cue.sentences.map((sentence) => sentence.text.trim()).join(" ");
}

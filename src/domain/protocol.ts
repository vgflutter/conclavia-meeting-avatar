export const avatarMoods = [
  "neutral",
  "attentive",
  "curious",
  "amused",
  "confident",
  "skeptical",
  "concerned",
  "surprised",
  "empathetic",
  "assertive",
  "frustrated",
  "reflective",
] as const;

export type AvatarMood = (typeof avatarMoods)[number];

export interface TranscriptSegment {
  id: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  capturedAt: string;
}

export interface AvatarSpeechSentence {
  text: string;
  mood: AvatarMood;
}

export interface AvatarSpeechCue {
  id: string;
  kind: "speak";
  provider: "diagnostic" | "openai";
  model: string | null;
  sentences: AvatarSpeechSentence[];
  addressedTo: string;
  sourceSegmentIds: string[];
  createdAt: string;
}

export interface ActivationDecision {
  ingested: boolean;
  activated: boolean;
  reason:
    | "wake-word"
    | "conversation-follow-up"
    | "conversation-observed"
    | "not-final"
    | "not-addressed";
  cue?: AvatarSpeechCue;
}

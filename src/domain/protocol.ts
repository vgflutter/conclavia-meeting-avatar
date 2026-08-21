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
export type AvatarMoodLevel = 1 | 2 | 3 | 4 | 5;

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
  level: AvatarMoodLevel;
}

export interface AvatarSpeechCue {
  id: string;
  kind: "speak";
  provider: "diagnostic" | "openai";
  model: string | null;
  speakerName?: string;
  sentences: AvatarSpeechSentence[];
  addressedTo: string;
  sourceSegmentIds: string[];
  webSources?: Array<{ title: string; url: string }>;
  createdAt: string;
}

export interface AvatarInterventionRequest {
  id: string;
  kind: "request-to-speak";
  speakerName: string;
  reason: string;
  proposedCue: AvatarSpeechCue;
  createdAt: string;
  expiresAt: string;
}

export interface ActivationDecision {
  ingested: boolean;
  activated: boolean;
  reason:
    | "wake-word"
    | "conversation-follow-up"
    | "conversation-observed"
    | "autonomous-request"
    | "not-final"
    | "not-addressed";
  cue?: AvatarSpeechCue;
  request?: AvatarInterventionRequest;
}

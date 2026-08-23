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
export const speechLanguages = ["it-IT", "en-US"] as const;
export type SpeechLanguage = (typeof speechLanguages)[number];
export const transcriptSources = ["speech", "chat", "manual"] as const;
export type TranscriptSource = (typeof transcriptSources)[number];
export const chatPlatforms = ["teams", "google-meet", "generic"] as const;
export type ChatPlatform = (typeof chatPlatforms)[number];

export const autonomousInterventionTypes = [
  "none",
  "factual-correction",
  "critical-omission",
  "material-addition",
] as const;
export type AutonomousInterventionType =
  (typeof autonomousInterventionTypes)[number];

export const chatCommandKinds = [
  "raise-hand",
  "lower-hand",
  "summarize-in-chat",
  "reply-in-chat",
  "speak",
] as const;
export type ChatCommandKind = (typeof chatCommandKinds)[number];

export interface ChatCommandAliases {
  raiseHand: string[];
  lowerHand: string[];
  summarizeInChat: string[];
  replyInChat: string[];
  speak: string[];
}

export interface TranscriptSegment {
  id: string;
  speakerId?: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  capturedAt: string;
  source?: TranscriptSource;
  platform?: ChatPlatform;
  meetingId?: string;
  externalId?: string;
}

export interface ChatMessageInput {
  platform: ChatPlatform;
  meetingId: string;
  messageId: string;
  speakerId?: string;
  speakerName: string;
  text: string;
  capturedAt?: string;
  senderIsAvatar?: boolean;
}

export interface MeetingTranscriptInput {
  platform: ChatPlatform;
  meetingId: string;
  segmentId: string;
  speakerId: string;
  speakerName: string;
  text: string;
  capturedAt?: string;
  isFinal?: boolean;
}

export interface MatchedChatCommand {
  kind: ChatCommandKind;
  alias: string;
  argument: string;
}

export interface OutboundChatMessage {
  id: string;
  platform: ChatPlatform;
  meetingId: string;
  replyToMessageId: string;
  speakerName: string;
  text: string;
  createdAt: string;
}

export interface AvatarSpeechSentence {
  text: string;
  mood: AvatarMood;
  level: AvatarMoodLevel;
  language: SpeechLanguage;
}

export interface AvatarListeningReaction {
  mood: AvatarMood;
  level: AvatarMoodLevel;
  sourceSegmentId: string;
  observedSpeakerName: string;
  createdAt: string;
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
  interventionType: Exclude<AutonomousInterventionType, "none">;
  importance: AvatarMoodLevel;
  confidence: AvatarMoodLevel;
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

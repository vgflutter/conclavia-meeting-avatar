// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import type { LlmModelId } from "@/lib/podcast/llm-models";
import type { StudioThemeId } from "@/lib/podcast/studio-themes";

export type TalkStatus = "draft" | "ready";
export type PerspectiveMode = "custom" | "automatic" | "random";
export type ParticipantKind = "ai" | "human" | "unassigned";
export type ParticipantSex = "female" | "male";
export type VoiceDelivery = "natural" | "energetic" | "authoritative";
export type ModeratorKind = "none" | "ai" | "human";
export type ModeratorStyle = "neutral" | "challenging" | "facilitating";
export type TalkPace = "fast" | "balanced" | "deep";
export type VideoMode = "cartoon";

export interface Participant {
  kind: ParticipantKind;
  sex: ParticipantSex;
  name: string;
  role: string;
  perspectiveMode: PerspectiveMode;
  perspectivePrompt: string;
  goals?: string;
  nonNegotiables?: string;
  speakingStylePrompt?: string;
  modelOverride?: LlmModelId;
  voiceId?: string;
  voiceDelivery?: VoiceDelivery;
  assertiveness: number;
  patience: number;
  interruptiveness: number;
  baselineTension: number;
}

export interface ModeratorConfiguration {
  kind: ModeratorKind;
  name?: string;
  role?: string;
  instructions?: string;
  style: ModeratorStyle;
  modelOverride?: LlmModelId;
  voiceId?: string;
  voiceDelivery?: VoiceDelivery;
  canInterrupt: boolean;
  manageTime: boolean;
  summarizeAtEnd: boolean;
}

export interface TalkSettings {
  maxTurns: number;
  targetDurationMinutes: number;
  videoMode: VideoMode;
  studioTheme: StudioThemeId;
  defaultModel: LlmModelId;
  allowInterruptions: boolean;
  pace: TalkPace;
}

export interface TalkInput {
  title: string;
  topic: string;
  centralQuestion?: string;
  editorialInstructions?: string;
  description?: string;
  language: string;
  participants: Participant[];
  moderator: ModeratorConfiguration;
  status: TalkStatus;
  settings: TalkSettings;
}

export interface TalkRecord extends TalkInput {
  createdAt: Date;
  updatedAt: Date;
}

export interface TalkResponse extends Omit<TalkInput, "description"> {
  id: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type PodcastInput = TalkInput;
export type PodcastResponse = TalkResponse;

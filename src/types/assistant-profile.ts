export type AssistantAppearance = "business_clay" | "business_clay_female";
export const ASSISTANT_VISUAL_STYLES = ["editorial", "portrait_2_5d", "stylized_3d"] as const;
export type AssistantVisualStyle = typeof ASSISTANT_VISUAL_STYLES[number];
export type AssistantVoiceStyle = "executive_warm" | "executive_clear";
export type AssistantResponseStyle = "concise" | "balanced" | "detailed";
export type AssistantAttitude = "discreet" | "collaborative" | "proactive";

export interface AssistantPersonality {
  responseStyle: AssistantResponseStyle;
  attitude: AssistantAttitude;
}

export interface AssistantProfileRecord {
  key: "default";
  displayName: string;
  role: string;
  appearance: AssistantAppearance;
  visualStyle?: AssistantVisualStyle;
  personality: AssistantPersonality;
  voice: {
    inworldVoiceIdIt?: string;
    inworldVoiceIdEn?: string;
    provider: "inworld";
    model: "inworld-tts-2" | "inworld-tts-2-flash";
    style: AssistantVoiceStyle;
    speakingRate: number;
    pronunciationProfile: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantProfileResponse {
  displayName: string;
  role: string;
  appearance: AssistantAppearance;
  visualStyle?: AssistantVisualStyle;
  personality: AssistantPersonality;
  voice: {
    inworldVoiceIdIt?: string;
    inworldVoiceIdEn?: string;
    provider: "inworld";
    model: "inworld-tts-2" | "inworld-tts-2-flash";
    style: AssistantVoiceStyle;
    speakingRate: number;
    pronunciationProfile: string;
  };
  connected: boolean;
  updatedAt?: string;
}

import { meetingTtsConfig } from "@/lib/meeting-tts-config";
import { connectToDatabase } from "@/lib/mongodb";
import { AssistantProfileModel } from "@/models/AssistantProfile";
import type { AssistantProfileResponse } from "@/types/assistant-profile";

export const DEFAULT_ASSISTANT_PROFILE = {
  key: "default" as const,
  displayName: "Conclavia",
  role: "Collega digitale",
  appearance: "business_clay" as const,
  personality: {
    responseStyle: "balanced" as const,
    attitude: "collaborative" as const,
  },
  voice: {
    provider: "inworld" as const,
    model: meetingTtsConfig().model,
    style: "executive_warm" as const,
    speakingRate: 0.96,
    pronunciationProfile: "inworld-it-en",
  },
};

export async function getAssistantProfile(): Promise<AssistantProfileResponse> {
  await connectToDatabase();
  const profile = await AssistantProfileModel.findOne({ key: "default" }).exec();
  const source = profile || DEFAULT_ASSISTANT_PROFILE;

  return {
    displayName: source.displayName,
    role: source.role,
    appearance: source.appearance,
    personality: {
      responseStyle:
        source.personality?.responseStyle ||
        DEFAULT_ASSISTANT_PROFILE.personality.responseStyle,
      attitude:
        source.personality?.attitude || DEFAULT_ASSISTANT_PROFILE.personality.attitude,
    },
    voice: {
      inworldVoiceIdIt: profile?.voice.inworldVoiceIdIt,
      inworldVoiceIdEn: profile?.voice.inworldVoiceIdEn,
      provider: DEFAULT_ASSISTANT_PROFILE.voice.provider,
      model: meetingTtsConfig().model,
      style: source.voice?.style || DEFAULT_ASSISTANT_PROFILE.voice.style,
      speakingRate:
        source.voice?.speakingRate || DEFAULT_ASSISTANT_PROFILE.voice.speakingRate,
      pronunciationProfile: DEFAULT_ASSISTANT_PROFILE.voice.pronunciationProfile,
    },
    connected: false,
    updatedAt: profile?.updatedAt.toISOString(),
  };
}

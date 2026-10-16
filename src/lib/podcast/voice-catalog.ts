import { findPodcastVoice, type PodcastVoiceProvider } from "@conclavia/avatar-kit/lib/podcast-voice-catalog";
export function findStudioVoice(id: string, provider: PodcastVoiceProvider = "inworld", language?: string) {
  return findPodcastVoice(id, provider, language);
}

import { isAvatarVoice } from "@/lib/avatar-voice-catalog";
import { meetingTtsConfig } from "@/lib/meeting-tts-config";
import { findPodcastVoice, podcastVoiceProvider, KOKORO_PODCAST_SPEED, type PodcastVoiceProvider } from "@conclavia/avatar-kit/lib/podcast-voice-catalog";
import { localKokoroHealth } from "@conclavia/avatar-kit/lib/local-kokoro-tts";
import type { TalkRunRecord } from "@/models/PodcastRun";

/** Flags/loopback health only. Never synthesize speech while loading configuration. */
export async function publicPodcastSpeechConfig() {
  const enabled = process.env.PODCAST_SPEECH_ENABLED === "true";
  const { ready, model } = meetingTtsConfig();
  const providers = { inworld: enabled && ready, kokoro: enabled && await localKokoroHealth() };
  return { enabled, ready: providers.inworld || providers.kokoro, model, providers };
}

/** Only stored AI turns can be voiced; operator text and guest speech stay human. */
export function podcastSpeechOptions(run: Pick<TalkRunRecord, "talkSnapshot" | "messages">, sequence: number): {
  text: string; language: "it" | "en"; voiceId: string; speakingRate: number; provider: PodcastVoiceProvider;
} | undefined {
  const snapshot = run.talkSnapshot;
  const message = run.messages.find((item) => item.sequence === sequence);
  if (!snapshot || !message || message.origin !== "ai" || !message.content.trim() || message.content.length > 4_000) return;
  if (snapshot.language !== "it" && snapshot.language !== "en") return;
  const language = snapshot.language;
  const speaker = message.speakerType === "moderator" ? snapshot.moderator : snapshot.participants[message.participantIndex ?? -1];
  if (!speaker || speaker.kind !== "ai") return;
  const female = "sex" in speaker && speaker.sex === "female";
  const provider = podcastVoiceProvider(snapshot.settings?.voiceProvider);
  if (provider === "kokoro") {
    if (language !== "it" || message.content.length > 2000) return;
    const fallback = female ? "if_sara" : "im_nicola";
    const voiceId = speaker.voiceId && findPodcastVoice(speaker.voiceId, provider, language, female ? "female" : "male") ? speaker.voiceId : fallback;
    return { text: message.content, language, voiceId, speakingRate: KOKORO_PODCAST_SPEED, provider };
  }
  const fallback = language === "it" ? female ? "Orietta" : "Gianni" : female ? "Olivia" : "Dennis";
  const voiceId = speaker.voiceId && isAvatarVoice(speaker.voiceId, language) ? speaker.voiceId : fallback;
  const speakingRate = speaker.voiceDelivery === "energetic" ? 1.06 : speaker.voiceDelivery === "authoritative" ? 0.94 : 1;
  return { text: message.content, language, voiceId, speakingRate, provider };
}

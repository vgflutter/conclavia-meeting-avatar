import { isAvatarVoice } from "@/lib/avatar-voice-catalog";
import { meetingTtsConfig } from "@/lib/meeting-tts-config";
import type { TalkRunRecord } from "@/models/PodcastRun";

export function publicPodcastSpeechConfig() {
  const enabled = process.env.PODCAST_SPEECH_ENABLED === "true";
  const { ready, model } = meetingTtsConfig();
  return { enabled, ready: enabled && ready, model };
}

/** Only stored AI turns can be voiced; operator text and guest speech stay human. */
export function podcastSpeechOptions(run: Pick<TalkRunRecord, "talkSnapshot" | "messages">, sequence: number): {
  text: string; language: "it" | "en"; voiceId: string; speakingRate: number;
} | undefined {
  const snapshot = run.talkSnapshot;
  const message = run.messages.find((item) => item.sequence === sequence);
  if (!snapshot || !message || message.origin !== "ai" || !message.content.trim() || message.content.length > 4_000) return;
  if (snapshot.language !== "it" && snapshot.language !== "en") return;
  const language = snapshot.language;
  const speaker = message.speakerType === "moderator"
    ? snapshot.moderator
    : snapshot.participants[message.participantIndex ?? -1];
  if (!speaker || speaker.kind !== "ai") return;
  const female = "sex" in speaker && speaker.sex === "female";
  const fallback = language === "it" ? female ? "Orietta" : "Gianni" : female ? "Olivia" : "Dennis";
  const voiceId = speaker.voiceId && isAvatarVoice(speaker.voiceId, language) ? speaker.voiceId : fallback;
  const speakingRate = speaker.voiceDelivery === "energetic" ? 1.06 : speaker.voiceDelivery === "authoritative" ? 0.94 : 1;
  return { text: message.content, language, voiceId, speakingRate };
}

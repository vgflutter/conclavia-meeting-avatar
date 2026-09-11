export type MeetingTtsProvider = "inworld";
export type InworldModel = "inworld-tts-2-flash" | "inworld-tts-2";

// Server-side configuration only. Never return credentials in a page or API response.
export function meetingTtsConfig(env: Record<string, string | undefined> = process.env) {
  const provider = env.MEETING_TTS_PROVIDER || "inworld";
  const model = env.INWORLD_TTS_MODEL || "inworld-tts-2-flash";
  const voiceId = env.INWORLD_VOICE_ID?.trim() || "Dennis";
  const italianVoiceId = env.INWORLD_VOICE_ID_IT?.trim() || "Gianni";
  const apiKey = env.INWORLD_API_KEY?.trim() || "";
  const valid = provider === "inworld" &&
    ["inworld-tts-2-flash", "inworld-tts-2"].includes(model);
  return {
    provider: "inworld" as MeetingTtsProvider,
    model: model as InworldModel,
    voiceId, italianVoiceId, apiKey,
    ready: valid && Boolean(apiKey),
  };
}

export function publicMeetingTtsConfig() {
  const { provider, model, ready } = meetingTtsConfig();
  return { provider, model, ready };
}

export function selectedMeetingVoices(voice: { inworldVoiceIdIt?: string; inworldVoiceIdEn?: string }, config = meetingTtsConfig()) {
  return { it: voice.inworldVoiceIdIt || config.italianVoiceId, en: voice.inworldVoiceIdEn || config.voiceId };
}

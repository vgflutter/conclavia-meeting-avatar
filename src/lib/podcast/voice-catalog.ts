import { AVATAR_VOICES } from "@conclavia/avatar-kit/lib/avatar-voice-catalog";

/** Compatibility for recovered podcast configuration; canonical catalog owns voices. */
export function findStudioVoice(id: string) {
  const voice = AVATAR_VOICES.find((entry) => entry.id === id);
  return voice ? { ...voice, sex: voice.gender } : undefined;
}

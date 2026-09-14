import type { AssistantAppearance } from "@/types/assistant-profile";

export const DEFAULT_SPEAKING_RATE = 1;

// Provider identity is distinct from voice ID and avatar identity. Only Inworld
// is integrated today; adding a catalog label does not enable another TTS backend.
export const VOICE_PROVIDERS = { inworld: { id: "inworld", name: "Inworld" } } as const;
export type VoiceProviderId = keyof typeof VOICE_PROVIDERS;
export const VOICE_CATALOG_VERIFIED_AT = "2026-09-13";

// Italian SYSTEM + community catalogs verified with the official read-only API.
// Community gender uses the explicit field where present, otherwise the voice's
// unambiguous published description (man/woman), never its display name.
// Keep native language/accent explicit; cross-lingual synthesis is not a native voice.
export const AVATAR_VOICES = ([
  { id: "Gianni", language: "it", accent: "IT", name: "Gianni", gender: "male", source: "system" },
  { id: "Orietta", language: "it", accent: "IT", name: "Orietta", gender: "female", source: "system" },
  { id: "community-rxgdeftvn9dc", language: "it", accent: "IT", name: "Capitano", gender: "male", source: "community" },
  { id: "community-wogdp7fnk36a", language: "it", accent: "IT", name: "Ingegnere", gender: "male", source: "community" },
  { id: "community-kvd4dbkrdpds", language: "it", accent: "IT", name: "Cuoco", gender: "male", source: "community" },
  { id: "community-detz4fjemm8q", language: "it", accent: "IT", name: "Voce Sistema", gender: "female", source: "community" },
  { id: "Dennis", language: "en", accent: "US", name: "Dennis", gender: "male", source: "system" },
  { id: "Edward", language: "en", accent: "US", name: "Edward", gender: "male", source: "system" },
  { id: "Alex", language: "en", accent: "US", name: "Alex", gender: "male", source: "system" },
  { id: "Alistair", language: "en", accent: "UK", name: "Alistair", gender: "male", source: "system" },
  { id: "Olivia", language: "en", accent: "UK", name: "Olivia", gender: "female", source: "system" },
  { id: "Eleanor", language: "en", accent: "UK", name: "Eleanor", gender: "female", source: "system" },
] as const).map(voice => ({ ...voice, provider: "inworld" as const }));

export function isAvatarVoice(value: unknown, language: unknown, provider: unknown = "inworld"): value is string {
  return typeof value === "string" && AVATAR_VOICES.some((voice) => voice.provider === provider && voice.id === value && voice.language === language);
}

export function avatarVoiceName(id: string, provider: VoiceProviderId = "inworld") {
  return AVATAR_VOICES.find(voice => voice.provider === provider && voice.id === id)?.name ?? id;
}

export function avatarVoiceLocale(id: string, language: "it" | "en") {
  if (language === "it") return "it-IT";
  const voice = AVATAR_VOICES.find(voice => voice.id === id && voice.language === language);
  // Respect a catalogued regional accent; do not impose an American accent on
  // a custom English voice whose native region we do not know.
  return voice?.accent === "UK" ? "en-GB" : voice?.accent === "US" ? "en-US" : "en";
}

export function voicesForAppearance(appearance: AssistantAppearance, language: "it" | "en", provider: VoiceProviderId = "inworld") {
  const gender = appearance === "business_clay_female" ? "female" : "male";
  return AVATAR_VOICES.filter(voice => voice.provider === provider && voice.language === language && voice.gender === gender);
}

export function compatibleAvatarVoice(value: string, language: "it" | "en", appearance: AssistantAppearance) {
  if (voicesForAppearance(appearance, language).some(voice => voice.id === value)) return value;
  return appearance === "business_clay_female"
    ? language === "it" ? "Orietta" : "Eleanor"
    : language === "it" ? "Gianni" : "Dennis";
}

// Curated SYSTEM voices verified against Inworld's voice catalog on 2026-09-11.
// Keep native language/accent explicit; cross-lingual synthesis is not a native voice.
export const AVATAR_VOICES = [
  { id: "Gianni", language: "it", accent: "IT", name: "Gianni" },
  { id: "Orietta", language: "it", accent: "IT", name: "Orietta" },
  { id: "Dennis", language: "en", accent: "US", name: "Dennis" },
  { id: "Edward", language: "en", accent: "US", name: "Edward" },
  { id: "Alex", language: "en", accent: "US", name: "Alex" },
  { id: "Alistair", language: "en", accent: "UK", name: "Alistair" },
  { id: "Olivia", language: "en", accent: "UK", name: "Olivia" },
  { id: "Eleanor", language: "en", accent: "UK", name: "Eleanor" },
] as const;

export function isAvatarVoice(value: unknown, language: unknown): value is string {
  return typeof value === "string" && AVATAR_VOICES.some((voice) => voice.id === value && voice.language === language);
}

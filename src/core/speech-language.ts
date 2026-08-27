import {
  speechLanguages,
  type SpeechLanguage,
} from "../domain/protocol.js";

const englishSignals = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "could",
  "from",
  "good",
  "have",
  "hello",
  "how",
  "is",
  "meeting",
  "please",
  "ready",
  "should",
  "summarize",
  "team",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "why",
  "will",
  "with",
  "would",
  "you",
]);

const italianSignals = new Set([
  "a",
  "che",
  "come",
  "con",
  "cosa",
  "da",
  "del",
  "della",
  "di",
  "e",
  "gli",
  "il",
  "in",
  "la",
  "le",
  "lo",
  "ma",
  "non",
  "per",
  "puoi",
  "questa",
  "questo",
  "sono",
  "un",
  "una",
]);

function languageScore(text: string, signals: ReadonlySet<string>): number {
  return text
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/[a-z]+/gu)
    ?.reduce((score, token) => score + (signals.has(token) ? 1 : 0), 0) ?? 0;
}

/**
 * Treat model-provided language metadata as a hint, but repair an obvious
 * mismatch before selecting a native TTS voice. Technical English words in
 * an Italian sentence do not switch the whole sentence to another speaker.
 */
export function resolveSpeechLanguage(
  declared: unknown,
  text: string,
): SpeechLanguage {
  const english = languageScore(text, englishSignals);
  const italian = languageScore(text, italianSignals);

  if (english >= 2 && english > italian) return "en-US";
  if (italian >= 2 && italian > english) return "it-IT";
  if (
    typeof declared === "string" &&
    (speechLanguages as readonly string[]).includes(declared)
  ) {
    return declared as SpeechLanguage;
  }
  return english > italian ? "en-US" : "it-IT";
}

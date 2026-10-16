import type { PodcastEmotion } from "@conclavia/avatar-kit/types/podcast";
import type { TalkRunPerformance, TalkRunSentencePerformance } from "@/types/podcast-run";

/** The renderer's acting vocabulary; no free-form sentiments enter an animation. */
export const PODCAST_MOODS = [
  "attention", "curiosity", "doubt", "agreement", "amusement", "empathy", "disagreement", "surprise",
] as const satisfies readonly PodcastEmotion[];
export const MAX_PERFORMANCE_SENTENCES = 24;
export const MAX_PERFORMANCE_SENTENCE_LENGTH = 1_600;
/** Kokoro's current speech request limit also bounds the whole intervention. */
export const MAX_PERFORMANCE_TEXT_LENGTH = 2_000;

const sentenceProperties = {
  text: { type: "string", minLength: 1, maxLength: MAX_PERFORMANCE_SENTENCE_LENGTH },
  mood: { type: "string", enum: [...PODCAST_MOODS] },
  intensity: { type: "number", minimum: 0, maximum: 1 },
  listenerMood: { type: "string", enum: [...PODCAST_MOODS] },
  listenerIntensity: { type: "number", minimum: 0, maximum: 1 },
};

export const TURN_PERFORMANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sentences"],
  properties: {
    sentences: {
      type: "array", minItems: 1, maxItems: MAX_PERFORMANCE_SENTENCES,
      items: {
        type: "object", additionalProperties: false,
        required: Object.keys(sentenceProperties), properties: sentenceProperties,
      },
    },
  },
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function mood(value: unknown): value is PodcastEmotion {
  return typeof value === "string" && PODCAST_MOODS.some((candidate) => candidate === value);
}

function intensity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Splits only for coverage, keeping each annotation on every constituent sentence. */
export function splitPerformanceSentences(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text),
    (entry) => normalizeText(entry.segment)).filter(Boolean);
}

/** Reject malformed provider output rather than speaking JSON or guessing missing moods. */
export function parseGeneratedPerformance(value: unknown): { content: string; performance: TalkRunPerformance } {
  if (!record(value) || !exactKeys(value, ["sentences"]) || !Array.isArray(value.sentences) ||
    value.sentences.length < 1 || value.sentences.length > MAX_PERFORMANCE_SENTENCES) {
    throw new Error("Invalid podcast performance: expected a bounded sentence list");
  }
  const sentences: TalkRunSentencePerformance[] = [];
  for (const entry of value.sentences) {
    if (!record(entry) || !exactKeys(entry, Object.keys(sentenceProperties)) ||
      typeof entry.text !== "string" || entry.text.length > MAX_PERFORMANCE_SENTENCE_LENGTH ||
      !normalizeText(entry.text) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(entry.text) ||
      !mood(entry.mood) || !mood(entry.listenerMood) ||
      !intensity(entry.intensity) || !intensity(entry.listenerIntensity)) {
      throw new Error("Invalid podcast performance: each sentence needs valid text and acting directions");
    }
    for (const text of splitPerformanceSentences(entry.text)) {
      sentences.push({ text, mood: entry.mood, intensity: entry.intensity,
        listenerMood: entry.listenerMood, listenerIntensity: entry.listenerIntensity });
    }
  }
  const content = sentences.map((entry) => entry.text).join(" ");
  if (!content || content.length > MAX_PERFORMANCE_TEXT_LENGTH || sentences.length > MAX_PERFORMANCE_SENTENCES) {
    throw new Error("Invalid podcast performance: spoken text exceeds its bounds");
  }
  return { content, performance: { version: 1, source: "ai", sentences } };
}

/** Safe migration at read time: old AI text remains exact, with visibly labelled neutral acting. */
export function resolveMessagePerformance(message: {
  origin?: "ai" | "human"; provider?: unknown; content: string; performance?: unknown;
}): TalkRunPerformance | undefined {
  if ((message.origin ?? (message.provider ? "ai" : "human")) !== "ai") return undefined;
  const stored = message.performance;
  if (record(stored) && stored.version === 1 && (stored.source === "ai" || stored.source === "legacy")) {
    try {
      const parsed = parseGeneratedPerformance({ sentences: stored.sentences });
      if (parsed.content === message.content.trim()) {
        return { ...parsed.performance, source: stored.source };
      }
    } catch { /* Old or malformed annotations never overrule the original spoken content. */ }
  }
  const originalText = message.content.trim();
  const split = splitPerformanceSentences(originalText);
  // A legacy transcript may carry meaningful line breaks or unusual spacing.
  // Keep one neutral direction for that exact text rather than rewriting speech
  // merely to manufacture sentence boundaries that were never annotated.
  const sentences = split.length <= MAX_PERFORMANCE_SENTENCES && split.join(" ") === originalText
    ? split : originalText ? [originalText] : [];
  return {
    version: 1, source: "legacy",
    sentences: sentences.map((text) => ({ text, mood: "attention", intensity: 0.3,
      listenerMood: "attention", listenerIntensity: 0.25 })),
  };
}

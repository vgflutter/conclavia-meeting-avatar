import type { TranscriptSegment } from "../domain/protocol.js";

const echoWindowMs = 30_000;
const exactShortEchoWindowMs = 8_000;

function normalizedWords(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function overlapRatio(candidate: readonly string[], reference: readonly string[]): number {
  const candidateWords = new Set(candidate);
  const referenceWords = new Set(reference);
  let overlap = 0;
  for (const word of candidateWords) {
    if (referenceWords.has(word)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(candidateWords.size, referenceWords.size));
}

function bigrams(words: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (let index = 1; index < words.length; index += 1) {
    result.add(`${words[index - 1]} ${words[index]}`);
  }
  return result;
}

function orderedOverlapRatio(candidate: readonly string[], reference: readonly string[]): number {
  const candidateBigrams = bigrams(candidate);
  const referenceBigrams = bigrams(reference);
  let overlap = 0;
  for (const pair of candidateBigrams) {
    if (referenceBigrams.has(pair)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(candidateBigrams.size, referenceBigrams.size));
}

/**
 * The meeting output and Mary playback can share a virtual audio bus. Reject a
 * recent, near-verbatim replay of Mary's own speech before it enters memory or
 * reaches the LLM. The four-word floor deliberately avoids swallowing short
 * human acknowledgements such as "sì" or "no".
 */
export function isLikelyAvatarSpeechEcho(
  segment: TranscriptSegment,
  history: readonly TranscriptSegment[],
  avatarName: string,
): boolean {
  // Older local-listener segments did not set `source`. Treat an omitted
  // source as speech for backwards compatibility, while still excluding
  // explicit manual/chat events from acoustic echo suppression.
  if (!segment.isFinal || (segment.source && segment.source !== "speech")) return false;
  if (segment.speakerName.localeCompare(avatarName, undefined, { sensitivity: "accent" }) === 0) {
    return false;
  }

  const candidate = normalizedWords(segment.text);
  if (candidate.length < 2) return false;
  const capturedAt = Date.parse(segment.capturedAt);
  const referenceTime = Number.isFinite(capturedAt) ? capturedAt : Date.now();

  return history.slice(-12).some((prior) => {
    if (prior.source !== "speech") return false;
    if (prior.speakerName.localeCompare(avatarName, undefined, { sensitivity: "accent" }) !== 0) {
      return false;
    }
    const priorCapturedAt = Date.parse(prior.capturedAt);
    if (
      Number.isFinite(priorCapturedAt) &&
      Math.abs(referenceTime - priorCapturedAt) > echoWindowMs
    ) {
      return false;
    }

    const reference = normalizedWords(prior.text);
    const exactMatch = candidate.join(" ") === reference.join(" ");
    if (candidate.length < 4 || reference.length < 4) {
      return exactMatch && (
        !Number.isFinite(priorCapturedAt) ||
        Math.abs(referenceTime - priorCapturedAt) <= exactShortEchoWindowMs
      );
    }
    if (exactMatch) return true;
    return overlapRatio(candidate, reference) >= 0.7 &&
      orderedOverlapRatio(candidate, reference) >= 0.45;
  });
}

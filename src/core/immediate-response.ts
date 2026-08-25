import { randomUUID } from "node:crypto";

import type { AvatarSpeechCue, TranscriptSegment } from "../domain/protocol.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addressedRemainder(text: string, avatarName: string): string | null {
  const escapedName = escapeRegExp(avatarName);
  const match = new RegExp(
    `^(?:(?:ciao|buongiorno|buonasera|salve|ehi|hey|scusa|scusami|senti)[\\s,.:;!?-]+)?(?:@\\s*)?${escapedName}(?:$|[\\s,.:;!?-]+)(?<remainder>.*)$`,
    "iu",
  ).exec(text.trim());
  return match?.groups?.remainder?.trim() ?? (match ? "" : null);
}

function normalizedIntent(value: string): string {
  return value
    .toLocaleLowerCase("it-IT")
    .replace(/[’']/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Resolve tiny presence checks locally. These phrases do not need meeting
 * context or factual reasoning, so sending them to the LLM only adds latency.
 * The match is deliberately strict: a substantive question always continues
 * through the normal intelligence path.
 */
export function immediateResponseFor(
  segment: TranscriptSegment,
  avatarName: string,
): AvatarSpeechCue | null {
  const remainder = addressedRemainder(segment.text, avatarName);
  if (remainder === null) return null;

  const intent = normalizedIntent(remainder);
  let text: string | null = null;

  if (/^(?:mi ascolti|stai ascoltando)(?: bene| ora| adesso)?$/u.test(intent)) {
    text = "Sì, ti ascolto.";
  } else if (/^(?:mi senti|riesci a sentirmi)(?: bene| ora| adesso)?$/u.test(intent)) {
    text = "Sì, ti sento.";
  } else if (/^(?:ci sei|sei (?:qui|lì|li|pronta|attiva|collegata|online))$/u.test(intent)) {
    text = "Sì, sono qui e sono pronta.";
  } else if (/^(?:ciao|buongiorno|buonasera|salve|ehi|hey)?$/u.test(intent)) {
    text = "Ciao! Sono qui.";
  }

  if (!text) return null;
  return {
    id: randomUUID(),
    kind: "speak",
    provider: "system",
    model: null,
    speakerName: avatarName,
    sentences: [{
      text,
      mood: "attentive",
      level: 2,
      language: "it-IT",
    }],
    addressedTo: segment.speakerName,
    sourceSegmentIds: [segment.id],
    createdAt: new Date().toISOString(),
  };
}

import { randomUUID } from "node:crypto";

import type {
  AvatarSpeechCue,
  AvatarSpeechSentence,
  TranscriptSegment,
} from "../domain/protocol.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addressedRemainder(text: string, avatarName: string): string | null {
  const escapedName = escapeRegExp(avatarName);
  const match = new RegExp(
    `^(?:(?:(?:ciao|buongiorno|buonasera|salve|ehi|hey|scusa|scusami|senti)[\\s,.:;!?-]+){1,3})?(?:@\\s*)?${escapedName}(?:$|[\\s,.:;!?-]+)(?<remainder>.*)$`,
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

function isCapabilitiesIntent(intent: string): boolean {
  return /^(?:(?:puoi|potresti|mi puoi|mi potresti)\s+)?(?:elencare|elenca|spiegare|spiega|descrivere|descrivi|raccontare|racconta)\s+(?:brevemente\s+)?(?:le\s+)?(?:tue\s+)?(?:funzionalit[àa]|funzioni|capacit[àa]|possibilit[àa])$/u.test(intent) ||
    /^(?:quali sono|dimmi)\s+(?:le\s+)?(?:tue\s+)?(?:funzionalit[àa]|funzioni|capacit[àa]|possibilit[àa])$/u.test(intent) ||
    /^(?:cosa|che cosa)\s+(?:sai|puoi)\s+fare$/u.test(intent);
}

function sentence(
  text: string,
  mood: AvatarSpeechSentence["mood"] = "attentive",
  level: AvatarSpeechSentence["level"] = 2,
): AvatarSpeechSentence {
  return { text, mood, level, language: "it-IT" };
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
  let sentences: AvatarSpeechSentence[] | null = null;

  if (/^(?:mi ascolti|stai ascoltando)(?: bene| ora| adesso)?$/u.test(intent)) {
    sentences = [sentence("Sì, ti ascolto.")];
  } else if (/^(?:mi senti|riesci a sentirmi)(?: bene| ora| adesso)?$/u.test(intent)) {
    sentences = [sentence("Sì, ti sento.")];
  } else if (/^(?:ci sei|sei (?:qui|lì|li|pronta|attiva|collegata|online))$/u.test(intent)) {
    sentences = [sentence("Sì, sono qui e sono pronta.")];
  } else if (/^(?:(?:ciao|buongiorno|buonasera|salve|ehi|hey)(?:\s+|$)){0,3}$/u.test(intent)) {
    sentences = [sentence("Ciao! Sono qui.")];
  } else if (isCapabilitiesIntent(intent)) {
    sentences = [
      sentence(
        "Posso ascoltare e ricordare il contesto della riunione, rispondere quando mi chiamate e verificare informazioni sul web quando serve.",
        "confident",
      ),
      sentence(
        "Posso chiedere la parola davanti a errori od omissioni importanti, alzare o abbassare la mano, applaudire e reagire con espressioni coerenti mentre ascolto e parlo.",
        "assertive",
      ),
      sentence(
        "Posso anche riassumere la discussione, seguire una scaletta con i tempi e salutare i partecipanti.",
        "amused",
      ),
    ];
  }

  if (!sentences) return null;
  return {
    id: randomUUID(),
    kind: "speak",
    provider: "system",
    model: null,
    speakerName: avatarName,
    sentences,
    addressedTo: segment.speakerName,
    sourceSegmentIds: [segment.id],
    createdAt: new Date().toISOString(),
  };
}

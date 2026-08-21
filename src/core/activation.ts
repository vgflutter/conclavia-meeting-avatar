import { randomUUID } from "node:crypto";

import type {
  ActivationDecision,
  AvatarMood,
  AvatarSpeechCue,
  TranscriptSegment,
} from "../domain/protocol.js";

const moodRules: ReadonlyArray<readonly [RegExp, AvatarMood]> = [
  [/\b(non sono d'accordo|sbagliato|contesto|assurdo)\b/i, "skeptical"],
  [/\b(preoccupa|rischio|problema|pericolo)\b/i, "concerned"],
  [/\b(divertente|ridere|ironico|buffo)\b/i, "amused"],
  [/\b(sorpresa|incredibile|inaspettato)\b/i, "surprised"],
  [/\b(cosa ne pensi|perché|come mai|domanda)\b/i, "curious"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectDiagnosticMood(text: string): AvatarMood {
  return moodRules.find(([pattern]) => pattern.test(text))?.[1] ?? "attentive";
}

export function decideActivation(
  segment: TranscriptSegment,
  wakeWord: string,
  conversationActive = false,
): ActivationDecision {
  if (!segment.isFinal) {
    return { ingested: false, activated: false, reason: "not-final" };
  }

  const wakeWordPattern = new RegExp(`\\b${escapeRegExp(wakeWord)}\\b`, "i");
  const containsWakeWord = wakeWordPattern.test(segment.text);
  if (!containsWakeWord && !conversationActive) {
    return { ingested: true, activated: false, reason: "not-addressed" };
  }

  const cue: AvatarSpeechCue = {
    id: randomUUID(),
    kind: "speak",
    provider: "diagnostic",
    model: null,
    sentences: [
      {
        text: `Ricevuto, ${segment.speakerName}. Il collegamento tra trascrizione e avatar funziona.`,
        mood: selectDiagnosticMood(segment.text),
      },
    ],
    addressedTo: segment.speakerName,
    sourceSegmentIds: [segment.id],
    createdAt: new Date().toISOString(),
  };

  return {
    ingested: true,
    activated: true,
    reason: containsWakeWord ? "wake-word" : "conversation-follow-up",
    cue,
  };
}

export function isDialogueDismissal(text: string, wakeWord: string): boolean {
  const escapedWakeWord = escapeRegExp(wakeWord);
  const wakeWordPattern = `\\b${escapedWakeWord}\\b`;
  const dismissalPattern =
    "(?:grazie|basta(?:\\s+così)?|fermati|stop|smett(?:i|ere)(?:\\s+di\\s+(?:rispondere|intervenire))?|non\\s+(?:rispondere|intervenire)|torna\\s+in\\s+ascolto)";
  return new RegExp(
    `(?:${wakeWordPattern}[\\s,.:;!?-]*(?:puoi\\s+)?${dismissalPattern}|${dismissalPattern}[\\s,.:;!?-]*${wakeWordPattern})`,
    "i",
  ).test(text);
}

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

export function isDialogueFollowUpCandidate(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  if (value.endsWith("?") && value.split(/\s+/u).length >= 2) return true;
  return /\b(?:secondo\s+te|tu\s+cosa|che\s+ne\s+pensi|cosa\s+ne\s+pensi|puoi|potresti|riesci|dimmi|spiegami|continua|approfondisci|ripeti|elabora|rispondi|what\s+do\s+you|do\s+you|can\s+you|could\s+you|would\s+you|tell\s+(?:me|us)|explain|continue|elaborate|repeat)\b/iu.test(value)
    || /^(?:(?:e|ma|quindi|allora)[\s,]+)?(?:perch[eéè]|come|quando|dove|quale|quali|chi|cosa|quanto|quanta|quanti|quante|in\s+che\s+senso|per\s+(?:domani|oggi|quest[oa]|il|la|i|le)|invece)(?=$|[\s,.:;!?-])[^.]*\??$/iu.test(value);
}

export function isAddressedToAvatar(text: string, wakeWord: string): boolean {
  const value = text.trim();
  const name = wakeWord.trim();
  if (!value || !name) return false;

  // The configured avatar name is an explicit wake trigger wherever it occurs
  // in a finalized meeting turn. Transcription frequently removes vocative
  // commas ("Ciao Pippo Mary, come stai?"); requiring punctuation or the name
  // at the beginning therefore loses real invocations. Unicode token guards
  // still prevent partial-name matches such as "Mariano" or "Maryland".
  const escapedWakeWord = escapeRegExp(name).replace(/\s+/gu, "\\s+");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}_])(?:@\\s*)?${escapedWakeWord}(?=$|[^\\p{L}\\p{N}_])`,
    "iu",
  ).test(value);
}

export function decideActivation(
  segment: TranscriptSegment,
  wakeWord: string,
  conversationActive = false,
): ActivationDecision {
  if (!segment.isFinal) {
    return { ingested: false, activated: false, reason: "not-final" };
  }

  const directlyAddressed = isAddressedToAvatar(segment.text, wakeWord);
  if (
    !directlyAddressed &&
    !(conversationActive && isDialogueFollowUpCandidate(segment.text))
  ) {
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
        level: 3,
        language: "it-IT",
      },
    ],
    addressedTo: segment.speakerName,
    sourceSegmentIds: [segment.id],
    createdAt: new Date().toISOString(),
  };

  return {
    ingested: true,
    activated: true,
    reason: directlyAddressed ? "wake-word" : "conversation-follow-up",
    cue,
  };
}

export function isDialogueDismissal(text: string, wakeWord: string): boolean {
  const escapedWakeWord = escapeRegExp(wakeWord);
  const wakeWordPattern = `\\b${escapedWakeWord}\\b`;
  const dismissalPattern =
    "(?:grazie|thanks?|thank\\s+you|basta(?:\\s+così)?|fermati|stop|smett(?:i|ere)(?:\\s+di\\s+(?:rispondere|intervenire))?|non\\s+(?:rispondere|intervenire)|do\\s+not\\s+(?:answer|speak|intervene)|torna\\s+in\\s+ascolto)";
  return new RegExp(
    `(?:${wakeWordPattern}[\\s,.:;!?-]*(?:puoi\\s+)?${dismissalPattern}|${dismissalPattern}[\\s,.:;!?-]*${wakeWordPattern})`,
    "i",
  ).test(text);
}

export function isFloorGrant(text: string, wakeWord: string): boolean {
  const escapedWakeWord = escapeRegExp(wakeWord);
  const wakeWordPattern = `\\b${escapedWakeWord}\\b`;
  const grantPattern =
    "(?:vai|prego|parla|intervieni|dicci|puoi\\s+(?:parlare|intervenire)|sentiamo|go\\s+ahead|speak|tell\\s+us|you\\s+can\\s+(?:speak|intervene))";
  return new RegExp(
    `(?:${wakeWordPattern}[\\s,.:;!?-]*(?:ora\\s+)?${grantPattern}|${grantPattern}[\\s,.:;!?-]*(?:pure[\\s,.:;!?-]*)?${wakeWordPattern})`,
    "i",
  ).test(text);
}

export function isAutonomyCandidate(text: string): boolean {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length < 5 || text.trim().length < 24) return false;
  return !/^(?:s[ìi]|no|ok(?:ay)?|ecco|allora|bene|capito|perfetto|grazie)[\s,.:;!?-]*$/iu
    .test(text.trim());
}

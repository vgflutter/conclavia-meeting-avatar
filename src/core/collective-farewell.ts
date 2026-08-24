import { randomUUID } from "node:crypto";

import type {
  AvatarSpeechCue,
  SpeechLanguage,
  TranscriptSegment,
} from "../domain/protocol.js";

const farewellWindowMs = 55_000;
const farewellCooldownMs = 5 * 60_000;

const italianClearFarewell = /\b(?:arrivederci|a\s+presto|alla\s+prossima|ci\s+vediamo|buona\s+(?:serata|notte|continuazione|giornata)|buon\s+(?:weekend|fine\s+settimana|rientro)|possiamo\s+chiudere|direi\s+che\s+(?:possiamo\s+)?chiudere|chiudiamo\s+qui)\b/iu;
const englishClearFarewell = /\b(?:goodbye|bye(?:\s+bye)?|see\s+you(?:\s+(?:soon|next\s+time|later))?|good\s+night|have\s+a\s+good\s+(?:day|evening|weekend)|let(?:'|’)s\s+wrap\s+up)\b/iu;
const ambiguousItalianFarewell = /^\s*(?:ok[,\s]*)?(?:ciao(?:\s+ciao)?|saluti)(?:\s+a\s+tutt[ie])?[\s.!?]*$/iu;
const explicitCollectiveFarewell = /\b(?:buona\s+(?:serata|notte|giornata)\s+a\s+tutt[ie]|arrivederci\s+a\s+tutt[ie]|goodbye\s+everyone|bye\s+everyone|good\s+(?:night|evening)\s+everyone)\b/iu;

interface FarewellSignal {
  clear: boolean;
  collective: boolean;
  language: SpeechLanguage;
}

export interface CollectiveFarewellDecision {
  meetingKey: string;
  signalCount: number;
  participantCount: number;
  cue: AvatarSpeechCue;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function meetingKey(segment: TranscriptSegment): string {
  return `${segment.platform ?? "generic"}:${segment.meetingId ?? "default"}`;
}

function sameMeeting(left: TranscriptSegment, right: TranscriptSegment): boolean {
  return meetingKey(left) === meetingKey(right);
}

function participantKey(segment: TranscriptSegment): string {
  return segment.speakerId?.trim() || normalize(segment.speakerName);
}

function farewellSignal(text: string): FarewellSignal | null {
  const english = englishClearFarewell.test(text);
  const italian = italianClearFarewell.test(text);
  const ambiguous = ambiguousItalianFarewell.test(text);
  if (!english && !italian && !ambiguous) return null;
  return {
    clear: english || italian,
    collective: explicitCollectiveFarewell.test(text),
    language: english ? "en-US" : "it-IT",
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function capturedTime(segment: TranscriptSegment, fallback: number): number {
  const parsed = Date.parse(segment.capturedAt);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function farewellCue(
  avatarName: string,
  language: SpeechLanguage,
  sourceSegmentIds: string[],
): AvatarSpeechCue {
  return {
    id: randomUUID(),
    kind: "speak",
    provider: "system",
    model: null,
    speakerName: avatarName,
    sentences: [{
      text: language === "en-US"
        ? "Thank you everyone, it was a pleasure. See you soon!"
        : "Grazie a tutti, è stato un piacere. A presto!",
      mood: "amused",
      level: 2,
      language,
    }],
    addressedTo: "meeting",
    sourceSegmentIds,
    createdAt: new Date().toISOString(),
  };
}

export class CollectiveFarewellTracker {
  readonly #lastFarewellByMeeting = new Map<string, number>();

  consider(
    history: readonly TranscriptSegment[],
    latest: TranscriptSegment,
    avatarName: string,
    now = capturedTime(latest, Date.now()),
  ): CollectiveFarewellDecision | null {
    const latestSignal = farewellSignal(latest.text);
    if (!latest.isFinal || !latestSignal) return null;

    const key = meetingKey(latest);
    const lastFarewellAt = this.#lastFarewellByMeeting.get(key) ?? 0;
    if (now - lastFarewellAt < farewellCooldownMs) return null;

    const recentHumanSegments = history.filter((segment) => {
      if (!segment.isFinal || !sameMeeting(segment, latest)) return false;
      if (normalize(segment.speakerName) === normalize(avatarName)) return false;
      const age = now - capturedTime(segment, now);
      return age >= 0 && age <= farewellWindowMs;
    });
    const signals = recentHumanSegments
      .map((segment) => ({ segment, signal: farewellSignal(segment.text) }))
      .filter((entry): entry is { segment: TranscriptSegment; signal: FarewellSignal } =>
        entry.signal !== null
      );

    const substantiveContext = history
      .filter((segment) =>
        segment.isFinal &&
        sameMeeting(segment, latest) &&
        normalize(segment.speakerName) !== normalize(avatarName) &&
        farewellSignal(segment.text) === null
      )
      .slice(-12);
    const substantiveWords = substantiveContext.reduce(
      (total, segment) => total + wordCount(segment.text),
      0,
    );
    const hasMeetingContext = substantiveContext.length >= 2 && substantiveWords >= 12;
    const clearSignals = signals.filter((entry) => entry.signal.clear);
    const hasCollectiveClose = signals.some((entry) => entry.signal.collective);
    const uniqueParticipants = new Set(signals.map((entry) => participantKey(entry.segment)));
    const uniquePhrases = new Set(signals.map((entry) => normalize(entry.segment.text)));
    const enoughIndependentSignals = uniqueParticipants.size >= 2 || uniquePhrases.size >= 2;

    const closesCollectively = hasCollectiveClose && hasMeetingContext;
    const formsFarewellWave = signals.length >= 2 && enoughIndependentSignals && (
      hasMeetingContext || clearSignals.length >= 2
    );
    if (!closesCollectively && !formsFarewellWave) return null;

    this.#lastFarewellByMeeting.set(key, now);
    const language = signals.filter((entry) => entry.signal.language === "en-US").length >
        signals.length / 2
      ? "en-US"
      : latestSignal.language;
    return {
      meetingKey: key,
      signalCount: signals.length,
      participantCount: uniqueParticipants.size,
      cue: farewellCue(
        avatarName,
        language,
        signals.slice(-4).map((entry) => entry.segment.id),
      ),
    };
  }

  reset(): void {
    this.#lastFarewellByMeeting.clear();
  }
}

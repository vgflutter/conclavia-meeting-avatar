import { randomUUID } from "node:crypto";

import type {
  AvatarSpeechCue,
  SpeechLanguage,
  TranscriptSegment,
} from "../domain/protocol.js";

const greetingCooldownMs = 10 * 60_000;

const italianGreeting = /^\s*(?:ciao|buongiorno|buonasera|salve)[\s,.:;!?-]+(?:a\s+)?(?<target>@?[\p{L}][\p{L}'’-]*)\b/iu;
const englishGreeting = /^\s*(?:hi|hello|good\s+(?:morning|afternoon|evening))[\s,.:;!?-]+(?:to\s+)?(?<target>@?[\p{L}][\p{L}'’-]*)\b/iu;

// These words commonly follow a generic greeting but do not identify a person.
const nonPersonTargets = new Set([
  "a",
  "all",
  "come",
  "colleghi",
  "colleghe",
  "everyone",
  "folks",
  "guys",
  "ragazzi",
  "ragazze",
  "sono",
  "team",
  "tutti",
  "tutte",
  "vi",
  "you",
]);

export interface SocialGreetingDecision {
  meetingKey: string;
  targetName: string;
  cue: AvatarSpeechCue;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/^@/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function meetingKey(segment: TranscriptSegment): string {
  return `${segment.platform ?? "generic"}:${segment.meetingId ?? "default"}`;
}

function capturedTime(segment: TranscriptSegment, fallback: number): number {
  const parsed = Date.parse(segment.capturedAt);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function displayName(value: string): string {
  const withoutMention = value.replace(/^@/u, "");
  if (!withoutMention) return value;
  return withoutMention[0]!.toLocaleUpperCase("it-IT") + withoutMention.slice(1);
}

function namedGreeting(text: string): {
  targetName: string;
  language: SpeechLanguage;
} | null {
  const italian = italianGreeting.exec(text);
  const english = italian ? null : englishGreeting.exec(text);
  const match = italian ?? english;
  const rawTarget = match?.groups?.target?.trim();
  if (!rawTarget) return null;

  const normalizedTarget = normalize(rawTarget);
  if (!normalizedTarget || nonPersonTargets.has(normalizedTarget)) return null;
  return {
    targetName: displayName(rawTarget),
    language: english ? "en-US" : "it-IT",
  };
}

function greetingCue(
  avatarName: string,
  sourceSegmentId: string,
): AvatarSpeechCue {
  return {
    id: randomUUID(),
    kind: "speak",
    provider: "system",
    model: null,
    speakerName: avatarName,
    sentences: [{
      text: "Ciao a tutti!",
      mood: "amused",
      level: 2,
      language: "it-IT",
    }],
    addressedTo: "meeting",
    sourceSegmentIds: [sourceSegmentId],
    createdAt: new Date().toISOString(),
  };
}

/** Lets Mary naturally join a participant's explicit greeting to another person. */
export class SocialGreetingTracker {
  readonly #lastGreetingByMeeting = new Map<string, number>();

  consider(
    latest: TranscriptSegment,
    avatarName: string,
    now = capturedTime(latest, Date.now()),
  ): SocialGreetingDecision | null {
    if (!latest.isFinal || normalize(latest.speakerName) === normalize(avatarName)) {
      return null;
    }

    const greeting = namedGreeting(latest.text);
    if (!greeting || normalize(greeting.targetName) === normalize(avatarName)) {
      return null;
    }

    const key = meetingKey(latest);
    const lastGreetingAt = this.#lastGreetingByMeeting.get(key) ?? 0;
    if (now - lastGreetingAt < greetingCooldownMs) return null;

    this.#lastGreetingByMeeting.set(key, now);
    return {
      meetingKey: meetingKey(latest),
      targetName: greeting.targetName,
      cue: greetingCue(
        avatarName,
        latest.id,
      ),
    };
  }

  reset(): void {
    this.#lastGreetingByMeeting.clear();
  }
}

import type { TranscriptSegment } from "../domain/protocol.js";

export const meetingMemoryKinds = [
  "summary",
  "decision",
  "action",
  "fact",
  "risk",
  "open-question",
] as const;

export type MeetingMemoryKind = (typeof meetingMemoryKinds)[number];

export interface MeetingMemoryScope {
  workspaceId: string;
  projectId: string;
}

export interface MeetingMemorySession extends MeetingMemoryScope {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
}

export interface MeetingMemoryItem {
  kind: MeetingMemoryKind;
  text: string;
  owner: string | null;
  dueAt: string | null;
  status: "open" | "done" | "superseded" | "informational";
  confidence: number;
  sourceSegmentIds: string[];
}

export interface MeetingMemorySnapshot {
  summary: string;
  items: MeetingMemoryItem[];
  sourceSegmentCount: number;
  generatedAt: string;
}

export interface RecalledMeetingMemory extends MeetingMemoryItem {
  id: string;
  sessionId: string;
  meetingTitle: string;
  meetingStartedAt: string;
  generatedAt: string;
}

export interface MeetingMemoryStore {
  readonly backend: "disabled" | "mongodb";
  readonly enabled: boolean;
  initialize(): Promise<void>;
  unfinishedSessions(
    scope: MeetingMemoryScope,
    excludeSessionId: string,
  ): Promise<MeetingMemorySession[]>;
  beginSession(session: MeetingMemorySession): Promise<void>;
  appendSegment(session: MeetingMemorySession, segment: TranscriptSegment): Promise<void>;
  sessionSegments(sessionId: string): Promise<TranscriptSegment[]>;
  saveSnapshot(session: MeetingMemorySession, snapshot: MeetingMemorySnapshot): Promise<void>;
  finalizeSession(session: MeetingMemorySession, endedAt: string): Promise<void>;
  recall(
    scope: MeetingMemoryScope,
    query: string,
    excludeSessionId: string,
    limit: number,
  ): Promise<RecalledMeetingMemory[]>;
  close(): Promise<void>;
}

export class DisabledMeetingMemoryStore implements MeetingMemoryStore {
  readonly backend = "disabled" as const;
  readonly enabled = false;

  initialize(): Promise<void> {
    return Promise.resolve();
  }
  unfinishedSessions(): Promise<MeetingMemorySession[]> {
    return Promise.resolve([]);
  }
  beginSession(): Promise<void> {
    return Promise.resolve();
  }
  appendSegment(): Promise<void> {
    return Promise.resolve();
  }
  sessionSegments(): Promise<TranscriptSegment[]> {
    return Promise.resolve([]);
  }
  saveSnapshot(): Promise<void> {
    return Promise.resolve();
  }
  finalizeSession(): Promise<void> {
    return Promise.resolve();
  }
  recall(): Promise<RecalledMeetingMemory[]> {
    return Promise.resolve([]);
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

export function normalizeMemoryScopeId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function isSharedMeetingMemoryQuery(text: string): boolean {
  const normalized = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it-IT");
  return /\b(?:ricord\w*|memoria|storico|precedent\w*|scors[oaie]|altr[oaie] meeting|riunion[ei] passat\w*|avevamo|avevate|abbiamo deciso|decision[ei]|action items?|azioni aperte|attivita aperte|rimast\w* apert\w*|cosa (?:era|e stato) deciso|cosa sappiamo|ne abbiamo parlato|era emerso|punto della situazione|follow[- ]?up)\b/u
    .test(normalized);
}

export interface MeetingMemoryRecallPlan {
  kinds: MeetingMemoryKind[];
  openOnly: boolean;
  searchTerms: string;
}

const recallStopWords = new Set([
  "abbiamo", "avevamo", "avevate", "cosa", "della", "delle", "degli", "dello",
  "deciso", "decisione", "decisioni", "meeting", "memoria", "mary", "passata",
  "passato", "precedente", "precedenti", "progetto", "quale", "quali", "ricordi",
  "riunione", "riunioni", "scorsa", "scorso", "sappiamo", "storico", "sulla",
  "sulle", "sugli", "sullo", "ultima", "ultimo", "azioni", "azione", "attivita",
  "aperte", "aperti", "rimaste", "rimasti", "follow", "up", "punto", "situazione",
  "sono", "siamo", "stato", "stata", "stati", "state", "come", "quando", "dove",
  "what", "did", "decide", "decided", "meeting", "previous", "remember", "open",
  "actions", "action", "items", "last", "about", "from", "with", "that", "this",
]);

/**
 * Converts a natural-language history question into a deterministic Mongo
 * retrieval plan. Generic questions such as "what did we decide?" intentionally
 * use recency instead of a meaningless full-text query made only of stop words.
 */
export function meetingMemoryRecallPlan(text: string): MeetingMemoryRecallPlan {
  const normalized = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it-IT");
  const kinds: MeetingMemoryKind[] = [];
  if (/\b(?:decis\w*|decid\w*)\b/u.test(normalized)) kinds.push("decision");
  if (/\b(?:azion\w*|attivit\w*|action items?|follow[- ]?up|task)\b/u.test(normalized)) {
    kinds.push("action");
  }
  if (/\b(?:risch\w*|risk\w*)\b/u.test(normalized)) kinds.push("risk");
  if (/\b(?:domand\w*|question\w*|dubbi?\w*)\b/u.test(normalized)) {
    kinds.push("open-question");
  }
  const openOnly = /\b(?:apert\w*|rimast\w*|pending|outstanding|da fare)\b/u.test(normalized);
  const searchTerms = normalized
    .split(/[^a-z0-9._-]+/gu)
    .filter((token) => token.length >= 3 && !recallStopWords.has(token))
    .slice(0, 12)
    .join(" ");
  return {
    kinds: [...new Set(kinds)],
    openOnly,
    searchTerms,
  };
}

export function recalledMemoryAsSegments(
  memories: readonly RecalledMeetingMemory[],
  referenceTime: string,
): TranscriptSegment[] {
  return memories.map((memory, index) => ({
    id: `shared-memory:${memory.id}`,
    speakerName: `Memoria condivisa · ${memory.kind}`,
    text: [
      memory.text,
      `Fonte: ${memory.meetingTitle}, ${memory.meetingStartedAt}`,
    ].join(" "),
    isFinal: true,
    // Recalled passages are deliberately placed at the end of the model
    // context. Their original timestamp remains in the provenance text.
    capturedAt: new Date(Date.parse(referenceTime) + index + 1).toISOString(),
    source: "manual",
    meetingId: memory.sessionId,
  }));
}

import { meetingInvocationNameOccurs } from "@/lib/meeting-command";

export interface ParticipantEvent {
  id: string;
  participantId: string;
  name: string;
  type: "join" | "leave";
  timestampMs: number;
}

export interface ParticipantPresence {
  participantId: string;
  name: string;
  present: boolean;
  timestampMs: number;
  eventId: string;
}

export interface MeetingParticipantRoster {
  attemptId: string;
  revision: number;
  entries: ParticipantPresence[];
  synchronizedAt?: Date;
  incomplete?: boolean;
}

export interface MeetingParticipantStatus {
  state: "inactive" | "unverified" | "synced" | "stale";
  names: string[];
  collisions: string[];
  voiceBlocked: boolean;
  synchronizedAt?: string;
}

export const PARTICIPANT_SYNC_INTERVAL_MS = 30_000;
export const PARTICIPANT_ROSTER_FRESH_MS = 90_000;
const MAX_PARTICIPANTS = 2_000;

export function parseParticipantEvent(value: unknown): ParticipantEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || row.id.length > 256 ||
      typeof row.participant_uuid !== "string" || !row.participant_uuid || row.participant_uuid.length > 256 ||
      typeof row.participant_name !== "string" || !row.participant_name.trim() ||
      !["join", "leave"].includes(String(row.event_type)) ||
      typeof row.timestamp_ms !== "number" || !Number.isSafeInteger(row.timestamp_ms) || row.timestamp_ms < 0) return undefined;
  return {
    id: row.id, participantId: row.participant_uuid,
    name: row.participant_name.trim().slice(0, 160),
    type: row.event_type as "join" | "leave", timestampMs: row.timestamp_ms,
  };
}

// Merge on identity, not display name. A late poll/webhook must never undo a
// more recent leave. At an equal timestamp leave wins, independently of order.
export function mergeParticipantEvents(entries: ParticipantPresence[], events: ParticipantEvent[]): ParticipantPresence[] {
  const byId = new Map(entries.map(entry => [entry.participantId, { ...entry }]));
  for (const event of events) {
    const previous = byId.get(event.participantId);
    if (previous && (event.timestampMs < previous.timestampMs ||
        (event.timestampMs === previous.timestampMs && (!previous.present || event.type === "join")))) continue;
    byId.set(event.participantId, {
      participantId: event.participantId, name: event.name, present: event.type === "join",
      timestampMs: event.timestampMs, eventId: event.id,
    });
    if (byId.size > MAX_PARTICIPANTS) throw new Error("Participant roster exceeds the local limit");
  }
  return [...byId.values()];
}

type RosterMeeting = {
  participantRoster?: MeetingParticipantRoster;
  assistant: { wakeWord: string };
  bot: { provider?: string; status?: string; entryAttemptId?: string; leftAt?: Date | string; stopRequestedAt?: Date | string };
};

export function meetingParticipantStatus(meeting: RosterMeeting, now = Date.now()): MeetingParticipantStatus {
  const inactive = meeting.bot.provider !== "attendee" || Boolean(meeting.bot.leftAt || meeting.bot.stopRequestedAt) ||
    !["joining", "waiting_room", "joined"].includes(meeting.bot.status || "");
  if (inactive) return { state: "inactive", names: [], collisions: [], voiceBlocked: false };
  const roster = meeting.participantRoster?.attemptId === meeting.bot.entryAttemptId ? meeting.participantRoster : undefined;
  const present = roster?.entries.filter(entry => entry.present) || [];
  const collisions = present.filter(entry => meetingInvocationNameOccurs(entry.name, meeting.assistant.wakeWord)).map(entry => entry.name);
  const synchronizedAt = roster?.synchronizedAt ? new Date(roster.synchronizedAt).toISOString() : undefined;
  const age = synchronizedAt ? now - Date.parse(synchronizedAt) : Infinity;
  const state = !synchronizedAt ? "unverified" : roster?.incomplete || age < 0 || age > PARTICIPANT_ROSTER_FRESH_MS ? "stale" : "synced";
  return { state, names: present.map(entry => entry.name), collisions, voiceBlocked: collisions.length > 0, synchronizedAt };
}

export function sameTranscriptSpeaker(a: { speakerId?: string; speakerName: string }, b: { speakerId?: string; speakerName: string }): boolean {
  // Missing ID on just one half is not evidence that captions belong together.
  return a.speakerId || b.speakerId ? Boolean(a.speakerId && a.speakerId === b.speakerId)
    : a.speakerName.toLocaleLowerCase() === b.speakerName.toLocaleLowerCase();
}

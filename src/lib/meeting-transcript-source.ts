import type { MeetingTranscriptSegment } from "@/types/meeting";

type Timestamp = Date | string;
type Segment = Pick<MeetingTranscriptSegment, "speakerName" | "speakerId" | "speakerIsParticipant" | "entryAttemptId" | "text" | "startMs" | "source" | "echoCommandId"> & { createdAt: Timestamp };
type Context = {
  assistant: { wakeWord: string };
  commandHistory: Array<{ id: string; response: string; createdAt: Timestamp; playbackStartedAt?: Timestamp; playbackEndedAt?: Timestamp }>;
  bot: { entryAttemptId?: string; outputSpeechCommandId?: string; outputSpeechState?: string; outputSpeechUpdatedAt?: Timestamp };
  participantRoster?: { attemptId: string; entries: Array<{ participantId: string }> };
};

function normalized(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function milliseconds(value?: Timestamp): number {
  return value ? new Date(value).getTime() : NaN;
}

// A suspicion, not a corrected speaker identity. Preserve the provider's raw text/name.
// Only a complete, substantial text fragment within confirmed playback is quarantined.
export function classifyTranscriptSource(meeting: Context, segment: Segment): {
  source: NonNullable<MeetingTranscriptSegment["source"]>; echoCommandId?: string; speakerIsParticipant?: boolean;
} {
  // Attendee excludes the bot from participant events. A matching stable ID is
  // stronger evidence than a display name, including a human named Riccardo.
  const knownParticipant = segment.speakerIsParticipant || Boolean(segment.speakerId && segment.entryAttemptId &&
    segment.entryAttemptId === meeting.bot.entryAttemptId &&
    meeting.participantRoster?.attemptId === segment.entryAttemptId &&
    meeting.participantRoster.entries.some(entry => entry.participantId === segment.speakerId));
  const identity = knownParticipant ? { speakerIsParticipant: true } : {};
  // Webhooks can arrive before the renderer's playback acknowledgement. A stored
  // "participant" is provisional, not a manual speaker correction: reconsider it
  // using the original speech time once playback evidence becomes available.
  // Preserve existing quarantines even after command history has been trimmed.
  if ((segment.source === "avatar" && !knownParticipant) || segment.source === "suspected_echo") {
    return { source: segment.source, echoCommandId: segment.echoCommandId, ...identity };
  }
  const speaker = normalized(segment.speakerName.replace(/\s*\((?:guest|unverified|ospite|non verificato)\)\s*$/iu, ""));
  if (!knownParticipant && speaker && speaker === normalized(meeting.assistant.wakeWord)) return { source: "avatar" };
  const text = normalized(segment.text);
  if (text.length < 18 || text.split(" ").length < 4) return { source: "participant", ...identity };
  // Attendee timestamps are epoch milliseconds; relative timestamps from other
  // providers cannot be compared to the playback clock. Use receipt time there.
  const at = segment.startMs && segment.startMs > 1e12 ? segment.startMs : milliseconds(segment.createdAt);
  for (const command of meeting.commandHistory.slice(-50).reverse()) {
    let start = milliseconds(command.playbackStartedAt);
    let end = milliseconds(command.playbackEndedAt);
    // Compatibility with sessions already running before playback history existed.
    if (!Number.isFinite(start) && meeting.bot.outputSpeechCommandId === command.id) {
      const updated = milliseconds(meeting.bot.outputSpeechUpdatedAt);
      if (meeting.bot.outputSpeechState === "speaking") start = updated;
      if (meeting.bot.outputSpeechState === "completed") {
        end = updated;
        start = Math.max(milliseconds(command.createdAt), end - 30_000);
      }
    }
    if (!Number.isFinite(start)) continue; // Generated text alone is not proof of playback.
    const until = Number.isFinite(end) ? end : start + 90_000;
    if (at < start || at > until + 5_000) continue;
    if (` ${normalized(command.response)} `.includes(` ${text} `)) {
      return { source: "suspected_echo", echoCommandId: command.id, ...identity };
    }
  }
  return { source: "participant", ...identity };
}

export function participantTranscript<T extends Segment>(meeting: Context & { transcript: T[] }): T[] {
  return meeting.transcript.filter((segment) => classifyTranscriptSource(meeting, segment).source === "participant");
}

// Bind asynchronous work to its immutable event ID, never the most recent speaker
// or a sequence number that concurrent deliveries might share.
export function transcriptEventIndex(segments: Array<{ segmentId?: string; text: string }>, text: string, segmentId?: string): number {
  const index = segmentId === undefined ? segments.length - 1 : segments.findIndex((segment) => segment.segmentId === segmentId);
  return segments[index]?.text === text ? index : -1;
}

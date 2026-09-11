import type { MeetingTranscriptSegment } from "@/types/meeting";

type Timestamp = Date | string;
type Segment = Pick<MeetingTranscriptSegment, "speakerName" | "text" | "startMs" | "source" | "echoCommandId"> & { createdAt: Timestamp };
type Context = {
  assistant: { wakeWord: string };
  commandHistory: Array<{ id: string; response: string; createdAt: Timestamp; playbackStartedAt?: Timestamp; playbackEndedAt?: Timestamp }>;
  bot: { outputSpeechCommandId?: string; outputSpeechState?: string; outputSpeechUpdatedAt?: Timestamp };
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
  source: NonNullable<MeetingTranscriptSegment["source"]>; echoCommandId?: string;
} {
  if (segment.source) return { source: segment.source, echoCommandId: segment.echoCommandId };
  const speaker = normalized(segment.speakerName.replace(/\s*\((?:guest|unverified|ospite|non verificato)\)\s*$/iu, ""));
  if (speaker && speaker === normalized(meeting.assistant.wakeWord)) return { source: "avatar" };
  const text = normalized(segment.text);
  if (text.length < 18 || text.split(" ").length < 4) return { source: "participant" };
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
      return { source: "suspected_echo", echoCommandId: command.id };
    }
  }
  return { source: "participant" };
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

import type { TranscriptSegment } from "../domain/protocol.js";

function normalizeIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLocaleLowerCase();
}

/**
 * Returns the stable floor-control identity for a transcript segment.
 * Mixed system audio deliberately has no identity: its configured display
 * name describes the audio device, not the human who is speaking.
 */
export function dialogueParticipantKey(segment: TranscriptSegment): string | null {
  const speakerId = normalizeIdentity(segment.speakerId ?? "");
  if (speakerId) {
    const platform = normalizeIdentity(segment.platform ?? segment.source ?? "generic");
    const meetingId = normalizeIdentity(segment.meetingId ?? "local");
    return `${platform}:${meetingId}:${speakerId}`;
  }

  const speakerName = normalizeIdentity(segment.speakerName);
  if (!speakerName) return null;
  if (segment.source === "manual") return `manual:local:${speakerName}`;
  if (segment.source === "chat" && segment.platform && segment.meetingId) {
    return `${segment.platform}:${normalizeIdentity(segment.meetingId)}:display:${speakerName}`;
  }
  return null;
}

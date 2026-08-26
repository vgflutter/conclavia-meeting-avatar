import type { TranscriptSegment } from "../domain/protocol.js";

export const maximumReactiveSegmentAgeMs = 30_000;
const outOfOrderToleranceMs = 2_500;

function segmentTimestamp(segment: TranscriptSegment): number | null {
  const timestamp = Date.parse(segment.capturedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Complete history remains available for answers and summaries, but only a
 * fresh, newest participant turn may drive mood, gestures or floor requests.
 * Caption/chat bridges can deliver old records after reconnecting; those
 * records belong in memory without making Mary react minutes too late.
 */
export function isCurrentReactionSegment(
  segment: TranscriptSegment,
  history: readonly TranscriptSegment[],
  avatarName: string,
  now = Date.now(),
): boolean {
  if (!segment.isFinal) return false;
  const candidateAt = segmentTimestamp(segment);
  if (candidateAt === null) return true;
  if (now - candidateAt > maximumReactiveSegmentAgeMs) return false;

  let newestParticipantAt = Number.NEGATIVE_INFINITY;
  for (const prior of history) {
    if (!prior.isFinal) continue;
    if (prior.speakerName.localeCompare(avatarName, undefined, { sensitivity: "accent" }) === 0) {
      continue;
    }
    const priorAt = segmentTimestamp(prior);
    if (priorAt !== null) newestParticipantAt = Math.max(newestParticipantAt, priorAt);
  }
  return candidateAt + outOfOrderToleranceMs >= newestParticipantAt;
}

import { randomUUID } from "node:crypto";

import type {
  AutonomousInterventionType,
  AvatarInterventionRequest,
  AvatarMoodLevel,
  AvatarSpeechCue,
  TranscriptSegment,
} from "../domain/protocol.js";

interface InterventionRequestInput {
  avatarName: string;
  segment: TranscriptSegment;
  reason: string;
  interventionType: Exclude<AutonomousInterventionType, "none">;
  importance: AvatarMoodLevel;
  confidence: AvatarMoodLevel;
  proposedCue: AvatarSpeechCue;
  ttlMs: number;
  now?: Date;
}

/**
 * Preserve both the disputed statement and Mary's prepared correction while
 * she waits for the floor. The prepared cue is deliberately not regenerated:
 * granting the request must answer the point that caused the raised hand, not
 * the last generic "Mary, go ahead" utterance.
 */
export function createInterventionRequest(
  input: InterventionRequestInput,
): AvatarInterventionRequest {
  const createdAt = input.now ?? new Date();
  return {
    id: randomUUID(),
    kind: "request-to-speak",
    speakerName: input.avatarName,
    objection: {
      sourceSegmentId: input.segment.id,
      speakerName: input.segment.speakerName,
      statement: input.segment.text,
      capturedAt: input.segment.capturedAt,
    },
    reason: input.reason,
    interventionType: input.interventionType,
    importance: input.importance,
    confidence: input.confidence,
    draft: input.proposedCue.sentences.map((sentence) => ({ ...sentence })),
    proposedCue: input.proposedCue,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + input.ttlMs).toISOString(),
  };
}

/** Create the actual speech cue once a participant grants the pending turn. */
export function grantedInterventionCue(
  request: AvatarInterventionRequest,
  grantSegment?: TranscriptSegment,
  now = new Date(),
): AvatarSpeechCue {
  const sourceSegmentIds = new Set(request.proposedCue.sourceSegmentIds);
  sourceSegmentIds.add(request.objection.sourceSegmentId);
  if (grantSegment) sourceSegmentIds.add(grantSegment.id);
  return {
    ...request.proposedCue,
    id: randomUUID(),
    sentences: request.draft.map((sentence) => ({ ...sentence })),
    addressedTo: grantSegment?.speakerName ?? request.proposedCue.addressedTo,
    sourceSegmentIds: [...sourceSegmentIds],
    createdAt: now.toISOString(),
  };
}

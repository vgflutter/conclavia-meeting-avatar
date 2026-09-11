import type { Model, Schema } from "mongoose";
import type { MeetingRecord } from "@/types/meeting";

// These fields must survive casting before any external participant can be created.
// Next.js hot reload can otherwise reuse a Mongoose model compiled before an update.
export const MEETING_LIFECYCLE_PATHS = [
  "bot.externalBotId", "bot.entryAttemptId", "bot.activeRoomKey", "bot.joinDeadlineAt",
  "bot.readyAt", "bot.stopRequestedAt", "bot.stopAcknowledgedAt", "bot.failureCode",
  "bot.monitorLeaseUntil", "bot.monitorCheckedAt",
  "bot.captionLanguage", "bot.captionLanguageAttempts", "bot.captionLanguageRequestedAt",
  "bot.outputLastSeenAt", "bot.outputVoiceReady",
  "bot.outputSpeechCommandId", "bot.outputSpeechState", "bot.outputSpeechUpdatedAt",
] as const;

export function hasMeetingLifecycleSchema(model: Model<MeetingRecord>): boolean {
  const botSchema = (model.schema.path("bot") as unknown as { schema?: Schema } | undefined)?.schema;
  const transcriptSchema = (model.schema.path("transcript") as unknown as { schema?: Schema } | undefined)?.schema;
  const commandSchema = (model.schema.path("commandHistory") as unknown as { schema?: Schema } | undefined)?.schema;
  return Boolean(botSchema && MEETING_LIFECYCLE_PATHS.every((path) => botSchema.path(path.slice(4))) &&
    transcriptSchema?.path("source") && transcriptSchema.path("echoCommandId") && transcriptSchema.path("segmentId") &&
    commandSchema?.path("playbackStartedAt") && commandSchema.path("playbackEndedAt"));
}

export function assertMeetingLifecycleSchema(model: Model<MeetingRecord>): void {
  if (!hasMeetingLifecycleSchema(model)) {
    throw new Error("Meeting lifecycle schema is outdated. Restart the application before sending a meeting participant.");
  }
}

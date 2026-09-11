import { createHash, randomUUID } from "node:crypto";
import { getMeetingBotAdapter, MeetingBotProviderError, type MeetingBotAdapter } from "@/lib/meeting-bot-adapter";
import { getMeetingBotRuntimeConfig } from "@/lib/meeting-bot-config";
import { attendeeAttemptFinished, meetingEntryDeadline, meetingEntryError } from "@/lib/meeting-entry-policy";
import { serializeMeeting } from "@/lib/serialize-meeting";
import { MeetingModel, type MeetingDocument } from "@/models/Meeting";
import { assertMeetingLifecycleSchema } from "@/lib/meeting-model-schema";
import { MeetingOutputUnavailableError } from "@/lib/meeting-output-health";
import { teamsCaptionLanguage } from "@/lib/meeting-caption-language";

export class MeetingEntryConflictError extends Error {}

// Certificate validation fails before an HTTPS request can be sent. Unlike a
// timeout or a reset after sending POST /bots, this is a definite non-creation.
function isProviderCertificateError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && [
    "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "ERR_TLS_CERT_ALTNAME_INVALID",
  ].includes(code);
}

export function meetingRoomKey(value: string): string {
  const url = new URL(value);
  // Navigation flags, passcodes and query ordering must not create a second participant in the same room.
  return createHash("sha256").update(`${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/u, "")}`).digest("hex");
}

export async function startAttendeeEntry(meeting: MeetingDocument, options: {
  scheduled?: boolean; now?: Date; adapter?: MeetingBotAdapter;
} = {}): Promise<MeetingDocument> {
  assertMeetingLifecycleSchema(MeetingModel);
  const adapter = options.adapter || getMeetingBotAdapter("attendee");
  if (!adapter.live || adapter.provider !== "attendee") throw new MeetingEntryConflictError("Automatic entry is unavailable");
  const now = options.now || new Date();
  const scheduledFor = options.scheduled ? meeting.scheduledStart : undefined;
  if (meeting.archivedAt || !["scheduled", "failed"].includes(meeting.status) ||
      !["not_scheduled", "failed", "left"].includes(meeting.bot.status) ||
      (meeting.bot.externalBotId && !attendeeAttemptFinished(meeting.bot)) || meeting.bot.failureCode === "create_uncertain") {
    throw new MeetingEntryConflictError("The previous entry attempt must finish before retrying");
  }
  const activeOther = await MeetingModel.exists({
    _id: { $ne: meeting._id }, meetingUrl: meeting.meetingUrl,
    "bot.status": { $in: ["scheduling", "scheduled", "joining", "waiting_room", "joined", "leaving"] },
    ...(scheduledFor ? { scheduledStart: { $lt: meeting.scheduledEnd }, scheduledEnd: { $gt: scheduledFor } } : {
      $or: [{ "bot.status": { $ne: "scheduled" } }, { scheduledStart: { $lte: now }, scheduledEnd: { $gt: now } }],
    }),
  });
  if (activeOther) throw new MeetingEntryConflictError("The colleague has already been sent to this meeting");

  await MeetingModel.init(); // The unique room claim must exist before creating an external participant.
  const attemptId = randomUUID();
  const captionLanguage = adapter.setCaptionLanguage ? teamsCaptionLanguage(meeting.language) : undefined;
  let claimed: MeetingDocument | null;
  try {
    claimed = await MeetingModel.findOneAndUpdate({
      _id: meeting._id,
      archivedAt: null,
      status: { $in: ["scheduled", "failed"] },
      "bot.status": { $in: ["not_scheduled", "failed", "left"] },
      "bot.entryAttemptId": meeting.bot.entryAttemptId ?? null,
    }, {
      $set: {
        status: scheduledFor ? "scheduled" : "joining",
        "bot.provider": "attendee", "bot.status": "scheduling", "bot.entryAttemptId": attemptId,
        "bot.joinDeadlineAt": meetingEntryDeadline(now, scheduledFor),
        ...(!scheduledFor ? { "bot.activeRoomKey": meetingRoomKey(meeting.meetingUrl) } : {}),
        ...(captionLanguage ? { "bot.captionLanguage": captionLanguage, "bot.captionLanguageAttempts": 0 } : {}),
      },
      $unset: {
        "bot.externalBotId": 1, "bot.leftAt": 1, "bot.joinedAt": 1, "bot.readyAt": 1,
        "bot.stopRequestedAt": 1, "bot.stopAcknowledgedAt": 1, "bot.failureCode": 1,
        "bot.lastError": 1, "bot.lastStatusAt": 1, "bot.monitorCheckedAt": 1, "bot.monitorLeaseUntil": 1,
        "bot.providerStatusCode": 1, "bot.outputUrl": 1, "bot.scheduledFor": 1,
        "bot.outputLastSeenAt": 1, "bot.outputVoiceReady": 1,
        "bot.outputSpeechCommandId": 1, "bot.outputSpeechState": 1, "bot.outputSpeechUpdatedAt": 1,
        "bot.captionLanguageRequestedAt": 1,
        ...(!captionLanguage ? { "bot.captionLanguage": 1, "bot.captionLanguageAttempts": 1 } : {}),
      },
    }, { new: true, strict: "throw" }).exec();
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new MeetingEntryConflictError("The colleague has already been sent to this meeting");
    throw error;
  }
  if (!claimed) throw new MeetingEntryConflictError("Entry has already been requested");
  if (claimed.bot.entryAttemptId !== attemptId || !claimed.bot.joinDeadlineAt) {
    throw new MeetingEntryConflictError("Entry tracking was not persisted; no participant was sent");
  }

  try {
    const session = scheduledFor
      ? await adapter.schedule(serializeMeeting(claimed))
      : await adapter.join(serializeMeeting(claimed), getMeetingBotRuntimeConfig().publicBaseUrl || "");
    await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": attemptId }, {
      $set: { "bot.externalBotId": session.externalBotId, "bot.outputUrl": session.outputUrl,
        ...(scheduledFor ? { "bot.scheduledFor": scheduledFor } : {}) },
    }).exec();
    // A fast webhook may already have advanced the state. Never overwrite it with "joining".
    await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": attemptId, "bot.status": "scheduling", "bot.stopRequestedAt": null }, {
      $set: { "bot.status": scheduledFor ? "scheduled" : "joining" },
    }).exec();
  } catch (error) {
    const outputUnavailable = error instanceof MeetingOutputUnavailableError;
    const certificateError = isProviderCertificateError(error);
    const definiteRejection = outputUnavailable || certificateError || (error instanceof MeetingBotProviderError &&
      Boolean(error.status && error.status >= 400 && error.status < 500 && ![408, 409].includes(error.status)));
    const failureCode = outputUnavailable ? "output_unavailable" : certificateError ? "provider_tls_error" : "entry_failed";
    await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": attemptId, "bot.externalBotId": null }, {
      $set: definiteRejection
        ? { status: "failed", "bot.status": "failed", "bot.failureCode": failureCode, "bot.lastError": meetingEntryError(failureCode) }
        : { "bot.failureCode": "create_uncertain", "bot.lastError": meetingEntryError("create_uncertain") },
      ...(definiteRejection ? { $unset: { "bot.activeRoomKey": 1, "bot.joinDeadlineAt": 1 } } : {}),
    }).exec();
    // An ambiguous response is reconciled by bot metadata, never by repeating POST /bots.
  }
  return (await MeetingModel.findById(meeting._id).exec())!;
}

export async function requestAttendeeExit(meeting: MeetingDocument, options: {
  reason?: string; now?: Date; adapter?: MeetingBotAdapter;
} = {}): Promise<void> {
  assertMeetingLifecycleSchema(MeetingModel);
  if (meeting.bot.leftAt) return;
  const now = options.now || new Date();
  const wasReady = meeting.bot.readyAt || (!meeting.bot.entryAttemptId && meeting.bot.joinedAt);
  const reason = options.reason || (!wasReady ? "entry_cancelled" : undefined);
  const claimed = await MeetingModel.findOneAndUpdate({
    _id: meeting._id, "bot.entryAttemptId": meeting.bot.entryAttemptId ?? null,
    "bot.leftAt": null, "bot.stopRequestedAt": null,
    ...(options.reason ? { "bot.readyAt": null } : {}),
  }, { $set: {
    "bot.stopRequestedAt": now, "bot.status": "leaving",
    status: reason ? "failed" : "processing",
    ...(reason ? { "bot.failureCode": reason, "bot.lastError": meetingEntryError(reason) } : {}),
  } }, { new: true, strict: "throw" }).exec();
  if (!claimed?.bot.externalBotId) return;
  const adapter = options.adapter || getMeetingBotAdapter("attendee");
  if (!adapter.live) return;
  try {
    await adapter.leave(claimed.bot.externalBotId);
    await MeetingModel.updateOne({ _id: claimed._id, "bot.entryAttemptId": claimed.bot.entryAttemptId ?? null }, {
      $set: { "bot.stopAcknowledgedAt": now },
    }).exec();
  } catch {
    // Acknowledgement is not exit confirmation. The server monitor reconciles and retries safely.
  }
}

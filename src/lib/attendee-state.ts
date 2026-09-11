import { MEETING_MEDIA_START_GRACE_SECONDS, meetingEntryDeadline, meetingEntryError } from "@/lib/meeting-entry-policy";
import type { MeetingRecord } from "@/types/meeting";

export interface AttendeeState {
  state: string;
  eventType?: string;
  subType?: string;
  occurredAt: Date;
}

export function applyAttendeeState(meeting: Pick<MeetingRecord, "status" | "bot">, event: AttendeeState): void {
  const { state, eventType, subType, occurredAt } = event;
  if (!Number.isFinite(occurredAt.getTime())) return;
  if (meeting.bot.lastStatusAt && meeting.bot.lastStatusAt > occurredAt) return;
  // Terminal meetings cannot be resurrected by delayed provider callbacks.
  if (meeting.bot.leftAt && !["fatal_error", "post_processing", "ended"].includes(state)) return;
  meeting.bot.lastStatusAt = occurredAt;
  meeting.bot.providerStatusCode = [state, eventType, subType].filter(Boolean).join(":").slice(0, 160);
  if (subType && meetingEntryError(subType)) {
    meeting.bot.failureCode = subType;
    meeting.bot.lastError = meetingEntryError(subType);
  }

  if (["post_processing", "ended", "fatal_error"].includes(state)) {
    meeting.bot.leftAt ||= occurredAt;
    if (state !== "post_processing") meeting.bot.activeRoomKey = undefined;
    meeting.bot.joinDeadlineAt = undefined;
    if (state === "fatal_error" || (meeting.bot.entryAttemptId && !meeting.bot.readyAt)) {
      meeting.status = "failed";
      meeting.bot.status = "failed";
      if (meeting.bot.failureCode === "create_uncertain") {
        meeting.bot.failureCode = "entry_failed";
        meeting.bot.lastError = meetingEntryError("entry_failed");
      }
      meeting.bot.failureCode ||= "entry_failed";
      meeting.bot.lastError ||= meetingEntryError(meeting.bot.failureCode);
    } else {
      if (!["completed", "cancelled", "failed"].includes(meeting.status)) meeting.status = "processing";
      meeting.bot.status = meeting.status === "failed" ? "failed" : "left";
    }
    return;
  }
  if (state === "leaving") {
    meeting.bot.status = "leaving";
    meeting.bot.stopRequestedAt ||= occurredAt;
    if (meeting.bot.entryAttemptId && !meeting.bot.readyAt) {
      meeting.status = "failed";
      meeting.bot.failureCode ||= "entry_failed";
      meeting.bot.lastError ||= meetingEntryError(meeting.bot.failureCode);
    } else if (meeting.status !== "failed") meeting.status = "processing";
    return;
  }
  // A late joined event must not cancel an exit already requested by the watchdog.
  if (meeting.bot.stopRequestedAt || ["completed", "cancelled", "failed"].includes(meeting.status)) return;
  if (["ready", "scheduled", "staged"].includes(state)) {
    if (!["joining", "waiting_room", "joined"].includes(meeting.bot.status)) meeting.bot.status = "scheduled";
  } else if (["joining", "connecting"].includes(state)) {
    if (!meeting.bot.joinedAt) { meeting.status = "joining"; meeting.bot.status = "joining"; }
  } else if (state === "waiting_room") {
    if (!meeting.bot.joinedAt) { meeting.status = "waiting_room"; meeting.bot.status = "waiting_room"; }
  } else if (state.startsWith("joined_") || state === "connected") {
    const firstAdmission = !meeting.bot.joinedAt;
    meeting.bot.joinedAt ||= occurredAt;
    if (state === "joined_recording") {
      meeting.status = "live";
      meeting.bot.status = "joined";
      meeting.bot.readyAt ||= occurredAt;
      meeting.bot.joinDeadlineAt = undefined;
      meeting.bot.lastError = undefined;
      meeting.bot.failureCode = undefined;
    } else {
      meeting.status = "joining";
      meeting.bot.status = "joining";
      meeting.bot.readyAt = undefined;
      if (firstAdmission) {
        // Lobby time must not consume all of the media startup window. Anchor
        // the grace to the first provider admission, not each poll/callback.
        meeting.bot.joinDeadlineAt = new Date(Math.max(
          meeting.bot.joinDeadlineAt?.getTime() || 0,
          occurredAt.getTime() + MEETING_MEDIA_START_GRACE_SECONDS * 1000,
        ));
      } else {
        meeting.bot.joinDeadlineAt ||= meetingEntryDeadline(occurredAt);
      }
    }
  }
}

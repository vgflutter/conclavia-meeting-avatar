import { applyAttendeeState, type AttendeeState } from "@/lib/attendee-state";
import { MeetingModel, type MeetingDocument } from "@/models/Meeting";

// Do not overwrite a concurrent stop request, a newer event, or a new entry attempt.
export async function persistAttendeeState(meeting: MeetingDocument, state: AttendeeState, eventId?: string): Promise<boolean> {
  const guard = {
    _id: meeting._id,
    "bot.entryAttemptId": meeting.bot.entryAttemptId ?? null,
    "bot.externalBotId": meeting.bot.externalBotId ?? null,
    "bot.lastStatusAt": meeting.bot.lastStatusAt ?? null,
    "bot.stopRequestedAt": meeting.bot.stopRequestedAt ?? null,
    "bot.leftAt": meeting.bot.leftAt ?? null,
    ...(eventId ? { "bot.processedWebhookIds": { $ne: eventId } } : {}),
  };
  applyAttendeeState(meeting, state);
  const set: Record<string, unknown> = { status: meeting.status };
  const unset: Record<string, 1> = {};
  const fields = ["status", "lastStatusAt", "providerStatusCode", "joinedAt", "readyAt", "leftAt", "joinDeadlineAt", "activeRoomKey", "stopRequestedAt", "failureCode", "lastError"] as const;
  for (const field of fields) {
    const value = meeting.bot[field];
    if (value === undefined) unset[`bot.${field}`] = 1;
    else set[`bot.${field}`] = value;
  }
  const result = await MeetingModel.updateOne(guard, {
    $set: set, $unset: unset,
    ...(eventId ? { $push: { "bot.processedWebhookIds": { $each: [eventId], $slice: -200 } } } : {}),
  }).exec();
  return result.matchedCount === 1;
}

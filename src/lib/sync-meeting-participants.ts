import { getMeetingBotAdapter, type MeetingBotAdapter } from "@/lib/meeting-bot-adapter";
import { mergeParticipantEvents, PARTICIPANT_SYNC_INTERVAL_MS, type ParticipantEvent } from "@/lib/meeting-participants";
import { MeetingModel } from "@/models/Meeting";

export interface ParticipantAttempt { meetingId: string; attemptId: string; externalBotId: string }

function activeGuard(attempt: ParticipantAttempt) {
  return {
    _id: attempt.meetingId, "bot.provider": "attendee", "bot.entryAttemptId": attempt.attemptId,
    "bot.externalBotId": attempt.externalBotId, "bot.leftAt": null, "bot.stopRequestedAt": null,
    "bot.status": { $in: ["joining", "waiting_room", "joined"] },
  };
}

// Compare-and-swap only this subdocument. A concurrent webhook, provider poll,
// leave or new entry cannot be overwritten by a stale roster snapshot.
export async function persistParticipantEvents(
  attempt: ParticipantAttempt,
  events: ParticipantEvent[],
  sync?: { complete: boolean; at: Date },
): Promise<void> {
  const guard = activeGuard(attempt);
  for (let retry = 0; retry < 8; retry++) {
    const meeting = await MeetingModel.findOne(guard).select("participantRoster").lean().exec();
    if (!meeting) return;
    const previous = meeting.participantRoster;
    const roster = previous?.attemptId === attempt.attemptId ? previous : undefined;
    const entries = mergeParticipantEvents(roster?.entries || [], events);
    const complete = sync?.complete && events.length > 0;
    const next = {
      attemptId: attempt.attemptId, revision: (previous?.revision || 0) + 1, entries,
      synchronizedAt: complete ? sync.at : roster?.synchronizedAt,
      incomplete: sync ? !complete : roster?.incomplete,
    };
    const result = await MeetingModel.updateOne({ ...guard, "participantRoster.revision": previous?.revision ?? null }, {
      $set: { participantRoster: next },
    }).exec();
    if (result.modifiedCount) return;
  }
  throw new Error("Participant roster changed concurrently; retry delivery");
}

export async function syncMeetingParticipants(meetingId: string, options: { now?: Date; adapter?: MeetingBotAdapter } = {}): Promise<void> {
  const now = options.now || new Date();
  const adapter = options.adapter || getMeetingBotAdapter("attendee");
  if (!adapter.live || !adapter.getParticipantEvents) return;
  const leaseUntil = new Date(now.getTime() + 30_000);
  const meeting = await MeetingModel.findOneAndUpdate({
    _id: meetingId, "bot.provider": "attendee", "bot.status": "joined",
    "bot.entryAttemptId": { $type: "string" }, "bot.externalBotId": { $type: "string" },
    "bot.leftAt": null, "bot.stopRequestedAt": null,
    $and: [
      { $or: [{ participantSyncLeaseUntil: null }, { participantSyncLeaseUntil: { $lte: now } }] },
      { $or: [{ participantSyncAttemptAt: null }, { participantSyncAttemptAt: { $lte: new Date(now.getTime() - PARTICIPANT_SYNC_INTERVAL_MS) } }] },
    ],
  }, { $set: { participantSyncAttemptAt: now, participantSyncLeaseUntil: leaseUntil } }, { new: true }).exec();
  if (!meeting) return;
  const attempt = { meetingId, attemptId: meeting.bot.entryAttemptId!, externalBotId: meeting.bot.externalBotId! };
  try {
    const result = await adapter.getParticipantEvents(attempt.externalBotId);
    await persistParticipantEvents(attempt, result.events, { complete: result.complete, at: now });
  } catch {
    // Failure is NOT evidence of an empty room. Keep known collisions and mark
    // the list unverified/stale; never create or remove a bot to recover it.
    await persistParticipantEvents(attempt, [], { complete: false, at: now });
  } finally {
    await MeetingModel.updateOne({ ...activeGuard(attempt), participantSyncLeaseUntil: leaseUntil }, {
      $unset: { participantSyncLeaseUntil: 1 },
    }).exec();
  }
}

import { getMeetingBotAdapter, type MeetingBotAdapter } from "@/lib/meeting-bot-adapter";
import { getMeetingBotRuntimeConfig } from "@/lib/meeting-bot-config";
import { attendeeAttemptFinished, MEETING_ENTRY_CHECK_MS, MEETING_ENTRY_TIMEOUT_SECONDS } from "@/lib/meeting-entry-policy";
import { requestAttendeeExit } from "@/lib/meeting-entry";
import { persistAttendeeState } from "@/lib/persist-attendee-state";
import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";
import { CAPTION_LANGUAGE_MAX_ATTEMPTS } from "@/lib/meeting-caption-language";

export async function reconcileMeetingEntry(id: string, options: { now?: Date; adapter?: MeetingBotAdapter } = {}): Promise<void> {
  const now = options.now || new Date();
  const leaseUntil = new Date(now.getTime() + 60_000);
  let meeting = await MeetingModel.findOneAndUpdate({
    _id: id, "bot.provider": "attendee", "bot.entryAttemptId": { $exists: true },
    $or: [{ "bot.leftAt": null }, { status: "processing" }, { "bot.providerStatusCode": /^post_processing(:|$)/u }],
    $and: [
      { $or: [{ "bot.monitorLeaseUntil": null }, { "bot.monitorLeaseUntil": { $lte: now } }] },
      { $or: [{ "bot.monitorCheckedAt": null }, { "bot.monitorCheckedAt": { $lte: new Date(now.getTime() - MEETING_ENTRY_CHECK_MS) } }] },
    ],
  }, { $set: { "bot.monitorLeaseUntil": leaseUntil, "bot.monitorCheckedAt": now } }, { new: true }).exec();
  if (!meeting) return;
  const attemptId = meeting.bot.entryAttemptId;
  const guard = { _id: meeting._id, "bot.entryAttemptId": attemptId };
  const adapter = options.adapter || getMeetingBotAdapter("attendee");
  try {
    if (!adapter.live || !adapter.getStatus) return;
    try {
      if (!meeting.bot.externalBotId && adapter.findAttempt) {
        const found = await adapter.findAttempt(id, attemptId!);
        if (found) {
          await MeetingModel.updateOne({ ...guard, "bot.externalBotId": null }, { $set: { "bot.externalBotId": found.externalBotId } }).exec();
        }
      }
      meeting = await MeetingModel.findOne(guard).exec();
      if (!meeting || (attendeeAttemptFinished(meeting.bot) && meeting.status !== "processing")) return;
      if (meeting.bot.externalBotId) {
        const state = await adapter.getStatus(meeting.bot.externalBotId);
        // Reload after network IO, so a stop request or a newer callback always wins.
        meeting = await MeetingModel.findOne(guard).exec();
        if (!meeting || (attendeeAttemptFinished(meeting.bot) && meeting.status !== "processing")) return;
        if (!await persistAttendeeState(meeting, state)) return;
        if (state.state === "joined_recording" && adapter.setCaptionLanguage && meeting.bot.captionLanguage) {
          // This monitor already owns the attempt lease. Persist the bounded
          // retry count before IO; a crash must not cause an unlimited loop.
          const captionGuard = { ...guard, "bot.externalBotId": meeting.bot.externalBotId,
            status: "live", "bot.stopRequestedAt": null, "bot.leftAt": null,
            "bot.providerStatusCode": /^joined_recording(:|$)/u,
            "bot.captionLanguage": meeting.bot.captionLanguage,
            "bot.captionLanguageRequestedAt": null,
          };
          const claimed = await MeetingModel.findOneAndUpdate({ ...captionGuard,
            "bot.captionLanguageAttempts": { $lt: CAPTION_LANGUAGE_MAX_ATTEMPTS },
          }, { $inc: { "bot.captionLanguageAttempts": 1 } }, { new: true }).exec();
          if (claimed) {
            try {
              await adapter.setCaptionLanguage(claimed.bot.externalBotId!, claimed.bot.captionLanguage!);
              await MeetingModel.updateOne(captionGuard, {
                $set: { "bot.captionLanguageRequestedAt": now },
              }).exec();
            } catch {
              // Next check retries. Do not misclassify a language API failure
              // as failed entry or create/leave a participant to recover it.
            }
          }
        }
        if (state.state === "ended" && meeting.status === "processing") {
          const { finalizeMeeting } = await import("@/lib/finalize-meeting");
          await finalizeMeeting(id);
        }
      }
    } catch {
      // Provider downtime must not disable the locally persisted entry deadline.
    }
    meeting = await MeetingModel.findOne(guard).exec();
    if (!meeting || meeting.bot.leftAt) return;
    if (!meeting.bot.stopRequestedAt && meeting.bot.joinDeadlineAt && meeting.bot.joinDeadlineAt <= now && !meeting.bot.readyAt) {
      await requestAttendeeExit(meeting, { now, adapter, reason: !meeting.bot.externalBotId ? "create_uncertain" : meeting.bot.joinedAt ? "media_not_ready" : "join_timeout" });
      return;
    }
    if (meeting.bot.stopRequestedAt && meeting.bot.externalBotId && !meeting.bot.stopAcknowledgedAt) {
      // First reconcile remote state, then retry an unacknowledged stop. Never create a replacement here.
      if (meeting.bot.providerStatusCode?.startsWith("leaving")) return;
      try {
        await adapter.leave(meeting.bot.externalBotId);
        await MeetingModel.updateOne(guard, { $set: { "bot.stopAcknowledgedAt": now } }).exec();
      } catch { /* A subsequent check retries after reading provider state again. */ }
    }
  } finally {
    await MeetingModel.updateOne({ ...guard, "bot.monitorLeaseUntil": leaseUntil }, { $unset: { "bot.monitorLeaseUntil": 1 } }).exec();
  }
}

export async function checkMeetingEntries(options: { adapter?: MeetingBotAdapter } = {}): Promise<void> {
  await connectToDatabase();
  const due = new Date(Date.now() + MEETING_ENTRY_TIMEOUT_SECONDS * 1000);
  const meetings = await MeetingModel.find({
    "bot.provider": "attendee", "bot.entryAttemptId": { $exists: true },
    $or: [
      { status: "live", "bot.status": "joined", "bot.leftAt": null },
      { "bot.leftAt": null, "bot.joinDeadlineAt": { $lte: due } },
      { "bot.leftAt": null, "bot.stopRequestedAt": { $exists: true } },
      { status: "processing" },
      { "bot.providerStatusCode": /^post_processing(:|$)/u },
    ],
  }).select("_id").sort({ "bot.monitorCheckedAt": 1 }).limit(100).exec();
  // Bounded parallel IO; MongoDB leases keep multiple server instances from doing the same work.
  for (let start = 0; start < meetings.length; start += 5) {
    await Promise.all(meetings.slice(start, start + 5).map((meeting) => reconcileMeetingEntry(meeting._id.toString(), options)));
  }
}

export function startMeetingEntryMonitor(): void {
  const config = getMeetingBotRuntimeConfig();
  if (!config.ready || config.provider !== "attendee") return;
  const processState = globalThis as typeof globalThis & { conclaviaEntryMonitor?: ReturnType<typeof setInterval> };
  if (processState.conclaviaEntryMonitor) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await checkMeetingEntries(); }
    catch { console.error("Meeting entry check could not complete; it will retry."); }
    finally { running = false; }
  };
  processState.conclaviaEntryMonitor = setInterval(() => void tick(), MEETING_ENTRY_CHECK_MS);
  processState.conclaviaEntryMonitor.unref();
  void tick();
}

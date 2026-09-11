import { Types } from "mongoose";
import { after, NextResponse } from "next/server";

import {
  attendeeTranscript,
  parseAttendeeWebhook,
  verifyAttendeeWebhook,
} from "@/lib/attendee-webhook";
import { getMeetingBotRuntimeConfig } from "@/lib/meeting-bot-config";
import { finalizeMeeting } from "@/lib/finalize-meeting";
import { persistAttendeeState } from "@/lib/persist-attendee-state";
import { connectToDatabase } from "@/lib/mongodb";
import {
  processMeetingTranscriptAutomation,
  storeMeetingTranscript,
} from "@/lib/process-meeting-transcript";
import { MeetingModel } from "@/models/Meeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runTranscriptAutomation(meetingId: string, text: string, segmentId: string): Promise<void> {
  try {
    await connectToDatabase();
    const meeting = await MeetingModel.findById(meetingId).exec();
    if (!meeting || meeting.bot.stopRequestedAt || ["completed", "cancelled", "failed"].includes(meeting.status)) return;
    await processMeetingTranscriptAutomation(meeting, text, segmentId);
  } catch (error) {
    console.error("Unable to process Attendee transcript automation", error);
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = parseAttendeeWebhook(payload);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const config = getMeetingBotRuntimeConfig();
  if (config.webhookSecret) {
    try {
      verifyAttendeeWebhook(config.webhookSecret, request.headers, payload);
    } catch {
      return NextResponse.json({ error: "Request not verified" }, { status: 401 });
    }
  }

  await connectToDatabase();
  const metadataMeetingId = event.botMetadata?.conclavia_meeting_id;
  const meetingToken = new URL(request.url).searchParams.get("meeting_token");
  let meeting = await MeetingModel.findOne({
    $or: [
      {
        "bot.provider": "attendee",
        "bot.externalBotId": event.botId,
      },
      ...(typeof metadataMeetingId === "string" &&
      Types.ObjectId.isValid(metadataMeetingId) &&
      meetingToken
        ? [
            {
              _id: metadataMeetingId,
              "bot.outputToken": meetingToken,
            },
          ]
        : []),
    ],
  }).exec();
  if (!meeting) return NextResponse.json({ received: true });

  if (!config.webhookSecret) {
    if (!meetingToken || meetingToken !== meeting.bot.outputToken) {
      return NextResponse.json({ error: "Request not verified" }, { status: 401 });
    }
  }

  const attemptId = event.botMetadata?.conclavia_attempt_id;
  if (meeting.bot.entryAttemptId && (
    (attemptId && attemptId !== meeting.bot.entryAttemptId) ||
    (event.botId !== meeting.bot.externalBotId && attemptId !== meeting.bot.entryAttemptId)
  )) return NextResponse.json({ received: true });
  if (meeting.bot.externalBotId && meeting.bot.externalBotId !== event.botId) {
    return NextResponse.json({ received: true });
  }
  // Creation callbacks may arrive before the POST response. Bind only this attempt's bot.
  if (!meeting.bot.externalBotId) {
    await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": meeting.bot.entryAttemptId ?? null, "bot.externalBotId": null }, {
      $set: { "bot.provider": "attendee", "bot.externalBotId": event.botId },
    }).exec();
    meeting = await MeetingModel.findById(meeting._id).exec();
    if (!meeting || meeting.bot.externalBotId !== event.botId) return NextResponse.json({ received: true });
  }

  meeting.bot.processedWebhookIds ||= [];
  if (meeting.bot.processedWebhookIds.includes(event.idempotencyKey)) {
    return NextResponse.json({ received: true });
  }
  if (event.trigger === "bot.state_change") {
    const occurredAt = new Date(typeof event.data.created_at === "string" ? event.data.created_at : Date.now());
    const updated = await persistAttendeeState(meeting, {
      state: typeof event.data.new_state === "string" ? event.data.new_state : "",
      eventType: typeof event.data.event_type === "string" ? event.data.event_type : undefined,
      subType: typeof event.data.event_sub_type === "string" ? event.data.event_sub_type : undefined,
      occurredAt,
    }, event.idempotencyKey);
    if (!updated) return NextResponse.json({ error: "State changed concurrently; retry delivery" }, { status: 503 });
    if (event.data.new_state === "ended" && meeting.status === "processing") {
      const meetingId = meeting._id.toString();
      after(() => finalizeMeeting(meetingId));
    }
    return NextResponse.json({ received: true });
  }
  if (meeting.bot.stopRequestedAt || meeting.bot.leftAt || ["failed", "completed", "cancelled"].includes(meeting.status)) {
    return NextResponse.json({ received: true });
  }
  meeting.bot.processedWebhookIds.push(event.idempotencyKey);
  if (meeting.bot.processedWebhookIds.length > 200) {
    meeting.bot.processedWebhookIds.splice(
      0,
      meeting.bot.processedWebhookIds.length - 200,
    );
  }

  let transcriptSegmentId: string | undefined;
  const transcript = attendeeTranscript(event);
  if (transcript) {
    const stored = await storeMeetingTranscript(meeting, {
      ...transcript,
      language: meeting.language === "auto" ? undefined : meeting.language,
    });
    transcriptSegmentId = stored.segmentId;
    if (stored.duplicate) await meeting.save();
  } else if (
    event.trigger === "participant_events.join_leave" &&
    event.data.event_type === "join" &&
    typeof event.data.participant_name === "string" &&
    event.data.participant_name.trim()
  ) {
    const participantName = event.data.participant_name.trim().slice(0, 160);
    if (
      !meeting.participants.some(
        (name) => name.toLocaleLowerCase() === participantName.toLocaleLowerCase(),
      )
    ) {
      meeting.participants.push(participantName);
    }
    await meeting.save();
  } else {
    await meeting.save();
  }

  if (transcriptSegmentId !== undefined && transcript) {
    const meetingId = meeting._id.toString();
    const segmentId = transcriptSegmentId;
    after(() => runTranscriptAutomation(meetingId, transcript.text, segmentId));
  }
  return NextResponse.json({ received: true });
}

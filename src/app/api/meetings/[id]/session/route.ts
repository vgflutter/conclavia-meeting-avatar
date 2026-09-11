import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { getMeetingBotAdapter } from "@/lib/meeting-bot-adapter";
import { getMeetingBotRuntimeConfig } from "@/lib/meeting-bot-config";
import { scheduleMeetingBot } from "@/lib/meeting-bot-scheduler";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMeeting } from "@/lib/serialize-meeting";
import { MeetingModel } from "@/models/Meeting";
import { startAttendeeEntry, requestAttendeeExit, MeetingEntryConflictError } from "@/lib/meeting-entry";
import { MeetingOutputUnavailableError } from "@/lib/meeting-output-health";
import { persistAttendeeState } from "@/lib/persist-attendee-state";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;
  if (action !== "join" && action !== "schedule" && action !== "leave" && action !== "refresh_output") {
    return NextResponse.json(
      { error: "Action must be join, schedule or leave" },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    let meeting = await MeetingModel.findById(id).exec();
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.archivedAt && (action === "join" || action === "schedule")) {
      return NextResponse.json({ error: "Unarchive the meeting before starting a new attempt" }, { status: 409 });
    }

    if (action === "refresh_output") {
      const outputAdapter = getMeetingBotAdapter(meeting.bot.provider);
      if (outputAdapter.live && outputAdapter.getStatus && meeting.bot.externalBotId) {
        await persistAttendeeState(meeting, await outputAdapter.getStatus(meeting.bot.externalBotId));
        meeting = (await MeetingModel.findById(id).exec())!;
      }
      if (!outputAdapter.live || !outputAdapter.refreshOutput || meeting.bot.status !== "joined" || meeting.bot.stopRequestedAt) {
        return NextResponse.json({ error: "No active avatar to restore", code: "output_not_active" }, { status: 409 });
      }
      const restart = Boolean(body && typeof body === "object" && "restart" in body && body.restart === true);
      const outputUrl = await outputAdapter.refreshOutput(serializeMeeting(meeting), {restart});
      await MeetingModel.updateOne({ _id: meeting._id, "bot.externalBotId": meeting.bot.externalBotId,
        "bot.entryAttemptId": meeting.bot.entryAttemptId, "bot.stopRequestedAt": null }, {
        $set: { "bot.outputUrl": outputUrl },
        $unset: { "bot.outputLastSeenAt": 1, "bot.outputVoiceReady": 1 },
      });
      const updated = await MeetingModel.findById(id).exec();
      return NextResponse.json({ meeting: serializeMeeting(updated!) });
    }

    const adapter = getMeetingBotAdapter(
      action === "leave" ? meeting.bot.provider : undefined,
    );
    if ((adapter.provider === "attendee" || (action === "leave" && meeting.bot.provider === "attendee")) && action !== "schedule") {
      if (action === "join") {
        const updated = await startAttendeeEntry(meeting);
        return NextResponse.json({ meeting: serializeMeeting(updated) });
      }
      if (!["scheduling", "joining", "waiting_room", "joined", "leaving"].includes(meeting.bot.status)) {
        return NextResponse.json({ error: "The colleague is not currently entering or in this meeting" }, { status: 409 });
      }
      await requestAttendeeExit(meeting);
      const updated = await MeetingModel.findById(id).exec();
      return NextResponse.json({ meeting: serializeMeeting(updated!) });
    }
    if (action === "schedule") {
      if (!meeting.autoJoin || !["scheduled", "failed"].includes(meeting.status)) {
        return NextResponse.json(
          { error: "Automatic entry cannot be scheduled from the current state" },
          { status: 409 },
        );
      }
      await scheduleMeetingBot(meeting);
    } else if (action === "join") {
      if (!["scheduled", "failed"].includes(meeting.status)) {
        return NextResponse.json(
          { error: "This meeting cannot be joined from its current state" },
          { status: 409 },
        );
      }

      const activeColleague = await MeetingModel.exists({
        _id: { $ne: meeting._id },
        meetingUrl: meeting.meetingUrl,
        "bot.status": { $in: ["scheduling", "joining", "waiting_room", "joined"] },
      });
      if (activeColleague) {
        return NextResponse.json(
          { error: "Il collega digitale è già stato inviato a questo meeting." },
          { status: 409 },
        );
      }

      const session = await adapter.join(
        serializeMeeting(meeting),
        new URL(request.url).origin,
      );
      const config = getMeetingBotRuntimeConfig();
      meeting.status = adapter.live ? "joining" : "live";
      meeting.bot.provider = session.provider;
      meeting.bot.accessMode = config.accessMode;
      meeting.bot.status = adapter.live ? "joining" : "joined";
      meeting.bot.externalBotId = session.externalBotId;
      meeting.bot.accountEmail = adapter.live ? config.accountEmail : undefined;
      meeting.bot.outputUrl = session.outputUrl;
      meeting.bot.joinedAt = adapter.live ? undefined : session.joinedAt;
      meeting.bot.leftAt = undefined;
      meeting.bot.providerStatusCode = adapter.live ? "joining" : "preview";
      meeting.bot.lastStatusAt = new Date();
      meeting.bot.lastError = undefined;
      await meeting.save();
    } else {
      if (
        !meeting.bot.externalBotId ||
        !["joining", "waiting_room", "joined"].includes(meeting.bot.status)
      ) {
        return NextResponse.json(
          { error: "The colleague is not currently in this meeting" },
          { status: 409 },
        );
      }

      const result = await adapter.leave(meeting.bot.externalBotId);
      meeting.status = "processing";
      meeting.bot.status = "left";
      meeting.bot.leftAt = result.leftAt;
      await meeting.save();
    }

    return NextResponse.json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    if (error instanceof MeetingOutputUnavailableError) {
      return NextResponse.json({ error: "Avatar unavailable", code: "output_unavailable" }, { status: 503 });
    }
    if (error instanceof MeetingEntryConflictError) {
      return NextResponse.json({ error: "Il tentativo precedente non è ancora terminato oppure il collega è già stato inviato a questo meeting." }, { status: 409 });
    }
    console.error("Unable to update meeting session", error);
    return NextResponse.json(
      { error: "Unable to update meeting session" },
      { status: 500 },
    );
  }
}

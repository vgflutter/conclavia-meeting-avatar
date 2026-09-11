import { createHash } from "node:crypto";
import { classifyTranscriptSource } from "@/lib/meeting-transcript-source";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";
import type { MeetingRecord } from "@/types/meeting";
import { MEETING_DEBUG_EVENT_LIMIT, type MeetingDebugEvent, type MeetingDebugResponse } from "@/types/meeting-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

type DebugMeeting = Pick<MeetingRecord, "assistant" | "transcript" | "commandHistory" | "bot"> & {
  totalEvents: number;
};

// Management-only route: deliberately outside the public meeting-room paths.
// Read bounded arrays; never serialize the bot configuration or the whole meeting.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404, headers });
  }

  try {
    await connectToDatabase();
    const [meeting] = await MeetingModel.aggregate<DebugMeeting>([
      { $match: { _id: new Types.ObjectId(id) } },
      { $project: {
        _id: 0,
        "assistant.wakeWord": 1,
        "bot.outputSpeechCommandId": 1,
        "bot.outputSpeechState": 1,
        "bot.outputSpeechUpdatedAt": 1,
        "bot.outputLastSeenAt": 1,
        transcript: { $slice: ["$transcript", -MEETING_DEBUG_EVENT_LIMIT] },
        commandHistory: { $slice: ["$commandHistory", -MEETING_DEBUG_EVENT_LIMIT] },
        totalEvents: { $add: [{ $size: "$transcript" }, { $size: "$commandHistory" }] },
      } },
    ]).exec();
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404, headers });
    }

    const events: MeetingDebugEvent[] = [
      ...meeting.transcript.map((segment) => ({
        ...classifyTranscriptSource(meeting, segment),
        id: `transcript-${segment.segmentId || segment.sequence}`,
        kind: "transcript" as const,
        speakerName: segment.speakerName,
        text: segment.text,
        createdAt: segment.createdAt.toISOString(),
      })),
      ...meeting.commandHistory.map((command) => ({
        id: `response-${command.id}`,
        kind: "response" as const,
        speakerName: meeting.assistant.wakeWord,
        text: command.response,
        prompt: command.prompt || undefined,
        createdAt: command.createdAt.toISOString(),
      })),
    ];
    events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const payload: MeetingDebugResponse = {
      events: events.slice(-MEETING_DEBUG_EVENT_LIMIT),
      hasEarlierEvents: meeting.totalEvents > MEETING_DEBUG_EVENT_LIMIT,
      ...(meeting.bot?.outputSpeechCommandId && meeting.bot.outputSpeechState && meeting.bot.outputSpeechUpdatedAt &&
        (meeting.bot.outputSpeechState !== "speaking" || (meeting.bot.outputLastSeenAt && Date.now() - meeting.bot.outputLastSeenAt.getTime() < 20_000)) ? {
        playback: { commandId: meeting.bot.outputSpeechCommandId, state: meeting.bot.outputSpeechState,
          updatedAt: meeting.bot.outputSpeechUpdatedAt.toISOString() },
      } : {}),
    };
    const etag = `"${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}"`;
    const responseHeaders = { ...headers, ETag: etag };
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: responseHeaders });
    }
    return NextResponse.json(payload, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to load conversation" }, { status: 500, headers });
  }
}

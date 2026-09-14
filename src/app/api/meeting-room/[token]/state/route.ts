import { after, NextResponse } from "next/server";
import { processMeetingInterventionQueue } from "@/lib/meeting-intervention-queue";
import { visibleMeetingIntervention } from "@/lib/meeting-pending-intervention";

import { connectToDatabase } from "@/lib/mongodb";
import { AssistantProfileModel } from "@/models/AssistantProfile";
import { MeetingModel } from "@/models/Meeting";
import { publicMeetingTtsConfig } from "@/lib/meeting-tts-config";
import { parseVoicePlaybackMetrics, type VoicePlaybackMetrics } from "@/lib/voice-playback-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[0-9a-f-]{36}$/iu.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let payload: { attemptId?: unknown; voiceReady?: unknown; playback?: { commandId?: unknown; state?: unknown; metrics?: unknown } };
  let metrics: VoicePlaybackMetrics | undefined;
  try {
    const body = await request.text();
    if (body.length > 1_024) throw new Error();
    payload = JSON.parse(body);
    if (!payload || typeof payload.attemptId !== "string" || !/^[0-9a-f-]{36}$/iu.test(payload.attemptId) ||
        typeof payload.voiceReady !== "boolean") throw new Error();
    if (payload.playback !== undefined && (!payload.playback ||
      typeof payload.playback.commandId !== "string" || !/^[0-9a-f-]{36}$/iu.test(payload.playback.commandId) ||
      !["speaking", "completed", "error"].includes(String(payload.playback.state)))) throw new Error();
    if (payload.playback?.metrics !== undefined) {
      metrics = parseVoicePlaybackMetrics(payload.playback.metrics);
      if (payload.playback.state !== "completed" || !metrics) throw new Error();
    }
  } catch { return NextResponse.json({ error: "Invalid readiness report" }, { status: 400 }); }
  try {
    await connectToDatabase();
    const match = {
      "bot.outputToken": token, "bot.entryAttemptId": payload.attemptId,
      "bot.stopRequestedAt": null, "bot.leftAt": null,
      "bot.status": { $in: ["scheduling", "joining", "waiting_room", "joined"] },
      ...(payload.playback ? { "commandHistory.id": payload.playback.commandId } : {}),
    };
    const result = await MeetingModel.updateOne(match, { $set: {
      "bot.outputLastSeenAt": new Date(), "bot.outputVoiceReady": payload.voiceReady,
    } }, { strict: "throw" });
    if (result.matchedCount && payload.playback) {
      const acknowledgedAt = new Date();
      const speechResult = await MeetingModel.updateOne({ ...match, $or: [
        { "bot.outputSpeechCommandId": { $ne: payload.playback.commandId } },
        { "bot.outputSpeechState": { $nin: payload.playback.state === "speaking"
          ? ["speaking", "completed"] : [payload.playback.state] } },
      ] }, { $set: {
        "bot.outputSpeechCommandId": payload.playback.commandId,
        "bot.outputSpeechState": payload.playback.state,
        "bot.outputSpeechUpdatedAt": acknowledgedAt,
      } }, { strict: "throw" });
      // Only a real transition is a playback timestamp. Repeated heartbeats or a
      // late "speaking" after completion must not invent a new playback window.
      if (speechResult.modifiedCount) {
        const clockField = payload.playback.state === "speaking" ? "playbackStartedAt" : "playbackEndedAt";
        await MeetingModel.updateOne({ ...match, commandHistory: { $elemMatch: {
          id: payload.playback.commandId, [clockField]: { $exists: false },
        } } }, { $set: { [`commandHistory.$.${clockField}`]: acknowledgedAt } }, { strict: "throw" });
      }
      // Heartbeats can retry a lost completion report. Save once, independently
      // of the latest playback badge; never rewrite a prior command's metrics.
      if (metrics) await MeetingModel.updateOne({ ...match, commandHistory: { $elemMatch: {
        id: payload.playback.commandId, playbackMetrics: { $exists: false },
      } } }, { $set: { "commandHistory.$.playbackMetrics": metrics } }, { strict: "throw" });
    }
    return new NextResponse(null, { status: result.matchedCount ? 204 : 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Readiness unavailable" }, { status: 503 }); }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "Meeting output not found" }, { status: 404 });
  }

  try {
    await connectToDatabase();
    const meeting = await MeetingModel.findOne({ "bot.outputToken": token })
      .select("status assistant.wakeWord assistant.correctionPolicy commandHistory pendingIntervention bot.stopRequestedAt bot.leftAt bot.interventionNextCheckAt bot.interventionLeaseUntil")
      .exec();
    if (!meeting) {
      return NextResponse.json({ error: "Meeting output not found" }, { status: 404 });
    }

    const profile = await AssistantProfileModel.findOne({ key: "default" }).select("appearance").lean().exec();
    if (meeting.status === "live" && meeting.bot?.interventionNextCheckAt &&
        meeting.bot.interventionNextCheckAt.getTime() <= Date.now() &&
        (!meeting.bot.interventionLeaseUntil || meeting.bot.interventionLeaseUntil.getTime() <= Date.now())) {
      // Existing renderer polling drains durable jobs without blocking media
      // state or requiring another caption. The worker rechecks all guards.
      after(async () => {
        try { await processMeetingInterventionQueue(meeting._id.toString()); }
        catch { console.error("Unable to drain meeting intervention queue"); }
      });
    }
    const latest = meeting.commandHistory.at(-1);
    const cursor = new URL(request.url).searchParams.get("after");
    const cursorIndex = cursor ? meeting.commandHistory.findIndex((command) => command.id === cursor) : -1;
    const commands = meeting.commandHistory.slice(cursorIndex + 1).map(({ id, kind, response }) => ({ id, kind, response }));
    const visible = visibleMeetingIntervention(meeting);
    const pending = visible ? { id: visible.id, type: visible.type, response: visible.response } : undefined;
    return NextResponse.json(
      {
        status: meeting.status,
        appearance: profile?.appearance === "business_clay_female" ? "business_clay_female" : "business_clay",
        voice: publicMeetingTtsConfig(),
        ...(cursor !== null ? { commands, displayName: meeting.assistant.wakeWord } : {}),
        pendingIntervention: pending,
        command: latest
          ? {
              id: latest.id,
              kind: latest.kind,
              response: latest.response,
            }
          : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Meeting output unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

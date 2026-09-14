import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { isLocalDiagnosticRequest } from "@/lib/meeting-diagnostics";
import { MeetingModel } from "@/models/Meeting";
import { MeetingDiagnosticModel } from "@/models/MeetingDiagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalDiagnosticRequest(request)) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return new NextResponse("Not found", { status: 404 });
  try {
    await connectToDatabase();
    const meeting = await MeetingModel.findById(id).select({ status: 1, bot: 1 }).exec();
    if (!meeting) return new NextResponse("Not found", { status: 404 });
    const bot = meeting.bot;
    const diagnostic = bot.entryAttemptId && bot.externalBotId ? await MeetingDiagnosticModel.findOne({
      meetingId: meeting._id, attemptId: bot.entryAttemptId, botId: bot.externalBotId,
      expiresAt: { $gt: new Date() },
    }).lean().exec() : undefined;
    // Explicit projection: no invitation, output capability, context or transcript.
    return NextResponse.json({
      meetingId: id, collectedAt: new Date().toISOString(), attemptId: bot.entryAttemptId ?? null,
      botId: bot.externalBotId ?? null, status: meeting.status, providerStatus: bot.providerStatusCode ?? null,
      failureCode: bot.failureCode ?? null, lastStatusAt: bot.lastStatusAt ?? null,
      joinDeadlineAt: bot.joinDeadlineAt ?? null, joinedAt: bot.joinedAt ?? null,
      readyAt: bot.readyAt ?? null, outputLastSeenAt: bot.outputLastSeenAt ?? null,
      stopRequestedAt: bot.stopRequestedAt ?? null, leftAt: bot.leftAt ?? null,
      logSubscription: bot.diagnosticLogsRequestedAt ? "requested" : "not_confirmed_for_this_attempt",
      logSubscriptionRequestedAt: bot.diagnosticLogsRequestedAt ?? null,
      expiresAt: diagnostic?.expiresAt ?? null,
      logs: (diagnostic?.entries ?? []).map(entry => ({
        level: entry.level, type: entry.type, message: entry.message,
        occurredAt: entry.occurredAt, receivedAt: entry.receivedAt,
      })),
      interpretation: "Empty logs are not proof of a healthy bot. Subscription acknowledgement is not proof of Teams entry. Only the current attempt is shown; prior attempts are not relabelled.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to read diagnostics" }, { status: 503 });
  }
}

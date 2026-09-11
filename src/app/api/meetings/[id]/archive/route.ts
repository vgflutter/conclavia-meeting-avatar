import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({error: "Not found"}, {status: 404});
  let archived: boolean;
  try {
    const raw = await request.text();
    if (raw.length > 128) throw new Error();
    const body = JSON.parse(raw);
    if (typeof body?.archived !== "boolean") throw new Error();
    archived = body.archived;
  } catch { return NextResponse.json({error: "Invalid archive request"}, {status: 400}); }
  try {
    await connectToDatabase();
    // Atomic guard shared with entry's archivedAt check: an active or uncertain
    // participant can never be hidden by archiving. No provider calls or deletion.
    const result = await MeetingModel.updateOne({
      _id: id, scheduledStart: { $lt: new Date() }, status: { $in: ["scheduled", "failed", "completed", "cancelled"] },
      "bot.status": { $nin: ["scheduling", "scheduled", "joining", "waiting_room", "joined", "leaving"] },
      "bot.activeRoomKey": null, "bot.failureCode": { $ne: "create_uncertain" },
      $or: [
        { "bot.externalBotId": null }, { "bot.externalBotId": "" },
        { "bot.leftAt": { $type: "date" }, "bot.providerStatusCode": /^(ended|fatal_error|cancelled)(:|$)/u },
        { "bot.leftAt": { $type: "date" }, "bot.entryAttemptId": null },
      ],
    }, archived ? { $set: { archivedAt: new Date() } } : { $unset: { archivedAt: 1 } }, {strict: "throw"});
    if (!result.matchedCount) return NextResponse.json({error: "Meeting must be past and its participant confirmed inactive"}, {status: 409});
    return NextResponse.json({archived});
  } catch { return NextResponse.json({error: "Archive unavailable"}, {status: 500}); }
}

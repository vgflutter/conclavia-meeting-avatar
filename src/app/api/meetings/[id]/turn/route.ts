import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { consumeMeetingIntervention } from "@/lib/consume-meeting-intervention";
import { MeetingModel } from "@/models/Meeting";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

// Management-only: an explicit GUI grant removes addressee ambiguity. This is
// not available through the public avatar capability or a provider webhook.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url);
  if (request.headers.get("host")) destination.host = request.headers.get("host")!;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== destination.origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Meeting not found" }, { status: 404, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.interventionId !== "string" || body.interventionId.length > 100) {
    return NextResponse.json({ error: "Intervention required" }, { status: 400, headers });
  }
  try {
    await connectToDatabase();
    const meeting = await MeetingModel.findById(id).exec();
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404, headers });
    const command = await consumeMeetingIntervention(meeting, body.interventionId);
    if (!command) return NextResponse.json({ error: "Turn no longer available" }, { status: 409, headers });
    return NextResponse.json({ commandId: command.id }, { headers });
  } catch {
    return NextResponse.json({ error: "Turn unavailable" }, { status: 503, headers });
  }
}

import { Types } from "mongoose";
import { after, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { meetingParticipantStatus } from "@/lib/meeting-participants";
import { syncMeetingParticipants } from "@/lib/sync-meeting-participants";
import { MeetingModel } from "@/models/Meeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  await connectToDatabase();
  const meeting = await MeetingModel.findById(id).exec();
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  // Return the last known state immediately; a leased background GET recovers
  // missed events, including for sessions already running before this update.
  after(async () => {
    try { await syncMeetingParticipants(id); }
    catch { console.error("Participant list could not synchronize; it will retry."); }
  });
  return NextResponse.json({ participantStatus: meetingParticipantStatus(meeting) }, { headers: { "Cache-Control": "no-store" } });
}

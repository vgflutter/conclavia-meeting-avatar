import { randomUUID } from "node:crypto";
import { MeetingModel, type MeetingDocument } from "@/models/Meeting";

// Shared by spoken grants and the explicit management control. Only the exact
// still-valid hand can be consumed; clearing it and publishing speech is atomic.
export async function consumeMeetingIntervention(meeting: MeetingDocument, interventionId: string) {
  const pending = meeting.pendingIntervention;
  if (!pending || pending.id !== interventionId) return undefined;
  const command = {
    id: randomUUID(), kind: pending.type === "correction" ? "correct" as const : "inform" as const,
    prompt: pending.sourceStatement, response: pending.response, createdAt: new Date(),
  };
  const consumed = await MeetingModel.updateOne({ _id: meeting._id,
    "pendingIntervention.id": pending.id, "pendingIntervention.expiresAt": { $gt: new Date() },
    "assistant.correctionPolicy": "important_only", "bot.entryAttemptId": meeting.bot.entryAttemptId,
    "bot.stopRequestedAt": { $exists: false }, "bot.leftAt": { $exists: false }, status: "live",
  }, { $unset: { pendingIntervention: 1 }, $push: { commandHistory: { $each: [command], $slice: -50 } } });
  return consumed.modifiedCount ? command : undefined;
}

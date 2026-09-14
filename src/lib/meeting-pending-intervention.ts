import type { MeetingRecord } from "@/types/meeting";

/** Shared by management, SSR and polling; retained evidence is not a live hand. */
export function visibleMeetingIntervention(
  meeting: Pick<MeetingRecord, "status" | "assistant" | "bot" | "pendingIntervention">,
  now = Date.now(),
) {
  const pending = meeting.pendingIntervention;
  return meeting.status === "live" && meeting.assistant.correctionPolicy === "important_only" &&
    !meeting.bot.stopRequestedAt && !meeting.bot.leftAt && pending && pending.expiresAt.getTime() > now
    ? pending : undefined;
}

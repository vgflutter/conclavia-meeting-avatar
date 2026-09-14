import { buildMeetingConversationContext } from "@/lib/meeting-conversation-context";
import type { MeetingResponse } from "@/types/meeting";

export interface InterventionCandidate { segmentId: string; speakerName: string; text: string }
export const INTERVENTION_BATCH_CHARS = 4_000;
// Fixed collection window, not a trailing debounce: continuous captions cannot
// keep postponing the first assessment. Only the proactive lane waits here.
export const INTERVENTION_CHECK_INTERVAL_MS = 2_500;

// The batch replaces part of the normal recent/retrieved window. Keep complete
// candidate captions and bounded recent dialogue, not the entire meeting history.
export function buildInterventionContext(meeting: MeetingResponse, query: string, candidates: InterventionCandidate[]) {
  if (!candidates.length || candidates.length > 8 || JSON.stringify(candidates).length > INTERVENTION_BATCH_CHARS) {
    throw new Error("Intervention batch exceeds context budget");
  }
  const context = buildMeetingConversationContext(meeting, query);
  const recent = [...context.recent];
  while (JSON.stringify(recent).length > 3_000) recent.shift();
  return { conversation: { ...context, recent, retrieved: [] }, candidates };
}

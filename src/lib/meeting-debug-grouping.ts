import type { MeetingDebugEvent } from "@/types/meeting-debug";

export interface MeetingDebugGroup {
  event: MeetingDebugEvent;
  transcripts: MeetingDebugEvent[];
}

function normalized(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Presentation only: keep every original event in the API/database. Do not use
// a visual association as a playback acknowledgement or speaker correction.
export function groupMeetingDebugEvents(events: MeetingDebugEvent[]): MeetingDebugGroup[] {
  const responses = events.filter(event => event.kind === "response");
  const attached = new Map<string, MeetingDebugEvent[]>();
  const children = new Set<string>();
  for (const event of events) {
    // Human speech and uncertain attribution must remain independently visible.
    if (event.kind !== "transcript" || event.source !== "avatar") continue;
    const text = normalized(event.text);
    if (!text) continue;
    const matches = responses.filter(response => {
      if (event.echoCommandId && response.id !== `response-${event.echoCommandId}`) return false;
      const elapsed = Date.parse(event.createdAt) - Date.parse(response.createdAt);
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 90_000) return false;
      const answer = normalized(response.text);
      return text === answer || (text.length >= 18 && text.split(" ").length >= 4 &&
        ` ${answer} `.includes(` ${text} `));
    });
    // Repeated answers, missing history or uncertain text stay separate.
    if (matches.length !== 1) continue;
    const parentId = matches[0].id;
    attached.set(parentId, [...(attached.get(parentId) || []), event]);
    children.add(event.id);
  }
  return events.filter(event => !children.has(event.id)).map(event => ({
    event, transcripts: attached.get(event.id) || [],
  }));
}

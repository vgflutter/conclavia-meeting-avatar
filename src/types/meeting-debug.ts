export const MEETING_DEBUG_EVENT_LIMIT = 100;

export interface MeetingDebugEvent {
  id: string;
  kind: "transcript" | "response";
  source?: "participant" | "avatar" | "suspected_echo";
  echoCommandId?: string;
  speakerName: string;
  text: string;
  prompt?: string;
  createdAt: string;
}

export interface MeetingDebugResponse {
  events: MeetingDebugEvent[];
  hasEarlierEvents: boolean;
  playback?: { commandId: string; state: "speaking" | "completed" | "error"; updatedAt: string };
}

export const MEETING_DEBUG_EVENT_LIMIT = 100;

export interface MeetingDebugEvent {
  id: string;
  kind: "transcript" | "response";
  source?: "participant" | "avatar" | "suspected_echo";
  echoCommandId?: string;
  speakerName: string;
  text: string;
  prompt?: string;
  playbackMetrics?: import("@/lib/voice-playback-metrics").VoicePlaybackMetrics;
  createdAt: string;
  interventionDecision?: {
    state: "queued" | "checking" | "raised" | "none" | "skipped" | "error";
    reason: string;
    detail?: string;
    decidedAt: string;
  };
  turnDecision?: {
    action: import("@/lib/meeting-speaking-turn").SpeakingTurnDecision["action"];
    reason: import("@/lib/meeting-speaking-turn").TurnReason;
    method: "rules" | "semantic";
    decidedAt: string;
  };
}

export interface MeetingDebugResponse {
  events: MeetingDebugEvent[];
  hasEarlierEvents: boolean;
  playback?: { commandId: string; state: "speaking" | "completed" | "error"; updatedAt: string };
}

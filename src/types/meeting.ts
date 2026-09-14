import type { Types } from "mongoose";

export type MeetingPlatform = "microsoft_teams";

export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "waiting_room"
  | "live"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed";

export type MeetingBotProvider = "mock" | "recall" | "attendee";
export type MeetingAccessMode = "verified_guest" | "anonymous_guest";
export type MeetingBotStatus =
  | "not_scheduled"
  | "scheduling"
  | "scheduled"
  | "joining"
  | "waiting_room"
  | "joined"
  | "leaving"
  | "left"
  | "failed";

export type MeetingLanguage = "auto" | "it" | "en";
export type AgendaItemStatus = "pending" | "covered" | "skipped";
export type CorrectionPolicy = "important_only" | "on_request" | "off";
export type MeetingCommandKind =
  | "remember"
  | "summary"
  | "agenda"
  | "ask"
  | "correct"
  | "inform";
export type MeetingInterventionType = "correction" | "relevant_information";

export interface MeetingAgendaInput {
  title: string;
  mandatory: boolean;
}

export interface MeetingAgendaItem extends MeetingAgendaInput {
  id: string;
  status: AgendaItemStatus;
  notes?: string;
}

export interface MeetingAssistantConfiguration {
  wakeWord: string;
  answerQuestions: boolean;
  captureMemory: boolean;
  summarizeOnRequest: boolean;
  correctionPolicy: CorrectionPolicy;
}

export interface MeetingCreateInput {
  context?: string;
  title: string;
  meetingUrl: string;
  scheduledStart: string;
  durationMinutes: number;
  timezone: string;
  objective: string;
  seriesLabel?: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  agenda: MeetingAgendaInput[];
  correctionPolicy: CorrectionPolicy;
}

export interface MeetingAppointmentInput {
  label?: string;
  meetingUrl: string;
  scheduledStart: string;
  durationMinutes: number;
}

export interface MeetingSeriesCreateInput {
  context?: string;
  title: string;
  objective: string;
  timezone: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  agenda: MeetingAgendaInput[];
  correctionPolicy: CorrectionPolicy;
  appointments: MeetingAppointmentInput[];
}

export interface MeetingActionItem {
  description: string;
  owner?: string;
  dueAt?: Date;
  completed: boolean;
}

export interface MeetingParticipantNote {
  displayName: string;
  note: string;
}

export interface MeetingTranscriptSegment {
  interventionDecision?: {
    state: "queued" | "checking" | "raised" | "none" | "skipped" | "error";
    reason: string;
    detail?: string;
    decidedAt: Date;
  };
  automationClaimedAt?: Date;
  turnDecision?: {
    action: import("@/lib/meeting-speaking-turn").SpeakingTurnDecision["action"];
    reason: import("@/lib/meeting-speaking-turn").TurnReason;
    method: "rules" | "semantic";
    decidedAt: Date;
  };
  speakerIsParticipant?: boolean;
  speakerId?: string;
  entryAttemptId?: string;
  segmentId?: string;
  source?: "participant" | "avatar" | "suspected_echo";
  echoCommandId?: string;
  sequence: number;
  speakerName: string;
  text: string;
  language?: "it" | "en";
  startMs?: number;
  endMs?: number;
  createdAt: Date;
}

export interface MeetingCommandEvent {
  playbackMetrics?: import("@/lib/voice-playback-metrics").VoicePlaybackMetrics;
  playbackStartedAt?: Date;
  playbackEndedAt?: Date;
  id: string;
  kind: MeetingCommandKind;
  prompt?: string;
  response: string;
  createdAt: Date;
}

export interface MeetingPendingIntervention {
  id: string;
  type: MeetingInterventionType;
  sourceSpeaker?: string;
  sourceStatement: string;
  reason: string;
  response: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface MeetingSummary {
  overview: string;
  rememberedFacts: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  openQuestions: string[];
  participantNotes: MeetingParticipantNote[];
  generatedAt?: Date;
}

export interface MeetingBotConfiguration {
  provider: MeetingBotProvider;
  accessMode: MeetingAccessMode;
  status: MeetingBotStatus;
  externalBotId?: string;
  accountEmail?: string;
  outputToken: string;
  outputUrl?: string;
  scheduledFor?: Date;
  joinedAt?: Date;
  leftAt?: Date;
  providerStatusCode?: string;
  lastStatusAt?: Date;
  lastCorrectionCheckAt?: Date;
  interventionNextCheckAt?: Date;
  interventionLeaseUntil?: Date;
  processedWebhookIds?: string[];
  lastError?: string;
  entryAttemptId?: string;
  activeRoomKey?: string;
  joinDeadlineAt?: Date;
  readyAt?: Date;
  outputLastSeenAt?: Date;
  outputVoiceReady?: boolean;
  outputSpeechCommandId?: string;
  outputSpeechState?: "speaking" | "completed" | "error";
  outputSpeechUpdatedAt?: Date;
  stopRequestedAt?: Date;
  stopAcknowledgedAt?: Date;
  failureCode?: string;
  monitorLeaseUntil?: Date;
  monitorCheckedAt?: Date;
  captionLanguage?: "it-it" | "en-us";
  captionLanguageAttempts?: number;
  // Provider HTTP acknowledgement, not proof of transcription accuracy.
  captionLanguageRequestedAt?: Date;
  diagnosticLogsRequestedAt?: Date;
}

export interface MeetingVoiceConfiguration {
  mode: "streaming";
  provider: "inworld";
  model: "inworld-tts-2" | "inworld-tts-2-flash";
  pronunciationProfile: string;
}

export interface MeetingRetentionConfiguration {
  transcriptDays: number;
  storeAudio: boolean;
  consentRequired: boolean;
}

export interface MeetingRecord {
  participantRoster?: import("@/lib/meeting-participants").MeetingParticipantRoster;
  participantSyncAttemptAt?: Date;
  participantSyncLeaseUntil?: Date;
  context?: string;
  contextVersion?: number;
  archivedAt?: Date;
  seriesId?: Types.ObjectId;
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  scheduledStart: Date;
  scheduledEnd: Date;
  timezone: string;
  objective: string;
  seriesLabel?: string;
  seriesKey: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  status: MeetingStatus;
  agenda: MeetingAgendaItem[];
  assistant: MeetingAssistantConfiguration;
  commandHistory: MeetingCommandEvent[];
  pendingIntervention?: MeetingPendingIntervention;
  bot: MeetingBotConfiguration;
  voice: MeetingVoiceConfiguration;
  retention: MeetingRetentionConfiguration;
  participants: string[];
  transcript: MeetingTranscriptSegment[];
  summary: MeetingSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingResponse {
  participantStatus?: import("@/lib/meeting-participants").MeetingParticipantStatus;
  context?: string;
  contextVersion?: number;
  archivedAt?: string;
  id: string;
  seriesId?: string;
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  objective: string;
  seriesLabel?: string;
  seriesKey: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  status: MeetingStatus;
  agenda: MeetingAgendaItem[];
  assistant: MeetingAssistantConfiguration;
  commandHistory: Array<Omit<MeetingCommandEvent, "createdAt" | "playbackStartedAt" | "playbackEndedAt"> & {
    createdAt: string; playbackStartedAt?: string; playbackEndedAt?: string;
  }>;
  pendingIntervention?: Omit<MeetingPendingIntervention, "createdAt" | "expiresAt"> & {
    createdAt: string;
    expiresAt: string;
  };
  bot: {
    provider: MeetingBotProvider;
    accessMode: MeetingAccessMode;
    status: MeetingBotStatus;
    externalBotId?: string;
    accountEmail?: string;
    outputToken: string;
    outputUrl?: string;
    scheduledFor?: string;
    joinedAt?: string;
    leftAt?: string;
    providerStatusCode?: string;
    lastStatusAt?: string;
    lastError?: string;
    joinDeadlineAt?: string;
    readyAt?: string;
    outputLastSeenAt?: string;
    outputVoiceReady?: boolean;
    outputSpeechCommandId?: string;
    outputSpeechState?: "speaking" | "completed" | "error";
    outputSpeechUpdatedAt?: string;
    stopRequestedAt?: string;
    failureCode?: string;
    entryAttemptId?: string;
    captionLanguage?: "it-it" | "en-us";
    captionLanguageAttempts?: number;
    captionLanguageRequestedAt?: string;
    diagnosticLogsRequestedAt?: string;
  };
  voice: MeetingVoiceConfiguration;
  retention: MeetingRetentionConfiguration;
  participants: string[];
  transcript: Array<Omit<MeetingTranscriptSegment, "createdAt"> & { createdAt: string }>;
  summary: {
    overview: string;
    rememberedFacts: string[];
    decisions: string[];
    actionItems: Array<Omit<MeetingActionItem, "dueAt"> & { dueAt?: string }>;
    openQuestions: string[];
    participantNotes: MeetingParticipantNote[];
    generatedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSeriesRecord {
  context?: string;
  contextVersion?: number;
  title: string;
  objective: string;
  timezone: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  agenda: MeetingAgendaInput[];
  assistant: MeetingAssistantConfiguration;
  voice: MeetingVoiceConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingSeriesResponse {
  context?: string;
  contextVersion?: number;
  id: string;
  title: string;
  objective: string;
  timezone: string;
  language: MeetingLanguage;
  autoJoin: boolean;
  agenda: MeetingAgendaInput[];
  assistant: MeetingAssistantConfiguration;
  voice: MeetingVoiceConfiguration;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingContinuityBriefing {
  seriesId?: string;
  seriesKey: string;
  previousMeetingIds: string[];
  lastMeetingAt?: string;
  overview?: string;
  rememberedFacts: string[];
  decisions: string[];
  actionItems: Array<Omit<MeetingActionItem, "dueAt"> & { dueAt?: string }>;
  openQuestions: string[];
  participantNotes: MeetingParticipantNote[];
}

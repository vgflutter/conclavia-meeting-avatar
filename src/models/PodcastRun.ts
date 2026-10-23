// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import {
  type HydratedDocument,
  type Model,
  Schema,
  Types,
  model,
  models,
} from "mongoose";

import { LLM_MODEL_IDS, type LlmModelId, type LlmProvider } from "@/lib/podcast/llm-models";
import { MAX_PERFORMANCE_SENTENCES, MAX_PERFORMANCE_SENTENCE_LENGTH, MAX_PERFORMANCE_TEXT_LENGTH, PODCAST_MOODS } from "@/lib/podcast/performance";
import type { TalkRunAudienceCue } from "@/types/podcast-audience";
import type { TalkResponse } from "@/types/podcast";
import type {
  TalkRunDiscussionState,
  TalkRunIntent,
  TalkRunPerformance,
  TalkRunPhase,
  TalkRunPreparationMode,
  TalkRunReferenceStyle,
  TalkRunSpeakerType,
  TalkRunStatus,
  TalkRunTurnPlan,
} from "@/types/podcast-run";

export interface TalkRunMessageRecord {
  sequence: number;
  speakerType: TalkRunSpeakerType;
  participantIndex?: number;
  speakerName: string;
  speakerRole?: string;
  intent: TalkRunIntent;
  targetParticipantIndex?: number;
  targetSpeakerName?: string;
  threadLabel: string;
  arcPhase: TalkRunTurnPlan["arcPhase"];
  preparationMode: TalkRunPreparationMode;
  referenceStyle: TalkRunReferenceStyle;
  wordCount: number;
  estimatedAirtimeSeconds: number;
  origin: "ai" | "human";
  provider?: LlmProvider;
  model?: LlmModelId;
  content: string;
  performance?: TalkRunPerformance;
  inputTokens?: number;
  outputTokens?: number;
  audienceCue?: TalkRunAudienceCue;
  createdAt: Date;
}

export interface TalkRunRecord {
  talkId: Types.ObjectId;
  status: TalkRunStatus;
  phase: TalkRunPhase;
  participantTurnCount: number;
  maxTurns: number;
  targetDurationMinutes: number;
  estimatedAirtimeSeconds: number;
  nextParticipantIndex: number;
  activeTurn?: TalkRunTurnPlan;
  audienceCue?: TalkRunAudienceCue;
  preparedTurn?: TalkRunPreparedTurnRecord;
  discussionState: TalkRunDiscussionState;
  talkSnapshot?: TalkResponse;
  messages: TalkRunMessageRecord[];
  error?: string;
  generationStartedAt?: Date;
  generationToken?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TalkRunPreparedTurnRecord {
  basedOnSequence: number;
  plan: TalkRunTurnPlan;
  provider: LlmProvider;
  model: LlmModelId;
  content: string;
  performance?: TalkRunPerformance;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: Date;
}

const audienceCueSchema = new Schema<TalkRunAudienceCue>(
  {
    provider: { type: String, enum: ["youtube"], required: true },
    messageId: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    authorImageUrl: { type: String, trim: true },
    content: { type: String, required: true, trim: true, maxlength: 1_000 },
    mode: {
      type: String,
      enum: ["host", "participant", "prompt"],
      required: true,
    },
    targetParticipantIndex: {
      type: Number,
      min: 0,
      max: 4,
      validate: Number.isInteger,
    },
  },
  { _id: false },
);

const performanceSentenceSchema = new Schema({
  text: { type: String, required: true, trim: true, maxlength: MAX_PERFORMANCE_SENTENCE_LENGTH },
  mood: { type: String, required: true, enum: PODCAST_MOODS },
  intensity: { type: Number, required: true, min: 0, max: 1, validate: Number.isFinite },
  listenerMood: { type: String, required: true, enum: PODCAST_MOODS },
  listenerIntensity: { type: Number, required: true, min: 0, max: 1, validate: Number.isFinite },
}, { _id: false });

const performanceSchema = new Schema<TalkRunPerformance>({
  version: { type: Number, enum: [1], required: true },
  source: { type: String, enum: ["ai", "legacy"], required: true },
  sentences: {
    type: [performanceSentenceSchema], required: true,
    validate: (sentences: Array<{ text?: string }>) => sentences.length > 0 &&
      sentences.length <= MAX_PERFORMANCE_SENTENCES &&
      sentences.map((sentence) => sentence.text ?? "").join(" ").length <= MAX_PERFORMANCE_TEXT_LENGTH,
  },
}, { _id: false });

const messageSchema = new Schema<TalkRunMessageRecord>(
  {
    sequence: { type: Number, required: true, min: 1, validate: Number.isInteger },
    speakerType: {
      type: String,
      enum: ["participant", "moderator"],
      required: true,
    },
    participantIndex: { type: Number, min: 0, max: 4, validate: Number.isInteger },
    speakerName: { type: String, required: true, trim: true },
    speakerRole: { type: String, trim: true },
    intent: {
      type: String,
      enum: [
        "opening",
        "argument",
        "reply",
        "challenge",
        "question",
        "answer",
        "clarification",
        "partial_agreement",
        "interruption",
        "moderation",
        "closing",
      ],
      required: true,
      default: "argument",
    },
    targetParticipantIndex: {
      type: Number,
      min: 0,
      max: 4,
      validate: Number.isInteger,
    },
    targetSpeakerName: { type: String, trim: true },
    threadLabel: { type: String, required: true, default: "", trim: true },
    arcPhase: {
      type: String,
      enum: ["positions", "conflict", "examination", "synthesis", "conclusion"],
      required: true,
      default: "positions",
    },
    preparationMode: {
      type: String,
      enum: ["reactive", "prepared"],
      required: true,
      default: "reactive",
    },
    referenceStyle: {
      type: String,
      enum: ["direct_name", "idea_first", "implicit", "echo_phrase"],
      required: true,
      default: "idea_first",
    },
    wordCount: { type: Number, required: true, default: 0, min: 0 },
    estimatedAirtimeSeconds: { type: Number, required: true, default: 0, min: 0 },
    origin: {
      type: String,
      enum: ["ai", "human"],
      required: true,
      default: "ai",
    },
    provider: { type: String, enum: ["openai", "claude", "gemini"] },
    model: { type: String, enum: LLM_MODEL_IDS },
    content: { type: String, required: true, trim: true },
    performance: { type: performanceSchema },
    inputTokens: { type: Number, min: 0, validate: Number.isInteger },
    outputTokens: { type: Number, min: 0, validate: Number.isInteger },
    audienceCue: { type: audienceCueSchema },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const activeTurnSchema = new Schema<TalkRunTurnPlan>(
  {
    speakerType: {
      type: String,
      enum: ["participant", "moderator"],
      required: true,
    },
    participantIndex: { type: Number, min: 0, max: 4, validate: Number.isInteger },
    speakerName: { type: String, required: true, trim: true },
    speakerRole: { type: String, trim: true },
    intent: {
      type: String,
      enum: [
        "opening",
        "argument",
        "reply",
        "challenge",
        "question",
        "answer",
        "clarification",
        "partial_agreement",
        "interruption",
        "moderation",
        "closing",
      ],
      required: true,
    },
    targetParticipantIndex: { type: Number, min: 0, max: 4, validate: Number.isInteger },
    targetSpeakerName: { type: String, trim: true },
    threadLabel: { type: String, required: true, trim: true },
    arcPhase: {
      type: String,
      enum: ["positions", "conflict", "examination", "synthesis", "conclusion"],
      required: true,
      default: "positions",
    },
    preparationMode: {
      type: String,
      enum: ["reactive", "prepared"],
      required: true,
      default: "reactive",
    },
    referenceStyle: {
      type: String,
      enum: ["direct_name", "idea_first", "implicit", "echo_phrase"],
      required: true,
      default: "idea_first",
    },
    minWords: { type: Number, required: true, min: 1, validate: Number.isInteger },
    maxWords: { type: Number, required: true, min: 1, validate: Number.isInteger },
    audienceCue: { type: audienceCueSchema },
  },
  { _id: false },
);

const participantMemorySchema = new Schema(
  {
    participantIndex: { type: Number, required: true, min: 0, max: 4 },
    statements: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const corePositionSchema = new Schema(
  {
    participantIndex: { type: Number, required: true, min: 0, max: 4 },
    summary: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const turningPointSchema = new Schema(
  {
    participantIndex: { type: Number, required: true, min: 0, max: 4 },
    summary: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const floorRequestSchema = new Schema(
  {
    participantIndex: { type: Number, required: true, min: 0, max: 4 },
    targetParticipantIndex: { type: Number, min: 0, max: 4 },
    intent: {
      type: String,
      enum: [
        "argument",
        "reply",
        "challenge",
        "question",
        "answer",
        "clarification",
        "partial_agreement",
        "interruption",
      ],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    threadLabel: { type: String, required: true, trim: true },
    priority: { type: Number, required: true, min: 0, max: 100 },
    expiresAfterSequence: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const conclusionSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["agreement", "conditional_agreement", "clarified_disagreement", "open"],
      required: true,
    },
    answer: { type: String, required: true, trim: true },
    agreements: { type: [String], required: true, default: [] },
    disagreements: { type: [String], required: true, default: [] },
    conditions: { type: [String], required: true, default: [] },
    openQuestions: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const preparedTurnSchema = new Schema<TalkRunPreparedTurnRecord>(
  {
    basedOnSequence: { type: Number, required: true, min: 0, validate: Number.isInteger },
    plan: { type: activeTurnSchema, required: true },
    provider: { type: String, enum: ["openai", "claude", "gemini"], required: true },
    model: { type: String, enum: LLM_MODEL_IDS, required: true },
    content: { type: String, required: true, trim: true },
    performance: { type: performanceSchema },
    inputTokens: { type: Number, min: 0, validate: Number.isInteger },
    outputTokens: { type: Number, min: 0, validate: Number.isInteger },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const discussionStateSchema = new Schema<TalkRunDiscussionState>(
  {
    arcPhase: {
      type: String,
      enum: ["positions", "conflict", "examination", "synthesis", "conclusion"],
      required: true,
      default: "positions",
    },
    centralQuestion: { type: String, required: true, default: "", trim: true },
    phaseObjective: { type: String, required: true, default: "", trim: true },
    currentFocus: { type: String, required: true, default: "", trim: true },
    corePositions: { type: [corePositionSchema], required: true, default: [] },
    keyConflict: { type: String, default: "", trim: true },
    contestedClaims: { type: [String], required: true, default: [] },
    evidenceAndTradeoffs: { type: [String], required: true, default: [] },
    openQuestions: { type: [String], required: true, default: [] },
    agreements: { type: [String], required: true, default: [] },
    unresolvedConflicts: { type: [String], required: true, default: [] },
    turningPoints: { type: [turningPointSchema], required: true, default: [] },
    floorQueue: { type: [floorRequestSchema], required: true, default: [] },
    conclusionReadiness: {
      type: String,
      enum: ["not_ready", "developing", "ready", "forced"],
      required: true,
      default: "not_ready",
    },
    conclusionReason: { type: String, default: "", trim: true },
    conclusion: { type: conclusionSchema },
    editorialReviewCount: { type: Number, required: true, default: 0, min: 0 },
    editorialInputTokens: { type: Number, required: true, default: 0, min: 0 },
    editorialOutputTokens: { type: Number, required: true, default: 0, min: 0 },
    participantMemories: {
      type: [participantMemorySchema],
      required: true,
      default: [],
    },
  },
  { _id: false },
);

const talkRunSchema = new Schema<TalkRunRecord>(
  {
    talkId: {
      type: Schema.Types.ObjectId,
      ref: "PodcastTalk",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["idle", "generating", "waiting_for_human", "completed", "failed"],
      required: true,
      default: "idle",
      index: true,
    },
    phase: {
      type: String,
      enum: ["opening", "discussion", "closing", "completed"],
      required: true,
    },
    participantTurnCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    maxTurns: { type: Number, required: true, min: 1, validate: Number.isInteger },
    targetDurationMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      validate: Number.isInteger,
    },
    estimatedAirtimeSeconds: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    nextParticipantIndex: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 4,
      validate: Number.isInteger,
    },
    activeTurn: { type: activeTurnSchema },
    audienceCue: { type: audienceCueSchema },
    preparedTurn: { type: preparedTurnSchema },
    discussionState: {
      type: discussionStateSchema,
      required: true,
      default: () => ({}),
    },
    talkSnapshot: { type: Schema.Types.Mixed },
    messages: { type: [messageSchema], required: true, default: [] },
    error: { type: String, trim: true },
    generationStartedAt: { type: Date },
    generationToken: { type: String },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

talkRunSchema.index({ talkId: 1, createdAt: -1 });
// Concurrent Start actions must resolve to one active episode, even across workers.
talkRunSchema.index({ talkId: 1 }, {
  unique: true,
  name: "podcast_one_active_run",
  partialFilterExpression: { status: { $in: ["idle", "generating", "waiting_for_human"] } },
});

export const TalkRunModel =
  (models.PodcastRun as Model<TalkRunRecord> | undefined) ??
  model<TalkRunRecord>("PodcastRun", talkRunSchema, "podcast_runs");

export type TalkRunDocument = HydratedDocument<TalkRunRecord>;

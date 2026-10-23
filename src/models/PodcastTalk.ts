// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import {
  type HydratedDocument,
  type Model,
  Schema,
  model,
  models,
} from "mongoose";

import type {
  ModeratorConfiguration,
  Participant,
  TalkRecord,
} from "@/types/podcast";
import { DEFAULT_LLM_MODEL, LLM_MODEL_IDS } from "@/lib/podcast/llm-models";
import { DEFAULT_STUDIO_LAYOUT, STUDIO_LAYOUT_IDS } from "@/lib/podcast/talk-run-compatibility";
import {
  DEFAULT_STUDIO_THEME,
  STUDIO_THEME_IDS, STUDIO_CAST_IDS, STUDIO_GUEST_MODES,
} from "@/lib/podcast/studio-themes";

const scoreField = {
  type: Number,
  required: true,
  min: 0,
  max: 100,
  validate: Number.isInteger,
};

const participantSchema = new Schema<Participant>(
  {
    kind: {
      type: String,
      enum: ["ai", "human", "unassigned"],
      required: true,
      default: "ai",
    },
    sex: {
      type: String,
      enum: ["female", "male"],
      required: true,
    },
    name: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    perspectiveMode: {
      type: String,
      enum: ["custom", "automatic", "random"],
      required: true,
      default: "custom",
    },
    perspectivePrompt: { type: String, default: "", trim: true },
    personalityPrompt: { type: String, trim: true, maxlength: 2000 },
    goals: { type: String, trim: true },
    nonNegotiables: { type: String, trim: true },
    speakingStylePrompt: { type: String, trim: true },
    modelOverride: { type: String, enum: LLM_MODEL_IDS, trim: true },
    voiceId: { type: String, trim: true },
    voiceDelivery: {
      type: String,
      enum: ["natural", "energetic", "authoritative"],
      default: "natural",
    },
    assertiveness: scoreField,
    patience: scoreField,
    interruptiveness: scoreField,
    baselineTension: scoreField,
  },
  { _id: false },
);

const moderatorSchema = new Schema<ModeratorConfiguration>(
  {
    kind: {
      type: String,
      enum: ["none", "ai", "human"],
      required: true,
      default: "none",
    },
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    instructions: { type: String, trim: true },
    style: {
      type: String,
      enum: ["neutral", "challenging", "facilitating"],
      required: true,
      default: "neutral",
    },
    modelOverride: { type: String, enum: LLM_MODEL_IDS, trim: true },
    voiceId: { type: String, trim: true },
    voiceDelivery: {
      type: String,
      enum: ["natural", "energetic", "authoritative"],
      default: "natural",
    },
    canInterrupt: { type: Boolean, required: true, default: true },
    manageTime: { type: Boolean, required: true, default: true },
    summarizeAtEnd: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const talkSchema = new Schema<TalkRecord>(
  {
    title: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true, maxlength: 2000 },
    centralQuestion: { type: String, trim: true, maxlength: 2000 },
    editorialInstructions: { type: String, trim: true, maxlength: 8000 },
    description: { type: String, trim: true },
    language: { type: String, required: true, trim: true },
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: (participants: Participant[]) => participants.length >= 2 && participants.length <= 5,
        message: "A podcast must have between two and five participants",
      },
    },
    moderator: {
      type: moderatorSchema,
      required: true,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["draft", "ready"],
      required: true,
    },
    settings: {
      videoTopicMode: { type: String, enum: ["episode", "conversation", "custom", "hidden"], default: "episode" },
      videoTopicText: { type: String, trim: true, maxlength: 80, default: "" },
      voiceProvider: { type: String, enum: ["inworld", "kokoro"], default: "inworld" },
      maxTurns: { type: Number, required: true, min: 1, validate: Number.isInteger },
      targetDurationMinutes: {
        type: Number,
        required: true,
        default: 30,
        min: 1,
        validate: Number.isInteger,
      },
      videoMode: {
        type: String,
        enum: ["cartoon"],
        required: true,
        default: "cartoon",
      },
      studioTheme: {
        type: String,
        enum: STUDIO_THEME_IDS,
        required: true,
        default: DEFAULT_STUDIO_THEME,
      },
      studioCast: { type: String, enum: STUDIO_CAST_IDS, required: true, default: "original" },
      studioGuest: { type: String, enum: STUDIO_GUEST_MODES, required: true, default: "auto" },
      studioLayout: {
        type: String,
        enum: STUDIO_LAYOUT_IDS,
        required: true,
        default: DEFAULT_STUDIO_LAYOUT,
      },
      defaultModel: {
        type: String,
        enum: LLM_MODEL_IDS,
        required: true,
        default: DEFAULT_LLM_MODEL,
        trim: true,
      },
      allowInterruptions: { type: Boolean, required: true },
      pace: {
        type: String,
        enum: ["fast", "balanced", "deep"],
        required: true,
        default: "balanced",
      },
    },
  },
  { timestamps: true },
);

export const TalkModel =
  (models.PodcastTalk as Model<TalkRecord> | undefined) ??
  model<TalkRecord>("PodcastTalk", talkSchema, "podcast_talks");

export type TalkDocument = HydratedDocument<TalkRecord>;

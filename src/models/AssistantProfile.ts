import { deleteModel, type HydratedDocument, type Model, Schema, model, models } from "mongoose";

import type { AssistantProfileRecord } from "@/types/assistant-profile";

const assistantProfileSchema = new Schema<AssistantProfileRecord>(
  {
    key: { type: String, enum: ["default"], required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    appearance: { type: String, enum: ["business_clay", "business_clay_female"], required: true },
    personality: {
      responseStyle: {
        type: String,
        enum: ["concise", "balanced", "detailed"],
        required: true,
        default: "balanced",
      },
      attitude: {
        type: String,
        enum: ["discreet", "collaborative", "proactive"],
        required: true,
        default: "collaborative",
      },
    },
    voice: {
      inworldVoiceIdIt: { type: String, trim: true, maxlength: 160 },
      inworldVoiceIdEn: { type: String, trim: true, maxlength: 160 },
      provider: { type: String, enum: ["inworld", "local"], required: true },
      model: { type: String, enum: ["inworld-tts-2", "inworld-tts-2-flash", "supertonic_3"], required: true },
      style: {
        type: String,
        enum: ["executive_warm", "executive_clear"],
        required: true,
      },
      speakingRate: { type: Number, min: 0.8, max: 1.1, required: true },
      pronunciationProfile: { type: String, required: true, trim: true, maxlength: 120 },
    },
  },
  { timestamps: true },
);

// Legacy metadata remains readable; it never selects a playback engine.
// HMR must not silently discard new settings through an old cached schema.
if (models.AssistantProfile && (!models.AssistantProfile.schema.path("appearance").options.enum.includes("business_clay_female") || !models.AssistantProfile.schema.path("voice.inworldVoiceIdIt") ||
  !models.AssistantProfile.schema.path("voice.inworldVoiceIdEn") ||
  !models.AssistantProfile.schema.path("voice.provider").options.enum.includes("inworld"))) deleteModel("AssistantProfile");

export const AssistantProfileModel =
  (models.AssistantProfile as Model<AssistantProfileRecord> | undefined) ??
  model<AssistantProfileRecord>("AssistantProfile", assistantProfileSchema);

export type AssistantProfileDocument = HydratedDocument<AssistantProfileRecord>;

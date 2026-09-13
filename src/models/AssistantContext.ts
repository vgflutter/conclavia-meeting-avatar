import { type Model, Schema, model, models } from "mongoose";
import { CONTEXT_MAX_LENGTH } from "@/lib/assistant-context";

interface AssistantContextRecord {
  key: "default";
  context: string;
  contextVersion: number;
}

const schema = new Schema<AssistantContextRecord>({
  key: { type: String, required: true, unique: true, enum: ["default"] },
  context: { type: String, default: "", maxlength: CONTEXT_MAX_LENGTH },
  contextVersion: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export const AssistantContextModel =
  (models.AssistantContext as Model<AssistantContextRecord> | undefined) ??
  model<AssistantContextRecord>("AssistantContext", schema);

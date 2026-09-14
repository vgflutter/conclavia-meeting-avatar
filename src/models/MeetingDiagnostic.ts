import { model, models, Schema, type Model, type Types } from "mongoose";

export interface DiagnosticEntry {
  key: string;
  level: "debug" | "info" | "warning" | "error";
  type: string;
  message: string;
  occurredAt: Date;
  receivedAt: Date;
}

interface MeetingDiagnosticRecord {
  _id: string;
  meetingId: Types.ObjectId;
  attemptId: string;
  botId: string;
  expiresAt: Date;
  entries: DiagnosticEntry[];
}

const entrySchema = new Schema<DiagnosticEntry>({
  key: { type: String, required: true, maxlength: 64 },
  level: { type: String, enum: ["debug", "info", "warning", "error"], required: true },
  type: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 2048 },
  occurredAt: { type: Date, required: true },
  receivedAt: { type: Date, required: true },
}, { _id: false });

const schema = new Schema<MeetingDiagnosticRecord>({
  _id: { type: String },
  meetingId: { type: Schema.Types.ObjectId, required: true },
  attemptId: { type: String, required: true },
  botId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  entries: { type: [entrySchema], default: [] },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ meetingId: 1, attemptId: 1 });

export const MeetingDiagnosticModel = (models.MeetingDiagnostic as Model<MeetingDiagnosticRecord> | undefined)
  || model<MeetingDiagnosticRecord>("MeetingDiagnostic", schema);

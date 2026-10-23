import { Schema, model, models, type Model } from 'mongoose';
import type { TgJob } from '@/lib/tg/types';
export interface TgRunRecord extends Omit<TgJob, 'id' | 'createdAt' | 'updatedAt'> { createdAt: Date; updatedAt: Date; leaseOwner?: string; leaseUntil?: Date; approvedAt?: string; mediaCapability?: string; publicationOwner?: string; publicationLeaseUntil?: Date }
const schema = new Schema<TgRunRecord>({
  edition: { type: String, required: true, enum: ['it', 'world'] }, date: { type: String, required: true },
  state: { type: String, required: true, default: 'queued' }, product: { type: Schema.Types.Mixed, required: true },
  research: Schema.Types.Mixed, script: Schema.Types.Mixed, audit: Schema.Types.Mixed, manifest: Schema.Types.Mixed,
  scriptReview:Schema.Types.Mixed,editorialRepairs:{type:Number,default:0},durationRepairs:{type:Number,default:0},
  assets: { type: Schema.Types.Mixed, default: [] }, issues: { type: [String], default: [] }, events: { type: Schema.Types.Mixed, default: [] },
  deliveries: { type: Schema.Types.Mixed, default: [] }, attempts: { type: Number, default: 0 }, approvedAt: String, publishedAt: String,
  leaseOwner: String, leaseUntil: Date, mediaCapability: { type: String, select: false },
  nextProductionAttemptAt: String,
  revision: { type: Number, default: 0 }, publicationPlan: Schema.Types.Mixed, review: Schema.Types.Mixed, finalReview: Schema.Types.Mixed,
  publicationOwner: { type: String, select: false }, publicationLeaseUntil: { type: Date, select: false },
}, { timestamps: true });
schema.index({ edition: 1, date: 1 }, { unique: true });
schema.index({ state: 1, leaseUntil: 1 });
export const TgRunModel = (models.TgRun as Model<TgRunRecord> | undefined) ?? model<TgRunRecord>('TgRun', schema, 'tg_runs');

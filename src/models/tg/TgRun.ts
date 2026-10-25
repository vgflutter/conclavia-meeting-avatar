import { Schema, model, models, type Model } from 'mongoose';
import type { TgJob } from '@/lib/tg/types';
export interface TgRunRecord extends Omit<TgJob, 'id' | 'createdAt' | 'updatedAt'> { createdAt: Date; updatedAt: Date; leaseOwner?: string; leaseUntil?: Date; approvedAt?: string; mediaCapability?: string; publicationOwner?: string; publicationLeaseUntil?: Date; commissioning?:{kind:'first-mac-cycle';id:string;at:string;reason:string;snapshotSha256:string;previous:TgJob} }
const schema = new Schema<TgRunRecord>({
  edition: { type: String, required: true, enum: ['it', 'world'] }, date: { type: String, required: true },
  state: { type: String, required: true, default: 'queued' }, product: { type: Schema.Types.Mixed, required: true },
  coverageRecovery: Schema.Types.Mixed,coverageRecoveryHistory:Schema.Types.Mixed,
  research: Schema.Types.Mixed, script: Schema.Types.Mixed, audit: Schema.Types.Mixed, manifest: Schema.Types.Mixed,
  scriptReview:Schema.Types.Mixed,editorialRepairs:{type:Number,default:0},durationRepairs:{type:Number,default:0},
  assets: { type: Schema.Types.Mixed, default: [] }, issues: { type: [String], default: [] }, events: { type: Schema.Types.Mixed, default: [] },
  deliveries: { type: Schema.Types.Mixed, default: [] }, attempts: { type: Number, default: 0 }, approvedAt: String, publishedAt: String,
  leaseOwner: String, leaseUntil: Date, mediaCapability: { type: String, select: false },
  nextProductionAttemptAt: String,
  revision: { type: Number, default: 0 }, publicationPlan: Schema.Types.Mixed, review: Schema.Types.Mixed, finalReview: Schema.Types.Mixed,
  sitePublication: Schema.Types.Mixed,
  textApproval: Schema.Types.Mixed,
  commissioning: {type:Schema.Types.Mixed,select:false},
  publicationOwner: { type: String, select: false }, publicationLeaseUntil: { type: Date, select: false },
}, { timestamps: true });
schema.index({ edition: 1, date: 1 }, { unique: true });
schema.index({ state: 1, leaseUntil: 1 });
const existing=models.TgRun as Model<TgRunRecord>|undefined;
// The private Next dev GUI may already hold the legacy model. Add only these
// owned fields so updates are not silently stripped during hot reload.
if(existing)for(const name of ['coverageRecovery','coverageRecoveryHistory']){
  if(!existing.schema.path(name))existing.schema.add({[name]:Schema.Types.Mixed});
}
export const TgRunModel = existing ?? model<TgRunRecord>('TgRun', schema, 'tg_runs');

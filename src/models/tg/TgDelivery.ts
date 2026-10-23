import { Schema, model, models, type Model } from 'mongoose';
interface Delivery { jobId: string; platform: string; state: string; remoteId?: string; remoteSession?: string; url?: string; issue?: string; updatedAt: Date; attempts: number; nextAttemptAt?: Date }
const schema = new Schema<Delivery>({ jobId: { type: String, required: true }, platform: { type: String, required: true }, state: { type: String, required: true }, remoteId: String, remoteSession: { type: String, select: false }, url: String, issue: String, updatedAt: { type: Date, default: Date.now }, attempts: {type:Number,default:0}, nextAttemptAt: Date });
schema.index({ jobId: 1, platform: 1 }, { unique: true });
export const TgDeliveryModel = (models.TgDelivery as Model<Delivery> | undefined) ?? model<Delivery>('TgDelivery', schema, 'tg_deliveries');

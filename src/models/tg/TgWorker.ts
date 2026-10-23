import { Schema, model, models, type Model } from 'mongoose';
interface Worker { name: string; heartbeatAt: Date; phase?: 'idle' | 'producing' | 'degraded'; jobId?: string; lastErrorAt?: Date }
const schema = new Schema<Worker>({ name: {type:String,required:true,unique:true}, heartbeatAt: {type:Date,required:true,index:{expires:86400}}, phase: String, jobId: String, lastErrorAt: Date });
export const TgWorkerModel = (models.TgWorker as Model<Worker>|undefined) ?? model<Worker>('TgWorker',schema,'tg_workers');

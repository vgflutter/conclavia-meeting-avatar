import { Schema, model, models, type Model } from 'mongoose';
import type { TgProduct } from '@/lib/tg/types';
interface Configuration { edition: string; product: TgProduct; revision: number; updatedAt: Date }
const schema = new Schema<Configuration>({ edition: { type: String, required: true, unique: true, enum: ['it', 'world'] }, product: { type: Schema.Types.Mixed, required: true }, revision: { type: Number, default: 1 }, updatedAt: { type: Date, default: Date.now } });
export const TgEditionModel = (models.TgEdition as Model<Configuration> | undefined) ?? model<Configuration>('TgEdition', schema, 'tg_editions');

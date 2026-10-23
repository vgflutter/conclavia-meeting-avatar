import { Schema, model, models, type Model } from 'mongoose';
interface PublicationControl { key: string; paused: boolean; revision: number; updatedAt: Date }
const schema = new Schema<PublicationControl>({
  key: { type: String, required: true, unique: true }, paused: { type: Boolean, default: true },
  revision: { type: Number, default: 0 }, updatedAt: { type: Date, default: Date.now },
});
export const TgPublicationControlModel = (models.TgPublicationControl as Model<PublicationControl> | undefined)
  ?? model<PublicationControl>('TgPublicationControl', schema, 'tg_publication_control');

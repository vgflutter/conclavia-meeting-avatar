import { Schema, model, models, type Model } from 'mongoose';
interface ChannelCheck {edition:string;platform:string;destination:string;ok:boolean;label:string;checkedAt:Date}
const schema=new Schema<ChannelCheck>({edition:String,platform:String,destination:String,ok:Boolean,label:String,checkedAt:Date});
schema.index({edition:1,platform:1},{unique:true});
export const TgChannelCheckModel=(models.TgChannelCheck as Model<ChannelCheck>|undefined)??model<ChannelCheck>('TgChannelCheck',schema,'tg_channel_checks');

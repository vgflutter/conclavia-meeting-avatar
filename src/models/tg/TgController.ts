import {Schema,model,models,type Model} from 'mongoose';
interface TgControllerRecord {
  key:string; heartbeatAt:Date; mode:'editorial'|'full'; driver:'launchd'|'systemd';
  lastDate?:string; lastState?:string; lastFinishedAt?:Date;
}
const schema=new Schema<TgControllerRecord>({
  key:{type:String,required:true,unique:true},heartbeatAt:{type:Date,required:true},
  mode:{type:String,enum:['editorial','full'],required:true},driver:{type:String,enum:['launchd','systemd'],required:true},
  lastDate:String,lastState:String,lastFinishedAt:Date,
});
export const TgControllerModel=(models.TgController as Model<TgControllerRecord>|undefined)??model<TgControllerRecord>('TgController',schema,'tg_controllers');

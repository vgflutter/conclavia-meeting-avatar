/** Local-only re-render of existing pilots. Keeps voices, script and evidence. */
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,copyFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgDeliveryModel} from '../../src/models/tg/TgDelivery';
import {artifactRoot,jobDirectory} from '../../src/lib/tg/artifacts';
import {renderMedia} from '../../src/lib/tg/media';
import {preserveSpeechIntermediates} from './studio-cache';

async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false'||process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw Error('Requires explicit confirmation, isolated local Mongo and publication disabled');
 const ids=process.argv.filter(a=>a.startsWith('--id=')).map(a=>a.slice(5));if(!ids.length||ids.some(id=>!/^[a-f0-9]{24}$/u.test(id)))throw Error('Explicit pilot IDs required');
 await connectToDatabase();
 for(const id of ids){
  const job=await TgRunModel.findById(id).lean();if(!job?.manifest||job.state!=='needs_review'||job.approvedAt||job.review?.decision==='approved'||await TgDeliveryModel.exists({jobId:id}))throw Error('Only unapproved pilots without deliveries can be refreshed');
  const owner='studio-refresh-'+randomUUID(),revision=job.revision??0;
  const claimed=await TgRunModel.findOneAndUpdate({_id:id,revision:job.revision===undefined?{$exists:false}:revision,state:'needs_review',approvedAt:{$exists:false}},{$set:{state:'rendering',leaseOwner:owner,leaseUntil:new Date(Date.now()+120000)},$inc:{revision:1}});
  if(!claimed)throw Error('Pilot changed before refresh');
  const stageId=randomBytes(12).toString('hex'),stage=jobDirectory(stageId),original=jobDirectory(id);
  const backup=path.join(artifactRoot(),'.studio-backups',new Date().toISOString().replace(/[:.]/gu,'-'),id);
  let swapped=false,archived=false;
  const renew=setInterval(()=>{void TgRunModel.updateOne({_id:id,leaseOwner:owner},{$set:{leaseUntil:new Date(Date.now()+120000)}}).catch(()=>undefined)},30000);
  try{
   await mkdir(stage,{recursive:true,mode:0o700});await copyFile(path.join(original,'track.wav'),path.join(stage,'track.wav'));
   await preserveSpeechIntermediates(original,stage);
   console.log(JSON.stringify({event:'studio_render_started',edition:job.edition,seconds:job.manifest.seconds}));
   const assets=await renderMedia(stageId,job.manifest,new AbortController().signal);
   await mkdir(path.dirname(backup),{recursive:true,mode:0o700});await rename(original,backup);archived=true;await rename(stage,original);swapped=true;
   const updated=await TgRunModel.findOneAndUpdate({_id:id,leaseOwner:owner,state:'rendering',revision:revision+1},{$set:{state:'needs_review',assets},$unset:{leaseOwner:1,leaseUntil:1,review:1,approvedAt:1,publicationPlan:1},$inc:{revision:1},$push:{events:{$each:[{at:new Date().toISOString(),stage:'needs_review',detail:'Studio Daily e robot 2D integrati nel renderer automatico. Audio, copione e fonti del pilota preservati; nuovi file da revisionare. Master precedenti archiviati.'}],$slice:-50}}});
   if(!updated)throw Error('Pilot changed during refresh');
   console.log(JSON.stringify({event:'studio_render_completed',edition:job.edition,state:'needs_review',assets:assets.map(a=>({name:a.name,bytes:a.bytes,duration:a.duration}))}));
  }catch(error){
   if(swapped)await rm(original,{recursive:true,force:true});if(archived)await rename(backup,original);await rm(stage,{recursive:true,force:true});
   await TgRunModel.updateOne({_id:id,leaseOwner:owner},{$set:{state:'needs_review'},$unset:{leaseOwner:1,leaseUntil:1},$inc:{revision:1}});throw error;
  }finally{clearInterval(renew);}
 }
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Pilot refresh failed');process.exitCode=1;}).finally(()=>mongoose.disconnect());

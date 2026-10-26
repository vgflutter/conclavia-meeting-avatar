import { loadPublishedHistory } from '../../src/lib/tg/history';
/** Explicit local commissioning: fresh news, two native voices, editorial gate. */
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgDeliveryModel} from '../../src/models/tg/TgDelivery';
import {artifactRoot,jobDirectory} from '../../src/lib/tg/artifacts';
import {serializeJob} from '../../src/lib/tg/store';
import {parseProduct,localEditionDate} from '../../src/lib/tg/config';
import {researchEdition,writeEdition,retrieveAuditEvidence,judgeEdition,reviewEditionScript} from '../../src/lib/tg/agents';
import {produceTg} from '../../src/lib/tg/pipeline';
import {synthesize,renderMedia} from '../../src/lib/tg/media';
import type {TgJob} from '../../src/lib/tg/types';

async function main(){
 if(!process.argv.includes('--confirm')||process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_')||process.env.TG_PUBLISH_ENABLED!=='false'||process.env.TG_AI_ENABLED!=='true'||process.env.PODCAST_AI_ENABLED!=='true'||process.env.PODCAST_SPEECH_ENABLED!=='true')throw Error('Explicit local trial, AI/voice flags and publication disabled required');
 const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5),resume=process.argv.find(a=>a.startsWith('--resume='))?.slice(9),seconds=Number(process.argv.find(a=>a.startsWith('--seconds='))?.slice(10)??90);
 if(![90,180].includes(seconds))throw Error('Explicit supported trial duration required');
 if(!id||!/^[a-f0-9]{24}$/u.test(id)||resume&&!/^[a-f0-9]{24}$/u.test(resume))throw Error('Explicit valid Italian pilot ID required');
 await connectToDatabase();
 const original=await TgRunModel.findById(id).lean();
 if(!original||original.edition!=='it'||original.state!=='needs_review'||original.approvedAt||original.review?.decision==='approved'||await TgDeliveryModel.exists({jobId:id}))throw Error('Only an unapproved Italian local pilot without deliveries can be replaced');
 const now=new Date(),product=parseProduct({...original.product,name:'Conclavia Daily · Italia',seconds,presenters:2,enabled:false,automatic:false});
 const stageId=resume??randomBytes(12).toString('hex'),stage=jobDirectory(stageId),owner='native-italian-trial-'+randomUUID(),revision=original.revision??0;
 let job:TgJob=resume?JSON.parse(await readFile(path.join(stage,'.trial-checkpoint.json'),'utf8')):{...serializeJob(original),id:stageId,date:localEditionDate(now,product.timezone),product,state:'queued',coverageRecovery:undefined,coverageRecoveryHistory:undefined,research:undefined,script:undefined,audit:undefined,manifest:undefined,assets:[],issues:[],events:[],deliveries:[],approvedAt:undefined,review:undefined,publicationPlan:undefined};
 if(job.product.edition!=='it'||job.product.seconds!==seconds||job.product.presenters!==2||job.date!==localEditionDate(now,product.timezone))throw Error('Trial checkpoint does not match today and the requested format');
 const claimed=await TgRunModel.updateOne({_id:id,revision,state:'needs_review',approvedAt:{$exists:false}},{$set:{state:'researching',leaseOwner:owner,leaseUntil:new Date(Date.now()+120000)},$inc:{revision:1}});
 if(claimed.matchedCount!==1)throw Error('Pilot changed before trial');
 await mkdir(stage,{recursive:true,mode:0o700});
 const backup=path.join(artifactRoot(),'.trial-backups',new Date().toISOString().replace(/[:.]/gu,'-'),id);
 const renew=setInterval(()=>void TgRunModel.updateOne({_id:id,leaseOwner:owner},{$set:{leaseUntil:new Date(Date.now()+120000)}}).catch(()=>undefined),30000);
 let swapped=false,archived=false;
 try{
  let evidence:{value:Awaited<ReturnType<typeof retrieveAuditEvidence>>;at:number}|undefined;
  const previous=await loadPublishedHistory('it',job.date,now);
  await produceTg(job,JSON.stringify(previous),{
   research:prior=>researchEdition(product,now,prior,AbortSignal.timeout(180000)),
   write:(r,correction)=>writeEdition(product,r,AbortSignal.timeout(180000),correction,job.date),
   audit:async(r,s)=>{evidence={value:await retrieveAuditEvidence(r,s,AbortSignal.timeout(180000),undefined,'verification'),at:Date.now()};return judgeEdition(product,r,s,evidence.value,AbortSignal.timeout(240000),previous);},
   reviewScript:async(r,s)=>reviewEditionScript(product,job.date,r,s,evidence?.value??await retrieveAuditEvidence(r,s,AbortSignal.timeout(180000),undefined,'verification'),AbortSignal.timeout(180000)),
   voice:(r,s)=>synthesize(stageId,product,job.date,r,s,AbortSignal.timeout(600000)),
   render:m=>renderMedia(stageId,m,AbortSignal.timeout(900000)),
   checkpoint:async(state,data,detail)=>{
    job={...job,...data,state,events:[...job.events,{at:new Date().toISOString(),stage:state,detail}].slice(-50)};
    await writeFile(path.join(stage,'.trial-checkpoint.json'),JSON.stringify(job),{mode:0o600});
    const updated=await TgRunModel.updateOne({_id:id,leaseOwner:owner},{$set:{state:state==='needs_review'?'rendering':state},$inc:{revision:1},$push:{events:{$each:[{at:new Date().toISOString(),stage:state,detail:'Prova italiana · '+detail}],$slice:-50}}});
    if(updated.matchedCount!==1)throw Error('Trial lease lost');
    console.log(JSON.stringify({event:'italian_trial',stage:state,stagingId:stageId,sentences:job.script?.sentences.length,words:job.script?.sentences.reduce((n,s)=>n+s.text.split(/\s+/u).length,0),auditPassed:job.audit?.passed,issues:job.issues}));
   }
  });
  if(job.state!=='needs_review'||!job.audit?.passed||!job.manifest?.speech||job.assets.length!==5)throw Error('Trial did not pass independent checks; checkpoint preserved');
  await mkdir(backup,{recursive:true,mode:0o700});await writeFile(path.join(backup,'previous-job.json'),JSON.stringify(original),{mode:0o600});
  await rename(jobDirectory(id),path.join(backup,'media'));archived=true;await rename(stage,jobDirectory(id));swapped=true;
  const set={date:job.date,product:job.product,research:job.research,script:job.script,audit:job.audit,scriptReview:job.scriptReview,editorialRepairs:job.editorialRepairs,durationRepairs:job.durationRepairs,manifest:job.manifest,assets:job.assets,issues:[],state:'needs_review'};
  const updated=await TgRunModel.updateOne({_id:id,leaseOwner:owner,approvedAt:{$exists:false}},{$set:set,$unset:{leaseOwner:1,leaseUntil:1,review:1,approvedAt:1,publicationPlan:1},$inc:{revision:1},$push:{events:{$each:[{at:new Date().toISOString(),stage:'needs_review',detail:`Nuova prova italiana di ${seconds} s: Gianni e Orietta, Inworld TTS-2. Notizie e copione verificati; master precedente archiviato. Revisione umana richiesta.`}],$slice:-50}}});
  if(updated.matchedCount!==1)throw Error('Pilot changed before final save');
  console.log(JSON.stringify({event:'italian_trial_ready',id,seconds:job.product.seconds,voices:job.manifest.speech.voices,state:'needs_review',backup:backup.slice(artifactRoot().length+1)}));
 }catch(error){
  if(swapped)await rename(jobDirectory(id),stage);if(archived)await rename(path.join(backup,'media'),jobDirectory(id));
  await TgRunModel.updateOne({_id:id,leaseOwner:owner},{$set:{state:'needs_review'},$unset:{leaseOwner:1,leaseUntil:1},$inc:{revision:1}});
  console.error(JSON.stringify({event:'italian_trial_incomplete',stagingId:stageId,state:job.state,issues:job.audit?.issues??job.issues}));throw error;
 }finally{clearInterval(renew);}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Italian trial failed');process.exitCode=1;}).finally(()=>mongoose.disconnect());

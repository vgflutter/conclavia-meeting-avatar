/** Always-on editorial commissioning. This entry has no voice, rendering or
 * publisher adapter imports and cannot produce or distribute media. */
import {readFile} from 'node:fs/promises';
import {parseAgentSchedule,agentDecision} from '../../src/lib/tg/agent-schedule';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgControllerModel} from '../../src/models/tg/TgController';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgEditionModel} from '../../src/models/tg/TgEdition';
import {parseProduct} from '../../src/lib/tg/config';
import {queueEdition,claimJob,checkpoint,renewLease,serializeJob} from '../../src/lib/tg/store';
import {produceTg} from '../../src/lib/tg/pipeline';
import {researchEdition,writeEdition,retrieveAuditEvidence,judgeEdition,reviewEditionScript} from '../../src/lib/tg/agents';
import {loadPublishedHistory} from '../../src/lib/tg/history';
import {saveEditionTexts} from '../../src/lib/tg/edition-text-files';
import {scriptReviewInputDigest} from '../../src/lib/tg/script-review';
import {TgEditorialError} from '../../src/lib/tg/editorial';
import mongoose from 'mongoose';

async function main(){
  const action=process.argv[2]??'status';
  if(!['status','tick','schedule'].includes(action))throw Error('Invalid action');
  const plan=parseAgentSchedule(JSON.parse(await readFile(process.env.TG_AGENT_PLAN_FILE||'config/tg/daily-agent.json','utf8')));
  if(plan.product.productionMode!=='editorial'||process.env.TG_EDITORIAL_ONLY!=='true'||process.env.TG_PUBLISH_ENABLED==='true')throw Error('Editorial ceiling required');
  await connectToDatabase();
  const stored=await TgEditionModel.findOne({edition:plan.product.edition}).lean();
  if(!stored)throw Error('Existing editorial database required');
  const product=parseProduct(stored.product);
  // Never overwrite frozen editions or silently turn a full-production plan
  // into an editorial job. Operators configure the product through its GUI.
  if(product.productionMode!=='editorial')throw Error('Product is not editorial');
  const now=new Date(),decision=agentDecision({...plan,product},now);
  if(action==='schedule'){
    const proposed=parseProduct({...product,productionTime:plan.product.productionTime,publishTime:plan.product.publishTime});
    if(proposed.timezone!=='Europe/Rome')throw Error('Existing editorial timezone differs');
    let changed=false;
    if(product.productionTime!==proposed.productionTime||product.publishTime!==proposed.publishTime){
      const result=await TgEditionModel.updateOne({_id:stored._id,revision:stored.revision},{$set:{'product.productionTime':proposed.productionTime,'product.publishTime':proposed.publishTime,updatedAt:now},$inc:{revision:1}});
      if(result.modifiedCount!==1)throw Error('Schedule changed concurrently');
      changed=true;
    }
    return console.log(JSON.stringify({configured:true,changed,edition:proposed.edition,productionTime:proposed.productionTime,publishTime:proposed.publishTime,timezone:proposed.timezone,decision:agentDecision({...plan,product:proposed},now),generation:false,publication:false}));
  }
  if(action==='status')return console.log(JSON.stringify({database:'connected',mode:'editorial',driver:plan.productionDriver,decision,generation:false,publication:false}));
  await TgControllerModel.updateOne({key:'daily-production'},{$set:{heartbeatAt:now,mode:'editorial',driver:plan.productionDriver}},{upsert:true});
  if(!decision.due)return console.log(JSON.stringify({action:'skipped',reason:decision.reason,date:decision.date}));
  if(!process.env.OPENAI_API_KEY||process.env.TG_AI_ENABLED!=='true'||process.env.PODCAST_AI_ENABLED!=='true')throw Error('Research not configured');
  const queued=await queueEdition(product,now,decision.date);
  if(queued.product.productionMode!=='editorial')throw Error('Frozen edition differs');
  const claim=await claimJob(now,queued._id.toString());
  if(!claim)return console.log(JSON.stringify({action:'existing',date:decision.date,state:queued.state}));
  const {owner,run}=claim,id=run._id.toString(),controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12*60000),signal=controller.signal;
  let renewing=false;
  const heartbeat=setInterval(()=>{
    if(renewing)return;renewing=true;
    void Promise.all([renewLease(id,owner),TgControllerModel.updateOne({key:'daily-production'},{$set:{heartbeatAt:new Date()}})])
      .then(([ok])=>{if(!ok)controller.abort();}).catch(()=>controller.abort()).finally(()=>{renewing=false;});
  },30000);
  try{
    const previous=await loadPublishedHistory(run.edition,run.date,now);
    let evidence:{key:string;value:Awaited<ReturnType<typeof retrieveAuditEvidence>>}|undefined;
    const getEvidence=async(r:Parameters<typeof judgeEdition>[1],s:Parameters<typeof judgeEdition>[2],verify=false)=>{
      const key=scriptReviewInputDigest(run.product,run.date,r,s);
      if(verify||!evidence||key!==evidence.key)evidence={key,value:await retrieveAuditEvidence(r,s,signal,undefined,verify?'verification':'research')};
      return evidence.value;
    };
    await produceTg(serializeJob(run.toObject()),JSON.stringify(previous),{
      editorialOnly:true,editorialReady:async job=>{await saveEditionTexts(job);},
      research:p=>researchEdition(run.product,now,p,signal),write:(r,c)=>writeEdition(run.product,r,signal,c,run.date),
      audit:async(r,s)=>judgeEdition(run.product,r,s,await getEvidence(r,s,true),signal,previous),
      reviewScript:async(r,s)=>reviewEditionScript(run.product,run.date,r,s,await getEvidence(r,s),signal),
      voice:async()=>{throw Error('Media disabled');},render:async()=>{throw Error('Media disabled');},
      checkpoint:(state,data,detail)=>checkpoint(id,owner,state,data,detail),
    });
    const finished=await TgRunModel.findById(id).select('state').lean().orFail();
    await TgControllerModel.updateOne({key:'daily-production'},{$set:{lastDate:run.date,lastState:finished.state,lastFinishedAt:new Date()}});
    console.log(JSON.stringify({date:run.date,state:finished.state,generation:false,publication:false}));
  }catch(error){
    await checkpoint(id,owner,'blocked',{issues:[error instanceof TgEditorialError?error.message:'Produzione editoriale interrotta: controllare il rapporto e richiedere un nuovo tentativo esplicito']},'Redazione fermata; nessuna ripetizione automatica del giudizio negativo').catch(()=>undefined);
    throw Error('Editorial production stopped');
  }finally{clearTimeout(timeout);clearInterval(heartbeat);await TgRunModel.updateOne({_id:id,leaseOwner:owner},{$unset:{leaseOwner:1,leaseUntil:1}});}
}
main().catch(()=>{console.error(JSON.stringify({state:'blocked',issue:'Host editoriale non completato: verificare stato, piano e configurazione privata',generation:false,publication:false}));process.exitCode=1;})
  .finally(async()=>{await mongoose.disconnect();});

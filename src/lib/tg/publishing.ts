import 'server-only';
import { randomUUID } from 'node:crypto';
import { editionSlot } from './schedule';
import { TgDeliveryModel } from '@/models/tg/TgDelivery';
import { TgRunModel } from '@/models/tg/TgRun';
import { serializeJob } from './store';
import { localEditionDate } from './config';
import { auditIsCurrent, approvalIsBound } from './review';
import { loadPublishedHistory } from './history';
import { freshnessIsCurrent } from './freshness';
import { publicationControl } from './newsroom';
import { tgReadiness } from './readiness';
import { inspectArtifact } from './artifacts';
import { pollDelivery, startDelivery } from './publishers';
import type { TgJob } from './types';

export class TgPublicationDeferred extends Error {}
export function publishTimeReached(job:TgJob,now:Date){
  const scheduled=Date.parse(job.publicationPlan?.scheduledAt??'');
  if(job.review?.mode==='ai')return Number.isFinite(scheduled)&&now.getTime()>=scheduled&&now.getTime()<=Date.parse(editionSlot(job.product,job.date).closesAt);
  if(Number.isFinite(scheduled))return job.date===localEditionDate(now,job.product.timezone)&&now.getTime()>=scheduled;
  const local=new Intl.DateTimeFormat('en-GB',{timeZone:job.product.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  return job.date===localEditionDate(now,job.product.timezone)&&local>=job.product.publishTime;
}
const defaults={start:startDelivery,poll:pollDelivery,inspect:inspectArtifact};
/** Durable outbox: one approved bundle, one receipt per platform, no blind reposts. */
export async function publishReadyTg(signal:AbortSignal,ports=defaults,scope:{driver?:'worker'|'chatgpt-work';edition?:TgJob['edition'];date?:string;jobId?:string}={}){
  if(process.env.TG_PUBLISH_ENABLED!=='true')return;
  await TgDeliveryModel.init();
  const stale=new Date(Date.now()-10*60000);
  await TgDeliveryModel.updateMany({state:'polling',updatedAt:{$lt:stale}},{$set:{state:'submitted'}});
  await TgDeliveryModel.updateMany({state:{$in:['dispatching','finalizing']},updatedAt:{$lt:stale}},{$set:{state:'unknown',issue:'Invio interrotto: controllare il canale e riconciliare la ricevuta prima di proseguire'}});
  const pendingIds=await TgDeliveryModel.distinct('jobId',{state:{$in:['submitted','polling','finalizing']}});
  const recentDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const driver=scope.driver??'worker';
  const candidates=await TgRunModel.find({'product.siteFirst':{$ne:true},...(scope.edition?{edition:scope.edition}:{}),...(scope.date?{date:scope.date}:{}),...(scope.jobId?{_id:scope.jobId}:{}),'product.publicationDriver':driver==='chatgpt-work'?'chatgpt-work':{$ne:'chatgpt-work'},approvedAt:{$exists:true},$or:[{state:'ready'},{state:'publishing',date:{$gte:recentDate}},{_id:{$in:pendingIds},state:{$in:['publishing','blocked']}}]}).select('_id').sort({updatedAt:1}).limit(40).lean();
  for(const candidate of candidates){
    signal.throwIfAborted();
    const owner=randomUUID(),now=new Date();
    const record=await TgRunModel.findOneAndUpdate({_id:candidate._id,state:{$in:['ready','publishing','blocked']},$or:[{publicationLeaseUntil:{$exists:false}},{publicationLeaseUntil:{$lt:now}}]},{$set:{publicationOwner:owner,publicationLeaseUntil:new Date(now.getTime()+120000)}},{returnDocument:'after'}).select('+mediaCapability');
    if(!record)continue;
    const id=record._id.toString(),job=serializeJob(record.toObject()),controller=new AbortController();
    const activeSignal=AbortSignal.any([signal,controller.signal]);
    let renewing=false;
    const heartbeat=setInterval(()=>{
      if(renewing)return;renewing=true;
      void TgRunModel.updateOne({_id:id,publicationOwner:owner,publicationLeaseUntil:{$gt:new Date()}},{$set:{publicationLeaseUntil:new Date(Date.now()+120000)}}).then(r=>{if(!r.matchedCount)controller.abort();}).catch(()=>controller.abort()).finally(()=>{renewing=false;});
    },30000);
    async function guard(){
      activeSignal.throwIfAborted();
      const [control,current]=await Promise.all([publicationControl(),TgRunModel.findOne({_id:id,publicationOwner:owner,publicationLeaseUntil:{$gt:new Date()}}).lean()]);
      if(!current||control.paused||!control.enabled)throw new TgPublicationDeferred('Distribuzione in pausa');
      const latest=serializeJob(current);
      const checkedNow=new Date();
      if(!['ready','publishing'].includes(latest.state)||!approvalIsBound(latest)||!auditIsCurrent(latest,checkedNow)||!publishTimeReached(latest,checkedNow)||!freshnessIsCurrent(latest,checkedNow,await loadPublishedHistory(latest.edition,latest.date,checkedNow)))throw new TgPublicationDeferred('Approvazione, attualità o archivio pubblicato da ricontrollare');
    }
    try{
      const valid=approvalIsBound(job),fresh=auditIsCurrent(job,now)&&freshnessIsCurrent(job,now,await loadPublishedHistory(job.edition,job.date,now)),due=publishTimeReached(job,now);
      const plan=job.publicationPlan?.platforms??[];
      const control=await publicationControl();
      const late=job.review?.mode==='ai'&&now.getTime()>Date.parse(editionSlot(job.product,job.date).closesAt);
      if((!valid||!fresh||late)&&job.state==='ready'){
        const issue=late?'Finestra di uscita superata: nessun invio automatico tardivo':!valid?'Approvazione mancante o pacchetto/destinazione cambiati: serve la revisione editoriale':'Attualità scaduta o archivio delle uscite cambiato: richiedere un nuovo controllo prima dell’uscita';
        await TgRunModel.updateOne({_id:id,publicationOwner:owner},{$set:{state:'blocked',issues:[issue]},$inc:{revision:1},$push:{events:{$each:[{at:new Date().toISOString(),stage:'blocked',detail:issue}],$slice:-50}}});
      }
      const readiness=tgReadiness({...job.product,platforms:plan});
      const mayStart=job.state!=='blocked'&&valid&&fresh&&due&&!late&&!control.paused;
      if(mayStart){
        for(const asset of job.assets){const actual=await ports.inspect(id,asset.name);if(actual.sha256!==asset.sha256||actual.bytes!==asset.bytes)throw new Error('Artifact changed');}
      }
      const receipts=await TgDeliveryModel.find({jobId:id}).select('+remoteSession');
      for(const platform of plan){
        activeSignal.throwIfAborted();
        let delivery=receipts.find(d=>d.platform===platform);
        if(delivery&&['published','unknown','blocked','dispatching','polling','finalizing'].includes(delivery.state))continue;
        if(delivery?.nextAttemptAt&&delivery.nextAttemptAt>new Date())continue;
        try{
          if(delivery?.state==='submitted'&&delivery.remoteId){
            const claim=await TgDeliveryModel.updateOne({_id:delivery._id,state:'submitted'},{$set:{state:'polling',updatedAt:new Date()}});
            if(!claim.modifiedCount)continue;
            const receipt=await ports.poll(job,platform,delivery.remoteId,activeSignal,{
              beforeMutation:guard,
              beforeFinalize:async()=>{await guard();await TgDeliveryModel.updateOne({_id:delivery!._id,state:'polling'},{$set:{state:'finalizing',updatedAt:new Date()}});},
            });
            await TgDeliveryModel.updateOne({_id:delivery._id,state:{$in:['polling','finalizing']}},{$set:{...receipt,attempts:0,updatedAt:new Date()},$unset:{issue:1,nextAttemptAt:1}});
            continue;
          }
          if(!mayStart||!readiness.channels.find(c=>c.platform===platform)?.ready)continue;
          await guard();
          if(!delivery){
            try{delivery=await TgDeliveryModel.create({jobId:id,platform,state:'dispatching',attempts:1});}
            catch(error){if((error as {code?:number}).code===11000)continue;throw error;}
          }else if(['uploading','waiting'].includes(delivery.state)){
            const claim=await TgDeliveryModel.updateOne({_id:delivery._id,state:delivery.state},{$set:{state:delivery.remoteSession?'uploading':'dispatching',updatedAt:new Date()},$inc:{attempts:1}});
            if(!claim.modifiedCount)continue;
          }else continue;
          await TgRunModel.updateOne({_id:id,publicationOwner:owner,state:'ready'},{$set:{state:'publishing'},$inc:{revision:1}});
          const origin=process.env.TG_MEDIA_PUBLIC_ORIGIN;
          const media=origin&&record.mediaCapability?new URL(`/api/tg-media/${record.mediaCapability}/${platform==='spotify'?'landscape.mp4':'portrait.mp4'}`,origin).toString():undefined;
          await ports.start(job,platform,media,activeSignal,async receipt=>{
            if(!await TgRunModel.exists({_id:id,publicationOwner:owner,publicationLeaseUntil:{$gt:new Date()}}))throw new Error('Publication lease lost');
            await TgDeliveryModel.updateOne({_id:delivery!._id},{$set:{...receipt,attempts:0,updatedAt:new Date()},$unset:{issue:1,nextAttemptAt:1,remoteSession:1}});
          },{beforeMutation:guard,remoteSession:delivery.remoteSession,saveSession:async session=>{
            await guard();await TgDeliveryModel.updateOne({_id:delivery!._id},{$set:{state:'uploading',remoteSession:session,updatedAt:new Date()}});
          }});
        }catch(error){
          if(!delivery)continue;
          const current=await TgDeliveryModel.findById(delivery._id).select('+remoteSession').lean();
          if(!current||current.state==='published')continue;
          if(error instanceof TgPublicationDeferred){
            await TgDeliveryModel.updateOne({_id:delivery._id},{$set:{state:current.remoteSession?'uploading':current.remoteId?'submitted':'waiting',updatedAt:new Date()}});
          }else if(current.state==='polling'){
            const attempts=(current.attempts??0)+1;
            await TgDeliveryModel.updateOne({_id:delivery._id},{$set:{state:attempts>=5?'blocked':'submitted',attempts,nextAttemptAt:new Date(Date.now()+Math.min(600000,15000*2**attempts)),issue:'Controllo della ricevuta non riuscito; nessun nuovo caricamento',updatedAt:new Date()}});
          }else if(current.remoteSession&&current.state==='uploading'){
            await TgDeliveryModel.updateOne({_id:delivery._id},{$set:{state:current.attempts>=3?'blocked':'uploading',nextAttemptAt:new Date(Date.now()+60000),issue:'Ripresa della stessa sessione YouTube in attesa',updatedAt:new Date()}});
          }else{
            await TgDeliveryModel.updateOne({_id:delivery._id},{$set:{state:'unknown',issue:'Esito non confermato: riconciliare il riferimento trovato sul canale; nessun reinvio automatico',updatedAt:new Date()}});
          }
        }
      }
      const current=await TgDeliveryModel.find({jobId:id}).lean();
      const done=valid&&plan.length>0&&plan.every(p=>current.some(r=>r.platform===p&&r.state==='published'));
      const deliveries=current.map(r=>({platform:r.platform,state:r.state,remoteId:r.remoteId,url:r.url,issue:r.issue,attempts:r.attempts,nextAttemptAt:r.nextAttemptAt?.toISOString()}));
      if(JSON.stringify(deliveries)!==JSON.stringify(job.deliveries)||done){
        await TgRunModel.updateOne({_id:id,publicationOwner:owner},{$set:{deliveries,...(done?{state:'published',publishedAt:new Date().toISOString(),issues:[]}: {})},$inc:{revision:1},...(done?{$push:{events:{$each:[{at:new Date().toISOString(),stage:'published',detail:'Pubblicazione confermata da tutti i canali approvati'}],$slice:-50}}}:{})});
      }
    }catch{
      if(!activeSignal.aborted)await TgRunModel.updateOne({_id:id,publicationOwner:owner},{$set:{state:'blocked',issues:['Distribuzione fermata: controllare integrità dei media e collegamenti nella redazione']},$inc:{revision:1}});
    }finally{clearInterval(heartbeat);await TgRunModel.updateOne({_id:id,publicationOwner:owner},{$unset:{publicationOwner:1,publicationLeaseUntil:1}});}
  }
}

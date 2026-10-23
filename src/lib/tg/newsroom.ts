import 'server-only';
import { randomUUID } from 'node:crypto';
import { TgRunModel } from '@/models/tg/TgRun';
import { TgDeliveryModel } from '@/models/tg/TgDelivery';
import { TgPublicationControlModel } from '@/models/tg/TgPublicationControl';
import { inspectArtifact } from './artifacts';
import { createEditorialApproval, approvalIsBound, auditIsCurrent } from './review';
import { serializeJob } from './store';
import type { TgJob } from './types';

export class TgNewsroomError extends Error { constructor(message:string, public status=409) {super(message);} }
export async function publicationControl() {
  const control = await TgPublicationControlModel.findOne({key:'tg'}).lean();
  return {paused:control?.paused ?? true,revision:control?.revision ?? 0,enabled:process.env.TG_PUBLISH_ENABLED==='true'};
}
export async function setPublicationPaused(paused:boolean,revision:number) {
  if (!Number.isInteger(revision) || revision<0) throw new TgNewsroomError('Versione non valida',400);
  if (!paused && process.env.TG_PUBLISH_ENABLED!=='true') throw new TgNewsroomError('La pubblicazione reale non è abilitata sul server');
  try {
    const updated=await TgPublicationControlModel.findOneAndUpdate({key:'tg',revision},{$set:{paused,updatedAt:new Date()},$inc:{revision:1}},{upsert:revision===0,returnDocument:'after'});
    if(!updated)throw new TgNewsroomError('Il controllo è cambiato: aggiorna la pagina');
    return {paused:updated.paused,revision:updated.revision,enabled:process.env.TG_PUBLISH_ENABLED==='true'};
  } catch(error) {if((error as {code?:number}).code===11000)throw new TgNewsroomError('Il controllo è cambiato: aggiorna la pagina');throw error;}
}
export async function authoritativeJob(id:string) {
  const record=await TgRunModel.findById(id).lean();
  if(!record)throw new TgNewsroomError('Edizione non trovata',404);
  const job=serializeJob(record);
  const receipts=await TgDeliveryModel.find({jobId:id}).select('+remoteSession').lean();
  job.deliveries=receipts.map(r=>({platform:r.platform as TgJob['product']['platforms'][number],state:r.state,remoteId:r.remoteId,url:r.url,issue:r.issue,attempts:r.attempts,nextAttemptAt:r.nextAttemptAt?.toISOString(),resumable:Boolean(r.remoteSession)&&r.platform==='youtube'}));
  return job;
}
/** The same publication lease protects review decisions and external dispatch. */
export async function editorialAction(id:string,body:Record<string,unknown>) {
  if(!['approve','reject','withdraw','retry','reverify','reconcile','cancel'].includes(String(body.action)))throw new TgNewsroomError('Azione non valida',400);
  if(!Number.isInteger(body.revision) || Number(body.revision)<0)throw new TgNewsroomError('Ricarica l’edizione prima di decidere');
  const owner=randomUUID(),now=new Date();
  const record=await TgRunModel.findOneAndUpdate({_id:id,$and:[
    {$or:[{revision:body.revision},...(body.revision===0?[{revision:{$exists:false}}]:[])]},
    {$or:[{publicationLeaseUntil:{$exists:false}},{publicationLeaseUntil:{$lt:now}}]},
    {$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lt:now}}]},
  ]},{$set:{publicationOwner:owner,publicationLeaseUntil:new Date(now.getTime()+120000)}},{returnDocument:'after'});
  if(!record)throw new TgNewsroomError('Edizione cambiata o lavorazione in corso: aggiorna e riprova');
  const job=serializeJob(record.toObject());
  try {
    const deliveries=await TgDeliveryModel.find({jobId:id}).select('+remoteSession').lean();
    const note=typeof body.note==='string'?body.note.trim().slice(0,1000):'';
    const reviewer=typeof body.reviewer==='string'?body.reviewer.trim().slice(0,80):'';
    let set:Record<string,unknown>={},unset:Record<string,1>={},detail='';
    if(body.action==='approve') {
      if(deliveries.length)throw new TgNewsroomError('Questa edizione ha già ricevute di distribuzione');
      let approval;try{approval=createEditorialApproval(job,body,now);}catch(error){throw new TgNewsroomError((error as Error).message);}
      for(const asset of job.assets){const actual=await inspectArtifact(id,asset.name);if(actual.sha256!==asset.sha256||actual.bytes!==asset.bytes)throw new TgNewsroomError('Il file video è cambiato: serve una nuova verifica');}
      set={...approval,state:'ready',issues:[]};detail=`Approvazione editoriale di ${approval.review.reviewer}; canali e orario congelati`;
    } else if(body.action==='reconcile') {
      if(!note || !['ready','publishing'].includes(job.state))throw new TgNewsroomError('Indica la verifica eseguita sul canale');
      const d=deliveries.find(d=>d.platform===body.platform);
      if(!d || !['unknown','blocked'].includes(d.state))throw new TgNewsroomError('Ricevuta non riconciliabile');
      const remoteId=typeof body.remoteId==='string'?body.remoteId.trim():d.remoteId;
      if(!remoteId&&d.platform==='youtube'&&d.remoteSession){
        if(!approvalIsBound(job)||!auditIsCurrent(job))throw new TgNewsroomError('Prima di riprendere l’upload serve una verifica e un’approvazione valide');
        await TgDeliveryModel.updateOne({_id:d._id,state:d.state},{$set:{state:'uploading',attempts:0,updatedAt:now},$unset:{issue:1,nextAttemptAt:1}});
      }else{
        if(!remoteId || !/^[\w:.-]{1,160}$/u.test(remoteId))throw new TgNewsroomError('Inserisci un ID ricevuta valido; non viene creato un nuovo caricamento');
        await TgDeliveryModel.updateOne({_id:d._id,state:d.state},{$set:{state:'submitted',remoteId,attempts:0,updatedAt:now},$unset:{issue:1,nextAttemptAt:1}});
      }
      detail=`Ricevuta ${d.platform} da ricontrollare: ${note}`;
    } else {
      if(deliveries.length)throw new TgNewsroomError('Sono già presenti invii: controlla le ricevute prima di modificare l’edizione');
      if(body.action==='cancel'){
        if(!['queued','needs_review','ready','blocked','failed'].includes(job.state)||!note)throw new TgNewsroomError('Indica il motivo dell’annullamento; le edizioni già inviate non possono essere annullate da qui');
        set={state:'cancelled',issues:[],review:{decision:'withdrawn',reviewer:reviewer||'Redazione',at:now.toISOString(),note,checks:{}}};
        unset={approvedAt:1,publicationPlan:1};detail=`Edizione annullata: ${note}`;
      } else if(body.action==='withdraw') {
        if(!['ready','blocked'].includes(job.state)||!job.approvedAt||!note)throw new TgNewsroomError('Puoi ritirare un’edizione approvata indicando il motivo');
        set={state:'needs_review',review:{decision:'withdrawn',reviewer:reviewer||'Redazione',at:now.toISOString(),note,checks:{}},issues:[note]};
        unset={approvedAt:1,publicationPlan:1};detail=`Approvazione ritirata: ${note}`;
      } else if(body.action==='reject') {
        if(job.state!=='needs_review'||!note)throw new TgNewsroomError('Scrivi che cosa correggere prima di rimandare in redazione');
        set={state:'blocked',issues:[note],review:{decision:'changes_requested',reviewer:reviewer||'Redazione',at:now.toISOString(),note,checks:{}}};
        unset={approvedAt:1,publicationPlan:1};detail=`Correzioni richieste: ${note}`;
      } else {
        if(job.approvedAt || !['needs_review','blocked','failed'].includes(job.state))throw new TgNewsroomError('Ritira prima l’approvazione o attendi la lavorazione');
        if(!note)throw new TgNewsroomError('Indica il motivo del nuovo tentativo');
        if(body.action==='reverify'&&!job.script)throw new TgNewsroomError('Non c’è un copione da verificare');
        set={state:'queued',attempts:0,issues:body.action==='retry'?[...job.issues,note].slice(-5):[]};
        unset={audit:1,scriptReview:1,review:1,finalReview:1,approvedAt:1,publicationPlan:1,nextProductionAttemptAt:1};
        if(body.action==='retry'&&job.state==='blocked'){unset={...unset,research:1,script:1,manifest:1};set.assets=[];set.editorialRepairs=0;set.durationRepairs=0;}
        detail=body.action==='reverify'?`Nuova verifica richiesta: ${note}`:`Rigenerazione richiesta: ${note}`;
      }
    }
    const updated=await TgRunModel.findOneAndUpdate({_id:id,publicationOwner:owner},{$set:set,...(Object.keys(unset).length?{$unset:unset}:{}),$inc:{revision:1},$push:{events:{$each:[{at:now.toISOString(),stage:String(set.state??job.state),detail}],$slice:-50}}},{returnDocument:'after'});
    if(!updated)throw new TgNewsroomError('Edizione cambiata');
    return await authoritativeJob(id);
  } finally {await TgRunModel.updateOne({_id:id,publicationOwner:owner},{$unset:{publicationOwner:1,publicationLeaseUntil:1}});}
}

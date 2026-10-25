import {createHash} from 'node:crypto';
import {scriptDigest} from './editorial';
import {scoredNarration} from './script-review';
import {editionSlot,localEditionDate} from './schedule';
import {auditIsCurrent} from './review';
import type {TgJob} from './types';

/** Called only by an explicit newsroom action; never from the producer. */
export function createManualTextApproval(job:TgJob,input:Record<string,unknown>,now=new Date()):NonNullable<TgJob['textApproval']>{
 if(job.state!=='editorial_ready'||job.product.productionMode==='editorial'||job.product.textReviewMode!=='manual')throw Error('Questa edizione non attende la conferma manuale prima dei media');
 if(input.confirmed!==true||typeof input.reviewer!=='string'||input.reviewer.trim().length<2||input.reviewer.length>80)throw Error('Conferma la lettura del testo e dello score e indica il revisore');
 const slot=editionSlot(job.product,job.date);
 if(localEditionDate(now,job.product.timezone)!==job.date||now.getTime()<Date.parse(slot.prepareAt)||now.getTime()>Date.parse(slot.closesAt))throw Error('Conferma fuori dalla finestra odierna: nessuna produzione tardiva');
 if(!auditIsCurrent(job,now)||!job.script||!job.scriptReview)throw Error('Entrambi i controlli AI devono essere positivi, attuali e relativi a questo copione');
 if(input.scriptSha256!==scriptDigest(job.script)||input.reviewInputSha256!==job.scriptReview.inputSha256)throw Error('Il testo o lo score sono cambiati: rileggi la versione corrente');
 if(job.attempts>=3)throw Error('Tentativi tecnici esauriti: controllare il lavoro prima di riprenderlo');
 return {mode:'manual',reviewer:input.reviewer.trim(),at:now.toISOString(),date:job.date,
  scriptSha256:scriptDigest(job.script),scoreSha256:createHash('sha256').update(scoredNarration(job.script).scoreMarkup).digest('hex')};
}

/** This receipt must originate from an explicit user confirmation, never an AI verdict. */
export function manualTextApprovalIsCurrent(job:Pick<TgJob,'date'|'product'|'script'|'textApproval'>,now=new Date()){
 const approval=job.textApproval,at=Date.parse(approval?.at??'');
 if(!job.script||!approval||approval.mode!=='manual'||typeof approval.reviewer!=='string'||!approval.reviewer.trim()||approval.date!==job.date
  ||!Number.isFinite(at)||at>now.getTime()||localEditionDate(now,job.product.timezone)!==job.date)return false;
 try{return approval.scriptSha256===scriptDigest(job.script)
  &&approval.scoreSha256===createHash('sha256').update(scoredNarration(job.script).scoreMarkup).digest('hex');}catch{return false;}
}

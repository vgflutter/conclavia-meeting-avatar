import {parseProduct} from './config';
import {editionSlot,localEditionDate} from './schedule';
import type {TgJob,TgProduct} from './types';

/** Explicit first-cycle commissioning only; never reopen a failed AI verdict. */
export function firstMacCommissionProduct(job:TgJob,current:TgProduct,now:Date){
 if(job.date!==localEditionDate(now,current.timezone)||job.edition!==current.edition
  ||job.state!=='blocked'||job.product.productionMode!=='editorial'||job.research||job.script||job.audit||job.scriptReview
  ||job.manifest||job.assets.length||job.approvedAt||job.review||job.finalReview||job.sitePublication||job.deliveries.length
  ||job.attempts>=3||(job.editorialRepairs??0)>0||(job.durationRepairs??0)>0)
  throw Error('La prima commissione Mac richiede un tentativo editoriale fermato prima del copione e dei controlli AI');
 const later=new Date(now.getTime()+45*60000);
 if(localEditionDate(later,current.timezone)!==job.date)throw Error('Finestra straordinaria oltre la data odierna');
 const clock=(date:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:current.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 const product=parseProduct({...current,productionMode:'full',productionTime:clock(now),publishTime:clock(later)});
 const slot=editionSlot(product,job.date);
 if(Date.parse(slot.prepareAt)>now.getTime()||Date.parse(slot.scheduledAt)<=now.getTime()
  ||localEditionDate(new Date(slot.closesAt),product.timezone)!==job.date)throw Error('Finestra straordinaria non disponibile');
 return product;
}

import {manualTextApprovalIsCurrent} from './text-approval';
import type {TgJob,TgProduct} from './types';

/** Local controller routing only. It cannot approve text, call AI or start media. */
export function macProductionStage(product:TgProduct,job:TgJob|undefined,now=new Date()){
 if(job?.state==='published')return 'published';
 if(job&&['blocked','failed','cancelled','needs_review'].includes(job.state))return 'stopped';
 if(job?.state==='editorial_ready')return 'waiting';
 if(job&&['ready','publishing'].includes(job.state))return 'upload';
 const frozen=job?.product??product;
 if(frozen.productionMode==='editorial'||frozen.textReviewMode==='manual'&&(!job||!manualTextApprovalIsCurrent(job,now)))return 'editorial';
 return 'media';
}

import {createHash} from 'node:crypto';
import {scriptDigest} from './editorial';
import {scoredNarration} from './script-review';
import {localEditionDate} from './schedule';
import type {TgJob} from './types';

/** This receipt must originate from an explicit user confirmation, never an AI verdict. */
export function manualTextApprovalIsCurrent(job:Pick<TgJob,'date'|'product'|'script'|'textApproval'>,now=new Date()){
 const approval=job.textApproval,at=Date.parse(approval?.at??'');
 if(!job.script||!approval||approval.mode!=='manual'||typeof approval.reviewer!=='string'||!approval.reviewer.trim()||approval.date!==job.date
  ||!Number.isFinite(at)||at>now.getTime()||localEditionDate(now,job.product.timezone)!==job.date)return false;
 try{return approval.scriptSha256===scriptDigest(job.script)
  &&approval.scoreSha256===createHash('sha256').update(scoredNarration(job.script).scoreMarkup).digest('hex');}catch{return false;}
}

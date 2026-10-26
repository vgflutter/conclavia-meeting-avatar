import {createHash} from 'node:crypto';
import {scriptDigest} from './editorial';
import {researchDigest} from './freshness';
import type {TgResearch,TgScript} from './types';

export interface TgEvidenceStory {
 storyId:string;brief:unknown;sources:{url:string;title:string}[];
 /** Original retrieval time, retained on a cache hit. Absent on legacy files. */
 retrievedAt?:string;
}
export interface TgAuditEvidence {
 data:TgEvidenceStory[];sources:{url:string;title:string}[];webByStory:Record<string,string[]>;
 verification?:{version:1;checkedAt:string;researchSha256:string;scriptSha256:string};
}
export const VERIFICATION_EVIDENCE_MAX_AGE_MS=5*60_000;
/** A verification snapshot is issued by fresh retrieval, never by the model. */
export function verificationEvidenceIsCurrent(value:unknown,research:TgResearch,script:TgScript,now:Date){
 const e=value as TgAuditEvidence,v=e?.verification,at=Date.parse(v?.checkedAt??'');
 if(!v||v.version!==1||!Number.isFinite(at)||at>now.getTime()+60_000||now.getTime()-at>VERIFICATION_EVIDENCE_MAX_AGE_MS||v.researchSha256!==researchDigest(research)||v.scriptSha256!==scriptDigest(script)||!Array.isArray(e.data)||e.data.length!==research.stories.length)return false;
 return research.stories.every(s=>{
  const matches=e.data.filter(d=>d.storyId===s.id),t=Date.parse(matches[0]?.retrievedAt??'');
  return matches.length===1&&Number.isFinite(t)&&t>=at&&t<=now.getTime()+60_000&&now.getTime()-t<=VERIFICATION_EVIDENCE_MAX_AGE_MS&&matches[0].sources.length>0;
 });
}
export type EvidenceLookup=(key:string,generate:()=>Promise<TgEvidenceStory>)=>Promise<TgEvidenceStory>;
export const EVIDENCE_CACHE_WINDOW_MS=30*60_000;

/** One story's exact query, model and policies; no unrelated stories or clock
 * seconds in the key. Bucket boundaries conservatively refresh within 30 min. */
export function evidenceLookupKey(input:{model:string;policy:string;domains:readonly string[];query:string},now:Date){
 if(!Number.isFinite(now.getTime()))throw Error('Invalid evidence cache date');
 return createHash('sha256').update(JSON.stringify({version:1,...input,domains:[...input.domains].sort(),window:Math.floor(now.getTime()/EVIDENCE_CACHE_WINDOW_MS)})).digest('hex');
}
/** Per-job sharing, including in-flight work. A failed request is not silently
 * retried; the normal bounded production/review policy remains responsible. */
export function evidenceMemo():EvidenceLookup {
 const values=new Map<string,Promise<TgEvidenceStory>>();
 return (key,generate)=>{
  if(!values.has(key)){
   if(values.size>=256)throw Error('Evidence memo budget exceeded');
   values.set(key,Promise.resolve().then(generate));
  }
  return values.get(key)!;
 };
}

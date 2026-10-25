import {createHash} from 'node:crypto';

export interface TgEvidenceStory {
 storyId:string;brief:unknown;sources:{url:string;title:string}[];
 /** Original retrieval time, retained on a cache hit. Absent on legacy files. */
 retrievedAt?:string;
}
export interface TgAuditEvidence {
 data:TgEvidenceStory[];sources:{url:string;title:string}[];webByStory:Record<string,string[]>;
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

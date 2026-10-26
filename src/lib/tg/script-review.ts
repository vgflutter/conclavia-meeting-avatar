import {createHash} from 'node:crypto';
import {formatPerformanceMarkup,parsePerformanceMarkup} from '@conclavia/avatar-kit/performance';
import {scriptDigest,TgEditorialError} from './editorial';
import type {TgJob,TgProduct,TgResearch,TgScript,TgScriptReview,TgSentence} from './types';
import {tgSpeechPassages} from './speech-plan';
import {DAILY_NARRATIVE_POLICY,DAILY_NARRATIVE_REVIEW,DAILY_REVIEW_GENERATION} from './narrative-policy';
import {DAILY_TIMELINE_POLICY} from './freshness';

export const SCRIPT_REVIEW_CHECKS=['coherence','impartiality','opening','closing','coverage'] as const;
export function compileEditorialPassage(markup:string,context:Pick<TgSentence,'speaker'|'storyId'|'sourceIds'>):TgSentence[]{
 return parsePerformanceMarkup(markup).map(s=>({...context,...s,sourceIds:[...context.sourceIds]}));
}
/** One immutable representation for review, plain speech and timed acting. */
export function scoredNarration(script:TgScript){
 if(script.sentences.some(s=>/<\/?[a-z][^>]*>|\[(?:mood|gesture|intent|transition)\s*[:=]/iu.test(s.text)))throw new TgEditorialError('Marcatori di regia presenti nel testo da leggere');
 const scoreMarkup=formatPerformanceMarkup(script.sentences);
 const parsed=parsePerformanceMarkup(scoreMarkup);
 const sentences=script.sentences.map((s,i)=>({...s,...parsed[i]}));
 if(sentences.some((s,i)=>s.text!==script.sentences[i].text))throw new TgEditorialError('Lo score altera il testo da leggere');
 return {scoreMarkup,narrationText:tgSpeechPassages(sentences).map(p=>p.map(s=>s.text).join(' ')).join('\n\n'),sentences};
}
export function scriptReviewInputDigest(product:TgProduct,date:string,research:TgResearch,script:TgScript){
 const score=scoredNarration(script);
 return createHash('sha256').update(JSON.stringify({version:1,narrativePolicy:DAILY_NARRATIVE_POLICY,narrativeReview:DAILY_NARRATIVE_REVIEW,timelinePolicy:DAILY_TIMELINE_POLICY,reviewGeneration:DAILY_REVIEW_GENERATION,product,date,research,script:scriptDigest(script),narrationText:score.narrationText,scoreMarkup:score.scoreMarkup})).digest('hex');
}
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function scriptReviewSchema(script:TgScript){
 return object({issues:{type:'array',maxItems:16,items:{type:'string',maxLength:700}},checks:object(Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,{type:'boolean'}]))),
  clauses:object(Object.fromEntries(script.sentences.map((_,i)=>[`sentence_${i}`,object({content:{type:'boolean'},form:{type:'boolean'},delivery:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:500}})])))});
}
export function validateScriptReview(raw:unknown,product:TgProduct,date:string,research:TgResearch,script:TgScript,model:string,now=new Date()):TgScriptReview{
 const value=raw as {issues?:unknown;checks?:Record<string,unknown>;clauses?:Record<string,{content?:unknown;form?:unknown;delivery?:unknown;reason?:unknown}>}|null;
 if(!value||!Array.isArray(value.issues)||value.issues.length>16||value.issues.some(s=>typeof s!=='string'||s.length>700)||!value.checks||SCRIPT_REVIEW_CHECKS.some(k=>typeof value.checks![k]!=='boolean')||!value.clauses||Object.keys(value.clauses).length!==script.sentences.length)throw new TgEditorialError('Seconda revisione del copione incompleta');
 const issues=[...value.issues] as string[];
 const clauses=script.sentences.map((_,index)=>{
  const c=value.clauses![`sentence_${index}`];
  if(!c||['content','form','delivery'].some(k=>typeof c[k as keyof typeof c]!=='boolean')||typeof c.reason!=='string'||c.reason.trim().length<10||c.reason.length>500)throw new TgEditorialError(`Seconda revisione incompleta: frase ${index+1}`);
  if(!c.content||!c.form||!c.delivery)issues.push(`Frase ${index+1}: ${c.reason}`);
  return {index,content:c.content as boolean,form:c.form as boolean,delivery:c.delivery as boolean,reason:c.reason};
 });
 const checks=Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,value.checks![k]])) as TgScriptReview['checks'];
 for(const k of SCRIPT_REVIEW_CHECKS)if(!checks[k])issues.push(`Seconda revisione: controllo ${k} non superato`);
 const {scoreMarkup,narrationText}=scoredNarration(script);
 return {version:1,inputSha256:scriptReviewInputDigest(product,date,research,script),scriptSha256:scriptDigest(script),checkedAt:now.toISOString(),model,passed:issues.length===0,issues,scoreMarkup,narrationText,checks,clauses};
}
export function scriptReviewIsCurrent(job:Pick<TgJob,'product'|'date'|'research'|'script'|'scriptReview'>,now=new Date()){
 const r=job.scriptReview,t=Date.parse(r?.checkedAt??'');
 if(!job.research||!job.script||!r||r.version!==1||!r.passed||!Array.isArray(r.issues)||r.issues.length||!r.checks||SCRIPT_REVIEW_CHECKS.some(k=>r.checks[k]!==true)||!Array.isArray(r.clauses)||r.clauses.length!==job.script.sentences.length||r.clauses.some((c,i)=>c.index!==i||c.content!==true||c.form!==true||c.delivery!==true)||!Number.isFinite(t)||t>now.getTime()+60000||now.getTime()-t>=6*3600000)return false;
 try {const score=scoredNarration(job.script);return r.scriptSha256===scriptDigest(job.script)&&r.inputSha256===scriptReviewInputDigest(job.product,job.date,job.research,job.script)&&r.narrationText===score.narrationText&&r.scoreMarkup===score.scoreMarkup;}catch{return false;}
}

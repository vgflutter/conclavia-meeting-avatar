import {createHash} from 'node:crypto';
import {formatPerformanceMarkup,parsePerformanceMarkup} from '@conclavia/avatar-kit/performance';
import {scriptDigest,TgEditorialError} from './editorial';
import type {TgJob,TgProduct,TgResearch,TgScript,TgScriptReview,TgSentence} from './types';
import {tgSpeechPassages} from './speech-plan';
import {DAILY_NARRATIVE_POLICY,DAILY_NARRATIVE_REVIEW,DAILY_REVIEW_GENERATION} from './narrative-policy';
import {DAILY_TIMELINE_POLICY} from './freshness';
import {SCRIPT_QUALITY_CHECKS,SCRIPT_QUALITY_PROTOCOL,QUALITY_PARENT} from './script-quality';

export const SCRIPT_REVIEW_CHECKS=['coherence','impartiality','opening','closing','coverage'] as const;
export {SCRIPT_QUALITY_CHECKS,SCRIPT_QUALITY_PROTOCOL} from './script-quality';
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
 return createHash('sha256').update(JSON.stringify({version:1,qualityProtocol:SCRIPT_QUALITY_PROTOCOL,narrativePolicy:DAILY_NARRATIVE_POLICY,narrativeReview:DAILY_NARRATIVE_REVIEW,timelinePolicy:DAILY_TIMELINE_POLICY,reviewGeneration:DAILY_REVIEW_GENERATION,product,date,research,script:scriptDigest(script),narrationText:score.narrationText,scoreMarkup:score.scoreMarkup})).digest('hex');
}
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function scriptReviewSchema(script:TgScript){
 return object({issues:{type:'array',maxItems:16,items:{type:'string',maxLength:700}},checks:object(Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,{type:'boolean'}]))),
  quality:object(Object.fromEntries(SCRIPT_QUALITY_CHECKS.map(k=>[k,object({passed:{type:'boolean'},reason:{type:'string',minLength:20,maxLength:700},clauseIndices:{type:'array',maxItems:script.sentences.length,items:{type:'integer',minimum:0,maximum:script.sentences.length-1}}})]))),
  clauses:object(Object.fromEntries(script.sentences.map((_,i)=>[`sentence_${i}`,object({content:{type:'boolean'},form:{type:'boolean'},delivery:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:500}})])))});
}
export function validateScriptReview(raw:unknown,product:TgProduct,date:string,research:TgResearch,script:TgScript,model:string,now=new Date()):TgScriptReview{
 const value=raw as {issues?:unknown;checks?:Record<string,unknown>;quality?:TgScriptReview['quality'];clauses?:Record<string,{content?:unknown;form?:unknown;delivery?:unknown;reason?:unknown}>}|null;
 if(!value||!Array.isArray(value.issues)||value.issues.length>16||value.issues.some(s=>typeof s!=='string'||s.length>700)||!value.checks||SCRIPT_REVIEW_CHECKS.some(k=>typeof value.checks![k]!=='boolean')||!value.clauses||Object.keys(value.clauses).length!==script.sentences.length)throw new TgEditorialError('Seconda revisione del copione incompleta');
 const issues=[...value.issues] as string[];
 const clauses=script.sentences.map((_,index)=>{
  const c=value.clauses![`sentence_${index}`];
  if(!c||['content','form','delivery'].some(k=>typeof c[k as keyof typeof c]!=='boolean')||typeof c.reason!=='string'||c.reason.trim().length<10||c.reason.length>500)throw new TgEditorialError(`Seconda revisione incompleta: frase ${index+1}`);
  if(!c.content||!c.form||!c.delivery)issues.push(`Frase ${index+1}: ${c.reason}`);
  return {index,content:c.content as boolean,form:c.form as boolean,delivery:c.delivery as boolean,reason:c.reason};
 });
 const checks=Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,value.checks![k]])) as TgScriptReview['checks'];
 if(!value.quality||Object.keys(value.quality).length!==SCRIPT_QUALITY_CHECKS.length)throw new TgEditorialError('Seconda revisione: valutazioni qualitative incomplete');
 const quality=Object.fromEntries(SCRIPT_QUALITY_CHECKS.map(k=>{
  const q=value.quality![k];
  if(!q||typeof q.passed!=='boolean'||typeof q.reason!=='string'||q.reason.trim().length<20||q.reason.length>700||!Array.isArray(q.clauseIndices)||q.clauseIndices.length>script.sentences.length||new Set(q.clauseIndices).size!==q.clauseIndices.length||q.clauseIndices.some(i=>!Number.isInteger(i)||i<0||i>=script.sentences.length)||!q.passed&&q.clauseIndices.length<1)throw new TgEditorialError(`Seconda revisione: valutazione ${k} incompleta`);
  if(!q.passed){checks[QUALITY_PARENT[k]]=false;issues.push(`B ${k} · frasi ${q.clauseIndices.map(i=>i+1).join(', ')}: ${q.reason}`);}
  return [k,{passed:q.passed,reason:q.reason,clauseIndices:[...q.clauseIndices]}];
 })) as NonNullable<TgScriptReview['quality']>;
 for(const k of SCRIPT_REVIEW_CHECKS)if(!checks[k])issues.push(`Seconda revisione: controllo ${k} non superato`);
 const {scoreMarkup,narrationText}=scoredNarration(script);
 return {version:1,inputSha256:scriptReviewInputDigest(product,date,research,script),scriptSha256:scriptDigest(script),checkedAt:now.toISOString(),model,passed:issues.length===0,issues,scoreMarkup,narrationText,checks,clauses,quality};
}
export function scriptReviewIsCurrent(job:Pick<TgJob,'product'|'date'|'research'|'script'|'scriptReview'>,now=new Date()){
 const r=job.scriptReview,t=Date.parse(r?.checkedAt??'');
 if(!r?.quality||SCRIPT_QUALITY_CHECKS.some(k=>!r.quality![k]?.passed||typeof r.quality![k].reason!=='string'||r.quality![k].reason.trim().length<20||!Array.isArray(r.quality![k].clauseIndices)||r.quality![k].clauseIndices.some(i=>!Number.isInteger(i)||i<0||i>=(job.script?.sentences.length??0))))return false;
 if(!job.research||!job.script||!r||r.version!==1||!r.passed||!Array.isArray(r.issues)||r.issues.length||!r.checks||SCRIPT_REVIEW_CHECKS.some(k=>r.checks[k]!==true)||!Array.isArray(r.clauses)||r.clauses.length!==job.script.sentences.length||r.clauses.some((c,i)=>c.index!==i||c.content!==true||c.form!==true||c.delivery!==true)||!Number.isFinite(t)||t>now.getTime()+60000||now.getTime()-t>=6*3600000)return false;
 try {const score=scoredNarration(job.script);return r.scriptSha256===scriptDigest(job.script)&&r.inputSha256===scriptReviewInputDigest(job.product,job.date,job.research,job.script)&&r.narrationText===score.narrationText&&r.scoreMarkup===score.scoreMarkup;}catch{return false;}
}

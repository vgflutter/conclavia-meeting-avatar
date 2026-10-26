import { freshnessFixture } from './freshness-fixture';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
import { scriptDigest } from '../../src/lib/tg/editorial';
import { createEditorialApproval } from '../../src/lib/tg/review';
import { TG_REVIEW_CHECKS } from '../../src/lib/tg/presentation';
import {validateScriptReview,SCRIPT_REVIEW_CHECKS,SCRIPT_QUALITY_CHECKS} from '../../src/lib/tg/script-review';
import type { TgJob, TgAsset, TgProduct, TgResearch, TgScript } from '../../src/lib/tg/types';
export const qualityFixture=()=>Object.fromEntries(SCRIPT_QUALITY_CHECKS.map(k=>[k,{passed:true,reason:'Valutazione sintetica esplicita delle clausole di prova.',clauseIndices:[] as number[]}]));
export function scriptReviewFixture(product:TgProduct,date:string,research:TgResearch,script:TgScript,now=new Date()){
  return validateScriptReview({issues:[],quality:qualityFixture(),checks:Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,true])),clauses:Object.fromEntries(script.sentences.map((_,i)=>[`sentence_${i}`,{content:true,form:true,delivery:true,reason:'Revisione sintetica esplicita del materiale di test.'}]))},product,date,research,script,'fixture/editor-B',now);
}
export function reviewFixture(now=new Date()):TgJob{
  const script={title:'Una giornata di notizie spiegate',description:'Tre aggiornamenti con fonti verificabili.',sentences:Array.from({length:9},(_,i)=>({text:`Aggiornamento verificato numero ${i+1}.`,speaker:0 as const,mood:'attention' as const,intensity:.3,storyId:`story-${i%3}`,sourceIds:[`source-${i%3}`]}))};
  const job:TgJob={id:'a'.repeat(24),edition:'it',date:now.toISOString().slice(0,10),state:'needs_review',product:{...TG_PRODUCTS[0],seconds:180,timezone:'UTC'},script,
    research:{collectedAt:now.toISOString(),searchCalls:1,warnings:[],stories:Array.from({length:3},(_,i)=>({id:`story-${i}`,headline:`Notizia verificata ${i}`,category:'society',importance:80-i,changedSinceYesterday:'Un fatto nuovo documentato.',whyItMatters:'Contesto per il pubblico.',uncertainty:'',sourceIds:[`source-${i}`,`source-${i+3}`],facts:[{text:`Aggiornamento verificato numero ${i+1}.`,sourceIds:[`source-${i}`,`source-${i+3}`]}]})),sources:Array.from({length:6},(_,i)=>({id:`source-${i}`,url:`https://www.ansa.it/fixture-${i}`,publisher:'Fonte fixture',independentGroup:i<3?'ansa':'bbc',title:`Articolo ${i}`,publishedAt:now.toISOString(),evidence:'Un fatto nel materiale di prova.'}))},
    audit:{passed:true,scriptSha256:scriptDigest(script),issues:[],checkedFacts:9,checkedAt:now.toISOString(),evidence:'Verifica sintetica di test.',sources:[]},
    assets:['landscape.mp4','portrait.mp4','audio.mp3','captions.vtt','manifest.json'].map(name=>({name:name as TgAsset['name'],bytes:20,sha256:'b'.repeat(64),...(name.endsWith('.mp4')?{duration:180}:{})})),
    issues:[],events:[],deliveries:[],createdAt:now.toISOString(),updatedAt:now.toISOString(),attempts:1,revision:0};
  job.audit!.freshness=freshnessFixture(job.research!,job.script!,now);
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  return job;
}
export const reviewChecks=()=>Object.fromEntries(Object.keys(TG_REVIEW_CHECKS).map(key=>[key,true]));
export function approvalInput(now=new Date()){return {reviewer:'Redazione fixture',checks:reviewChecks(),plan:{platforms:['youtube'],scheduledAt:new Date(now.getTime()+1000).toISOString()}};}
export function approvedFixture(now=new Date(),env:Record<string,string|undefined>=process.env){
  const job=reviewFixture(now),approval=createEditorialApproval(job,approvalInput(now),now,env);
  return {...job,...approval,state:'ready' as const};
}

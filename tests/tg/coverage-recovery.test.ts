import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recoverDailyCoverage,mergeCoverageCandidates,type CoverageRecoveryState,type CoverageRecoveryPorts} from '../../src/lib/tg/coverage-recovery';
import {balancedSourceLedger} from '../../src/lib/tg/sources';
import {editorialFixture} from './editorial-fixture';
import type {TgResearch} from '../../src/lib/tg/types';
import type {SourceEditorCheck} from '../../src/lib/tg/selection-review';
const now=new Date('2026-10-26T06:35:00Z'),product={...editorialFixture(now).product,editorialProfile:'italia-morning-v2' as const};
const pool=(ids:string[]):TgResearch=>({sources:editorialFixture(now).research!.sources,stories:ids.map((id,i)=>({...editorialFixture(now).research!.stories[0],id,headline:`Fatto indipendente ${id}`,changedSinceYesterday:`Sviluppo specifico ${id}`,importance:90-i})),collectedAt:now.toISOString(),searchCalls:0,warnings:[]});
const check:SourceEditorCheck={coreSupported:true,coherentSources:true,fresh:true,italyFocus:true,scope:'italy',reason:'Fatto nuovo corroborato da due origini realmente distinte e pertinente al pubblico italiano.',sourceUrls:['https://www.ansa.it/a','https://www.rainews.it/b']};
const verify:CoverageRecoveryPorts['verify']=async p=>({checks:Object.fromEntries(p.stories.map(s=>[s.id,check])),context:p.stories.map(s=>({storyId:s.id,brief:'Contesto realmente verificato per il writer.',sourceUrls:check.sourceUrls}))});
const signal=()=>new AbortController().signal;

test('four valid items trigger immediate supplementation to six and retain reviewed evidence and context',async()=>{
 const saved:CoverageRecoveryState[]=[],requested:number[]=[];
 const result=await recoverDailyCoverage(product,{now:()=>now,signal:signal(),find:async c=>{requested.push(c.missing);if(c.round===2){assert.equal(c.retained.stories.length,4);assert.match(c.feedback,/missing/u);}return c.round===1?pool(['a','b','c','d']):pool(['e','f']);},verify,save:async s=>{saved.push(s);}});
 assert.deepEqual(requested,[6,2]);assert.equal(result.stories.length,6);assert.equal(result.retrievedContext?.length,6);
 assert.deepEqual(saved.filter(s=>s.rounds.at(-1)?.status==='completed').map(s=>s.retained.stories.length),[4,6]);
 assert.equal(new Set(result.stories.map(s=>s.id)).size,6);assert.equal(saved[1].retained.stories.length,4);
});
test('unchanged rejected candidates are not rerolled, and a second deficit automatically uses the third round',async()=>{
 const seen:string[][]=[],states:CoverageRecoveryState[]=[];
 const result=await recoverDailyCoverage(product,{now:()=>now,signal:signal(),find:async c=>c.round===1?pool(['a','b','c','d','bad']):c.round===2?pool(['bad','e']):pool(['f']),verify:async p=>{seen.push(p.stories.map(s=>s.headline));return {checks:Object.fromEntries(p.stories.map(s=>[s.id,s.headline.endsWith('bad')?{...check,fresh:false,reason:'Evento precedente alla finestra temporale: non è una notizia nuova.'}:check]))};},save:async s=>{states.push(s);}});
 assert.equal(result.stories.length,6);assert.equal(seen.length,3);
 assert.ok(!seen[1].some(s=>s.endsWith('bad')));assert.equal(states.at(-1)!.rounds.length,3);
 assert.equal(states.at(-1)!.rounds[0].checks&&Object.values(states.at(-1)!.rounds[0].checks!).filter(c=>!c.fresh).length,1);
});
test('a restart resumes the saved counter and valid stories instead of restarting a paid cycle',async()=>{
 let initial:CoverageRecoveryState|undefined;
 const interrupted=new Error('Provider quota unavailable');
 await assert.rejects(recoverDailyCoverage(product,{now:()=>now,signal:signal(),find:async c=>{if(c.round===2)throw interrupted;return pool(['a','b','c','d']);},verify,save:async s=>{initial=s;}}),/quota/u);
 assert.equal(initial!.rounds.length,2);assert.equal(initial!.retained.stories.length,4);
 const rounds:number[]=[];
 const result=await recoverDailyCoverage(product,{initial,now:()=>now,signal:signal(),find:async c=>{rounds.push(c.round);return pool(['e','f']);},verify,save:async()=>{}});
 assert.deepEqual(rounds,[3]);assert.equal(result.stories.length,6);
});
test('failed supplementation stays explicit after three rounds, and service failures never become positive checks',async()=>{
 let calls=0,last:CoverageRecoveryState|undefined;
 await assert.rejects(recoverDailyCoverage(product,{now:()=>now,signal:signal(),find:async()=>{calls++;return pool(['a','b','c','d']);},verify,save:async s=>{last=s;}}),/3 giri: 4\/6/u);
 assert.equal(calls,3);assert.equal(last!.rounds.length,3);
 calls=0;await assert.rejects(recoverDailyCoverage(product,{now:()=>now,signal:signal(),find:async()=>{calls++;throw Error('OpenAI API 429 credits exhausted');},verify:async()=>{assert.fail('No source review');},save:async()=>{}}),/429/u);assert.equal(calls,1);
});
test('the recovery respects cancellation, deadline and unchanged source snapshots',async()=>{
 let calls=0;const ports:CoverageRecoveryPorts={now:()=>now,deadline:new Date(now),signal:signal(),find:async()=>{calls++;return pool(['a']);},verify,save:async()=>{}};
 await assert.rejects(recoverDailyCoverage(product,ports),/Finestra/u);assert.equal(calls,0);
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(recoverDailyCoverage(product,{...ports,deadline:undefined,signal:ctrl.signal}),/abort/iu);
 const a=pool(['a']),b=pool(['b']);b.sources=structuredClone(b.sources);b.sources[0].evidence+=' Changed';
 assert.throws(()=>mergeCoverageCandidates(a,b,[],now),/Fonte modificata/u);
 let at=now;const deadline=new Date(now.getTime()+1000);
 await assert.rejects(recoverDailyCoverage(product,{now:()=>at,deadline,signal:signal(),find:async()=>{at=deadline;return pool(['a','b','c','d','e','f']);},verify:async()=>{assert.fail('No late web verification');},save:async()=>{}}),/Finestra/u);
});
test('expanded rounds expose more feed articles without counting the same publisher as a new origin',()=>{
 const source=pool(['a']).sources[0],sources=Array.from({length:80},(_,i)=>({...source,id:`s${i}`,url:`https://www.ansa.it/${i}`,feedId:'section',publisher:'ANSA'}));
 const first=balancedSourceLedger(sources,now),second=balancedSourceLedger(sources,now,480,48),third=balancedSourceLedger(sources,now,720,72);
 assert.equal(first.length,24);assert.equal(second.length,48);assert.equal(third.length,72);
 assert.equal(new Set(third.map(s=>s.independentGroup)).size,1);
});

test('one or two supplement candidates may pass their local temporal checks without lowering the final edition minimum',async()=>{
 const {requireFreshCandidates}=await import('../../src/lib/tg/freshness');
 const {requireDailyCoverage}=await import('../../src/lib/tg/editorial');
 const small=pool(['e','f']);
 assert.throws(()=>requireFreshCandidates(small,now,[]),/sufficienti/u);
 assert.doesNotThrow(()=>requireFreshCandidates(small,now,[],{allowPartial:true}));
 assert.throws(()=>requireDailyCoverage(product,small),/da 6 a 9/u);
 const stale=structuredClone(small);stale.sources=stale.sources.map(s=>({...s,publishedAt:new Date(now.getTime()-25*3600000).toISOString()}));
 assert.throws(()=>requireFreshCandidates(stale,now,[],{allowPartial:true}),/nessuna fonte nuova/u);
});

test('the existing private GUI model gains recovery fields without replacing its cached model or unrelated fields',async()=>{
 const {execFileSync}=await import('node:child_process');
 const result=execFileSync(process.execPath,['--conditions=react-server','--import','tsx','--eval',`
 const assert=require('node:assert/strict'),mongoose=require('mongoose');
 const original=mongoose.model('TgRun',new mongoose.Schema({legacy:String}),'tg_runs');
 const {TgRunModel}=require('./src/models/tg/TgRun.ts');
 assert.equal(TgRunModel,original);assert.ok(original.schema.path('legacy'));
 assert.ok(original.schema.path('coverageRecovery'));assert.ok(original.schema.path('coverageRecoveryHistory'));
 process.stdout.write('existing-model-preserved');
 `],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'',ELEVENLABS_API_KEY:'',MONGODB_URI:''},timeout:15000});
 assert.equal(result,'existing-model-preserved');
});

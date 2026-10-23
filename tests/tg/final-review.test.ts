import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewFixture,scriptReviewFixture } from './fixtures';
import { finalReviewInputDigest, finalReviewIsBound, mediaCheckIssues, validateFinalReview } from '../../src/lib/tg/final-review-policy';
import { createAiApproval, approvalIsBound } from '../../src/lib/tg/review';
import { measurePcm, reviewSampleTimes } from '../../src/lib/tg/final-review-media';
import { produceTg } from '../../src/lib/tg/pipeline';
import { scriptDigest } from '../../src/lib/tg/editorial';
import { tgSpeechPlan } from '../../src/lib/tg/speech-plan';
import type { TgFinalReview, TgJob, TgManifest, TgState } from '../../src/lib/tg/types';
const now=new Date('2026-10-20T18:50:00Z');
const env={TG_IT_YOUTUBE_CHANNEL_ID:'fixture-channel'};
function automaticJob(){const job=reviewFixture(now);job.product={...job.product,automatic:true,publishTime:'19:15',platforms:['youtube']};job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);job.manifest={version:1,product:job.product,date:job.date,seconds:job.product.seconds,stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};return job;}
function finalReview(job:TgJob):TgFinalReview{return {version:1,checkedAt:now.toISOString(),inputSha256:finalReviewInputDigest(job),model:'fixture-reviewer',passed:true,
 checks:{visual:true,headlines:true,captions:true,emotion:true,publication:true},issues:[],summary:'Controllo sintetico dei fotogrammi campionati; audio misurato.',
 media:([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:job.product.seconds,rms:.1,peak:.8,clippedRatio:0,leadingSilence:.2,trailingSilence:2})),
 samples: ['landscape','portrait'].flatMap(format=>[1,90,177].map(at=>({format:format as 'landscape'|'portrait',at}))) };}
test('AI approval binds the actual report, media, destinations and schedule without human attestations',()=>{
 const job=automaticJob();job.finalReview=finalReview(job);const approval=createAiApproval(job,now,env),ready={...job,...approval,state:'ready' as const};
 assert.equal(approval.review.mode,'ai');assert.equal(approval.review.checks.facts,undefined);assert.equal(approval.publicationPlan.scheduledAt,'2026-10-20T19:15:00.000Z');
 assert.equal(approvalIsBound(ready,env,now),true);
 const changed=structuredClone(ready);changed.assets[0].sha256='c'.repeat(64);assert.equal(approvalIsBound(changed,env,now),false);
 assert.equal(approvalIsBound(ready,{TG_IT_YOUTUBE_CHANNEL_ID:'different'},now),false);
 const changedReport=structuredClone(ready);changedReport.finalReview!.checks.visual=false;assert.equal(approvalIsBound(changedReport,env,now),false);
});
test('failed, stale, altered or incomplete final evidence never approves; no destination or late release stops too',()=>{
 for(const mutation of [(j:TgJob)=>{j.finalReview!.passed=false;},(j:TgJob)=>{j.finalReview!.checkedAt='2026-10-19T00:00:00Z';},(j:TgJob)=>{j.finalReview!.samples=[];},(j:TgJob)=>{j.finalReview!.media[0].rms=0;},(j:TgJob)=>{j.script!.title='Changed';}]){
  const job=automaticJob();job.finalReview=finalReview(job);mutation(job);assert.throws(()=>createAiApproval(job,now,env));
 }
 const job=automaticJob();job.finalReview=finalReview(job);assert.throws(()=>createAiApproval(job,now,{}));assert.throws(()=>createAiApproval(job,new Date('2026-10-20T19:46:00Z'),env),/Finestra/);
 assert.equal(finalReviewIsBound({...job,finalReview:undefined},now),false);
});
test('local quality gate rejects silence, clipping, wrong dimensions and excessive tail silence',()=>{
 const report=finalReview(automaticJob());assert.deepEqual(mediaCheckIssues(report.media,180),[]);
 for(const update of [{rms:0},{clippedRatio:.5},{width:640},{seconds:179},{trailingSilence:12},{peak:NaN}]){const changed=structuredClone(report.media);Object.assign(changed[0],update);assert.ok(mediaCheckIssues(changed,180).length);}
 const silent=measurePcm(Buffer.alloc(32000));assert.equal(silent.rms,0);assert.equal(silent.leadingSilence,1);
 const tone=Buffer.alloc(32000);for(let i=0;i<16000;i++)tone.writeInt16LE(Math.round(Math.sin(i*.1)*10000),i*2);assert.ok(measurePcm(tone).rms>.2);
});
test('an inconclusive or malformed reviewer response fails closed',()=>{
 assert.throws(()=>validateFinalReview({passed:true,checks:{},issues:[],summary:'Ok'}));
 const raw={checks:{visual:true,headlines:true,captions:false,emotion:true,publication:true},issues:[],summary:'Sottotitoli da verificare'};
 assert.equal(validateFinalReview(raw).passed,false);assert.ok(validateFinalReview(raw).issues.length);
});
test('automatic production uses a separate final reviewer and stops on a negative verdict or missing port',async()=>{
 const old=process.env.TG_IT_YOUTUBE_CHANNEL_ID;process.env.TG_IT_YOUTUBE_CHANNEL_ID=env.TG_IT_YOUTUBE_CHANNEL_ID;
 try{for(const verdict of ['pass','fail','missing'] as const){
  const job=automaticJob(),states:TgState[]=[],saved:Partial<TgJob>[]=[];
  const manifest:TgManifest={version:1,product:job.product,date:job.date,seconds:180,speech:tgSpeechPlan(job.product),stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};
  job.manifest=manifest;job.state='queued';job.audit!.scriptSha256=scriptDigest(job.script!);
  await produceTg(job,'',{research:async()=>job.research!,write:async()=>job.script!,reviewScript:async()=>job.scriptReview!,audit:async()=>job.audit!,voice:async()=>manifest,render:async()=>job.assets,
   ...(verdict!=='missing'?{finalReview:async(candidate:TgJob)=>{const report=finalReview(candidate);if(verdict==='fail'){report.passed=false;report.checks.visual=false;report.issues=['Mano sovrapposta al volto'];}return report;}}:{}),now:()=>now,
   checkpoint:async(state,data)=>{states.push(state);saved.push(data);}});
  assert.ok(states.includes('reviewing'));assert.equal(states.at(-1),verdict==='pass'?'ready':'blocked');
  assert.equal(saved.at(-1)?.review?.mode,verdict==='pass'?'ai':undefined);assert.equal(states.includes('needs_review'),false);
  assert.ok(reviewSampleTimes(job).length>=3);
 }}finally{if(old===undefined)delete process.env.TG_IT_YOUTUBE_CHANNEL_ID;else process.env.TG_IT_YOUTUBE_CHANNEL_ID=old;}
});

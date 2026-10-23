import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewFinalVideo } from '../../src/lib/tg/final-review';
import { reviewFixture,scriptReviewFixture } from './fixtures';
import { finalReviewIsBound } from '../../src/lib/tg/final-review-policy';
import type { TgJob } from '../../src/lib/tg/types';
function fixture():TgJob{
 const job=reviewFixture();job.product.automatic=true;job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!);
 job.manifest={version:1,product:job.product,date:job.date,seconds:180,stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};return job;
}
const checked={media:([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:180,rms:.1,peak:.8,clippedRatio:0,leadingSilence:.2,trailingSilence:2})),frames:(['landscape','portrait'] as const).flatMap(format=>[1,90,177].map(at=>({format,at,data:'synthetic-jpeg-fixture'})))};
const verdict={checks:{visual:true,headlines:true,captions:true,emotion:true,publication:true},issues:[],summary:'Fotogrammi campionati leggibili nei due formati; audio misurato, non ascoltato.'};
async function withEnabled(work:()=>Promise<void>){
 const vars={TG_AUTOMATIC_REVIEW_ENABLED:'true',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-test-only'};
 const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
 try{await work();}finally{for(const k of Object.keys(vars)){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
}
test('final reviewer sees actual sampled formats and public copy; incomplete, oversized and refused outputs fail closed',async()=>withEnabled(async()=>{
 let calls=0;const job=fixture();
 const ports={inspect:async()=>checked,fetch:async(_input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  calls++;const request=JSON.parse(String(init?.body));assert.equal(request.store,false);assert.equal(request.max_output_tokens,3000);
  assert.equal(request.input[0].content.filter((p:{type:string})=>p.type==='input_image').length,6);
  assert.equal(request.text.format.strict,true);assert.equal(JSON.stringify(request).includes('remoteSession'),false);
  return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(verdict)}]}]});}};
 const report=await reviewFinalVideo(job,new AbortController().signal,ports);assert.equal(calls,1);assert.equal(finalReviewIsBound({...job,finalReview:report}),true);
 for(const payload of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'not-json'}]}]}])await assert.rejects(reviewFinalVideo(job,new AbortController().signal,{...ports,fetch:async()=>Response.json(payload)}));
 await assert.rejects(reviewFinalVideo(job,new AbortController().signal,{...ports,fetch:async()=>new Response('x'.repeat(256001))}),/troppo grande/);
}));
test('media failure and stale fact evidence stop before any provider request',async()=>withEnabled(async()=>{
 const job=fixture();let calls=0;const ports={inspect:async()=>{throw new Error('Video silent');},fetch:async()=>{calls++;return Response.json({});}};
 await assert.rejects(reviewFinalVideo(job,new AbortController().signal,ports),/silent/);assert.equal(calls,0);
 job.audit!.checkedAt=new Date(Date.now()-7*3600000).toISOString();await assert.rejects(reviewFinalVideo(job,new AbortController().signal,ports),/aggiornata/);assert.equal(calls,0);
}));

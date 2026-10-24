import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scriptReviewFixture} from './fixtures';
import {editorialFixture} from './editorial-fixture';
import {produceTg,type TgProductionPorts} from '../../src/lib/tg/pipeline';
import {approvalIsBound,createAiApproval} from '../../src/lib/tg/review';
import {parseProduct} from '../../src/lib/tg/config';
import {readinessWithRuntime} from '../../src/lib/tg/runtime-readiness';
import type {TgJob,TgState} from '../../src/lib/tg/types';

const now=new Date('2026-10-24T06:40:00Z');

function ports(job:TgJob,states:TgState[],exported:TgJob[]):TgProductionPorts{
  return {research:async()=>{assert.fail('No new research');},write:async()=>{assert.fail('No rewrite');},audit:async()=>job.audit!,reviewScript:async()=>job.scriptReview!,
    voiceConfigurationSha256:()=>{assert.fail('No voice configuration needed');},voice:async()=>{assert.fail('No speech calls');},render:async()=>{assert.fail('No render');},finalReview:async()=>{assert.fail('No media reviewer');},
    editorialReady:async j=>{exported.push(j);},checkpoint:async(s)=>{states.push(s);},now:()=>now};
}
for(const mode of ['product','runtime'] as const)test(`editorial commissioning exports the exact A/B-verified pack without any media port: ${mode}`,async()=>{
  const job=editorialFixture(now),states:TgState[]=[],exported:TgJob[]=[];
  if(mode==='runtime'){delete job.product.productionMode;job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);}
  await produceTg(job,'',{...ports(job,states,exported),editorialOnly:mode==='runtime'});
  assert.equal(states.at(-1),'editorial_ready');assert.equal(exported.length,1);
  assert.deepEqual(exported[0].script,job.script);assert.equal(exported[0].approvedAt,undefined);assert.equal(exported[0].publicationPlan,undefined);
  assert.deepEqual(exported[0].assets,[]);assert.equal(exported[0].manifest,undefined);
});
test('failed second review remains blocked and cannot export a verified pack',async()=>{
  const job=editorialFixture(now),states:TgState[]=[],exported:TgJob[]=[];
  job.scriptReview!.passed=false;job.scriptReview!.issues=['Un passaggio della sintesi non è sostenuto dalle fonti'];job.editorialRepairs=1;
  await produceTg(job,'',ports(job,states,exported));
  assert.equal(states.at(-1),'blocked');assert.equal(exported.length,0);
});
test('export failure never creates an editorial-ready checkpoint',async()=>{
  const job=editorialFixture(now),states:TgState[]=[];
  await assert.rejects(produceTg(job,'',{...ports(job,states,[]),editorialReady:async()=>{throw Error('Disk full fixture');}}),/Disk full/);
  assert.equal(states.includes('editorial_ready'),false);
});
test('editorial mode cannot inherit a forged media approval or become publication-ready',()=>{
  const job=editorialFixture(now);job.state='ready';job.approvedAt=now.toISOString();
  assert.equal(approvalIsBound(job),false);assert.throws(()=>createAiApproval(job,now));
  assert.equal(parseProduct(job.product).productionMode,'editorial');
  assert.throws(()=>parseProduct({...job.product,productionMode:'invented'}));
  const runtime={worker:{online:false},controller:{online:true}};
  const before=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-test';
  try{
    const r=readinessWithRuntime(job.product,runtime);assert.equal(r.editorialReady,true);assert.equal(r.productionReady,false);assert.equal(r.mediaDeferred,true);
    assert.equal(readinessWithRuntime(job.product,{...runtime,controller:{online:false}}).editorialReady,false);
  }finally{if(before===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=before;}
});

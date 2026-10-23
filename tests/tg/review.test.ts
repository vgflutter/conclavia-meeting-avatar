import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshnessFixture } from './freshness-fixture';
import { auditIsCurrent, approvalIsBound, createEditorialApproval, parsePublicationPlan } from '../../src/lib/tg/review';
import { publicationCopy } from '../../src/lib/tg/presentation';
import { scriptDigest } from '../../src/lib/tg/editorial';
import { approvedFixture, scriptReviewFixture,approvalInput, reviewFixture } from './fixtures';
const now=new Date('2026-10-18T12:00:00Z'),env={TG_IT_YOUTUBE_CHANNEL_ID:'fixture-channel'};
test('approval requires every editorial check and a named reviewer, even after previous approvals',()=>{
  const job=reviewFixture(now),input=approvalInput(now);
  assert.throws(()=>createEditorialApproval(job,{...input,checks:{}},now,env),/controlli/);
  assert.throws(()=>createEditorialApproval(job,{...input,reviewer:''},now,env),/revisore/);
  assert.throws(()=>createEditorialApproval({...job,state:'ready'},input,now,env));
  const approval=createEditorialApproval(job,input,now,env);assert.equal(approval.review.decision,'approved');
});
test('review binds the exact script, public copy, source ledger, assets, channels, destination and time',()=>{
  const job=approvedFixture(now,env);assert.equal(approvalIsBound(job,env),true);
  for(const mutate of [(j:typeof job)=>{j.script!.sentences[0].text='Changed';},(j:typeof job)=>{j.assets[0].sha256='c'.repeat(64);},(j:typeof job)=>{j.publicationPlan!.scheduledAt='2026-10-18T13:00:00Z';},(j:typeof job)=>{j.research!.sources[0].evidence='Changed evidence';},(j:typeof job)=>{j.review.checks.facts=false;},(j:typeof job)=>{j.audit!.freshness!.checks[0].development='Il resoconto del nuovo fatto è cambiato.';}]){
    const copy=structuredClone(job);mutate(copy);assert.equal(approvalIsBound(copy,env),false);
  }
  assert.equal(approvalIsBound(job,{TG_IT_YOUTUBE_CHANNEL_ID:'another-project'}),false);
  assert.equal(approvalIsBound({...job,review:undefined},env),false);
});
test('a stale, failed, mismatched or future audit cannot authorize publication',()=>{
  const job=reviewFixture(now);assert.equal(auditIsCurrent(job,now),true);
  for(const update of [{passed:false},{checkedAt:'2026-10-18T05:00:00Z'},{checkedAt:'2026-10-18T13:00:00Z'},{scriptSha256:'wrong'}])assert.equal(auditIsCurrent({...job,audit:{...job.audit!,...update}},now),false);
});
test('five-minute approval cannot bypass complete five-story coverage even with a matching positive audit',()=>{
  const job=reviewFixture(now);job.product.seconds=300;
  job.research!.stories=Array.from({length:5},(_,i)=>({id:`story-${i}`,headline:`Notizia ${i}`,category:'society',importance:80-i,changedSinceYesterday:'Novità di prova.',whyItMatters:'Contesto di prova.',uncertainty:'',sourceIds:['source-0','source-3'],facts:[{text:'Fatto di prova.',sourceIds:['source-0','source-3']}]}));
  job.script!.sentences.forEach((line,i)=>{line.storyId=`story-${i%5}`;});
  job.audit!.scriptSha256=scriptDigest(job.script!);
  job.audit!.freshness=freshnessFixture(job.research!,job.script!,now);
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  assert.equal(auditIsCurrent(job,now),true);
  for(const line of job.script!.sentences)if(line.storyId==='story-4')line.storyId='story-2';
  job.audit!.scriptSha256=scriptDigest(job.script!);
  assert.equal(auditIsCurrent(job,now),false);
  assert.throws(()=>createEditorialApproval(job,approvalInput(now),now,env),/verifica attuale/);
});
test('approval rejects missing captions, wrong runtime and an unconfigured destination',()=>{
  const job=reviewFixture(now),input=approvalInput(now);
  assert.throws(()=>createEditorialApproval({...job,assets:job.assets.filter(a=>a.name!=='captions.vtt')},input,now,env),/incompleto/);
  const copy=structuredClone(job);copy.assets[0].duration=179;assert.throws(()=>createEditorialApproval(copy,input,now,env),/Durata/);
  assert.throws(()=>createEditorialApproval(job,input,now,{}),/destinazione/);
});
test('publication plan cannot silently add channels, move to another day or outlive the audit',()=>{
  const job=reviewFixture(now);job.product.platforms=['youtube'];
  for(const plan of [{platforms:['youtube','instagram'],scheduledAt:now.toISOString()},{platforms:['youtube'],scheduledAt:'2026-10-19T12:00:00Z'},{platforms:['youtube'],scheduledAt:'2026-10-18T18:00:00Z'},{platforms:['youtube','youtube'],scheduledAt:now.toISOString()}])assert.throws(()=>parsePublicationPlan(plan,job,now));
});
test('social copy declares the real AI workflow, credits only spoken evidence and never cuts factual sentences',()=>{
  const job=reviewFixture(now);job.research!.sources.push({...job.research!.sources[0],id:'irrelevant',url:'https://www.ansa.it/irrelevant'});
  let copy=publicationCopy(job,'instagram');assert.match(copy.description,/ricerca, stesura/);assert.doesNotMatch(copy.description,/irrelevant/);
  job.script!.description='An entire long paragraph. '.repeat(200);copy=publicationCopy(job,'instagram');assert.ok(copy.description.length<=2200);assert.doesNotMatch(copy.description,/long paragraph/);assert.match(copy.description,/Fonti:/);
  job.script!.title='a'.repeat(110);assert.ok(publicationCopy(job,'youtube').title.length<=100);
});

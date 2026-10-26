import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evidenceLookupKey,evidenceMemo,verificationEvidenceIsCurrent,type TgEvidenceStory} from '../../src/lib/tg/evidence-cache';
import {retrieveAuditEvidence} from '../../src/lib/tg/agents';
import {editorialFixture} from './editorial-fixture';
const now=new Date('2026-10-25T08:01:00Z');
const input={model:'fixture-model',policy:'policy-v1',domains:['rainews.it','ansa.it'],query:'Exact claims for story one'};
test('evidence reuse expires within thirty minutes and is bound to claims, model, policy and source domains',()=>{
 const key=evidenceLookupKey(input,now);
 assert.equal(key,evidenceLookupKey(input,new Date('2026-10-25T08:29:59Z')));
 for(const date of ['2026-10-25T08:30:00Z','2026-10-26T08:01:00Z'])assert.notEqual(key,evidenceLookupKey(input,new Date(date)));
 for(const change of [{query:'Changed claim'},{model:'another-model'},{policy:'policy-v2'},{domains:['another.example']}])assert.notEqual(key,evidenceLookupKey({...input,...change},now));
 assert.equal(key,evidenceLookupKey({...input,domains:[...input.domains].reverse()},now));
});
test('concurrent lookups share the original result and an unsuccessful request is not blindly repeated',async()=>{
 const lookup=evidenceMemo();let calls=0;
 const value:TgEvidenceStory={storyId:'one',brief:'Retrieved evidence',sources:[],retrievedAt:now.toISOString()};
 const generate=async()=>{calls++;return value;};
 const results=await Promise.all([lookup('one',generate),lookup('one',generate)]);
 assert.equal(calls,1);assert.equal(results[0],value);assert.equal(results[1],value);
 const fail=async()=>{calls++;throw Error('Known test interruption');};
 await assert.rejects(lookup('two',fail));await assert.rejects(lookup('two',fail));assert.equal(calls,2);
});
test('the retrieval adapter searches only the changed story and never returns another story ID',async t=>{
 t.mock.timers.enable({apis:['Date'],now:now.getTime()});
 const saved={TG_AI_ENABLED:process.env.TG_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 process.env.TG_AI_ENABLED='true';process.env.OPENAI_API_KEY='synthetic-regression-key';
 const j=editorialFixture(now),lookup=evidenceMemo();let calls=0;
 t.mock.method(globalThis,'fetch',async (url:Parameters<typeof fetch>[0])=>{
  assert.equal(String(url),'https://api.openai.com/v1/responses');calls++;
  return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[{url:'https://www.ansa.it/fixture',title:'Actual mocked retrieval'}]}},{type:'message',content:[{type:'output_text',text:'Evidence retrieved by the mocked provider.'}]}]});
 });
 try{
  const first=await retrieveAuditEvidence(j.research!,j.script!,new AbortController().signal,lookup);
  assert.equal(calls,5);assert.deepEqual(first.data.map(d=>d.storyId),j.research!.stories.map(s=>s.id));
  await retrieveAuditEvidence(j.research!,j.script!,new AbortController().signal,lookup);assert.equal(calls,5);
  const revised=structuredClone(j.script!);revised.sentences.find(s=>s.storyId==='story-1')!.text+=' A revised factual claim.';
  await retrieveAuditEvidence(j.research!,revised,new AbortController().signal,lookup);assert.equal(calls,6);
  t.mock.timers.tick(30*60000);
  await retrieveAuditEvidence(j.research!,revised,new AbortController().signal,lookup);assert.equal(calls,11);
 }finally{for(const k of Object.keys(saved) as (keyof typeof saved)[]){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});

test('verification searches bypass a warm research cache and bind fresh receipts to the exact script',async t=>{
 t.mock.timers.enable({apis:['Date'],now:now.getTime()});
 const env={TG_AI_ENABLED:process.env.TG_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 Object.assign(process.env,{TG_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-regression-key'});
 const j=editorialFixture(now),lookup=evidenceMemo();let calls=0;
 t.mock.method(globalThis,'fetch',async(_u:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  calls++;const request=JSON.parse(String(init?.body));
  assert.match(request.input,/LATEST available authoritative updates/);
  return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[{url:'https://www.ansa.it/current',title:'Fresh test lookup'}]}},{type:'message',content:[{type:'output_text',text:'The newest original bulletin supersedes earlier projections.'}]}]});
 });
 try{
  await retrieveAuditEvidence(j.research!,j.script!,new AbortController().signal,lookup);assert.equal(calls,5);
  const fresh=await retrieveAuditEvidence(j.research!,j.script!,new AbortController().signal,lookup,'verification');assert.equal(calls,10);
  assert.ok(verificationEvidenceIsCurrent(fresh,j.research!,j.script!,now));
  await retrieveAuditEvidence(j.research!,j.script!,new AbortController().signal,lookup,'verification');assert.equal(calls,15);
  assert.equal(verificationEvidenceIsCurrent(fresh,j.research!,{...j.script!,description:'Changed summary'},now),false);
  assert.equal(verificationEvidenceIsCurrent(fresh,j.research!,j.script!,new Date(now.getTime()+6*60000)),false);
 }finally{for(const k of Object.keys(env) as (keyof typeof env)[]){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}
});

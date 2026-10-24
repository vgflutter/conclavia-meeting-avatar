import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeEdition } from '../../src/lib/tg/agents';
import { reviewFixture } from './fixtures';
import { auditTargets } from '../../src/lib/tg/editorial';
const now=new Date('2026-10-21T16:00:00Z');
test('the actual audit adapter requests independent freshness, preserves negative verdicts and checks every public claim only after passing',async t=>{
 const saved={PODCAST_AI_ENABLED:process.env.PODCAST_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 process.env.PODCAST_AI_ENABLED='true';process.env.OPENAI_API_KEY='synthetic-test-only';
 const job=reviewFixture(now),r=job.research!,s=job.script!,checks=Object.fromEntries(job.audit!.freshness!.checks.map(({storyId,...c})=>[storyId,c]));
 const webByStory=Object.fromEntries(r.stories.map(story=>[story.id,r.sources.filter(source=>story.sourceIds.includes(source.id)).map(source=>source.url)]));
 let duplicate=false,calls=0,claimCalls=0;
 t.mock.method(globalThis,'fetch',async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  assert.equal(String(input),'https://api.openai.com/v1/responses');calls++;
  const request=JSON.parse(String(init?.body));assert.equal(request.store,false);
  let data:unknown;
  if(request.text.format.name==='tg_freshness_audit'){
   assert.match(request.instructions,/independent freshness/);assert.match(request.input,/actual published editions/);
   assert.match(request.input,/OUR CONFIRMED PUBLISHED ARCHIVE/);
   const firstStory=request.text.format.schema.properties.checks.properties[r.stories[0].id].properties;
   assert.equal(firstStory.status.enum.includes('update'),false);
   assert.equal(firstStory.previousStoryKeys.maxItems,0);
   data={checks:structuredClone(checks)};
   if(duplicate)(data as {checks:typeof checks}).checks['story-0']={...checks['story-0'],status:'duplicate',evidence:'Lo stesso fatto era già stato raccontato nella puntata precedente.'};
  } else {
   assert.equal(request.text.format.name,'tg_independent_audit');claimCalls++;
   data={issues:[],checks:Object.fromEntries(Object.keys(request.text.format.schema.properties.checks.properties).map(key=>{const storyId=key.startsWith('sentence_')?s.sentences[Number(key.slice(9))].storyId:r.stories[0].id;return [key,{status:'supported',evidence:'Il dettaglio è esplicitamente sostenuto dalle fonti sintetiche.',sourceUrls:[webByStory[storyId]?.[0]??r.sources[0].url]}];}))};
  }
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
 });
 try{
  const searched={data:'Brief di ricerca sintetico',sources:r.sources.map(source=>({url:source.url,title:source.title})),webByStory};
  const approved=await judgeEdition(job.product,r,s,searched,new AbortController().signal,[],now);
  assert.equal(approved.passed,true);assert.equal(approved.freshness?.passed,true);assert.equal(approved.checks?.length,auditTargets(s).length);assert.ok(claimCalls>0);
  duplicate=true;calls=0;claimCalls=0;
  const rejected=await judgeEdition(job.product,r,s,searched,new AbortController().signal,[],now);
  assert.equal(rejected.passed,false);assert.equal(rejected.freshness?.passed,false);assert.equal(rejected.checkedFacts,0);assert.equal(calls,1);assert.equal(claimCalls,0);
 }finally{for(const key of Object.keys(saved) as (keyof typeof saved)[]){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

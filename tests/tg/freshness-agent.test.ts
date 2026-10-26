import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeEdition } from '../../src/lib/tg/agents';
import { reviewFixture } from './fixtures';
import { scriptDigest, auditTargets } from '../../src/lib/tg/editorial';
import { researchDigest, DAILY_TIMELINE_POLICY } from '../../src/lib/tg/freshness';
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
   assert.ok(request.instructions.includes(DAILY_TIMELINE_POLICY));
   assert.match(request.input,/do not block for missing clock precision/);
   assert.match(request.input,/announcement within the window/);
   assert.match(request.input,/2026-10-20T16:00:00.000Z through 2026-10-21T16:00:00.000Z/);
   assert.match(request.input,/NO completed-action requirement/);assert.match(request.input,/official URL retrieved later may still lag/);
   assert.equal(request.reasoning.effort,'medium');assert.equal(request.text.verbosity,'low');
   assert.doesNotMatch(request.input,/first public disclosure now|If day-only dating cannot establish/);
   assert.match(request.input,/OUR CONFIRMED PUBLISHED ARCHIVE/);
   const firstStory=request.text.format.schema.properties.checks.properties[r.stories[0].id].properties;
   assert.equal(firstStory.status.enum.includes('update'),false);
   assert.equal(firstStory.previousStoryKeys.maxItems,0);
   data={checks:structuredClone(checks)};
   if(duplicate)(data as {checks:typeof checks}).checks['story-0']={...checks['story-0'],status:'duplicate',evidence:'Lo stesso fatto era già stato raccontato nella puntata precedente.'};
  } else {
   assert.equal(request.text.format.name,'tg_independent_audit');claimCalls++;
   assert.ok(request.instructions.includes(DAILY_TIMELINE_POLICY));
   data={issues:[],checks:Object.fromEntries(Object.keys(request.text.format.schema.properties.checks.properties).map(key=>{const storyId=key.startsWith('sentence_')?s.sentences[Number(key.slice(9))].storyId:r.stories[0].id;return [key,{status:'supported',evidence:'Il dettaglio è esplicitamente sostenuto dalle fonti sintetiche.',sourceUrls:[webByStory[storyId]?.[0]??r.sources[0].url]}];}))};
  }
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
 });
 try{
  const searched={verification:{version:1 as const,checkedAt:now.toISOString(),researchSha256:researchDigest(r),scriptSha256:scriptDigest(s)},data:r.stories.map(story=>({storyId:story.id,retrievedAt:now.toISOString(),brief:'Brief di ricerca sintetico',sources:r.sources.filter(source=>story.sourceIds.includes(source.id)).map(source=>({url:source.url,title:source.title}))})),sources:r.sources.map(source=>({url:source.url,title:source.title})),webByStory};
  const approved=await judgeEdition(job.product,r,s,searched,new AbortController().signal,[],now);
  assert.equal(approved.passed,true);assert.equal(approved.freshness?.passed,true);assert.equal(approved.checks?.length,auditTargets(s).length);assert.ok(claimCalls>0);
  duplicate=true;calls=0;claimCalls=0;
  const rejected=await judgeEdition(job.product,r,s,searched,new AbortController().signal,[],now);
  assert.equal(rejected.passed,false);assert.equal(rejected.freshness?.passed,false);assert.equal(rejected.checkedFacts,0);assert.equal(calls,1);assert.equal(claimCalls,0);
 }finally{for(const key of Object.keys(saved) as (keyof typeof saved)[]){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

test('A refreshes untagged research evidence and rejects a once-correct projection superseded by a new official count',async t=>{
 t.mock.timers.enable({apis:['Date'],now:now.getTime()});
 const saved={TG_AI_ENABLED:process.env.TG_AI_ENABLED,PODCAST_AI_ENABLED:process.env.PODCAST_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 Object.assign(process.env,{TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-test-only'});
 const job=reviewFixture(now),r=job.research!,s=job.script!;let searches=0,judgements=0;
 const source='https://www.ansa.it/fresh-official-count';
 t.mock.method(globalThis,'fetch',async(_input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  const request=JSON.parse(String(init?.body));
  if(request.text?.format?.name==='tg_freshness_audit'){
   judgements++;assert.match(request.input,/new official count is 61/);assert.doesNotMatch(request.input,/OLD_CACHE_ONLY/);
   const checks=Object.fromEntries(job.audit!.freshness!.checks.map(({storyId,...c})=>[storyId,{...c,webUrls:[source],latest:{status:'current',evidence:'The freshly consulted bulletin confirms the current script.',webUrls:[source],supersededText:'',replacementText:''}}]));
   checks[r.stories[0].id].latest={status:'superseded',evidence:'The new official count supersedes the earlier provisional projection.',webUrls:[source],supersededText:'The projection is 58.',replacementText:'The new official count is 61.'};
   return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({checks})}]}]});
  }
  assert.equal(request.text?.format?.name,undefined,'No claim audit may follow a freshness rejection');
  searches++;assert.match(request.input,/LATEST available authoritative updates/);
  return Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[{url:source,title:'New official count'},{url:'https://www.rainews.it/new-count',title:'Independent current confirmation'}]}},{type:'message',content:[{type:'output_text',text:'The new official count is 61, superseding the earlier projection of 58.'}]}]});
 });
 try{
  const result=await judgeEdition(job.product,r,s,{data:[{brief:'OLD_CACHE_ONLY'}],sources:[{url:'https://www.ansa.it/old',title:'Old projection'}]},new AbortController().signal,[],now);
  assert.equal(searches,r.stories.length);assert.equal(judgements,1);assert.equal(result.passed,false);assert.equal(result.checkedFacts,0);
  assert.equal(result.freshness?.checks[0].latest?.status,'superseded');assert.match(result.issues.join(' '),/superseded/);
 }finally{for(const key of Object.keys(saved) as (keyof typeof saved)[]){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

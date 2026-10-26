import test from 'node:test';
import assert from 'node:assert/strict';
import {writeEdition} from '../../src/lib/tg/agents';
import {editorialFixture} from './editorial-fixture';
import {dailyClosing,dailyGreeting,scriptSchema,validateScript} from '../../src/lib/tg/editorial';
import {scoredNarration} from '../../src/lib/tg/script-review';
import {writingEvidence,DAILY_CONTEXT_POLICY} from '../../src/lib/tg/narrative-policy';
import {dailyScriptDepthIssues} from '../../src/lib/tg/script-depth';
import {tgSpeechPassages} from '../../src/lib/tg/speech-plan';

// Provider fixtures verify transport/score/provenance only, never pretend to
// establish narrative quality. The dated live comparison is documented separately.
test('writer keeps grouped generation, flat public score, continuous speech, sources and app-owned bookends',async t=>{
 const now=new Date('2026-10-26T07:00:00Z'),job=editorialFixture(now);
 const body=job.script!.sentences.filter(s=>!['intro','outro'].includes(s.storyId));
 body[0]={...body[0],mood:'curiosity',intensity:.68,intent:'question'};
 body[1]={...body[1],mood:'surprise',intensity:.63,intent:'explain'};
 const raw={title:job.script!.title,description:job.script!.description,
  sentences:Object.fromEntries(job.research!.stories.map(s=>[s.id,body.filter(l=>l.storyId===s.id)])),
  cards:Object.fromEntries(job.research!.stories.map(s=>[s.id,{context:'Una scheda completa per la prova tecnica.',change:''}])),
  headlines:Object.fromEntries(job.research!.stories.map(s=>[s.id,s.headline]))};
 let invalid=false,calls=0;
 const original={TG_AI_ENABLED:process.env.TG_AI_ENABLED,PODCAST_AI_ENABLED:process.env.PODCAST_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 Object.assign(process.env,{TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-test-only'});
 t.mock.method(globalThis,'fetch',async(_url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  calls++;const request=JSON.parse(String(init?.body));
  assert.equal(request.text.format.name,'tg_script');assert.equal(request.store,false);
  assert.equal(request.reasoning.effort,'medium');assert.equal(request.text.verbosity,'medium');
  assert.ok(request.instructions.includes(DAILY_CONTEXT_POLICY));
  const payload=JSON.parse(request.input.split('<untrusted_evidence>')[1].split('</untrusted_evidence>')[0]);
  assert.deepEqual(payload,writingEvidence(job.research!));
  const schema=request.text.format.schema;
  assert.equal(schema.properties.sentences.type,'object');
  assert.deepEqual(schema.properties.sentences.required,job.research!.stories.map(s=>s.id));
  for(const entry of Object.values(schema.properties.sentences.properties) as {items:{required:string[]}}[])
   assert.deepEqual(entry.items.required,['text','mood','intensity','intent','speaker','storyId','sourceIds']);
  const response=structuredClone(raw);
  if(invalid)response.sentences[job.research!.stories[0].id][0].sourceIds=['unregistered'];
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(response)}]}]});
 });
 try{
  const result=await writeEdition(job.product,job.research!,new AbortController().signal,undefined,job.date);
  assert.deepEqual(result.sentences.filter(s=>!['intro','outro'].includes(s.storyId)),body);
  assert.deepEqual(result.sentences.slice(1,3).map(s=>[s.mood,s.intensity]),[['curiosity',.68],['surprise',.63]],'editing policy never normalizes lively score values automatically');
  assert.equal(result.sentences[0].text,dailyGreeting('it',job.date,'reviewed'));
  assert.deepEqual(result.sentences.filter(s=>s.storyId==='outro'),dailyClosing('it','reviewed'));
  assert.equal(result.sentences.filter(s=>s.storyId==='outro'&&s.intent==='point-down').length,1);
  assert.deepEqual(scoredNarration(result).sentences,result.sentences);
  const passages=tgSpeechPassages(body);
  assert.deepEqual(passages.flat(),body);
  assert.ok(passages.some(p=>p.length>1),'adjacent semantic clauses stay connected within the existing speech limits');
  assert.ok(passages.every(p=>p.every(s=>s.storyId===p[0].storyId&&s.speaker===p[0].speaker)));
  invalid=true;
  await assert.rejects(writeEdition(job.product,job.research!,new AbortController().signal,undefined,job.date),/attribuita/);
  assert.equal(calls,2);
 }finally{
  for(const k of Object.keys(original) as (keyof typeof original)[]){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
 }
});


test('selection rationale is not spoken evidence; facts, qualifications, dates and complete reviewer research survive',()=>{
 const research=editorialFixture(new Date('2026-10-26T07:00:00Z')).research!;
 const original=structuredClone(research);
 const payload=writingEvidence(research);
 assert.deepEqual(research,original,'projection never modifies the research seen by A/B');
 assert.deepEqual(payload.sources,research.sources);
 for(const [i,story]of payload.stories.entries()){
  assert.equal('whyItMatters' in story,false);
  assert.deepEqual(story.facts,research.stories[i].facts);
  assert.deepEqual(story.sourceIds,research.stories[i].sourceIds);
  assert.equal(story.uncertainty,research.stories[i].uncertainty);
  assert.equal(story.changedSinceYesterday,research.stories[i].changedSinceYesterday);
 }
});


test('private generation allows meaning-led segment counts while public coverage and word depth remain enforced',()=>{
 const job=editorialFixture(new Date('2026-10-26T07:00:00Z'));
 const schema=scriptSchema(job.product,job.research!);
 const stories=(schema.properties.sentences as {properties:Record<string,{minItems:number;maxItems:number;items:{properties:{text:{minLength:number;maxLength:number}}}} >}).properties;
 assert.ok(Object.values(stories).reduce((n,s)=>n+s.maxItems,5)<=70);
 for(const entry of Object.values(stories)){
  assert.equal(entry.minItems,1);
  assert.deepEqual(entry.items.properties.text,{type:'string',minLength:5,maxLength:450});
 }
 // Move a meaningful clause boundary, without changing the narration/facts.
 const source=job.script!.sentences.find(s=>s.storyId===job.research!.stories[0].id)!;
 const cut=source.text.indexOf(' Il contesto');
 const index=job.script!.sentences.indexOf(source);
 const changed={...job.script!,sentences:[...job.script!.sentences.slice(0,index),{...source,text:source.text.slice(0,cut)},{...source,text:source.text.slice(cut+1)},...job.script!.sentences.slice(index+1)]};
 assert.doesNotThrow(()=>validateScript(changed,job.product,job.research!));
 assert.deepEqual(dailyScriptDepthIssues(job.product,changed),[]);
 const missing={...changed,sentences:changed.sentences.filter(s=>s.storyId!==source.storyId)};
 assert.throws(()=>validateScript(missing,job.product,job.research!),/copertura|notizie|copione/i);
 const compressed={...changed,sentences:changed.sentences.map(s=>({...s,text:'Un fatto breve.'}))};
 assert.ok(dailyScriptDepthIssues(job.product,compressed).length>0);
});

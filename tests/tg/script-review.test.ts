import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewFixture,scriptReviewFixture,qualityFixture} from './fixtures';
import {compileEditorialPassage,scoredNarration,scriptReviewIsCurrent,validateScriptReview,SCRIPT_REVIEW_CHECKS} from '../../src/lib/tg/script-review';
import {dailyGreeting,withDailyGreeting,scriptDigest} from '../../src/lib/tg/editorial';
import {produceTg,type TgProductionPorts} from '../../src/lib/tg/pipeline';
import {freshnessFixture} from './freshness-fixture';
import {tgSpeechPlan} from '../../src/lib/tg/speech-plan';
import {reviewEditionScript} from '../../src/lib/tg/agents';
import {DAILY_TIMELINE_POLICY} from '../../src/lib/tg/freshness';
import {DAILY_NARRATIVE_POLICY,DAILY_NARRATIVE_REVIEW,DAILY_REVIEW_GENERATION,DAILY_CONTEXT_POLICY} from '../../src/lib/tg/narrative-policy';
import type {TgJob,TgManifest,TgScript} from '../../src/lib/tg/types';

const now=new Date('2026-10-24T07:00:00Z');
const judgement=(script:TgScript)=>({issues:[],quality:qualityFixture(),checks:Object.fromEntries(SCRIPT_REVIEW_CHECKS.map(k=>[k,true])),clauses:Object.fromEntries(script.sentences.map((_,i)=>[`sentence_${i}`,{content:true,form:true,delivery:true,reason:'Frase verificata nel contesto sintetico del test.'}]))});
test('the edition date is spoken in its language and never follows render time; dated greeting rewrites stay singular',()=>{
 assert.equal(dailyGreeting('it','2026-10-24'),'Ciao, questo è Conclavia Daily. Oggi è il ventiquattro ottobre.');
 assert.equal(dailyGreeting('en','2026-10-24'),'Hi, this is Conclavia Daily. Today is October 24.');
 assert.match(dailyGreeting('it','2026-11-01'),/il primo novembre/);
 for(const date of ['2026-02-30','2026-13-01','24/10/2026'])assert.throws(()=>dailyGreeting('it',date));
 const s=reviewFixture(now).script!,old=withDailyGreeting(s,'it','2026-10-23'),next=withDailyGreeting(old,'it','2026-10-24');
 assert.equal(next.sentences.length,s.sentences.length+1);assert.deepEqual(withDailyGreeting(next,'it','2026-10-24'),next);
 assert.deepEqual(next.sentences.slice(1),s.sentences);
});
test('notation compiles to the same ordered spoken clauses and expression fields, without speaking markup',()=>{
 const clauses=compileEditorialPassage('<mood:curiosity intensity="0.6" intent="explain">Il risultato è interessante,</mood>\n<mood:doubt intensity="0.4" intent="reflect">ma servono ulteriori verifiche.</mood>',{storyId:'example',speaker:0,sourceIds:['source']});
 assert.deepEqual(clauses.map(c=>c.mood),['curiosity','doubt']);
 const s={title:'Test',description:'Test',sentences:clauses},score=scoredNarration(s);
 assert.equal(score.narrationText,'Il risultato è interessante, ma servono ulteriori verifiche.');
 assert.deepEqual(score.sentences,clauses);assert.ok(!score.narrationText.includes('<mood'));
 assert.throws(()=>scoredNarration({...s,sentences:[{...clauses[0],text:'<mood:fun>Non leggere i marcatori.</mood>'}]}));
});
test('editor B must cover every clause and global criterion; approval binds text, acting, date and source evidence',()=>{
 const j=reviewFixture(now),base=judgement(j.script!);
 assert.ok(scriptReviewIsCurrent(j,now));
 const missing=structuredClone(base);delete missing.clauses.sentence_2;
 assert.throws(()=>validateScriptReview(missing,j.product,j.date,j.research!,j.script!,'fixture',now),/incompleta/);
 const negative=structuredClone(base);negative.clauses.sentence_2.delivery=false;
 assert.equal(validateScriptReview(negative,j.product,j.date,j.research!,j.script!,'fixture',now).passed,false);
 for(const mutate of [(j:TgJob)=>{j.script!.sentences[0].text+=' Nuova affermazione.';},(j:TgJob)=>{j.script!.sentences[0].mood='amusement';},(j:TgJob)=>{j.script!.sentences[0].intent='reassure';},(j:TgJob)=>{j.date='2026-10-25';},(j:TgJob)=>{j.research!.sources[0].evidence='Prova modificata.';},(j:TgJob)=>{j.scriptReview!.scoreMarkup+=' extra';},(j:TgJob)=>{j.scriptReview!.narrationText+=' extra';}]){
  const changed=structuredClone(j);mutate(changed);assert.equal(scriptReviewIsCurrent(changed,now),false);
 }
 assert.equal(scriptReviewIsCurrent({...j,scriptReview:undefined},now),false);
 assert.equal(scriptReviewIsCurrent(j,new Date(now.getTime()+6*3600000)),false);
});
function harness(){
 const j=reviewFixture(now);j.state='queued';delete j.audit;delete j.scriptReview;
 const calls:string[]=[],saved:Partial<TgJob>[]=[];
 const manifest=(s:TgScript):TgManifest=>({version:1,product:j.product,date:j.date,seconds:j.product.seconds,speech:tgSpeechPlan(j.product),stories:[],sources:j.research!.sources,cues:s.sentences.map((c,i)=>({...c,start:i*10,end:i*10+8}))});
 const ports:TgProductionPorts={now:()=>now,research:async()=>j.research!,write:async()=>{calls.push('write');return j.script!;},audit:async(r,s)=>{calls.push('A');return {...reviewFixture(now).audit!,scriptSha256:scriptDigest(s),freshness:freshnessFixture(r,s,now)};},reviewScript:async(r,s)=>{calls.push('B');return scriptReviewFixture(j.product,j.date,r,s,now);},voice:async(_r,s)=>{calls.push('voice');return manifest(s);},render:async()=>{calls.push('render');return j.assets;},checkpoint:async(_state,data)=>{saved.push(data);}};
 return {j,ports,calls,saved,manifest};
}
test('both independent verdicts precede voice and rendering, including resumed jobs with a media master',async()=>{
 const h=harness();await produceTg(h.j,'[]',h.ports);assert.deepEqual(h.calls,['A','B','voice','render']);
 const resumed=harness();resumed.j.manifest=resumed.manifest(resumed.j.script!);
 await produceTg(resumed.j,'[]',resumed.ports);assert.deepEqual(resumed.calls,['A','B','render']);
 const absent=harness();const {reviewScript:unused,...ports}=absent.ports;void unused;
 await produceTg(absent.j,'[]',ports as TgProductionPorts);assert.deepEqual(absent.calls,['A']);assert.ok(absent.saved.at(-1)?.issues?.some(s=>s.includes('Secondo revisore')));
});
test('a negative B never reaches audio, survives resume and cannot become unlimited automatic rewrites',async()=>{
 const h=harness();h.ports.reviewScript=async(r,s)=>{h.calls.push('B');const review=scriptReviewFixture(h.j.product,h.j.date,r,s,now);return {...review,passed:false,issues:['Tono allegro inadatto al testo.']};};
 await produceTg(h.j,'[]',h.ports);assert.deepEqual(h.calls,['A','B','write','A','B']);
 assert.ok(h.saved.some(s=>s.editorialRepairs===1));assert.equal(h.saved.at(-1)?.scriptReview?.passed,false);
 h.calls.length=0;await produceTg({...h.j,editorialRepairs:1},'[]',h.ports);assert.deepEqual(h.calls,['A','B']);
});
test('duration rewrites repeat A and B, and audio with a different script cannot reach rendering',async()=>{
 const h=harness();let voices=0;h.ports.voice=async(_r,s)=>{h.calls.push('voice');if(++voices===1)throw Object.assign(new Error('duration'),{ratio:1.2,actualSeconds:210});return h.manifest(s);};
 await produceTg(h.j,'[]',h.ports);assert.deepEqual(h.calls,['A','B','voice','write','A','B','voice','render']);
 const changed=harness();changed.ports.voice=async(_r,s)=>{const m=changed.manifest(s);m.cues[0].text='Una frase diversa dal testo approvato.';return m;};
 await produceTg(changed.j,'[]',changed.ports);assert.equal(changed.calls.includes('render'),false);assert.match(changed.saved.at(-1)?.issues?.[0]??'',/master vocale/);
});
test('real B adapter sees complete narration and score, without checker A conclusions; provider is mocked',async t=>{
 const original={PODCAST_AI_ENABLED:process.env.PODCAST_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 Object.assign(process.env,{PODCAST_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-test-only'});
 const j=reviewFixture(now);let calls=0;
 t.mock.method(globalThis,'fetch',async(_url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  calls++;const request=JSON.parse(String(init?.body));assert.equal(request.text.format.name,'tg_script_review_b');assert.equal(request.store,false);
  assert.equal(request.reasoning.effort,'medium');assert.equal(request.text.verbosity,'low');
  assert.ok(request.instructions.includes(DAILY_TIMELINE_POLICY));
  assert.ok(request.instructions.includes(DAILY_CONTEXT_POLICY));
  assert.ok(request.instructions.includes(DAILY_NARRATIVE_REVIEW));
  assert.ok(request.input.includes(JSON.stringify(dailyGreeting(j.product.language,j.date,j.product.productionStandard==='cdaily-v1'?'reviewed':undefined))));
  assert.match(request.input,/do not demand a numeric date, year or weekday/);
  assert.ok(request.input.includes(scoredNarration(j.script!).narrationText.split('\n')[0]));assert.ok(request.input.includes('<mood:attention'));assert.ok(request.instructions.includes('independent editor B'));assert.match(request.instructions,/Compare informational propositions/);assert.match(request.instructions,/assess priority as well as correctness/);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(judgement(j.script!))}]}]});
 });
 try{const result=await reviewEditionScript(j.product,j.date,j.research!,j.script!,{data:[],sources:j.audit!.sources.length?j.audit!.sources:j.research!.sources.map(s=>({url:s.url,title:s.title})),webByStory:{}},new AbortController().signal,now);assert.equal(result.passed,true);assert.equal(calls,1);assert.equal(scriptReviewIsCurrent({...j,scriptReview:result},now),true);}
 finally{for(const k of Object.keys(original) as (keyof typeof original)[]){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}}
});

for(const kind of ['missing-context','irrelevant-context','empty-prose'] as const)test(`B blocks ${kind} through existing fields even when all factual claims pass`,async()=>{
 const h=harness();h.j.product.textReviewMode='manual';h.j.editorialRepairs=1;
 h.ports.reviewScript=async(r,s)=>{
  h.calls.push('B');const verdict=judgement(s);
  if(kind==='missing-context')verdict.checks.coverage=false;
  else verdict.clauses.sentence_2.form=false;
  verdict.clauses.sentence_2.reason=kind==='missing-context'?'Manca il ruolo indispensabile per capire il soggetto della decisione.':kind==='irrelevant-context'?'La spiegazione ovvia occupa il posto del rapporto necessario a capire questo fatto.':'Il passaggio ripete il significato della frase precedente senza funzione narrativa.';
  return validateScriptReview(verdict,h.j.product,h.j.date,r,s,'mock-editor-B',now);
 };
 await produceTg(h.j,'[]',h.ports);
 assert.deepEqual(h.calls,['A','B']);
 assert.equal(h.saved.at(-1)?.scriptReview?.passed,false);
 assert.ok(h.saved.at(-1)?.scriptReview?.clauses.every(c=>c.content));
 assert.equal(h.saved.some(data=>data.textApproval!==undefined||data.manifest!==undefined),false);
});


test('factual support cannot compensate for rejected narrative form or edition coherence, including manual review',async()=>{
 for(const kind of ['content','form','coherence'] as const){
  const h=harness();
  h.j.product.textReviewMode='manual';h.j.editorialRepairs=1;
  h.ports.reviewScript=async(r,s)=>{
   h.calls.push('B');const verdict=judgement(s);
   if(kind==='coherence')verdict.checks.coherence=false;
   else verdict.clauses.sentence_2[kind]=false;
   verdict.clauses.sentence_2.reason=kind==='content'?'Questa affermazione non è sostenuta dalle prove.':'La conclusione ripete il fatto iniziale senza aggiungere contesto.';
   return validateScriptReview(verdict,h.j.product,h.j.date,r,s,'mock-editor-B',now);
  };
  await produceTg(h.j,'[]',h.ports);
  assert.deepEqual(h.calls,['A','B']);
  assert.equal(h.saved.at(-1)?.scriptReview?.passed,false);
  assert.ok(h.saved.at(-1)?.issues?.length);
  assert.equal(h.saved.some(s=>s.textApproval!==undefined),false);
 }
});

test('a verdict created before the stronger narrative criteria requires a fresh B without changing the report schema',()=>{
 const j=reviewFixture(now),score=scoredNarration(j.script!);
 // The exact pre-revision digest, not an arbitrary corrupted hash.
 const previousDigest=createHash('sha256').update(JSON.stringify({version:1,product:j.product,date:j.date,research:j.research,script:scriptDigest(j.script!),narrationText:score.narrationText,scoreMarkup:score.scoreMarkup})).digest('hex');
 const old={...j,scriptReview:{...j.scriptReview!,inputSha256:previousDigest}};
 assert.equal(scriptReviewIsCurrent(old,now),false);
 assert.equal(scriptReviewIsCurrent(j,now),true);
 assert.deepEqual(Object.keys(old.scriptReview).sort(),Object.keys(j.scriptReview!).sort());
 const beforeTemporalPolicy=createHash('sha256').update(JSON.stringify({version:1,narrativePolicy:DAILY_NARRATIVE_POLICY,narrativeReview:DAILY_NARRATIVE_REVIEW,reviewGeneration:DAILY_REVIEW_GENERATION,product:j.product,date:j.date,research:j.research,script:scriptDigest(j.script!),narrationText:score.narrationText,scoreMarkup:score.scoreMarkup})).digest('hex');
 assert.equal(scriptReviewIsCurrent({...j,scriptReview:{...j.scriptReview!,inputSha256:beforeTemporalPolicy}},now),false);
});

for(const key of ['naturalness','nonRedundancy','contextRelevance','informationValue'] as const)test(`explicit B subcheck ${key} blocks despite positive global/clause verdicts`,async()=>{
 const h=harness();h.j.editorialRepairs=1;h.j.product.textReviewMode='manual';
 h.ports.reviewScript=async(r,s)=>{
  h.calls.push('B');const raw=judgement(s);
  raw.quality[key]={passed:false,reason:'Il confronto dei passaggi mostra un difetto sostanziale da correggere.',clauseIndices:key==='nonRedundancy'?[1,2]:[1]};
  return validateScriptReview(raw,h.j.product,h.j.date,r,s,'fixture/B',now);
 };
 await produceTg(h.j,'[]',h.ports);
 assert.deepEqual(h.calls,['A','B']);assert.equal(h.saved.at(-1)?.scriptReview?.passed,false);
 assert.ok(h.saved.at(-1)?.issues?.some(x=>x.includes(key)));
 assert.equal(h.saved.some(x=>x.manifest||x.textApproval),false);
});
test('new B reports require all four justified subchecks and valid repetition references',()=>{
 const j=reviewFixture(now),raw=judgement(j.script!);
 const missing=structuredClone(raw) as {quality?:unknown};delete missing.quality;
 assert.throws(()=>validateScriptReview(missing,j.product,j.date,j.research!,j.script!,'fixture',now),/qualitative incomplete/);
 for(const refs of [[],[1,1],[1,999]]){
  const bad=structuredClone(raw);bad.quality.nonRedundancy={passed:false,reason:'Le due frasi ripetono la stessa informazione con parole differenti.',clauseIndices:refs};
  assert.throws(()=>validateScriptReview(bad,j.product,j.date,j.research!,j.script!,'fixture',now),/nonRedundancy incompleta/);
 }
 const legacy=structuredClone(j);delete legacy.scriptReview!.quality;
 assert.equal(scriptReviewIsCurrent(legacy,now),false);
});

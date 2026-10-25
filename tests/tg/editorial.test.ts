import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TG_PRODUCTS, isDue, localEditionDate, parseProduct } from '../../src/lib/tg/config';
import { parseFeed, TG_FEEDS, publicSourceUrl } from '../../src/lib/tg/sources';
import { validateResearch, validateScript, scriptDigest, auditTargets, validateAudit, requireDailyCoverage, requireWebCorroboration, TgCoverageError, TgEditorialError, visibleScript, dailyGreeting, withDailyGreeting, withDailyClosing, dailyClosing, scriptSchema } from '../../src/lib/tg/editorial';
import {scriptReviewFixture} from './fixtures';
import { freshnessFixture } from './freshness-fixture';
import { produceTg } from '../../src/lib/tg/pipeline';
import { tgReadiness } from '../../src/lib/tg/readiness';
import { tgFrameAt, captionsVtt } from '../../src/lib/tg/timeline';
import type { TgAsset, TgAudit, TgJob, TgManifest, TgResearch, TgScript, TgState } from '../../src/lib/tg/types';
import {tgSpeechPlan} from '../../src/lib/tg/speech-plan';
const now = new Date('2026-10-17T17:00:00Z');
function research(count = 3): TgResearch {
  const sources = Array.from({length:count*2},(_,i) => ({ id:'s'+i, publisher:i%2?'BBC':'ANSA', independentGroup:i%2?'bbc':'ansa', url:i%2?`https://www.bbc.com/news/${i}`:`https://www.ansa.it/news/${i}`, title:'Titolo originale', evidence:'Una fonte descrive una novità di interesse pubblico con dettagli verificabili.', publishedAt:now.toISOString() }));
  return { collectedAt:now.toISOString(), searchCalls:1, warnings:[], sources, stories:Array.from({length:count},(_,i) => ({ id:'story'+i, headline:'Una notizia importante '+i, category:i===0?'economy':'society', importance:80-i, whyItMatters:'Una conseguenza concreta per il pubblico.', changedSinceYesterday:'Nuovi dati rispetto a ieri.', uncertainty:'Alcuni aspetti sono ancora da confermare.', sourceIds:['s'+(i*2),'s'+(i*2+1)], facts:[{text:'Un fatto attribuito.',sourceIds:['s'+(i*2)]}] })) };
}
const script = (count = 3):TgScript => ({ title:'Titolo',description:'Spiegazione e fonti.',sentences:Array.from({length:18},(_,i) => ({ text:('Una frase informativa con conseguenze spiegate al pubblico senza inventare dettagli. ').repeat(2).trim(),mood:'attention',intensity:.4,speaker:0,storyId:'story'+i%count,sourceIds:['s'+(i%count*2)] })) });
const job = ():TgJob => ({ id:'a'.repeat(24),edition:'it',date:'2026-10-17',state:'queued',product:{...TG_PRODUCTS[0],seconds:180},assets:[],issues:[],events:[],attempts:1,createdAt:now.toISOString(),updatedAt:now.toISOString(),deliveries:[] });
const assets = ():TgAsset[] => ['landscape.mp4','portrait.mp4','audio.mp3','captions.vtt','manifest.json'].map(name => ({name:name as TgAsset['name'],bytes:2000,sha256:'b'.repeat(64),...(name.endsWith('.mp4')?{duration:180}:{})}));
function harness(failAudit = false,product=job().product) {
  const r=research(),s=script(),states:TgState[]=[],calls:string[]=[],saved:Partial<TgJob>[]=[];
  const m:TgManifest={version:1,product:job().product,date:job().date,seconds:180,stories:r.stories,sources:r.sources,cues:s.sentences.map((x,i)=>({...x,start:i*8,end:i*8+7,levels:[.4],frameSeconds:1,phones:[{start:0,end:1,viseme:'a'}]}))};
  const audit:TgAudit={freshness:freshnessFixture(r,s,now),scriptSha256:scriptDigest(s),passed:!failAudit,issues:failAudit?['Affermazione non provata']:[],checkedFacts:s.sentences.length,checkedAt:now.toISOString(),evidence:'Controllate le fonti originarie.',sources:r.sources.map(x=>({url:x.url,title:x.title}))};
  return {r,s,m,audit,states,calls,saved,ports:{now:()=>now,research:async()=>{calls.push('research');return r;},write:async()=>{calls.push('write');return s;},audit:async()=>{calls.push('audit');return audit;},reviewScript:async(r:TgResearch,s:TgScript)=>{calls.push('reviewB');return scriptReviewFixture(product,job().date,r,s,now);},voice:async()=>{calls.push('voice');return m;},render:async()=>{calls.push('render');return assets();},checkpoint:async(state:TgState,data:Partial<TgJob>)=>{states.push(state);saved.push(data);}}};
}
test('editions remain separate with exact clocks and DST-safe daily dates',()=>{
 assert.equal(TG_PRODUCTS[0].seconds,300);assert.equal(TG_PRODUCTS[1].seconds,300);assert.equal(TG_PRODUCTS.every(p=>!p.enabled&&!p.automatic),true);
 const p={...TG_PRODUCTS[0],enabled:true}; assert.equal(isDue(p,new Date('2026-10-17T16:29:00Z')),false);assert.equal(isDue(p,new Date('2026-10-17T16:30:00Z')),true);
 assert.equal(localEditionDate(new Date('2026-10-17T23:30:00Z'),'Europe/Rome'),'2026-10-18');
 for(const bad of [{seconds:0},{seconds:601},{presenters:3},{publishTime:'29:00'},{timezone:'Wrong/Zone'},{platforms:['youtube','youtube']},{edition:'it',language:'en'}])assert.throws(()=>parseProduct({...p,...bad}));
});
test('RSS is bounded, dated, canonical and cannot expand entities or expose private links',()=>{
 const xml=`<rss><channel><item><title>Una novità</title><link>https://www.ansa.it/a</link><pubDate>${now.toUTCString()}</pubDate><description><![CDATA[<p>Un fatto pubblico verificabile.</p>]]></description></item></channel></rss>`;
 const data=parseFeed(xml,TG_FEEDS[0],now);assert.equal(data.length,1);assert.equal(data[0].evidence,'Un fatto pubblico verificabile.');
 assert.throws(()=>parseFeed('<!DOCTYPE x [<!ENTITY x "xx">]>'+xml,TG_FEEDS[0],now));assert.throws(()=>parseFeed('a'.repeat(1000001),TG_FEEDS[0],now));
 assert.equal(parseFeed(xml,TG_FEEDS[0],new Date(now.getTime()+2*86400000)).length,0);
 for(const url of ['http://127.0.0.1/x','https://www.ansa.it.evil.example/x','https://user:pass@www.ansa.it/x','file:///etc/passwd'])assert.equal(publicSourceUrl(url),undefined);
});
test('research needs actual consulted URLs, current dates, independent publishers and multiple categories',()=>{
 const r=research(),urls=new Set(r.sources.map(x=>x.url));assert.equal(validateResearch(r,urls,now).stories.length,3);
 assert.throws(()=>validateResearch(r,new Set(),now),TgEditorialError);const copy=structuredClone(r);copy.sources[1].url='https://www.ansa.it/another';assert.throws(()=>validateResearch(copy,new Set([...urls,copy.sources[1].url]),now),TgEditorialError);
 copy.sources[1].publishedAt='2020-01-01';assert.throws(()=>validateResearch(copy,urls,now));
});
test('the short greeting survives editorial/duration rewrites once, without changing news or evidence',()=>{
 const original=script(5),snapshot=structuredClone(original);
 for(const language of ['it','en'] as const){
  const opened=withDailyGreeting(original,language);
  assert.equal(dailyGreeting(language).split(/\s+/u).length,5);
  assert.equal(opened.sentences[0].text,dailyGreeting(language));
  assert.equal(opened.sentences[0].storyId,'intro');assert.equal(opened.sentences[0].speaker,0);
  assert.deepEqual(opened.sentences[0].sourceIds,[]);
  assert.deepEqual(opened.sentences.slice(1),original.sentences);
  assert.deepEqual(withDailyGreeting(opened,language),opened);
  assert.deepEqual(withDailyGreeting({...opened,sentences:[opened.sentences[0],...opened.sentences]},language),opened);
  assert.notEqual(scriptDigest(opened),scriptDigest(original));
  assert.equal(auditTargets(opened).find(t=>t.key==='sentence_0')?.factual,false);
  assert.doesNotThrow(()=>validateScript(opened,{...TG_PRODUCTS[0],language},research(5)));
 }
 assert.deepEqual(original,snapshot);
 const generatedLimit=(scriptSchema(TG_PRODUCTS[0],research(5)).properties.sentences as {maxItems:number}).maxItems;
 assert.equal(generatedLimit,46); // greeting + three closing cues stay inside the 50-cue validator.
});
test('every Daily closes once with the fixed invitation, preserving factual news through rewrites',()=>{
 for(const language of ['it','en'] as const){
  const base=script(5);base.sentences.push({text:'Una precedente chiusura non fattuale.',storyId:'outro',speaker:0,mood:'agreement',intensity:.4,sourceIds:[]});
  const closed=withDailyClosing(withDailyGreeting(base,language),language),last=closed.sentences.slice(-3);
  assert.deepEqual(last,dailyClosing(language));assert.deepEqual(withDailyClosing(closed,language),closed);
  assert.deepEqual(closed.sentences.slice(1,-3),base.sentences.slice(0,-1));
  assert.equal(last[0].intent,'point-down');assert.ok(last[0].text.includes(last[0].gestureWord!));
  assert.doesNotThrow(()=>validateScript(closed,{...TG_PRODUCTS[0],language},research(5)));
  const changed=structuredClone(closed);delete changed.sentences.at(-3)!.intent;assert.notEqual(scriptDigest(changed),scriptDigest(closed));
 }
 const it=dailyClosing('it').map(c=>c.text).join(' ');assert.equal(it,'Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande. Meno rumore, più contesto.');
});
test('scripts require evidence and sentence moods without a second speaker in solo edition',()=>{
 const r=research(),s=script();assert.equal(validateScript(s,{...TG_PRODUCTS[0],seconds:180},r).sentences.length,18);
 s.sentences[0].speaker=1;assert.throws(()=>validateScript(s,{...TG_PRODUCTS[0],seconds:180},r));s.sentences[0].speaker=0;s.sentences[0].sourceIds=['unknown'];assert.throws(()=>validateScript(s,{...TG_PRODUCTS[0],seconds:180},r));
});
test('five-minute Daily requires exactly five distinct selected stories, all developed in the script',()=>{
 const product=TG_PRODUCTS[0],r=research(5),s=script(5);
 assert.equal(validateScript(s,product,r).sentences.length,18);
 for(const count of [0,3,4,6])assert.throws(()=>requireDailyCoverage(product,research(count)),TgCoverageError);
 const duplicated=research(5);duplicated.stories[4].id=duplicated.stories[0].id;
 assert.throws(()=>requireDailyCoverage(product,duplicated),TgCoverageError);
 assert.throws(()=>validateScript(script(),product,r),TgCoverageError);
 const unknown=script(5);for(const line of unknown.sentences)if(line.storyId==='story4')line.storyId='unknown';
 assert.throws(()=>requireDailyCoverage(product,r,unknown),TgCoverageError);
 assert.doesNotThrow(()=>requireDailyCoverage({...product,seconds:180},research(),script()));
});
test('insufficient five-minute research stops before writing, voice or rendering, including resumed jobs',async()=>{
 for(const resumed of [false,true]){
  const h=harness();await produceTg({...job(),product:TG_PRODUCTS[0],...(resumed?{research:h.r,script:h.s,audit:h.audit,manifest:h.m}: {})},'',h.ports);
  assert.deepEqual(h.calls,resumed?[]:['research']);assert.equal(h.states.at(-1),'blocked');
  assert.equal(h.saved.at(-1)?.audit,undefined);assert.deepEqual(h.saved.at(-1)?.assets,[]);
 }
});
test('a five-minute script omitting a selected story cannot reuse approval or reach voice',async()=>{
 const h=harness(),r=research(5);
 await produceTg({...job(),product:TG_PRODUCTS[0],research:r,script:h.s,audit:h.audit,manifest:h.m},'',h.ports);
 assert.deepEqual(h.calls,[]);assert.equal(h.states.at(-1),'blocked');
});
test('a valid four-story Daily still reaches measured media production',async()=>{
 const h=harness(false,TG_PRODUCTS[0]),r=research(5),s=script(5),product=TG_PRODUCTS[0];
 await produceTg({...job(),product},'',{...h.ports,research:async()=>r,write:async()=>s,
  audit:async()=>({...h.audit,freshness:freshnessFixture(r,s,now),scriptSha256:scriptDigest(s)}),voice:async()=>({...h.m,product,seconds:product.seconds,stories:r.stories,sources:r.sources,cues:s.sentences.map((line,i)=>({...h.m.cues[i],...line}))}),
  render:async()=>assets().map(asset=>({...asset,...(asset.name.endsWith('.mp4')?{duration:product.seconds}:{})}))});
 assert.equal(h.states.at(-1),'needs_review');assert.equal(h.saved.at(-1)?.assets?.length,5);
});
test('editorial and duration repairs cannot silently drop a fourth story',async()=>{
 for(const reason of ['editorial','duration'] as const){
  const h=harness(false,TG_PRODUCTS[0]),r=research(5),s=script(5);let writes=0,voices=0,audits=0;
  await produceTg({...job(),product:TG_PRODUCTS[0],research:r},'',{...h.ports,
   write:async()=>++writes===1?s:script(),
   audit:async()=>{audits++;return {...h.audit,freshness:freshnessFixture(r,s,now),scriptSha256:scriptDigest(s),passed:reason!=='editorial',issues:reason==='editorial'?['Dettaglio non documentato']:[]};},
   voice:async()=>{voices++;throw Object.assign(new Error('duration'),{ratio:1.2,actualSeconds:280});}});
  assert.equal(h.states.at(-1),'blocked');assert.equal(writes,2);assert.equal(audits,1);
  assert.equal(voices,reason==='duration'?1:0);assert.equal(h.calls.includes('render'),false);
 }
});
test('the production workflow stops at initial review with all real media artifacts',async()=>{
 const h=harness();await produceTg(job(),'[]',h.ports);assert.deepEqual(h.calls,['research','write','audit','reviewB','voice','render']);assert.equal(h.states.at(-1),'needs_review');assert.equal(h.saved.at(-1)?.assets?.length,5);
});
test('a failed fact check never reaches voice, rendering or publication',async()=>{
 const h=harness(true);await produceTg(job(),'',h.ports);assert.deepEqual(h.calls,['research','write','audit','write','audit']);assert.equal(h.states.at(-1),'blocked');
});
test('audit requires every public sentence and rejects invented or unconsulted citations',()=>{
 const s=script(),r=research(),citations=r.sources.map(x=>({url:x.url,title:x.title}));
 const value={issues:[],checks:Object.fromEntries(auditTargets(s).map(t=>[t.key,{status:'supported',evidence:'Riscontro puntuale nel testo della fonte.',sourceUrls:[citations[0].url]}]))};
 const good=validateAudit(value,s,citations,now);assert.equal(good.passed,true);assert.equal(good.checkedFacts,18);assert.equal(good.checks?.length,20);
 const incomplete=structuredClone(value);delete incomplete.checks.sentence_5;assert.throws(()=>validateAudit(incomplete,s,citations,now));
 const invented=structuredClone(value);invented.checks.sentence_5.sourceUrls=['https://www.ansa.it/not-consulted'];assert.equal(validateAudit(invented,s,citations,now).passed,false);
});
test('a repaired script needs a separate passing audit before producing any audio',async()=>{
 const h=harness();let audits=0;
 await produceTg(job(),'',{...h.ports,audit:async()=>{h.calls.push('audit');return ++audits===1?{...h.audit,passed:false,issues:['Attribuire questa affermazione']}:h.audit;}});
 assert.deepEqual(h.calls,['research','write','audit','write','audit','reviewB','voice','render']);assert.equal(h.states.at(-1),'needs_review');
});
test('a negative target blocks an otherwise positive audit without free-form issues; historic issues remain blocking',()=>{
 const r=research(),s=script(),citations=r.sources.map(x=>({url:x.url,title:x.title}));
 const value={issues:[] as string[],checks:Object.fromEntries(auditTargets(s).map(t=>[t.key,{status:'supported',evidence:'Fatto presente nella fonte acquisita e controllata.',sourceUrls:[r.sources[0].url]}]))};
 assert.equal(validateAudit(value,s,citations,now).passed,true);
 for(const status of ['unsupported','unverifiable']){
  const changed=structuredClone(value);changed.checks.sentence_1.status=status;
  const result=validateAudit(changed,s,citations,now);
  assert.equal(result.passed,false);assert.ok(result.issues.some(s=>s.startsWith('sentence_1:')));
 }
 const historic=structuredClone(value);historic.issues.push('Rilievo storico da conservare, non da eliminare.');
 assert.equal(validateAudit(historic,s,citations,now).passed,false);
});
test('RSS detail support cannot replace live corroboration of every story',()=>{
 const r=research(),s=script();
 const value={issues:[],checks:Object.fromEntries(auditTargets(s).map(t=>[t.key,{status:'supported',evidence:'Dettaglio esplicitamente presente nella fonte raccolta.',sourceUrls:[r.sources[0].url]}]))};
 const citations=r.sources.map(x=>({url:x.url,title:x.title}));
 assert.equal(requireWebCorroboration(validateAudit(value,s,citations,now),r,s,['https://apnews.com/another-live-report']).passed,false);
 assert.equal(requireWebCorroboration(validateAudit(value,s,citations,now),r,s,[r.sources[0].url]).passed,true);
 const partial=structuredClone(value);partial.checks.sentence_2.sourceUrls=[r.sources[1].url];for(let i=5;i<18;i+=3)partial.checks[`sentence_${i}`].sourceUrls=[r.sources[1].url];
 assert.equal(requireWebCorroboration(validateAudit(partial,s,citations,now),r,s,[r.sources[0].url]).passed,false);
});
test('on-screen context is audited and changing it invalidates the script approval',()=>{
 const s=script();s.cards=[{storyId:'story0',context:'Una conseguenza sostenuta dalle fonti.',change:'Un aggiornamento verificato.'}];
 assert.equal(validateScript(s,{...TG_PRODUCTS[0],seconds:180},research()).cards?.length,1);
 assert.equal(auditTargets(s).some(t=>t.key==='context_0'&&t.factual),true);assert.equal(auditTargets(s).some(t=>t.key==='change_0'&&t.factual),true);
 const prior=scriptDigest(s);s.cards[0].context='Una conseguenza diversa.';assert.notEqual(scriptDigest(s),prior);
});
test('unused research cards never become public text or create phantom story checks',()=>{
 const s=script();s.headlines=[{storyId:'story0',title:'Notizia in onda'},{storyId:'unused',title:'Solo materiale di ricerca'}];s.cards=[{storyId:'unused',context:'Non va mostrato.',change:''}];
 const visible=visibleScript(s);assert.deepEqual(visible.headlines?.map(h=>h.storyId),['story0']);assert.deepEqual(visible.cards,[]);assert.notEqual(scriptDigest(visible),scriptDigest(s));
});
test('card cleanup drops a truncated trailing fragment without inventing a completion',()=>{
 const s=script();s.cards=[{storyId:'story0',context:'Una frase completa. Una seconda frase tronc',change:'Un aggiornamento completo.'}];
 const cleaned=visibleScript(s);assert.equal(cleaned.cards?.[0].context,'Una frase completa.');assert.notEqual(scriptDigest(cleaned),scriptDigest(s));
});
test('duration correction is bounded to one rewrite and requires a fresh audit',async()=>{
 const h=harness();let attempts=0;const voice=async()=>{if(++attempts===1)throw Object.assign(new Error('duration'),{ratio:1.2,actualSeconds:210});return h.m;};
 await produceTg(job(),'',{...h.ports,voice});assert.equal(h.calls.filter(x=>x==='write').length,2);assert.equal(h.calls.filter(x=>x==='audit').length,2);assert.equal(h.states.at(-1),'needs_review');
 const h2=harness();await produceTg(job(),'',{...h2.ports,voice:async()=>{throw Object.assign(new Error('duration'),{ratio:1.3,actualSeconds:240});}});assert.equal(h2.states.at(-1),'blocked');assert.equal(h2.calls.includes('render'),false);assert.equal(h2.calls.filter(x=>x==='write').length,2);
});
test('resuming with a changed script cannot reuse an old positive audit',async()=>{
 const h=harness();const changed=script();changed.sentences[0].text='Una modifica editoriale.';await produceTg({...job(),research:h.r,script:changed,audit:h.audit},'',h.ports);assert.equal(h.calls[0],'audit');
});
test('a legacy voice master is regenerated, while matching natural voice provenance can resume rendering',async()=>{
 for(const current of [false,true]){
  const h=harness();h.m.stories=h.m.stories.map(s=>({...s,whyItMatters:'',changedSinceYesterday:''}));
  if(current)h.m.speech=tgSpeechPlan(job().product);
  await produceTg({...job(),research:h.r,script:h.s,audit:h.audit,manifest:h.m},'',h.ports);
  assert.equal(h.calls.includes('voice'),!current);assert.equal(h.states.at(-1),'needs_review');
 }
});
test('timeline lips and moods follow measured sentence cues and close in pauses; VTT is timed',()=>{
 const h=harness();let f=tgFrameAt(h.m,.3);assert.equal(f.speakers[0].speaking,true);assert.equal(f.speakers[0].viseme,'a');assert.equal(f.speakers[0].emotion,'attention');f=tgFrameAt(h.m,7.5);assert.equal(f.speakers[0].speaking,false);assert.equal(f.speakers[0].viseme,'rest');assert.match(captionsVtt(h.m),/00:00:00\.000 --> 00:00:07\.000/u);
});
test('TG sentence direction follows the audio clock and distinguishes the listening presenter',()=>{
 const h=harness();h.m.product={...h.m.product,presenters:2};
 const first=tgFrameAt(h.m,0).speakers, middle=tgFrameAt(h.m,3.5).speakers, pause=tgFrameAt(h.m,7.5).speakers;
 assert.equal(first[0].performance?.phase,'anticipation');
 assert.equal(middle[0].performance?.phase,'delivery');assert.equal(middle[0].performance?.progress,.5);
 assert.equal(middle[0].performance?.listening,false);assert.equal(middle[0].performance?.gaze,'camera');
 assert.equal(middle[1].performance?.listening,true);assert.equal(middle[1].performance?.gaze,'partner');
 assert.equal(middle[0].performance?.durationSeconds,7);assert.equal(middle[1].performance?.gazeDirection,-1);
 assert.equal(pause[0].speaking,false);assert.equal(pause[0].performance?.phase,'settle');
 assert.equal(pause[0].performance?.progress,1);
 assert.notEqual(tgFrameAt(h.m,8.5).speakers[0].performance?.cueId,first[0].performance?.cueId);
});
test('production readiness does not confuse configured strings with published channels',()=>{
 const ready=tgReadiness(TG_PRODUCTS[0],{});assert.equal(ready.productionReady,false);assert.equal(ready.channels.every(x=>!x.ready),true);assert.equal(ready.reviewRequired,true);
});

test('XML-encoded tracking URLs normalize to the same immutable source URL',()=>{
 assert.equal(publicSourceUrl('https://www.bbc.co.uk/news/articles/a?at_medium=RSS&amp;at_campaign=rss'), 'https://www.bbc.co.uk/news/articles/a');
 assert.equal(publicSourceUrl('https://www.ansa.it/a?utm_source=feed'), 'https://www.ansa.it/a');
 const xml=`<rss><channel><item><title>Notizia</title><link>https://www.ansa.it/a</link><pubDate>${now.toUTCString()}</pubDate><description>&lt;p&gt;Un fatto pubblico.&lt;/p&gt;</description></item></channel></rss>`;
 assert.equal(parseFeed(xml,TG_FEEDS[0],now)[0].evidence,'Un fatto pubblico.');
});

test('legacy automatic settings cannot approve when the final AI reviewer is unavailable',async()=>{
 const h=harness();await produceTg({...job(),product:{...job().product,automatic:true}},'',h.ports);
 assert.equal(h.states.at(-1),'blocked');assert.equal(h.saved.at(-1)?.approvedAt,undefined);assert.equal(h.saved.at(-1)?.review,undefined);
});

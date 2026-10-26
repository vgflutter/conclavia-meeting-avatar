import assert from 'node:assert/strict';
import {test} from 'node:test';
import {citedEvidenceSources} from '../../src/lib/tg/evidence-relevance';
import {searchJson} from '../../src/lib/tg/agents';
import {auditCitationScopes} from '../../src/lib/tg/audit-context';
import {auditSchema,auditTargets,validateAudit,requireWebCorroboration} from '../../src/lib/tg/editorial';
import {reviewFixture} from './fixtures';
const links=[{url:'https://www.ansa.it/event?item=1',title:'Event report'},
 {url:'https://www.ansa.it/event-extra?item=1',title:'Different event'},
 {url:'https://www.rainews.it/context',title:'Relevant background'},
 {url:'https://www.ansa.it/navigation',title:'Navigation'}];
test('only actually cited retrieved URLs survive, including contrary evidence and precise tracking aliases',()=>{
 const brief='Reported fact [report](https://www.ansa.it/event?item=1&utm_source=search). Conflicting background: https://www.rainews.it/context.';
 assert.deepEqual(citedEvidenceSources(brief,links),[links[0],links[2]]);
 assert.deepEqual(citedEvidenceSources('No URL in text',links,[links[2]]),[links[2]]);
 assert.deepEqual(citedEvidenceSources('`https://www.rainews.it/context`',links),[links[2]]);
 assert.deepEqual(citedEvidenceSources('https://www.ansa.it/event?item=2 https://www.ansa.it/not-retrieved',links),[]);
 assert.deepEqual(citedEvidenceSources('https://www.ansa.it/event-extra?item=1',links),[links[1]],'Prefix matching must not associate different articles');
});
test('real search adapter excludes unused search hits and fails when none were cited; original discovery mode remains available',async()=>{
 const saved={TG_AI_ENABLED:process.env.TG_AI_ENABLED,OPENAI_API_KEY:process.env.OPENAI_API_KEY};Object.assign(process.env,{TG_AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-only'});
 let text='Evidence [source](https://www.ansa.it/event?item=1)';
 const fetcher=async()=>Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:links}},{type:'message',content:[{type:'output_text',text}]}]});
 try{
  const result=await searchJson(undefined,'Synthetic lookup',new AbortController().signal,fetcher,3,1,'cited');assert.deepEqual(result.sources,[links[0]]);
  text='No actual citation';await assert.rejects(searchJson(undefined,'Synthetic lookup',new AbortController().signal,fetcher,3,1,'cited'),/priva di fonti/);
  assert.deepEqual((await searchJson(undefined,'Synthetic lookup',new AbortController().signal,fetcher)).sources,links);
 }finally{for(const k of Object.keys(saved) as (keyof typeof saved)[]){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test('a citation for another story cannot support a target even when it was actually retrieved',()=>{
 const j=reviewFixture(),r=j.research!,s=j.script!,citations=r.sources.map(({url,title})=>({url,title}));
 const webByStory=Object.fromEntries(r.stories.map(story=>[story.id,r.sources.filter(x=>story.sourceIds.includes(x.id)).map(x=>x.url)]));
 const scope=auditCitationScopes(r,s,{data:[],sources:citations,webByStory});
 const schema=auditSchema(s,citations.map(c=>c.url),undefined,webByStory,scope);
 const properties=schema.properties.checks as {properties:Record<string,{properties:{sourceUrls:{items:{enum:string[]}}}}>};
 assert.deepEqual(properties.properties.sentence_0.properties.sourceUrls.items.enum,scope.sentence_0);
 const checks=Object.fromEntries(auditTargets(s).map(target=>[target.key,{status:'supported',evidence:'Riscontro pertinente nel documento associato alla stessa notizia.',sourceUrls:[scope[target.key][0]]}]));
 assert.equal(validateAudit({issues:[],checks},s,citations,new Date(),scope).passed,true);
 checks.sentence_0.sourceUrls.push(r.sources[1].url);
 const result=validateAudit({issues:[],checks},s,citations,new Date(),scope);
 assert.equal(result.passed,false);assert.equal(result.checks?.find(c=>c.key==='sentence_0')?.status,'unverifiable');
 assert.ok(!result.checks?.find(c=>c.key==='sentence_0')?.sourceUrls.includes(r.sources[1].url));
});
test('the report catalog contains only sources attached to actual checked claims, including negative checks',()=>{
 const j=reviewFixture(),s=j.script!,citations=j.research!.sources.map(({url,title})=>({url,title}));
 const checks=Object.fromEntries(auditTargets(s).map(t=>[t.key,{status:'supported',evidence:'Riscontro presente nel testo della fonte effettivamente pertinente.',sourceUrls:[citations[0].url]}]));
 checks.sentence_1={status:'unsupported',evidence:'Il documento contraddice esplicitamente il dato dichiarato.',sourceUrls:[citations[1].url]};
 const audit=validateAudit({issues:[],checks},s,citations,new Date());
 assert.deepEqual(audit.sources,citations.slice(0,2));
 requireWebCorroboration(audit,j.research!,s,citations.map(c=>c.url));assert.deepEqual(audit.webSourceUrls,citations.slice(0,2).map(c=>c.url));
});

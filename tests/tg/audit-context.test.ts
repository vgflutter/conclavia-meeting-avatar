import assert from 'node:assert/strict';
import {test} from 'node:test';
import {editorialFixture} from './editorial-fixture';
import {auditTargets} from '../../src/lib/tg/editorial';
import {factAuditBatches,factBatchContext} from '../../src/lib/tg/audit-context';
import type {TgAuditEvidence} from '../../src/lib/tg/evidence-cache';
const now=new Date('2026-10-25T08:00:00Z');
function material(){
 const job=editorialFixture(now),research=job.research!,script=job.script!;
 script.headlines=research.stories.map(s=>({storyId:s.id,title:s.headline}));
 script.cards=research.stories.map(s=>({storyId:s.id,context:s.whyItMatters,change:s.changedSinceYesterday}));
 const data=research.stories.map(s=>({storyId:s.id,brief:('Complete evidence '+s.id+' ').repeat(200),sources:[{url:`https://www.rainews.it/evidence-${s.id}`,title:s.headline}]}));
 const evidence:TgAuditEvidence={data,sources:data.flatMap(d=>d.sources),webByStory:Object.fromEntries(data.map(d=>[d.storyId,d.sources.map(s=>s.url)]))};
 return {research,script,evidence};
}
test('a story check retains its full evidence, source pair, original target indices and whole narration',()=>{
 const {research,script,evidence}=material();
 const c=factBatchContext(research,script,evidence,['sentence_1','headline_0','context_0','change_0']);
 assert.deepEqual(c.storyIds,['story-0']);assert.deepEqual(c.searched.data,[evidence.data[0]]);
 assert.equal(c.script,script);assert.deepEqual(c.research.sources,research.sources.filter(s=>research.stories[0].sourceIds.includes(s.id)));
 assert.equal(c.research.retrievedContext,undefined);
 assert.deepEqual(c.targets.map(t=>t.key).sort(),['sentence_1','headline_0','context_0','change_0'].sort());
 assert.equal(c.consultedSourceCatalog.some(s=>s.url===evidence.sources[1].url),false);
 assert.ok(JSON.stringify(c).length<JSON.stringify({research,script,evidence}).length);
});
test('mixed-story batches include both stories, while summary, title and bookends keep all evidence',()=>{
 const {research,script,evidence}=material();
 assert.deepEqual(factBatchContext(research,script,evidence,['sentence_1','sentence_5']).storyIds,['story-0','story-1']);
 for(const key of ['title','description','sentence_0',`sentence_${script.sentences.length-1}`]){
  const c=factBatchContext(research,script,evidence,[key]);
  assert.deepEqual(c.research.stories,research.stories);assert.deepEqual(c.searched,evidence);
 }
 const keys=auditTargets(script).map(t=>t.key),seen:string[]=[];
 for(let i=0;i<keys.length;i+=4)seen.push(...factBatchContext(research,script,evidence,keys.slice(i,i+4)).targets.map(t=>t.key));
 assert.deepEqual(seen,keys,'No public claim is removed by compaction');
});
test('legacy unstructured briefs are preserved and invalid targets fail instead of skipping checks',()=>{
 const {research,script,evidence}=material(),legacy={...evidence,data:'An unstructured older brief'};
 const c=factBatchContext(research,script,legacy,['sentence_1']);
 assert.deepEqual(c.searched,legacy);assert.deepEqual(c.research.sources,research.sources);
 for(const keys of [[],['sentence_999'],['sentence_1','sentence_1']])assert.throws(()=>factBatchContext(research,script,evidence,keys));
});
test('the audit plan groups each story, bounds replies and still checks every public target exactly once',()=>{
 const {research,script,evidence}=material(),batches=factAuditBatches(script),all=auditTargets(script).map(t=>t.key);
 assert.deepEqual(batches.flat().sort(),[...all].sort());assert.equal(new Set(batches.flat()).size,all.length);
 assert.ok(batches.every(keys=>keys.length>0&&keys.length<=6));
 for(const keys of batches){
  const c=factBatchContext(research,script,evidence,keys);
  assert.ok(c.storyIds.length===1||keys.some(k=>['title','description','sentence_0',`sentence_${script.sentences.length-1}`].includes(k))||keys.every(k=>k.startsWith('sentence_')&&script.sentences[Number(k.slice(9))].storyId==='outro'));
 }
 assert.throws(()=>factAuditBatches(script,7));
});

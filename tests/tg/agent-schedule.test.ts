import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentCalendar, agentDecision, parseAgentSchedule } from '../../src/lib/tg/agent-schedule';
import { editionSlot } from '../../src/lib/tg/schedule';
import { parseProduct } from '../../src/lib/tg/config';
import { editionTexts } from '../../src/lib/tg/edition-texts';
import { reviewFixture } from './fixtures';
import { tgReadiness } from '../../src/lib/tg/readiness';
import { saveEditionTexts } from '../../src/lib/tg/edition-text-files';

const plan=parseAgentSchedule(JSON.parse(readFileSync(new URL('../../config/tg/daily-agent.json',import.meta.url),'utf8')));
test('07:30 creation is distinct from 08:15 publication across the October DST transition',()=>{
  const before=editionSlot(plan.product,'2026-10-24'),after=editionSlot(plan.product,'2026-10-25');
  assert.equal(before.prepareAt,'2026-10-24T05:30:00.000Z');assert.equal(before.scheduledAt,'2026-10-24T06:15:00.000Z');
  assert.equal(after.prepareAt,'2026-10-25T06:30:00.000Z');assert.equal(after.scheduledAt,'2026-10-25T07:15:00.000Z');
  assert.equal(after.closesAt,'2026-10-25T07:45:00.000Z');
  assert.equal(agentDecision(plan,new Date('2026-10-24T05:29:59Z')).due,false);
  assert.equal(agentDecision(plan,new Date('2026-10-24T05:30:00Z')).due,true);
  assert.equal(agentDecision(plan,new Date('2026-10-24T06:45:01Z')).reason,'closed');
});
test('first edition, disabled schedules and actual local date prevent old-news catch-up',()=>{
  assert.equal(agentDecision(plan,new Date('2026-10-23T07:00:00Z')).reason,'before_first_edition');
  assert.equal(agentDecision({...plan,product:{...plan.product,enabled:false}},new Date('2026-10-24T06:00:00Z')).reason,'disabled');
  assert.equal(agentDecision(plan,new Date('2026-10-23T22:01:00Z')).date,'2026-10-24');
  assert.equal(agentCalendar(plan,new Date('2026-10-23T22:01:00Z'))[0].date,'2026-10-24');
  assert.throws(()=>parseAgentSchedule({...plan,firstEditionDate:'2026-02-31'}));
  assert.throws(()=>parseAgentSchedule({...plan,product:{...plan.product,automatic:false}}));
  assert.throws(()=>parseProduct({...plan.product,productionTime:'09:01'}));
  assert.throws(()=>parseProduct({...plan.product,productionTime:'bad'}));
});
test('social pack includes only spoken stories in spoken order and retains exact reviewed words',()=>{
  const job=reviewFixture(new Date('2026-10-24T06:10:00Z'));
  job.script!.sentences=job.script!.sentences.filter(s=>s.storyId!=='story-1');
  job.script!.headlines=[{storyId:'story-2',title:'Titolo verificato due'},{storyId:'story-0',title:'Titolo verificato zero'}];
  job.script!.cards=[{storyId:'story-2',context:'Descrizione già presente nel copione.',change:'Un aggiornamento'}];
  const pack=editionTexts(job);
  assert.deepEqual(pack.rundown.map(s=>s.storyId),['story-0','story-2']);
  assert.equal(pack.rundown[0].title,'Titolo verificato zero');
  assert.equal(pack.rundown[1].description,job.script!.cards[0].context);
  assert.equal(pack.summary,job.script!.description);
  assert.equal(pack.posts.length,job.product.platforms.length);
  assert.equal(pack.markdown.includes('2026-10-24'),true);
  assert.equal(pack.markdown.includes('Titolo verificato due'),true);
  assert.equal(pack.narrationText.includes('<mood:'),false);
  assert.match(pack.scoreMarkup,/<mood:/u);
  assert.equal(pack.rundown.flatMap(s=>s.sourceIds).includes('source-1'),false);
});
test('each production saves a private dated dossier, source ledger, rundown and exact social copy',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cdaily-editorial-pack-')),previous=process.env.TG_ARTIFACT_DIR;
  process.env.TG_ARTIFACT_DIR=root;
  try{
    const job=reviewFixture(new Date('2026-10-24T06:10:00Z')),{directory,files}=await saveEditionTexts(job);
    assert.equal(directory,path.join(root,job.id));
    for(const name of ['edition-dossier.md','research.json','script.json','social-summary.txt','rundown.md','social-posts.json','editorial-package.json','narration.txt','performance-score.txt'])assert.ok(files.includes(name));
    assert.equal(await readFile(path.join(directory,'social-summary.txt'),'utf8'),job.script!.description+'\n');
    const dossier=await readFile(path.join(directory,'edition-dossier.md'),'utf8');
    assert.match(dossier,/# Daily 2026-10-24/u);assert.match(dossier,/non attestazione di pubblicazione/u);
    const pack=JSON.parse(await readFile(path.join(directory,'editorial-package.json'),'utf8'));
    assert.equal(pack.publicationState,'unpublished');assert.deepEqual(pack.scriptReview,job.scriptReview);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,'research.json'),'utf8')),job.research);
    assert.equal((await stat(path.join(directory,'social-summary.txt'))).mode&0o777,0o600);
  }finally{
    if(previous===undefined)delete process.env.TG_ARTIFACT_DIR;else process.env.TG_ARTIFACT_DIR=previous;
    await rm(root,{recursive:true,force:true});
  }
});

test('scoped Daily planning exposes its AI reviewers but never treats an Inworld key as the approved Alex voice',()=>{
  const ready=tgReadiness(plan.product,{OPENAI_API_KEY:'synthetic-test',PODCAST_SPEECH_ENABLED:'true',INWORLD_API_KEY:'synthetic-test'});
  assert.equal(ready.automaticReviewAvailable,true);
  assert.equal(ready.checks.find(c=>c.id==='ai')?.ready,true);
  assert.equal(ready.checks.find(c=>c.id==='final-review')?.ready,true);
  assert.equal(ready.checks.find(c=>c.id==='speech')?.ready,false);
  assert.equal(ready.productionReady,false);
});

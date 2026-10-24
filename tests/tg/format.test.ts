import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DAILY_SECONDS,DAILY_OPENING_PAUSE_SECONDS,DAILY_RUNDOWN,dailyStoryCount,dailyWritingStructure} from '../../src/lib/tg/format';
import {TG_PRODUCTS} from '../../src/lib/tg/config';
import {requireDailyCoverage,TgCoverageError} from '../../src/lib/tg/editorial';
import type {TgResearch,TgScript} from '../../src/lib/tg/types';

test('the five-minute clock funds five explained items and the clean opening pause',()=>{
 assert.equal(DAILY_SECONDS,300);
 assert.deepEqual(DAILY_RUNDOWN.map(b=>b.end-b.start),[18,2,75,48,48,48,48,13]);
 assert.equal(DAILY_RUNDOWN.find(b=>b.id==='opening-pause')!.end-DAILY_RUNDOWN.find(b=>b.id==='opening-pause')!.start,DAILY_OPENING_PAUSE_SECONDS);
 assert.equal(DAILY_RUNDOWN[0].start,0);
 assert.equal(DAILY_RUNDOWN.at(-1)!.end,DAILY_SECONDS);
 for(let i=1;i<DAILY_RUNDOWN.length;i++)assert.equal(DAILY_RUNDOWN[i].start,DAILY_RUNDOWN[i-1].end);
 for(const p of TG_PRODUCTS){
  assert.equal(dailyStoryCount(p),5);
  assert.match(dailyWritingStructure(p),/75 seconds/);
  assert.match(dailyWritingStructure(p),/clean two-second pause/);
  assert.match(dailyWritingStructure(p),/exactly 300 seconds/);
 }
});

test('new editions require five distinct covered items; archived four-minute jobs retain four',()=>{
 for(const [seconds,count] of [[240,4],[300,5]]){
  const product={...TG_PRODUCTS[0],seconds};
  assert.equal(dailyStoryCount(product),count);
  const stories=Array.from({length:count},(_,i)=>({id:'item-'+i})) as TgResearch['stories'];
  assert.doesNotThrow(()=>requireDailyCoverage(product,{stories}));
  assert.throws(()=>requireDailyCoverage(product,{stories:stories.slice(0,count-1)}),TgCoverageError);
  assert.throws(()=>requireDailyCoverage(product,{stories:[...stories.slice(0,count-1),stories[0]]}),TgCoverageError);
  const script={sentences:stories.slice(0,count-1).map(s=>({storyId:s.id}))} as TgScript;
  assert.throws(()=>requireDailyCoverage(product,{stories},script),TgCoverageError);
 }
 assert.equal(dailyStoryCount({seconds:180}),3);
});

test('CDaily varies its selected story count between five and seven without changing archived quotas',()=>{
 const product={...TG_PRODUCTS[0],productionStandard:'cdaily-v1' as const};
 for(const count of [4,5,6,7,8]){
  const stories=Array.from({length:count},(_,i)=>({id:`story-${i}`})) as TgResearch['stories'];
  if(count>=5&&count<=7)assert.doesNotThrow(()=>requireDailyCoverage(product,{stories}));
  else assert.throws(()=>requireDailyCoverage(product,{stories}),TgCoverageError);
 }
 assert.match(dailyWritingStructure(product),/real take determines/);
 assert.ok(!dailyWritingStructure(product).includes('exactly 300'));
});

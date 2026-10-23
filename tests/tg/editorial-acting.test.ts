import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyEditorialIntents,requireEditorialScore,scriptSchema,scriptDigest,validateScript} from '../../src/lib/tg/editorial';
import {directDailyCueMotion} from '../../src/lib/tg/performance-direction';
import {tgFrameAt} from '../../src/lib/tg/timeline';
import {dailyProductionStudioConfig} from '../../src/components/tg/daily-production-studio';
import {reviewFixture} from './fixtures';
import type {TgCue,TgManifest} from '../../src/lib/tg/types';
const clause=(start:number,intent:TgCue['intent']='reflect'):TgCue=>({start,end:start+8,text:'Resta una domanda aperta, prima di trarre una conclusione.',mood:'doubt',intensity:.8,intent,storyId:'example',speaker:0,sourceIds:[]});

test('new writer output requires a semantic score; physical gestures are app/engine owned and old scripts remain readable',()=>{
 const job=reviewFixture(),schema=scriptSchema(job.product,job.research!);
 const lines=(schema.properties.sentences as {items:{anyOf:{required:string[];properties:{intent:{enum:readonly string[]}}}[]}}).items.anyOf;
 for(const line of lines){assert.ok(line.required.includes('intent'));assert.deepEqual(line.properties.intent.enum,dailyEditorialIntents);}
 const old={...job.script!,sentences:job.script!.sentences.map(s=>({...s,text:(s.text+' ').repeat(3).trim()}))},scored={...old,sentences:old.sentences.map(s=>({...s,intent:'explain' as const}))};
 assert.throws(()=>requireEditorialScore(old),/intenzione/);assert.doesNotThrow(()=>requireEditorialScore(scored));
 assert.notEqual(scriptDigest(old),scriptDigest(scored),'AI editorial approval binds intentions too');
 for(const intent of ['palms-joined','chin-touch','point-down'] as const)
  assert.throws(()=>requireEditorialScore({...scored,sentences:[{...scored.sentences[0],intent}]}),/posa fisica/);
 assert.doesNotThrow(()=>validateScript(old,job.product,job.research!));
});

test('same editorial meaning and measured speech select the same motion for unrelated stories',()=>{
 const a=directDailyCueMotion([clause(0),clause(8)],'2026-10-23');
 const b=directDailyCueMotion([clause(0),clause(8)].map(c=>({...c,storyId:'other',text:'Un tema del tutto diverso, con un limite ancora da chiarire.'})),'2026-10-23');
 assert.deepEqual(a.map(c=>c.choreography),b.map(c=>c.choreography));
 assert.equal(a[0].choreography,a[1].choreography);assert.deepEqual(a[0].performanceWindow,{start:0,end:16});
 const fixture=reviewFixture(),manifest:TgManifest={version:1,product:fixture.product,date:fixture.date,seconds:20,stories:[],sources:[],cues:a};
 const before=tgFrameAt(manifest,7.99).speakers[0].performance!,after=tgFrameAt(manifest,8.01).speakers[0].performance!;
 assert.equal(before.cueId,after.cueId);assert.equal(before.choreography,after.choreography);
 assert.ok(after.progress!>before.progress!,'mood clauses never reset the body clock');
 assert.equal(tgFrameAt(manifest,16.5).speakers[0].speaking,false);
});

test('a missing score, another speaker and explicit pointers separate thought windows without replacing supplied acting',()=>{
 const missing={...clause(8),intent:undefined},pointer={...clause(24,'point-down'),storyId:'outro'},last=clause(32);
 const result=directDailyCueMotion([clause(0),missing,clause(16),pointer,last],'2026-10-23');
 assert.equal(result[1].choreography,undefined);assert.equal(result[0].performanceWindow!.end,8);
 assert.notEqual(result[0].choreography,result[2].choreography);
 assert.ok(result[3].choreography!.strokes.some(s=>s.kind==='point-down'));
 const supplied=result[2].choreography;directDailyCueMotion(result,'2026-10-24');assert.equal(result[2].choreography,supplied);
 const duo=directDailyCueMotion([clause(0),{...clause(8),speaker:1}],'2026-10-23');
 assert.notEqual(duo[0].choreography,duo[1].choreography);
 for(const p of [dailyProductionStudioConfig.palette,dailyProductionStudioConfig.secondaryPalette!]){
  assert.equal(p.posture,'standing');assert.equal(p.handStyle,'anatomical');assert.equal(p.finish,'sculpted');
 }
});
